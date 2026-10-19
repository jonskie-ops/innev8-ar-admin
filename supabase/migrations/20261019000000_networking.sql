-- INNEV8 QR Hunt: networking. A QR code can have an extra task that players do before they can find
-- it: meet another hunter (any, or one from another province) by scanning their hunter QR, or take a
-- selfie together. So that a meeting can be checked, each player's phone gets a hunter ID (their name
-- and province, and a secret only the phone knows).
--
-- Security: the hunter tables are closed to everyone (row level security, no policies for the game).
-- The game reaches them only through the functions below, which check the phone's secret. The team
-- can count hunters and meetings, never read a secret.

-- ---------------------------------------------------------------- the extra task on a code
alter table public.codes add column task text not null default 'none'
  check (task in ('none', 'any', 'province', 'selfie'));

-- ---------------------------------------------------------------- hunters and their meetings
create table public.hunters (
  id uuid primary key default gen_random_uuid(),
  -- Under their hunter QR, to type in when a camera can't scan it
  tag text not null unique check (tag ~ '^[A-Z0-9]{5}$'),
  name text not null check (char_length(name) between 1 and 20),
  province text not null check (char_length(province) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Each hunter's phone keeps this: it proves who's asking, and makes their hunter QR's PIN
create table public.hunter_secrets (
  hunter_id uuid primary key references public.hunters (id) on delete cascade,
  secret text not null
);

-- Two hunters who met (one scanned the other's QR): it counts for both, once
create table public.meetings (
  a uuid not null references public.hunters (id) on delete cascade,
  b uuid not null references public.hunters (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

-- Wrong PINs: after 10 in 10 minutes, that hunter waits (so a PIN can't be guessed)
create table public.meet_failures (
  id bigint generated always as identity primary key,
  hunter_id uuid not null references public.hunters (id) on delete cascade,
  at timestamptz not null default now()
);
create index meet_failures_hunter on public.meet_failures (hunter_id, at desc);

alter table public.hunters enable row level security;
alter table public.hunter_secrets enable row level security;
alter table public.meetings enable row level security;
alter table public.meet_failures enable row level security;

create policy "Team reads hunters" on public.hunters for select to authenticated using ((select public.is_team()));
create policy "Team reads meetings" on public.meetings for select to authenticated using ((select public.is_team()));

-- ---------------------------------------------------------------- the functions the game calls

-- A hunter's PIN for one minute (minutes since 1970): from their secret, so it changes every minute.
-- The phone works out the same, offline: the first 7 hex digits of sha256("<secret>:<minute>"), mod 10000.
create function public.hunter_pin(p_secret text, p_minute bigint) returns text
language sql immutable set search_path = ''
as $$
  select lpad(((('x' || substr(encode(sha256(convert_to(p_secret || ':' || p_minute, 'UTF8')), 'hex'), 1, 7))::bit(28)::int) % 10000)::text, 4, '0')
$$;

-- Is this the hunter's own phone?
create function public.hunter_auth(p_id uuid, p_secret text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.hunter_secrets where hunter_id = p_id and secret = p_secret) $$;

-- A new hunter (when a player signs up): their ID, tag and secret
create function public.hunter_join(p_name text, p_province text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_name text := trim(coalesce(p_name, ''));
  v_province text := trim(coalesce(p_province, ''));
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_tag text;
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 20 or char_length(v_province) not between 1 and 40 then
    return json_build_object('error', 'details');
  end if;
  loop
    v_tag := '';
    for i in 1..5 loop
      v_tag := v_tag || substr(abc, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.hunters where tag = v_tag);
  end loop;
  insert into public.hunters (tag, name, province) values (v_tag, v_name, v_province) returning id into v_id;
  insert into public.hunter_secrets (hunter_id, secret) values (v_id, v_secret);
  return json_build_object('id', v_id, 'tag', v_tag, 'secret', v_secret);
end $$;

-- A hunter changed their name or province
create function public.hunter_update(p_id uuid, p_secret text, p_name text, p_province text) returns json
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.hunter_auth(p_id, p_secret) then return json_build_object('error', 'unknown'); end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 20 or char_length(trim(coalesce(p_province, ''))) not between 1 and 40 then
    return json_build_object('error', 'details');
  end if;
  update public.hunters set name = trim(p_name), province = trim(p_province) where id = p_id;
  return json_build_object('ok', true);
end $$;

-- One hunter scanned (or typed) another's tag and PIN: if it's right, they've met
create function public.hunter_meet(p_id uuid, p_secret text, p_tag text, p_pin text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_other public.hunters;
  v_secret text;
  v_minute bigint := floor(extract(epoch from now()) / 60);
  v_ok boolean := false;
  v_rows int;
begin
  if not public.hunter_auth(p_id, p_secret) then return json_build_object('error', 'unknown'); end if;
  if (select count(*) from public.meet_failures where hunter_id = p_id and at > now() - interval '10 minutes') >= 10 then
    return json_build_object('error', 'wait');
  end if;
  select * into v_other from public.hunters where tag = upper(trim(coalesce(p_tag, '')));
  if v_other.id is not null then
    if v_other.id = p_id then return json_build_object('error', 'self'); end if;
    select secret into v_secret from public.hunter_secrets where hunter_id = v_other.id;
    -- A few minutes either way, for phones whose clocks are a little off
    for m in v_minute - 2 .. v_minute + 2 loop
      if public.hunter_pin(v_secret, m) = trim(coalesce(p_pin, '')) then
        v_ok := true;
        exit;
      end if;
    end loop;
  end if;
  if not v_ok then
    insert into public.meet_failures (hunter_id) values (p_id);
    delete from public.meet_failures where at < now() - interval '1 day';
    return json_build_object('error', 'nomatch');
  end if;
  insert into public.meetings (a, b) values (least(p_id, v_other.id), greatest(p_id, v_other.id))
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return json_build_object(
    'ok', true,
    'again', v_rows = 0,
    'hunter', json_build_object('id', v_other.id, 'name', v_other.name, 'province', v_other.province)
  );
end $$;

-- Everyone a hunter has met (either of them scanning), first met first
create function public.hunter_meetings(p_id uuid, p_secret text) returns json
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.hunter_auth(p_id, p_secret) then return json_build_object('error', 'unknown'); end if;
  return (
    select coalesce(json_agg(json_build_object('id', h.id, 'name', h.name, 'province', h.province, 'at', m.at) order by m.at), '[]')
    from public.meetings m
    join public.hunters h on h.id = case when m.a = p_id then m.b else m.a end
    where p_id in (m.a, m.b)
  );
end $$;

-- For the admin's overview: how many hunters, and how many meetings
create function public.hunter_stats() returns json
language sql stable security definer set search_path = ''
as $$
  select case when public.is_team() then
    json_build_object('hunters', (select count(*) from public.hunters), 'meetings', (select count(*) from public.meetings))
  end
$$;

revoke execute on function public.hunter_pin(text, bigint) from public, anon, authenticated;
revoke execute on function public.hunter_auth(uuid, text) from public, anon, authenticated;
revoke execute on function public.hunter_stats() from public, anon;
grant execute on function public.hunter_stats() to authenticated;
revoke execute on function public.hunter_join(text, text) from public;
revoke execute on function public.hunter_update(uuid, text, text, text) from public;
revoke execute on function public.hunter_meet(uuid, text, text, text) from public;
revoke execute on function public.hunter_meetings(uuid, text) from public;
grant execute on function public.hunter_join(text, text) to anon, authenticated;
grant execute on function public.hunter_update(uuid, text, text, text) to anon, authenticated;
grant execute on function public.hunter_meet(uuid, text, text, text) to anon, authenticated;
grant execute on function public.hunter_meetings(uuid, text) to anon, authenticated;
