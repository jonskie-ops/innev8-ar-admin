-- The game as it is today (lib/hunt.ts and lib/site.ts in innev8-ar-js): 3 zones, the 8 test
-- QR codes (placeholder spots and clues until the floor plan is final) and the event dates.
insert into public.zones (id, name, label_x, label_y, sort) values
  ('annex', 'Annex A', 190, 206, 1),
  ('annexb', 'Annex B', 252, 167, 2),
  ('court', 'Courtyard', null, null, 3);

insert into public.codes (id, code, num, name, zone_id, spot, rarity, points, clue, blurb, x, y) values
  ('px01', 'I8AR-01-M2VD', 1, 'Partner Booths', 'annex', 'Partner booths', 'common', 100,
    'Where industry meets the region. Look among the partners.',
    'Meet the companies bridging industries across Eastern Visayas.', 80, 90),
  ('px02', 'I8AR-02-B7XQ', 2, 'Registration', 'annex', 'Registration desk', 'common', 100,
    'Look where attendees pick up their IDs.',
    'Where attendees pick up their IDs and summit kits.', 160, 100),
  ('px03', 'I8AR-03-R4CF', 3, 'Capstone Rooms', 'annexb', 'Capstone rooms', 'common', 100,
    'Students defend their best work here.',
    'Student teams present their best capstone projects in these rooms.', 236, 90),
  ('px04', 'I8AR-04-H6WN', 4, 'Tech Showcase', 'annex', 'Tech showcase', 'rare', 250,
    'Gadgets on display, and one of them blinks back.',
    'Gadgets, robots and live demos from across the region.', 96, 176),
  ('px05', 'I8AR-05-ZV2L', 5, 'Hall of Icons', 'annex', 'Hall of Icons', 'legendary', 500,
    'Stand where the region''s icons are honored.',
    'The gold code, hidden where Eastern Visayas'' tech trailblazers are honored.', 150, 176),
  ('px06', 'I8AR-06-P8JS', 6, 'Games Area', 'annexb', 'Games area', 'common', 100,
    'Press start to play.',
    'Interactive displays and games. Press start.', 216, 178),
  ('px07', 'I8AR-07-K3MD', 7, 'Digital Marketing', 'court', 'Digital marketing booth', 'common', 100,
    'Follow, like and share. It lives where brands go viral.',
    'Brands go viral here. Tag #RICTS2026 when you share your find.', 96, 228),
  ('px08', 'I8AR-08-T7GA', 8, 'Photo Wall', 'court', 'Photo wall', 'rare', 250,
    'Smile! This one hides where everyone takes their picture.',
    'Strike a pose. Every hunter needs a summit selfie.', 220, 228);

-- Their sponsors, in order of number (as the sponsors update starts them)
update public.codes
set sponsor = (array['converge', 'dost', 'gcash', 'globe', 'oppo', 'prodigy', 'samsung', 'symphonics'])[((num - 1) % 8) + 1];

insert into public.settings (starts_at, ends_at, test_mode, claim_place) values
  ('2026-11-20T08:00:00+08:00', '2026-11-21T18:00:00+08:00', true, 'INNEV8 help desk');

-- The seed isn't anyone's change
truncate public.activity;
