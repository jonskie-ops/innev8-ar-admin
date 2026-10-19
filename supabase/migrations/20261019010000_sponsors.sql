-- INNEV8 QR Hunt: a sponsor on every QR code. The game shows the sponsor's logo in a circle on the
-- code's top-right corner (on the map, in the collection, in the camera). The logos come with the
-- game (its scripts/sponsors.mjs; copied to this admin's public/sponsors); here each code gets one.

alter table public.codes add column sponsor text not null default 'none'
  check (sponsor ~ '^[a-z0-9-]{1,32}$');

-- The first sponsors, in order of the codes' numbers, as the game shows them until now. Set
-- quietly: not a change anyone made, so it's left out of "Recent changes" and "Last changed".
alter table public.codes disable trigger log_activity;
alter table public.codes disable trigger stamp;
update public.codes
set sponsor = (array['converge', 'dost', 'gcash', 'globe', 'oppo', 'prodigy', 'samsung', 'symphonics'])[((num - 1) % 8) + 1];
alter table public.codes enable trigger stamp;
alter table public.codes enable trigger log_activity;
