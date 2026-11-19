-- INNEV8 QR Hunt: prizes that cost points. A new kind of prize, "Costs N points": a player can get it
-- once they have N points to spend, and the prize desk takes those N points when it gives it. Points
-- spent are a wallet apart from the score: the leaderboard and "Reach N points" prizes still go by
-- every point earned.
--
-- - Points to spend = the score (each confirmed find, at the points it earned) − the points spent
--   (on points prizes given at the desk). Test mode as everywhere: with it off, test finds and test
--   gives don't count.
-- - A points prize is once per player, like the others (a prize card with a claim code). Its card
--   shows while they have enough; the desk checks again as it gives, takes the points with the
--   prize, and remembers what it cost then (a price changed later doesn't change what was spent).
--   Taking a prize back (admins) gives the points back.
-- - Two desks giving one player two points prizes at once: one after the other, so nobody spends
--   more than they have.
-- - The prize desk page shows the points players still have to spend, and the points spent.

-- ---------------------------------------------------------------- the new kind of prize
alter table public.prizes drop constraint prizes_rule_check;
alter table public.prizes add constraint prizes_rule_check check (rule in ('all', 'count', 'legendary', 'points', 'code', 'cost'));
-- (the number goes with "count", "points" and now "cost": the old check, whatever its name, goes)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.prizes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%rule_value IS NOT NULL%'
  loop
    execute format('alter table public.prizes drop constraint %I', c);
  end loop;
end $$;
alter table public.prizes add constraint prizes_rule_value_needed check ((rule in ('count', 'points', 'cost')) = (rule_value is not null));

-- What a points prize cost when it was given (null: any other prize)
alter table public.claims add column cost int check (cost is null or cost between 1 and 100000);

-- ---------------------------------------------------------------- the wallet
-- A hunter's standing (as before) and now `spent` (points spent at the desk) and `balance` (to spend)
create or replace function public.hunter_standing(p_hunter uuid) returns json
language sql stable security definer set search_path = ''
as $$
  with s as (select test_mode from public.settings limit 1),
  game as (
    select c.id from public.codes c join public.locations l on l.id = c.location_id where c.live and l.live
  ),
  mine as (
    select f.code_id, max(f.points) as points, bool_or(f.legendary) as legendary
    from public.finds f, s
    where f.hunter_id = p_hunter and (s.test_mode or not f.test)
    group by f.code_id
  ),
  score as (select coalesce(sum(points), 0)::int as n from mine),
  spent as (
    select coalesce(sum(cl.cost), 0)::int as n
    from public.claims cl, s
    where cl.hunter_id = p_hunter and cl.claimed_at is not null and cl.cost is not null and cl.test = s.test_mode
  )
  select json_build_object(
    'count', (select count(*) from mine where code_id in (select id from game)),
    'total', (select count(*) from game),
    'finds', (select count(*) from mine),
    'score', (select n from score),
    'legendary', (select coalesce(bool_or(legendary), false) from mine),
    'spent', (select n from spent),
    'balance', (select score.n - spent.n from score, spent)
  )
$$;

-- Has this hunter won this prize? A points prize: given to them already, or they have its points to spend.
create or replace function public.prize_won(p_hunter uuid, p_prize uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  s json := public.hunter_standing(p_hunter);
  p public.prizes;
begin
  select * into p from public.prizes where id = p_prize;
  if p.id is null then return false; end if;
  return case p.rule
    when 'all' then (s ->> 'total')::int > 0 and (s ->> 'count')::int >= (s ->> 'total')::int
    when 'count' then (s ->> 'finds')::int >= p.rule_value
    when 'legendary' then (s ->> 'legendary')::boolean
    when 'code' then exists (
      select 1 from public.finds f, public.settings st
      where f.hunter_id = p_hunter and f.code_id = p.rule_code and (st.test_mode or not f.test)
    )
    when 'cost' then (s ->> 'balance')::int >= p.rule_value or exists (
      select 1 from public.claims cl, public.settings st
      where cl.hunter_id = p_hunter and cl.prize_id = p.id and cl.claimed_at is not null and cl.test = st.test_mode
    )
    else (s ->> 'score')::int >= p.rule_value
  end;
end $$;

-- ---------------------------------------------------------------- the desk takes the points
-- Gives the prize to this person (as before); a points prize takes its points, checked again now with
-- this player's other gives held back until it's done.
create or replace function public.desk_give_to(p_code text, p_person text, p_again boolean default false) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  cl public.claims;
  st public.settings;
  pr public.prizes;
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
  -- (one give at a time for this player: their points are checked and spent once)
  perform pg_advisory_xact_lock(hashtext('wallet:' || cl.hunter_id::text));
  select * into st from public.settings limit 1;
  select * into pr from public.prizes where id = cl.prize_id;
  if cl.test and not st.test_mode then return json_build_object('error', 'test'); end if;
  if cl.claimed_at is not null then
    return json_build_object('error', 'claimed', 'at', cl.claimed_at, 'by', cl.claimed_by_name, 'to', cl.given_to);
  end if;
  if not public.prize_won(cl.hunter_id, cl.prize_id) then
    return json_build_object('error', case when pr.rule = 'cost' then 'points' else 'notwon' end);
  end if;
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
  update public.claims
  set claimed_at = now(), claimed_by = auth.uid(), claimed_by_name = v_who, given_to = v_person,
      cost = case when pr.rule = 'cost' then pr.rule_value end
  where id = cl.id;
  select p.name || ' to ' || h.name || ' (' || v_person || ')' ||
         case when pr.rule = 'cost' then ' for ' || pr.rule_value || ' points' else '' end into v_label
  from public.prizes p, public.hunters h where p.id = cl.prize_id and h.id = cl.hunter_id;
  insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'claims', 'added', v_label);
  return json_build_object('ok', true, 'left', v_left, 'cost', case when pr.rule = 'cost' then pr.rule_value end);
end $$;

-- Taking a prize back gives its points back too (they're no longer spent)
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
  perform pg_advisory_xact_lock(hashtext('wallet:' || cl.hunter_id::text));
  if not cl.test then
    perform set_config('innev8.quiet', 'on', true);
    update public.prizes set stock = stock + 1 where id = cl.prize_id;
    perform set_config('innev8.quiet', 'off', true);
  end if;
  update public.claims set claimed_at = null, claimed_by = null, claimed_by_name = null, given_to = null, cost = null where id = cl.id;
  v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
  select p.name || ' from ' || h.name || case when cl.cost is not null then ' (' || cl.cost || ' points back)' else '' end into v_label
  from public.prizes p, public.hunters h where p.id = cl.prize_id and h.id = cl.hunter_id;
  insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'claims', 'removed', v_label);
  return json_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- the desk's totals
-- Points earned by every player, spent at the desk, and still to spend (this mode's: test or not)
create function public.desk_points() returns json
language sql stable security definer set search_path = ''
as $$
  with s as (select test_mode from public.settings limit 1),
  mine as (
    select f.hunter_id, f.code_id, max(f.points) as points
    from public.finds f, s
    where s.test_mode or not f.test
    group by f.hunter_id, f.code_id
  ),
  earned as (select coalesce(sum(points), 0)::bigint as n from mine),
  spent as (
    select coalesce(sum(cl.cost), 0)::bigint as n
    from public.claims cl, s
    where cl.claimed_at is not null and cl.cost is not null and cl.test = s.test_mode
  )
  select case when public.is_team() then json_build_object(
    'earned', (select n from earned),
    'spent', (select n from spent),
    'unspent', (select earned.n - spent.n from earned, spent)
  ) end
$$;

revoke execute on function public.desk_points() from public, anon;
grant execute on function public.desk_points() to authenticated;
-- (as before: the standing and the rules check only from inside the database)
revoke execute on function public.hunter_standing(uuid) from public, anon, authenticated;
revoke execute on function public.prize_won(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.desk_give_to(text, text, boolean) from public, anon;
grant execute on function public.desk_give_to(text, text, boolean) to authenticated;
revoke execute on function public.desk_undo(text) from public, anon;
grant execute on function public.desk_undo(text) to authenticated;
