-- INNEV8 QR Hunt: the leaderboard. The game shows the top hunters (a trophy chip with the player's
-- own rank in its top bar opens it), worked out here from the confirmed finds (the same ones the
-- prize desk goes by, so a code that didn't count doesn't count here either):
--
-- - Ranked by points (each code once, at its points), then codes found, then whoever got there first.
-- - Each row: their rank, name and province (as they signed up), points and codes found.
-- - Test mode as everywhere: once it's off, finds made in test mode don't count.
-- - Final results: from the hunt's end (test mode off), finds sent after it don't change the board
--   (a phone that was offline still has an hour to send them, for the prize desk).
--
-- Security: the board itself is public (as the game shows it to every player). The player's own
-- rank needs their hunter ID and the secret only their phone has; without them there's none.

create function public.leaderboard(p_id uuid default null, p_secret text default null, p_limit int default 20)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  st public.settings;
  v_final boolean;
  v_me uuid;
  v_out json;
begin
  select * into st from public.settings limit 1;
  v_final := not st.test_mode and now() >= st.ends_at;
  if p_id is not null and public.hunter_auth(p_id, coalesce(p_secret, '')) then v_me := p_id; end if;
  with mine as (
    select f.hunter_id, f.code_id, max(f.points) as points, min(f.at) as at
    from public.finds f
    where (st.test_mode or not f.test) and (not v_final or f.at <= st.ends_at)
    group by f.hunter_id, f.code_id
  ),
  per as (
    select hunter_id, sum(points)::int as score, count(*)::int as codes, max(at) as reached
    from mine
    group by hunter_id
  ),
  ranked as (
    select row_number() over (order by p.score desc, p.codes desc, p.reached, h.created_at) as rank,
           h.id, h.name, h.province, p.score, p.codes
    from per p join public.hunters h on h.id = p.hunter_id
  )
  select json_build_object(
    'final', v_final,
    'players', (select count(*) from ranked),
    'top', coalesce((
      select json_agg(json_build_object(
        'rank', r.rank, 'name', r.name, 'province', r.province, 'score', r.score, 'codes', r.codes, 'me', coalesce(r.id = v_me, false)
      ) order by r.rank)
      from ranked r
      where r.rank <= greatest(1, least(coalesce(p_limit, 20), 50))
    ), '[]'),
    'me', (select json_build_object('rank', r.rank, 'score', r.score, 'codes', r.codes) from ranked r where r.id = v_me)
  ) into v_out;
  return v_out;
end $$;

revoke execute on function public.leaderboard(uuid, text, int) from public;
grant execute on function public.leaderboard(uuid, text, int) to anon, authenticated;
