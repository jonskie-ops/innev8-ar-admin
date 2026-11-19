-- INNEV8 QR Hunt: clean up test play in one go (Settings, by test mode). Removes every test find,
-- every test prize card (given or not: test gives never touched the stock), and the test players.
--
-- A test player joined before the hunt's start (until then the game only lets people in with test
-- mode on) and has nothing real: no real find, no real prize card. Anyone with a real find or card
-- stays (only their test finds and cards go), and so does everyone who joined after the start.
-- Real finds and real prizes given are never touched.
--
-- test_play() counts what would go (anyone on the team); test_play(true) removes it (admins only),
-- with one line in Recent changes.

-- What counts as test play now
create function public.test_players() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select h.id
  from public.hunters h, public.settings st
  where h.created_at < st.starts_at
    and not exists (select 1 from public.finds f where f.hunter_id = h.id and not f.test)
    and not exists (select 1 from public.claims c where c.hunter_id = h.id and not c.test)
$$;
revoke execute on function public.test_players() from public, anon, authenticated;

create function public.test_play(p_remove boolean default false) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_finds int;
  v_cards int;
  v_players int;
  v_ids uuid[];
  v_who text;
  v_parts text[] := '{}';
  v_label text;
begin
  if not public.is_team() then return json_build_object('error', 'team'); end if;
  if p_remove and not public.is_admin() then return json_build_object('error', 'admin'); end if;
  -- (one clean-up at a time)
  if p_remove then perform pg_advisory_xact_lock(hashtext('test-cleanup')); end if;

  select coalesce(array_agg(id), '{}') into v_ids from public.test_players() as id;
  select count(*) into v_finds from public.finds where test;
  select count(*) into v_cards from public.claims where test;
  v_players := cardinality(v_ids);

  if p_remove and (v_finds + v_cards + v_players) > 0 then
    delete from public.claims where test;
    delete from public.finds where test;
    -- (their meetings and secrets go with them; one line in Recent changes for all of it, below)
    perform set_config('innev8.quiet', 'on', true);
    delete from public.hunters where id = any(v_ids);
    perform set_config('innev8.quiet', 'off', true);

    if v_finds > 0 then v_parts := v_parts || (v_finds || ' find' || case when v_finds = 1 then '' else 's' end); end if;
    if v_cards > 0 then v_parts := v_parts || (v_cards || ' prize card' || case when v_cards = 1 then '' else 's' end); end if;
    if v_players > 0 then v_parts := v_parts || (v_players || ' player' || case when v_players = 1 then '' else 's' end); end if;
    v_label := case cardinality(v_parts)
      when 1 then v_parts[1]
      when 2 then v_parts[1] || ' and ' || v_parts[2]
      else v_parts[1] || ', ' || v_parts[2] || ' and ' || v_parts[3]
    end;
    v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
    insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'test', 'removed', v_label);
  end if;

  return json_build_object('finds', v_finds, 'cards', v_cards, 'players', v_players, 'removed', p_remove);
end $$;

revoke execute on function public.test_play(boolean) from public, anon;
grant execute on function public.test_play(boolean) to authenticated;

-- Hunters removed by the clean-up: its own line says so (the usual "removed N hunters" stays quiet).
-- Otherwise as in …_hunter_leave.sql.
create or replace function public.log_hunters_removed() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  n int;
  one text;
begin
  if current_setting('innev8.quiet', true) = 'on' then return null; end if;
  select count(*), min(name) into n, one from gone;
  if n = 0 then return null; end if;
  insert into public.activity (user_id, who, what, action, label)
  values (
    auth.uid(),
    coalesce(
      (select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()),
      nullif(current_setting('app.who', true), ''),
      'System'
    ),
    'hunters',
    'removed',
    case when n = 1 then one else n || ' hunters' end
  );
  return null;
end $$;
