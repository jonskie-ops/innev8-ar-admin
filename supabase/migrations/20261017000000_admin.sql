-- INNEV8 QR Hunt admin: what the organisers set for the game (QR codes, zones, prizes, the event),
-- who the organisers are, and a log of every change.
--
-- Security: row level security on every table. Players (the game, signed out) can only READ what's
-- live; only people on the team can see everything, and only team admins can change anything.
-- Staff are on the team but can't edit (they'll run the prize desk).

-- ---------------------------------------------------------------- team
create table public.team (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '' check (char_length(name) <= 60),
  role text not null default 'admin' check (role in ('admin', 'staff')),
  -- Added with a temporary password: they set their own at first sign-in
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.is_team() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team where user_id = auth.uid()) $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team where user_id = auth.uid() and role = 'admin') $$;

-- After setting their own password
create function public.password_changed() returns void
language sql security definer set search_path = ''
as $$ update public.team set must_change_password = false where user_id = auth.uid() $$;

revoke execute on function public.password_changed() from public, anon;

-- The team always keeps at least one admin
create function public.keep_an_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.team where role = 'admin') then
    raise exception 'The team needs at least one admin' using errcode = 'P0001';
  end if;
  return null;
end $$;

create trigger keep_an_admin after update or delete on public.team
for each statement execute function public.keep_an_admin();

-- ---------------------------------------------------------------- the hunt
create table public.zones (
  id text primary key check (id ~ '^[a-z0-9-]{1,24}$'),
  name text not null unique check (char_length(name) between 1 and 40),
  -- Where its name tag stands on the venue map (360×520 plan units); none: not labelled
  label_x real check (label_x between 0 and 360),
  label_y real check (label_y between 0 and 520),
  sort int not null default 0
);

create table public.codes (
  id text primary key check (id ~ '^[a-z0-9]{2,16}$'),
  -- The code's value: seeds its 3D pattern, and opens it as a /?s=<code> link
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  num int not null unique check (num between 1 and 99),
  name text not null check (char_length(name) between 1 and 40),
  zone_id text not null references public.zones (id) on update cascade,
  spot text not null default '' check (char_length(spot) <= 60),
  rarity text not null check (rarity in ('common', 'rare', 'legendary')),
  points int not null check (points between 0 and 10000),
  clue text not null default '' check (char_length(clue) <= 140),
  blurb text not null default '' check (char_length(blurb) <= 200),
  -- Position on the venue map (360×520 plan units, x right, y down)
  x real not null check (x between 0 and 360),
  y real not null check (y between 0 and 520),
  -- Off: hidden from the game
  live boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  -- In the "prizes" storage bucket
  photo_path text,
  -- Who wins: all the codes, N codes, the legendary code, or N points
  rule text not null default 'all' check (rule in ('all', 'count', 'legendary', 'points')),
  rule_value int check (rule_value between 1 and 100000),
  stock int not null default 0 check (stock between 0 and 100000),
  live boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check ((rule in ('count', 'points')) = (rule_value is not null))
);

-- One row
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- On: the hunt is playable before the event, with the test tools showing
  test_mode boolean not null default true,
  -- Where players claim prizes (on the game's prize card)
  claim_place text not null default 'INNEV8 help desk' check (char_length(claim_place) between 1 and 60),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (ends_at > starts_at)
);

create function public.stamp() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger stamp before update on public.codes for each row execute function public.stamp();
create trigger stamp before update on public.prizes for each row execute function public.stamp();
create trigger stamp before update on public.settings for each row execute function public.stamp();

-- ---------------------------------------------------------------- what changed, by whom
create table public.activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  who text not null,
  what text not null, -- the table
  action text not null check (action in ('added', 'changed', 'removed')),
  label text not null,
  -- For "changed": the fields that changed ("live:on" / "live:off" for the switch)
  changes text[] not null default '{}'
);

create index activity_at on public.activity (at desc);

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  o jsonb;
  k text;
  diff text[] := '{}';
  lbl text;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    for k in select jsonb_object_keys(r) loop
      continue when k in ('updated_at', 'updated_by', 'must_change_password');
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

create trigger log_activity after insert or update or delete on public.codes for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.zones for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.prizes for each row execute function public.log_activity();
create trigger log_activity after update on public.settings for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.team for each row execute function public.log_activity();

-- ---------------------------------------------------------------- who can read and change what
alter table public.team enable row level security;
alter table public.zones enable row level security;
alter table public.codes enable row level security;
alter table public.prizes enable row level security;
alter table public.settings enable row level security;
alter table public.activity enable row level security;

-- The game (anyone): what's live
create policy "Anyone reads zones" on public.zones for select to anon, authenticated using (true);
create policy "Anyone reads live codes" on public.codes for select to anon, authenticated
  using (live or (select public.is_team()));
create policy "Anyone reads live prizes" on public.prizes for select to anon, authenticated
  using (live or (select public.is_team()));
create policy "Anyone reads settings" on public.settings for select to anon, authenticated using (true);

-- The team: each other, and the log
create policy "Team reads the team" on public.team for select to authenticated using ((select public.is_team()));
create policy "Team reads the log" on public.activity for select to authenticated using ((select public.is_team()));

-- Admins: change everything
create policy "Admins add zones" on public.zones for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit zones" on public.zones for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove zones" on public.zones for delete to authenticated using ((select public.is_admin()));
create policy "Admins add codes" on public.codes for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit codes" on public.codes for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove codes" on public.codes for delete to authenticated using ((select public.is_admin()));
create policy "Admins add prizes" on public.prizes for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit prizes" on public.prizes for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove prizes" on public.prizes for delete to authenticated using ((select public.is_admin()));
create policy "Admins edit settings" on public.settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins add teammates" on public.team for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit teammates" on public.team for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove teammates" on public.team for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------- sign-in throttle
-- Wrong passwords, kept for a day: after 5 for one email (or 20 from one address) in 15 minutes the
-- admin stops trying for a while. Every sign-in reaches Supabase from the admin's server, so its own
-- per-address limit can't tell organisers apart. Only the server (secret key) reads or writes this.
create table public.sign_in_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  email text not null,
  ip text not null
);
create index sign_in_failures_email on public.sign_in_failures (email, at desc);
create index sign_in_failures_ip on public.sign_in_failures (ip, at desc);
alter table public.sign_in_failures enable row level security;

-- ---------------------------------------------------------------- prize photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prizes', 'prizes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- (removing a photo needs reading it too)
create policy "Admins see prize photos" on storage.objects for select to authenticated
  using (bucket_id = 'prizes' and (select public.is_admin()));
create policy "Admins add prize photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'prizes' and (select public.is_admin()));
create policy "Admins remove prize photos" on storage.objects for delete to authenticated
  using (bucket_id = 'prizes' and (select public.is_admin()));
