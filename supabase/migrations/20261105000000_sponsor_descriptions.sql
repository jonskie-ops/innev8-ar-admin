-- INNEV8 QR Hunt: a description for each sponsor, under their name on the Sponsors page (what their
-- logo stands for). Set and changed on the sponsor's page; up to 300 characters, none to start with
-- for a sponsor added later.
--
-- The 8 sponsors the game came with start with one, from what each company says about its logo
-- where it says (Converge, DOST, Globe), and otherwise what the logo shows. Prodigy's only describes
-- the logo: change it on their page.

begin;

alter table public.sponsors
  add column description text not null default '' check (char_length(description) <= 300);

-- (the starting descriptions: not "changed" lines in Recent changes, and not "last changed" now)
alter table public.sponsors disable trigger log_activity;
alter table public.sponsors disable trigger stamp;

update public.sponsors set description = v.description
from (values
  ('converge', 'Three strands sweep upward to form a “C”: they stand for connectivity, intelligence and experience, Converge’s move from telco to tech company (2025). The teal, now deeper, keeps its roots.'),
  ('dost', 'Four circles joined into a square: the four guiding principles of the Department of Science and Technology, excellence, relevance, cooperation and cost-effectiveness.'),
  ('gcash', 'A blue “G” sending out waves like a phone’s signal: GCash, the mobile wallet for paying, sending and saving money from your phone.'),
  ('globe', 'A globe with a hand at its centre, ringed by icons: the hand stands for Globe’s customers, and the icons for what Globe offers them and what inspires them.'),
  ('oppo', 'OPPO’s name in its own soft, rounded lettering, in its signature green: the wordmark of the smartphone maker.'),
  ('samsung', 'Samsung’s name in its own bold blue lettering. In Korean, “Samsung” means “three stars”.'),
  ('symphonics', 'A flowing “S” in a blue circle: Symphonics Co., an internet service company in Tacloban City, making websites and cloud software and teaching digital skills.'),
  ('prodigy', 'A “P” inside a blue cloud shaped like a brain.')
) as v (id, description)
where sponsors.id = v.id and sponsors.description = '';

alter table public.sponsors enable trigger stamp;
alter table public.sponsors enable trigger log_activity;

commit;
