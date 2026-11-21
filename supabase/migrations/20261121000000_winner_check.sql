-- INNEV8 QR Hunt: checking a winner at the prize desk by their hunter QR (the game's Me tab: their tag
-- and a PIN that changes every minute, so a screenshot stops working). The desk scans it with the
-- floating scan button:
--
-- - desk_winner: whose QR it is (if its PIN is right now, a few minutes either way for phone clocks),
--   their rank and points on the leaderboard, whether they've been checked already, and the
--   leaderboard prizes ("the leaderboard decides", …_leaderboard_prizes.sql) with who has each.
-- - desk_check_winner: marks them checked with the leaderboard prize they get: once per player (no one
--   gets two), while there's stock (test mode as at the desk: the stock stays), with the person's name
--   from their ID, one line in Recent changes. It's a given claim like any other, so the player's
--   phone sees it (hunter_prizes: claimed) and says so, and Every prize given lists it.
-- Only the team. A take-back (admins) is as for any prize, by its claim code.

-- Whose hunter QR this is, if its PIN is right now (null: no such tag, or a wrong or old PIN)
create function public.hunter_by_badge(p_tag text, p_pin text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_secret text;
  v_minute bigint := floor(extract(epoch from now()) / 60);
begin
  select h.id, s.secret into v_id, v_secret
  from public.hunters h join public.hunter_secrets s on s.hunter_id = h.id
  where h.tag = upper(btrim(coalesce(p_tag, '')));
  if v_id is null then return null; end if;
  for m in v_minute - 2 .. v_minute + 2 loop
    if public.hunter_pin(v_secret, m) = btrim(coalesce(p_pin, '')) then return v_id; end if;
  end loop;
  return null;
end $$;
revoke execute on function public.hunter_by_badge(text, text) from public, anon, authenticated;

-- A scanned hunter QR, for the desk: the player, their place on the leaderboard, their check, the prizes
create function public.desk_winner(p_tag text, p_pin text) returns json
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
      where cl.hunter_id = v_id and cl.claimed_at is not null and cl.test = st.test_mode and p.rule = 'board'
    ), '[]'),
    'prizes', coalesce((
      select json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'stock', p.stock,
        'to', (
          select h2.name from public.claims c2 join public.hunters h2 on h2.id = c2.hunter_id
          where c2.prize_id = p.id and c2.claimed_at is not null and c2.test = st.test_mode
          order by c2.claimed_at desc limit 1
        )
      ) order by p.sort, p.created_at)
      from public.prizes p
      where p.live and p.rule = 'board'
    ), '[]')
  );
end $$;

-- Checked: this player gets this leaderboard prize (once each, while there's stock)
create function public.desk_check_winner(p_tag text, p_pin text, p_prize uuid, p_person text) returns json
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
  if pr.id is null or not pr.live or pr.rule <> 'board' then return json_build_object('error', 'noprize'); end if;
  -- (one check at a time for this player)
  perform pg_advisory_xact_lock(hashtext('wallet:' || v_id::text));
  select p.name, cl.claimed_at, cl.claimed_by_name into r
  from public.claims cl join public.prizes p on p.id = cl.prize_id
  where cl.hunter_id = v_id and cl.claimed_at is not null and cl.test = st.test_mode and p.rule = 'board'
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
