-- INNEV8 QR Hunt: catching up on …_desk_names.sql, which the live database never got. Its later
-- changes are already there (…_points_prizes.sql gave desk_give_to and desk_undo their newest form,
-- which keep the person's name in claims.given_to), but the column and the name helper they use are
-- missing, so giving a prize, taking one back and checking a winner (…_winner_check.sql) fail. This
-- adds only what's missing, and leaves the newer functions as they are. Safe to run more than once,
-- and on a database that did get …_desk_names.sql.

-- The person's name as the desk typed it from their ID
alter table public.claims add column if not exists given_to text
  check (given_to is null or char_length(given_to) between 1 and 80);

-- A name as the desk compares it: "  juan  DELA cruz " = "Juan Dela Cruz"
create or replace function public.person_key(p text) returns text
language sql immutable set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

create index if not exists claims_given_to on public.claims (prize_id, test, public.person_key(given_to)) where claimed_at is not null;

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

-- The old give (without the person's name) goes, as …_desk_names.sql did: desk_give_to replaces it
drop function if exists public.desk_give(text);
