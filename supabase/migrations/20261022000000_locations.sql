-- INNEV8 QR Hunt: locations. The hunt can be played somewhere other than Leyte Academic Center: the
-- organisers add a location on the admin's Locations page (where it is, and how wide its map is),
-- and each QR code is at one. A location's map for the game is drawn from OpenStreetMap's buildings
-- and roads around it (`outlines`, made by the admin); Leyte Academic Center keeps the map drawn by
-- hand for the summit. Players see the codes of every location that's on.

create table public.locations (
  -- From the name when it's added; 'lac': Leyte Academic Center, the first
  id text primary key check (id ~ '^[a-z0-9-]{1,24}$' and id <> 'new'),
  name text not null check (char_length(name) between 1 and 60),
  address text not null default '' check (char_length(address) <= 120),
  -- The middle of its map
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- How wide its map is, in metres (west to east)
  width smallint not null default 300 check (width between 60 and 2000),
  -- Its map for the game: OpenStreetMap's buildings, roads and grounds around it, as drawings in the
  -- map's units ({ buildings, roads, grounds, count, at }); { drawing } while the admin draws it,
  -- { failed } if OpenStreetMap didn't answer; null: Leyte Academic Center's own
  outlines jsonb,
  -- Off: its codes are hidden from the game
  live boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Leyte Academic Center, where every code and zone is until now (before the log starts, so it isn't
-- "added" in Recent changes)
insert into public.locations (id, name, address, lat, lng, width, sort)
values ('lac', 'Leyte Academic Center', 'Barangay Pawing, Palo, Leyte', 11.17687, 125.003127, 100, 0);

-- A location's map is drawn in the background after it's moved (by the admin, from OpenStreetMap):
-- that isn't a change anyone made, so the log leaves `outlines` out (the move itself is logged)
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

create trigger stamp before update on public.locations for each row execute function public.stamp();
create trigger log_activity after insert or update or delete on public.locations for each row execute function public.log_activity();

-- Each code and zone is at a location (a location with codes can't be removed; its zones go with it)
alter table public.codes add column location_id text not null default 'lac' references public.locations (id) on update cascade;
alter table public.zones add column location_id text not null default 'lac' references public.locations (id) on update cascade on delete cascade;
create index codes_location on public.codes (location_id);
create index zones_location on public.zones (location_id);
-- Two locations can each have a "Main hall"
alter table public.zones drop constraint if exists zones_name_key;
alter table public.zones add constraint zones_location_name unique (location_id, name);

-- The game (anyone) reads the locations that are on, and only their codes
alter table public.locations enable row level security;
create policy "Anyone reads live locations" on public.locations for select to anon, authenticated
  using (live or (select public.is_team()));
create policy "Admins add locations" on public.locations for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit locations" on public.locations for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove locations" on public.locations for delete to authenticated using ((select public.is_admin()));

drop policy "Anyone reads live codes" on public.codes;
create policy "Anyone reads live codes" on public.codes for select to anon, authenticated
  using (
    (live and exists (select 1 from public.locations l where l.id = location_id and l.live))
    or (select public.is_team())
  );
