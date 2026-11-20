-- INNEV8 QR Hunt: a prize with no rule of its own, "Nothing: the leaderboard decides, after the hunt"
-- ('board'). Players see it in the game (top hunters win it), but the game never gives it: no prize
-- card or claim code, and the desk can't give it by code. The organisers give it to the top hunters
-- on the final leaderboard themselves.

alter table public.prizes drop constraint prizes_rule_check;
alter table public.prizes add constraint prizes_rule_check
  check (rule in ('all', 'count', 'legendary', 'points', 'code', 'cost', 'board'));

-- Has this hunter won this prize? As before (…_points_prizes.sql); a leaderboard prize: never here.
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
    when 'board' then false
    else (s ->> 'score')::int >= p.rule_value
  end;
end $$;

revoke execute on function public.prize_won(uuid, uuid) from public, anon, authenticated;
