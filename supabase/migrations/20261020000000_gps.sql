-- INNEV8 QR Hunt: QR codes at real places. Each code gets a GPS spot (latitude and longitude) and a
-- distance: the game shows it only to players whose phone is within that many metres of the spot (10
-- by default; more for a spot indoors, where a phone's GPS is rougher). A code without its own spot
-- yet is where its pin is on the venue map: that map is traced from OpenStreetMap, so the admin and
-- the game work its place out from the pin.
--
-- The event gets a switch for the old way: codes hidden at random spots around each player, wherever
-- they are, for trying the scanner away from the venue.
--
-- Adding columns with defaults changes no rows, so nothing shows in "Recent changes".

alter table public.codes
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  -- How sure the phone that set the spot was, in metres; none: set on a map or typed in
  add column accuracy real check (accuracy between 0 and 1000),
  add column radius smallint not null default 10 check (radius between 3 and 50),
  add constraint codes_lat_lng check ((lat is null) = (lng is null));

alter table public.settings add column random_spots boolean not null default false;
