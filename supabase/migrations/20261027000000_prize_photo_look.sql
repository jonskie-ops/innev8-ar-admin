-- INNEV8 QR Hunt: how a prize's photo sits in its box, wherever it's shown (the admin, the prize
-- desk, the game). The photo itself is kept as uploaded; these only change how it's shown.

alter table public.prizes
  -- 'cover': fills the box, its edges cropped (as until now); 'contain': the whole photo, as it is
  add column photo_fit text not null default 'cover' check (photo_fit in ('cover', 'contain')),
  -- Zoomed in or out from there, in per cent (100: as it is)
  add column photo_zoom smallint not null default 100 check (photo_zoom between 50 and 200);
