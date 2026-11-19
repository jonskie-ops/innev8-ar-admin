-- INNEV8 QR Hunt: how the hunt is going, in numbers, for the Overview (it reads them again every 30 s).
-- One small answer instead of every find: players joined (and how many have found a code), finds so
-- far (each player's code once) and the latest, points earned and spent at the desk, prizes given, and
-- the stock left. Test mode as everywhere: with it off, test finds and test gives don't count.
-- Only the team can read it.

create function public.hunt_pulse() returns json
language sql stable security definer set search_path = ''
as $$
  with s as (select test_mode from public.settings limit 1),
  found as (
    select f.hunter_id, f.code_id, max(f.points) as points, max(f.at) as at
    from public.finds f, s
    where s.test_mode or not f.test
    group by f.hunter_id, f.code_id
  ),
  given as (
    select count(*) as n, coalesce(sum(cl.cost), 0) as spent
    from public.claims cl, s
    where cl.claimed_at is not null and cl.test = s.test_mode
  )
  select case when public.is_team() then json_build_object(
    'test', (select test_mode from s),
    'joined', (select count(*) from public.hunters),
    'hunting', (select count(distinct hunter_id) from found),
    'finds', (select count(*) from found),
    'last', (select max(at) from found),
    'earned', (select coalesce(sum(points), 0) from found),
    'spent', (select spent from given),
    'given', (select n from given),
    'stock', (select coalesce(sum(stock), 0) from public.prizes where live)
  ) end
$$;

revoke execute on function public.hunt_pulse() from public, anon;
grant execute on function public.hunt_pulse() to authenticated;
