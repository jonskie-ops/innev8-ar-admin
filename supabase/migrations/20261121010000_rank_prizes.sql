-- INNEV8 QR Hunt: a prize for a place on the leaderboard ('rank', its number the place: #1, #2…). Like
-- "the leaderboard decides" ('board'): never won in the game (no prize card or claim code); the
-- desk's winner check (…_winner_check.sql) lists it with its place and picks it for the player in
-- that place. Safe to run more than once.

alter table public.prizes drop constraint if exists prizes_rule_check;
alter table public.prizes add constraint prizes_rule_check
  check (rule in ('all', 'count', 'legendary', 'points', 'code', 'cost', 'board', 'rank'));
alter table public.prizes drop constraint if exists prizes_rule_value_needed;
alter table public.prizes add constraint prizes_rule_value_needed
  check ((rule in ('count', 'points', 'cost', 'rank')) = (rule_value is not null));

-- Has this hunter won this prize? As before (…_leaderboard_prizes.sql); a leaderboard place: never here.
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
    when 'rank' then false
    else (s ->> 'score')::int >= p.rule_value
  end;
end $$;
revoke execute on function public.prize_won(uuid, uuid) from public, anon, authenticated;

-- The winner check (…_winner_check.sql), with leaderboard places too: listed with their place
create or replace function public.desk_winner(p_tag text, p_pin text) returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid;
  h public.hunters;
  v_secret text;
  st public.settings;
  v_board json;
begin
  if not public.is_team() then return json_build_object('error', 'team'); end if;
  v_id := public.hunter_by_badge(p_tag, p_pin);
  if v_id is null then
    return json_build_object('error',
      case when exists (select 1 from public.hunters where tag = upper(btrim(coalesce(p_tag, '')))) then 'pin' else 'tag' end);
  end if;
  select * into h from public.hunters where id = v_id;
  select secret into v_secret from public.hunter_secrets where hunter_id = v_id;
  select * into st from public.settings limit 1;
  v_board := public.leaderboard(v_id, v_secret, 1);
  return json_build_object(
    'hunter', json_build_object('id', h.id, 'name', h.name, 'province', h.province, 'tag', h.tag),
    'test', st.test_mode,
    'final', coalesce((v_board ->> 'final')::boolean, false),
    'me', v_board -> 'me',
    'checked', coalesce((
      select json_agg(json_build_object('prize', p.name, 'at', cl.claimed_at, 'by', cl.claimed_by_name, 'to', cl.given_to) order by cl.claimed_at)
      from public.claims cl join public.prizes p on p.id = cl.prize_id
      where cl.hunter_id = v_id and cl.claimed_at is not null and cl.test = st.test_mode and p.rule in ('board', 'rank')
    ), '[]'),
    'prizes', coalesce((
      select json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'stock', p.stock,
        'rank', case when p.rule = 'rank' then p.rule_value end,
        'to', (
          select h2.name from public.claims c2 join public.hunters h2 on h2.id = c2.hunter_id
          where c2.prize_id = p.id and c2.claimed_at is not null and c2.test = st.test_mode
          order by c2.claimed_at desc limit 1
        )
      ) order by p.sort, p.created_at)
      from public.prizes p
      where p.live and p.rule in ('board', 'rank')
    ), '[]')
  );
end $$;

create or replace function public.desk_check_winner(p_tag text, p_pin text, p_prize uuid, p_person text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  st public.settings;
  pr public.prizes;
  v_person text := regexp_replace(btrim(coalesce(p_person, '')), '\s+', ' ', 'g');
  v_who text;
  v_left int;
  r record;
begin
  if not public.is_team() then return json_build_object('error', 'team'); end if;
  if char_length(v_person) not between 1 and 80 then return json_build_object('error', 'noperson'); end if;
  v_id := public.hunter_by_badge(p_tag, p_pin);
  if v_id is null then return json_build_object('error', 'pin'); end if;
  select * into st from public.settings limit 1;
  select * into pr from public.prizes where id = p_prize for update;
  if pr.id is null or not pr.live or pr.rule not in ('board', 'rank') then return json_build_object('error', 'noprize'); end if;
  -- (one check at a time for this player)
  perform pg_advisory_xact_lock(hashtext('wallet:' || v_id::text));
  select p.name, cl.claimed_at, cl.claimed_by_name into r
  from public.claims cl join public.prizes p on p.id = cl.prize_id
  where cl.hunter_id = v_id and cl.claimed_at is not null and cl.test = st.test_mode and p.rule in ('board', 'rank')
  limit 1;
  if found then
    return json_build_object('error', 'already', 'prize', r.name, 'at', r.claimed_at, 'by', r.claimed_by_name);
  end if;
  if not st.test_mode then
    perform set_config('innev8.quiet', 'on', true);
    update public.prizes set stock = stock - 1 where id = pr.id and stock > 0 returning stock into v_left;
    perform set_config('innev8.quiet', 'off', true);
    if v_left is null then return json_build_object('error', 'nostock'); end if;
  end if;
  v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
  insert into public.claims (code, hunter_id, prize_id, test, claimed_at, claimed_by, claimed_by_name, given_to)
  values (public.claim_code(), v_id, pr.id, st.test_mode, now(), auth.uid(), v_who, v_person)
  on conflict (hunter_id, prize_id, test) do update
    set claimed_at = now(), claimed_by = auth.uid(), claimed_by_name = v_who, given_to = v_person;
  insert into public.activity (user_id, who, what, action, label)
  select auth.uid(), v_who, 'claims', 'added', pr.name || ' to ' || h.name || ' (' || v_person || ') · leaderboard'
  from public.hunters h where h.id = v_id;
  return json_build_object('ok', true, 'left', v_left);
end $$;

revoke execute on function public.desk_winner(text, text) from public, anon;
grant execute on function public.desk_winner(text, text) to authenticated;
revoke execute on function public.desk_check_winner(text, text, uuid, text) from public, anon;
grant execute on function public.desk_check_winner(text, text, uuid, text) to authenticated;
