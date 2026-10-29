-- INNEV8 QR Hunt: the prize desk asks for the person's name (from their ID or summit badge) as it
-- gives a prize, and keeps it with the claim. One person playing as two hunters (incognito, a second
-- phone) could otherwise win the same prize twice: if that prize was already given to someone of the
-- same name, the desk says so (when, to which hunter, by whom) and gives it only when asked again (a
-- different person with the same name). Names are matched ignoring case and extra spaces.
--
-- Run it after the admin's update is live: the desk then gives through desk_give_to, and the old
-- desk_give (no name) goes.

alter table public.claims add column given_to text check (given_to is null or char_length(given_to) between 1 and 80);

-- A name as the desk compares it: "  juan  DELA cruz " = "Juan Dela Cruz"
create function public.person_key(p text) returns text
language sql immutable set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

create index claims_given_to on public.claims (prize_id, test, public.person_key(given_to)) where claimed_at is not null;

-- What a claim code is (as before), and who it was given to
create or replace function public.desk_lookup(p_code text) returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  cl public.claims;
  st public.settings;
  h public.hunters;
  p public.prizes;
begin
  if not public.is_team() then return json_build_object('error', 'team'); end if;
  select * into cl from public.claims where code = public.claim_code_of(p_code);
  if cl.id is null then return json_build_object('error', 'nocode'); end if;
  select * into st from public.settings limit 1;
  select * into h from public.hunters where id = cl.hunter_id;
  select * into p from public.prizes where id = cl.prize_id;
  return json_build_object(
    'code', cl.code,
    'test', cl.test,
    'testNow', st.test_mode,
    'claimedAt', cl.claimed_at,
    'claimedBy', cl.claimed_by_name,
    'givenTo', cl.given_to,
    'hunter', json_build_object('id', h.id, 'name', h.name, 'province', h.province, 'tag', h.tag),
    'prize', json_build_object('id', p.id, 'name', p.name, 'photo', p.photo_path, 'rule', p.rule, 'value', p.rule_value, 'stock', p.stock, 'live', p.live),
    'standing', public.hunter_standing(h.id),
    'won', public.prize_won(h.id, p.id)
  );
end $$;

-- Gives the prize to this person: as desk_give did (once, won, in stock), and first, unless
-- `p_again`, refuses a prize this person (by name) was already given as another hunter.
create function public.desk_give_to(p_code text, p_person text, p_again boolean default false) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  cl public.claims;
  st public.settings;
  v_person text := regexp_replace(btrim(coalesce(p_person, '')), '\s+', ' ', 'g');
  v_who text;
  v_left int;
  v_label text;
  r record;
begin
  if not public.is_team() then return json_build_object('error', 'team'); end if;
  if char_length(v_person) not between 1 and 80 then return json_build_object('error', 'noperson'); end if;
  select * into cl from public.claims where code = public.claim_code_of(p_code) for update;
  if cl.id is null then return json_build_object('error', 'nocode'); end if;
  select * into st from public.settings limit 1;
  if cl.test and not st.test_mode then return json_build_object('error', 'test'); end if;
  if cl.claimed_at is not null then
    return json_build_object('error', 'claimed', 'at', cl.claimed_at, 'by', cl.claimed_by_name, 'to', cl.given_to);
  end if;
  if not public.prize_won(cl.hunter_id, cl.prize_id) then return json_build_object('error', 'notwon'); end if;
  -- (two desks giving this prize to this name at once: one after the other)
  perform pg_advisory_xact_lock(hashtext(cl.prize_id::text || ':' || public.person_key(v_person)));
  if not p_again then
    select c.claimed_at, c.claimed_by_name, c.given_to, h.name, h.tag into r
    from public.claims c left join public.hunters h on h.id = c.hunter_id
    where c.prize_id = cl.prize_id and c.test = cl.test and c.claimed_at is not null
      and public.person_key(c.given_to) = public.person_key(v_person)
    order by c.claimed_at
    limit 1;
    if found then
      return json_build_object('error', 'repeat', 'at', r.claimed_at, 'by', r.claimed_by_name, 'to', r.given_to, 'hunter', r.name, 'tag', r.tag);
    end if;
  end if;
  if not cl.test then
    perform set_config('innev8.quiet', 'on', true);
    update public.prizes set stock = stock - 1 where id = cl.prize_id and stock > 0 returning stock into v_left;
    perform set_config('innev8.quiet', 'off', true);
    if v_left is null then return json_build_object('error', 'nostock'); end if;
  end if;
  v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
  update public.claims set claimed_at = now(), claimed_by = auth.uid(), claimed_by_name = v_who, given_to = v_person where id = cl.id;
  select p.name || ' to ' || h.name || ' (' || v_person || ')' into v_label
  from public.prizes p, public.hunters h where p.id = cl.prize_id and h.id = cl.hunter_id;
  insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'claims', 'added', v_label);
  return json_build_object('ok', true, 'left', v_left);
end $$;

-- Taking a prize back forgets who it was given to, too
create or replace function public.desk_undo(p_code text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  cl public.claims;
  v_who text;
  v_label text;
begin
  if not public.is_admin() then return json_build_object('error', 'admin'); end if;
  select * into cl from public.claims where code = public.claim_code_of(p_code) for update;
  if cl.id is null then return json_build_object('error', 'nocode'); end if;
  if cl.claimed_at is null then return json_build_object('error', 'notgiven'); end if;
  if not cl.test then
    perform set_config('innev8.quiet', 'on', true);
    update public.prizes set stock = stock + 1 where id = cl.prize_id;
    perform set_config('innev8.quiet', 'off', true);
  end if;
  update public.claims set claimed_at = null, claimed_by = null, claimed_by_name = null, given_to = null where id = cl.id;
  v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
  select p.name || ' from ' || h.name into v_label
  from public.prizes p, public.hunters h where p.id = cl.prize_id and h.id = cl.hunter_id;
  insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'claims', 'removed', v_label);
  return json_build_object('ok', true);
end $$;

-- Every give now has a name: the old way without one goes
drop function public.desk_give(text);

revoke execute on function public.desk_give_to(text, text, boolean) from public, anon;
grant execute on function public.desk_give_to(text, text, boolean) to authenticated;
