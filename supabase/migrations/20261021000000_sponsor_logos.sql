-- INNEV8 QR Hunt: sponsors the organisers keep themselves, on the admin's Sponsors page: add one
-- (a name and a logo), change its logo, take it off. Until now the sponsors came with the game.
--
-- Each sponsor's logo is a round badge (the admin makes it from the logo they choose) in the
-- "sponsors" storage bucket. The first 8 start with the badges that came with the game and the
-- admin (badge_path null) until a new logo is chosen for them.

create table public.sponsors (
  -- From the name when it's added; what codes.sponsor holds
  id text primary key check (id ~ '^[a-z0-9-]{1,32}$' and id not in ('none', 'new')),
  name text not null check (char_length(name) between 1 and 40),
  -- In the "sponsors" storage bucket; null: the badge that came with the game (the first sponsors)
  badge_path text check (badge_path ~ '^[a-z0-9-]{1,64}\.(webp|png)$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- The first sponsors, as the game and admin have had them (before the log starts, so they aren't
-- "added" in Recent changes)
insert into public.sponsors (id, name) values
  ('converge', 'Converge'),
  ('dost', 'DOST'),
  ('gcash', 'GCash'),
  ('globe', 'Globe'),
  ('oppo', 'OPPO'),
  ('prodigy', 'Prodigy'),
  ('samsung', 'Samsung'),
  ('symphonics', 'Symphonics');

create trigger stamp before update on public.sponsors for each row execute function public.stamp();
create trigger log_activity after insert or update or delete on public.sponsors for each row execute function public.log_activity();

-- A sponsor taken off: the codes that had them have none (logged as a change to each code)
create function public.unsponsor() returns trigger
language plpgsql set search_path = ''
as $$
begin
  update public.codes set sponsor = 'none' where sponsor = old.id;
  return old;
end $$;

create trigger unsponsor before delete on public.sponsors for each row execute function public.unsponsor();

-- The game (anyone) reads them all; admins change them
alter table public.sponsors enable row level security;
create policy "Anyone reads sponsors" on public.sponsors for select to anon, authenticated using (true);
create policy "Admins add sponsors" on public.sponsors for insert to authenticated with check ((select public.is_admin()));
create policy "Admins edit sponsors" on public.sponsors for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove sponsors" on public.sponsors for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------- their badges
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsors', 'sponsors', true, 524288, array['image/webp', 'image/png']);

-- (removing a badge needs reading it too)
create policy "Admins see sponsor badges" on storage.objects for select to authenticated
  using (bucket_id = 'sponsors' and (select public.is_admin()));
create policy "Admins add sponsor badges" on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsors' and (select public.is_admin()));
create policy "Admins remove sponsor badges" on storage.objects for delete to authenticated
  using (bucket_id = 'sponsors' and (select public.is_admin()));
