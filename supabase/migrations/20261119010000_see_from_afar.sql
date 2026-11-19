-- Codes seen from farther away than they're collected. With the event's switch (settings.far_view) on,
-- a player sees a QR code in the camera from `see_metres` away (30 m to start), locked, with "walk
-- closer"; they collect it once within its own distance (codes.radius, "Collect it within" on its page,
-- 10 m by default). The switch starts off, so nothing changes in the game until it's turned on.
--
-- The game applies it in the scanner; the database's check on a find is unchanged (its distance plus
-- the GPS's error and a margin, as phone GPS is rough). Run once in Supabase's SQL Editor.

alter table public.settings
  add column far_view boolean not null default false,
  add column see_metres smallint not null default 30 check (see_metres between 10 and 200);
