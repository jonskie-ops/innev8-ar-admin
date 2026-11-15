-- "Seen from": a QR code that players see from one side only, so they have to walk around a wall or a
-- building to find it. Each code can have a fan pointing out from its GPS spot toward the side players
-- must stand on (seen_dir: its middle, compass degrees from north; seen_width: how wide, in degrees).
-- No fan (both null): seen from every side. The event's switch (settings.seen_from) turns every code's
-- fan on or off at once; it starts off, so nothing changes in the game until it's turned on.
--
-- The game applies it in the scanner (the server's distance check on a find is unchanged: GPS by a
-- wall is too rough for a hard rule there). Run once in Supabase's SQL Editor.

alter table public.codes
  add column seen_dir smallint check (seen_dir between 0 and 359),
  add column seen_width smallint check (seen_width between 30 and 300),
  add constraint codes_seen_both check ((seen_dir is null) = (seen_width is null));

alter table public.settings add column seen_from boolean not null default false;
