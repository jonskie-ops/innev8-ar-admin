-- INNEV8 QR Hunt: QR code numbers start again at 1 at each location. A number was unique across
-- every code; now only within its location (Leyte Academic Center's #01–#08, and a new location's own
-- #01, #02…). Players and the prize desk go by a code's id, never its number, so nothing else changes.

alter table public.codes drop constraint if exists codes_num_key;
alter table public.codes add constraint codes_location_num unique (location_id, num);
