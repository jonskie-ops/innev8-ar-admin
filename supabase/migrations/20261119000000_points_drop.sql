-- Points that drop as more people find a code, so finding codes early pays. With the event's switch
-- (settings.points_drop) on, the first `drop_full` finders of a code get its full points; after them,
-- every `drop_every` finders get 10% of its full points less, never below `drop_floor`% of them.
-- With 10 / 2 / 10%: #1–10 get 100, #11–12 get 90, #13–14 get 80 … and from #27 on, 10.
-- The switch starts off, so nothing changes in the game until it's turned on.
--
-- Each find already keeps the points it earned (finds.points), which the leaderboard, the desk and
-- the prize rules add up, so points already earned stay as they are. Test-mode finds are counted
-- apart from real ones, as everywhere. Run once in Supabase's SQL Editor.

alter table public.settings
  add column points_drop boolean not null default false,
  add column drop_full smallint not null default 10 check (drop_full between 1 and 1000),
  add column drop_every smallint not null default 2 check (drop_every between 1 and 1000),
  add column drop_floor smallint not null default 10 check (drop_floor between 1 and 100);

-- What the `p_place`th finder of a code worth `p_full` gets under these settings.
create function public.find_points(p_full int, p_place int, p_on boolean, p_first int, p_every int, p_floor int)
returns int
language sql immutable set search_path = ''
as $$
  select case
    when not p_on or p_place <= p_first then p_full
    else greatest(1, round(p_full * greatest(p_floor, 100 - 10 * ceil((p_place - p_first)::numeric / greatest(p_every, 1))) / 100.0))::int
  end
$$;

-- A find, as before (who, when the hunt is open, which code, where the phone was), now earning the
-- points its place among the code's finders gives. One find of a code at a time, so two players
-- scanning together can't share a place. Answers with the points earned.
create or replace function public.hunter_find(p_id uuid, p_secret text, p_code text, p_lat double precision, p_lng double precision, p_accuracy real)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  st public.settings;
  c public.codes;
  v_far double precision;
  v_place int;
  v_points int;
begin
  if not public.hunter_auth(p_id, p_secret) then return json_build_object('error', 'unknown'); end if;
  select * into st from public.settings limit 1;
  if not st.test_mode and (now() < st.starts_at or now() > st.ends_at + interval '1 hour') then
    return json_build_object('error', 'closed');
  end if;
  select c2.* into c from public.codes c2 join public.locations l on l.id = c2.location_id
  where c2.id = p_code and c2.live and l.live;
  if c.id is null then return json_build_object('error', 'code'); end if;
  if not st.random_spots and c.lat is not null then
    if p_lat is null or p_lng is null then return json_build_object('error', 'where'); end if;
    v_far := public.metres_between(p_lat, p_lng, c.lat, c.lng);
    if v_far > c.radius + 20 + least(greatest(coalesce(p_accuracy, 40), 0), 40) then
      return json_build_object('error', 'far', 'metres', round(v_far));
    end if;
  end if;
  -- Theirs already (sent again): the points it earned then
  select f.points into v_points from public.finds f where f.hunter_id = p_id and f.code_id = c.id and f.test = st.test_mode;
  if found then return json_build_object('ok', true, 'points', v_points); end if;
  perform pg_advisory_xact_lock(hashtext('find:' || c.id || ':' || st.test_mode::text));
  select count(*) into v_place from public.finds f where f.code_id = c.id and f.test = st.test_mode;
  v_points := public.find_points(c.points, v_place + 1, st.points_drop, st.drop_full, st.drop_every, st.drop_floor);
  insert into public.finds (hunter_id, code_id, test, points, legendary, lat, lng, accuracy)
  values (p_id, c.id, st.test_mode, v_points, c.rarity = 'legendary', p_lat, p_lng, p_accuracy)
  on conflict do nothing;
  return json_build_object('ok', true, 'points', v_points);
end $$;

-- Each code's finders so far and what the next finder would get (test finds while test mode is on,
-- real ones once it's off): the game shows it on codes not found yet, the admin on its codes list.
-- Players see only the codes that are on; the team sees them all.
create function public.code_worth()
returns table (code_id text, finders int, worth int)
language sql stable security definer set search_path = ''
as $$
  select c.id, coalesce(f.n, 0)::int,
    public.find_points(c.points, coalesce(f.n, 0)::int + 1, s.points_drop, s.drop_full, s.drop_every, s.drop_floor)
  from public.codes c
  cross join (select * from public.settings limit 1) s
  left join (
    select f.code_id, count(*) as n from public.finds f
    where f.test = (select s2.test_mode from public.settings s2 limit 1)
    group by f.code_id
  ) f on f.code_id = c.id
  where c.live or (select public.is_team())
$$;

revoke execute on function public.find_points(int, int, boolean, int, int, int) from public, anon, authenticated;
revoke execute on function public.code_worth() from public;
grant execute on function public.code_worth() to anon, authenticated;
