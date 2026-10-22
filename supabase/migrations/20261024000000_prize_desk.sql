-- INNEV8 QR Hunt: the prize desk. Until now a player's finds lived only on their phone, and the code
-- on their prize card was worked out there too: nothing could check it, so a prize could be claimed
-- again and again. Now:
--
-- - Each code a player collects is sent here (a find, against their hunter ID), and counts only if
--   their phone was near the code's GPS spot. Who won a prize is worked out here, from the finds.
-- - Each prize a player wins gets a claim code (on their prize card, as a QR and as text). At the
--   prize desk, staff look it up and give the prize: it's marked claimed (when, by whom) and the
--   prize's stock goes down by one, together, once. A second time is refused.
-- - Finds and claims made in test mode are kept apart: once test mode is off, they don't count, and
--   giving a prize in test mode doesn't touch the stock.
--
-- Security: finds and claims are closed to everyone but the team (who can read them). The game
-- reaches them only through hunter_find and hunter_prizes, which check the phone's secret; the desk
-- through desk_lookup, desk_give (the team: admins and staff) and desk_undo (admins).

-- ---------------------------------------------------------------- finds and claims
create table public.finds (
  hunter_id uuid not null references public.hunters (id) on delete cascade,
  -- No reference: a code turned off or deleted later stays found (as in the game)
  code_id text not null,
  -- Found while test mode was on
  test boolean not null,
  -- The code's, when it was found
  points int not null,
  legendary boolean not null,
  at timestamptz not null default now(),
  -- Where the phone was
  lat double precision,
  lng double precision,
  accuracy real,
  primary key (hunter_id, code_id, test)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  -- On the prize card (shown as XXXX-XXXX, and in its QR)
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  hunter_id uuid not null references public.hunters (id) on delete cascade,
  prize_id uuid not null references public.prizes (id) on delete cascade,
  test boolean not null,
  created_at timestamptz not null default now(),
  -- Given at the desk: when, and by whom
  claimed_at timestamptz,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_by_name text,
  unique (hunter_id, prize_id, test)
);
create index claims_given on public.claims (claimed_at desc) where claimed_at is not null;

alter table public.finds enable row level security;
alter table public.claims enable row level security;
create policy "Team reads finds" on public.finds for select to authenticated using ((select public.is_team()));
create policy "Team reads claims" on public.claims for select to authenticated using ((select public.is_team()));

-- ---------------------------------------------------------------- Recent changes: quiet when asked
-- The desk lowers a prize's stock as it gives it: that's its own line ("gave Tote bag to Ana"), not
-- "changed the stock of Tote bag" too. (As before, otherwise.)
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  o jsonb;
  k text;
  diff text[] := '{}';
  lbl text;
begin
  if current_setting('innev8.quiet', true) = 'on' then return null; end if;
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    for k in select jsonb_object_keys(r) loop
      continue when k in ('updated_at', 'updated_by', 'must_change_password', 'outlines');
      if r -> k is distinct from o -> k then
        diff := diff || case when k = 'live' then 'live:' || case when (r ->> k)::boolean then 'on' else 'off' end else k end;
      end if;
    end loop;
    if cardinality(diff) = 0 then return null; end if; -- saved without changes
  end if;
  lbl := case tg_table_name
    when 'codes' then '#' || lpad(r ->> 'num', 2, '0') || ' ' || (r ->> 'name')
    when 'settings' then 'the event'
    when 'team' then coalesce(nullif(r ->> 'name', ''), r ->> 'email')
    else r ->> 'name'
  end;
  insert into public.activity (user_id, who, what, action, label, changes)
  values (
    auth.uid(),
    coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System'),
    tg_table_name,
    case tg_op when 'INSERT' then 'added' when 'UPDATE' then 'changed' else 'removed' end,
    lbl,
    diff
  );
  return null;
end $$;

-- ---------------------------------------------------------------- working it out

-- Metres between two GPS spots
create function public.metres_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable set search_path = ''
as $$
  select 2 * 6371008.8 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- A new claim code: 8 letters and digits, none that look alike
create function public.claim_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text := '';
begin
  for i in 1..8 loop
    v := v || substr(abc, 1 + floor(random() * 32)::int, 1);
  end loop;
  return v;
end $$;

-- A hunter's standing, as the game works it out: `count` of the `total` codes in the game now (on,
-- at a location that's on), `finds` (every code found, on or not), `score`, and the legendary code.
-- With test mode off, finds made in test mode don't count.
create function public.hunter_standing(p_hunter uuid) returns json
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
  )
  select json_build_object(
    'count', (select count(*) from mine where code_id in (select id from game)),
    'total', (select count(*) from game),
    'finds', (select count(*) from mine),
    'score', (select coalesce(sum(points), 0) from mine),
    'legendary', (select coalesce(bool_or(legendary), false) from mine)
  )
$$;

-- Has this hunter won this prize? (Its rule, against their standing; as the game's prizeProgress.)
create function public.prize_won(p_hunter uuid, p_prize uuid) returns boolean
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
    else (s ->> 'score')::int >= p.rule_value
  end;
end $$;

-- ---------------------------------------------------------------- the functions the game calls

-- A code collected. It counts if the code is in the game and (unless the codes are at random spots,
-- or it has no GPS spot of its own) the phone was within its distance, with room for GPS error.
-- Outside the event's dates (test mode off) nothing counts, but a phone that was offline has an hour
-- after the end to send what it found.
create function public.hunter_find(p_id uuid, p_secret text, p_code text, p_lat double precision, p_lng double precision, p_accuracy real)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  st public.settings;
  c public.codes;
  v_far double precision;
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
  insert into public.finds (hunter_id, code_id, test, points, legendary, lat, lng, accuracy)
  values (p_id, c.id, st.test_mode, c.points, c.rarity = 'legendary', p_lat, p_lng, p_accuracy)
  on conflict do nothing;
  return json_build_object('ok', true);
end $$;

-- The hunter's standing and the prizes that are on: whether they've won each, and for one they've won
-- (or been given) its claim code, when it was given, and how many are left.
create function public.hunter_prizes(p_id uuid, p_secret text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  st public.settings;
begin
  if not public.hunter_auth(p_id, p_secret) then return json_build_object('error', 'unknown'); end if;
  select * into st from public.settings limit 1;
  insert into public.claims (code, hunter_id, prize_id, test)
  select public.claim_code(), p_id, p.id, st.test_mode
  from public.prizes p
  where p.live and public.prize_won(p_id, p.id)
  on conflict (hunter_id, prize_id, test) do nothing;
  return json_build_object(
    'standing', public.hunter_standing(p_id),
    'prizes', coalesce((
      select json_agg(json_build_object(
        'id', p.id,
        'won', public.prize_won(p_id, p.id),
        'code', cl.code,
        'claimed', cl.claimed_at,
        'left', p.stock
      ) order by p.sort, p.created_at)
      from public.prizes p
      left join public.claims cl on cl.prize_id = p.id and cl.hunter_id = p_id and cl.test = st.test_mode
      where p.live
    ), '[]')
  );
end $$;

-- ---------------------------------------------------------------- the prize desk (the team)

-- A claim code as typed or scanned ("k7m2-p9qx", or the QR's "INNEV8-PRIZE:K7M2P9QX"): its 8 characters
create function public.claim_code_of(p_text text) returns text
language sql immutable set search_path = ''
as $$
  select right(upper(regexp_replace(coalesce(p_text, ''), '[^A-Za-z0-9]', '', 'g')), 8)
$$;

-- What a claim code is: the player, the prize, their standing, whether they've won it, and whether
-- it's been given
create function public.desk_lookup(p_code text) returns json
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
    'hunter', json_build_object('id', h.id, 'name', h.name, 'province', h.province, 'tag', h.tag),
    'prize', json_build_object('id', p.id, 'name', p.name, 'photo', p.photo_path, 'rule', p.rule, 'value', p.rule_value, 'stock', p.stock, 'live', p.live),
    'standing', public.hunter_standing(h.id),
    'won', public.prize_won(h.id, p.id)
  );
end $$;

-- Gives the prize: once, to a player who's won it, while there's stock (a test claim: in test mode,
-- without touching the stock). Recent changes says who gave what to whom.
create function public.desk_give(p_code text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  cl public.claims;
  st public.settings;
  v_who text;
  v_left int;
  v_label text;
begin
  if not public.is_team() then return json_build_object('error', 'team'); end if;
  select * into cl from public.claims where code = public.claim_code_of(p_code) for update;
  if cl.id is null then return json_build_object('error', 'nocode'); end if;
  select * into st from public.settings limit 1;
  if cl.test and not st.test_mode then return json_build_object('error', 'test'); end if;
  if cl.claimed_at is not null then
    return json_build_object('error', 'claimed', 'at', cl.claimed_at, 'by', cl.claimed_by_name);
  end if;
  if not public.prize_won(cl.hunter_id, cl.prize_id) then return json_build_object('error', 'notwon'); end if;
  if not cl.test then
    perform set_config('innev8.quiet', 'on', true);
    update public.prizes set stock = stock - 1 where id = cl.prize_id and stock > 0 returning stock into v_left;
    perform set_config('innev8.quiet', 'off', true);
    if v_left is null then return json_build_object('error', 'nostock'); end if;
  end if;
  v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
  update public.claims set claimed_at = now(), claimed_by = auth.uid(), claimed_by_name = v_who where id = cl.id;
  select p.name || ' to ' || h.name into v_label
  from public.prizes p, public.hunters h where p.id = cl.prize_id and h.id = cl.hunter_id;
  insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'claims', 'added', v_label);
  return json_build_object('ok', true, 'left', v_left);
end $$;

-- Takes a prize back (given by mistake): it can be given again, and the stock goes back up (admins)
create function public.desk_undo(p_code text) returns json
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
  update public.claims set claimed_at = null, claimed_by = null, claimed_by_name = null where id = cl.id;
  v_who := coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System');
  select p.name || ' from ' || h.name into v_label
  from public.prizes p, public.hunters h where p.id = cl.prize_id and h.id = cl.hunter_id;
  insert into public.activity (user_id, who, what, action, label) values (auth.uid(), v_who, 'claims', 'removed', v_label);
  return json_build_object('ok', true);
end $$;

-- The prizes given lately (this mode's: test or not), newest first, and how many of each prize
create function public.desk_given(p_limit int default 30) returns json
language sql stable security definer set search_path = ''
as $$
  with s as (select test_mode from public.settings limit 1),
  given as (
    select cl.* from public.claims cl, s where cl.claimed_at is not null and cl.test = s.test_mode
  )
  select case when public.is_team() then json_build_object(
    'recent', coalesce((
      select json_agg(r order by r.at desc) from (
        select g.code, g.claimed_at as at, g.claimed_by_name as given_by, h.name as hunter, h.province, p.name as prize
        from given g join public.hunters h on h.id = g.hunter_id join public.prizes p on p.id = g.prize_id
        order by g.claimed_at desc limit greatest(1, least(p_limit, 200))
      ) r
    ), '[]'),
    'counts', coalesce((select json_object_agg(prize_id, n) from (select prize_id, count(*) as n from given group by prize_id) c), '{}')
  ) end
$$;

-- ---------------------------------------------------------------- who can call what
revoke execute on function public.metres_between(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.claim_code() from public, anon, authenticated;
revoke execute on function public.hunter_standing(uuid) from public, anon, authenticated;
revoke execute on function public.prize_won(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.claim_code_of(text) from public, anon, authenticated;
revoke execute on function public.hunter_find(uuid, text, text, double precision, double precision, real) from public;
revoke execute on function public.hunter_prizes(uuid, text) from public;
grant execute on function public.hunter_find(uuid, text, text, double precision, double precision, real) to anon, authenticated;
grant execute on function public.hunter_prizes(uuid, text) to anon, authenticated;
revoke execute on function public.desk_lookup(text) from public, anon;
revoke execute on function public.desk_give(text) from public, anon;
revoke execute on function public.desk_undo(text) from public, anon;
revoke execute on function public.desk_given(int) from public, anon;
grant execute on function public.desk_lookup(text) to authenticated;
grant execute on function public.desk_give(text) to authenticated;
grant execute on function public.desk_undo(text) to authenticated;
grant execute on function public.desk_given(int) to authenticated;
