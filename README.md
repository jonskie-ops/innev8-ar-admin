# QR Hunt Admin

The organisers' side of the INNEV8 QR Code Hunt (Regional ICT Summit 2026): a separate website,
for the team only, where they set what the game shows. It uses the same Supabase database the game
will read from.

| Page | What's set there |
| --- | --- |
| **Overview** | The summit (days to go, test mode), every QR code as a card, where they are and how many of each rarity, the prizes (what each one takes), the latest changes with who made them, and the team |
| **QR codes** | The venue map and every code's number: tap one (or use ← →) and its details show beside it, with its switch and its code value. Edit opens its page: name, clue, description, rarity and points, zone and spot, its pin (drag it), and **On the ground**: its GPS spot and how close players must be to see it (below). Codes can be added and deleted. Changes save by themselves |
| **Map** | Leyte Academic Center on a real map, with each QR code as a pin at its GPS spot inside a ring: how close players must be to see it. Admins drag a pin to move its code, inside the area the game's map shows. **Show me** puts your phone on the map with every code's distance, for walking the venue. Satellite (Esri) and street (OpenStreetMap) maps through Leaflet, free and without a key; Google's map to look at |
| **Locations** | Where the hunt can be played (below): Leyte Academic Center, and any added since. Each has its map for the game, its areas (the codes' zones), its QR codes and an on/off switch |
| **Prizes** | Name, photo, description, who wins it (all the codes, a number of codes, the legendary code, or a number of points) and how many are in stock |
| **Prize desk** | Where prizes are given out (below): type or scan the code on a player's prize card, check it, and give the prize, once. Admins and staff. On a phone it's on the Account page |
| **Sponsors** | The sponsors whose logos go on the QR codes (below): add one with its name and logo, change either, or take one off. Each code's sponsor is chosen on the code's page |
| **Hunters** | The players with a hunter ID (below): find one by name, province or tag, and see who they've met. Admins delete one, or tick several and delete them together. On a phone it's on the Account page |
| **Event** | When the hunt starts and ends (Philippine time), test mode, **random spots** (below), and where players claim prizes |
| **Team** | Who can sign in, as **admin** (changes everything) or **staff** (looks, can't change) |
| **Account** | Your password |

Every page has the same frame: the pages as icons down the side, with your account and sign out at
its foot (on phones, a tab bar along the bottom and sign out in the top bar), and a top bar with
search (QR codes, prizes, sponsors, locations and pages; press `/`), the latest changes, a link to the summit page (innev8.org/ict-summit-2026), and who's
signed in.

Next 16 (App Router, `proxy.ts`), React 19, Supabase (Auth, Postgres, Storage) through
`@supabase/ssr`. It looks like the game (same colours, fonts, QR tiles, venue map and Qufoo) and
works on a phone.

## Where the QR codes are (GPS)

Each code has a GPS spot, and the game shows it only to players whose phone is within its distance
of that spot: 10 m unless set otherwise. Phone GPS is good to a few metres outdoors and much rougher
indoors, so a code inside gets more (presets: 10 m outdoors, 15 m by a building, 20 m indoors, 30 m
in a big hall; any 3–50 m).

- **Best: set it on site.** Stand on the spot with your phone, open the code's page and tap **Use my
  location here**. It listens to the GPS for 15 seconds and averages the readings (the surer ones
  count more), showing how sure it is; **Done** uses what it has. The players' phones get the same
  kind of readings, errors near buildings included, so their game matches.
- **Or paste it** from Google Maps (press and hold the spot there, copy the numbers), or **drag the
  pin** on the Map page or the code's venue map. The venue map pin and the GPS spot always move
  together.
- A code without a spot of its own is where its venue map pin is: that map is traced from
  OpenStreetMap, so the pin has real coordinates.
- **Before the summit, walk the venue** with the Map page's **Show me** on: each code says how far you
  are, and turns turquoise once you're within its distance. Adjust spots and distances there.

**Random spots** (Event page, test mode panel) is the old way, for trying the scanner away from the
venue: codes appear at random spots around each player, wherever they are.

The GPS spots need the update `supabase/migrations/20261020000000_gps.sql` (run it in the SQL Editor).
Until then both apps keep working with each code at its pin, 10 m, and the admin asks for the update
only when a GPS setting is changed. Location only works on the live `https://` address (and
`localhost`), not over a local network address.

## Locations

The hunt can be played somewhere other than Leyte Academic Center. On the **Locations** page:

- **Add location:** its name and address, and where it is: **find it** by name (OpenStreetMap's
  search), **use my location here** on site, **paste** its coordinates from Google Maps, or tap the
  satellite map. Then how wide its map is (150 m for a building up to 1.2 km for a town centre;
  60 m–2 km): the dashed outline is what the game's map shows, and the codes go inside it.
- **Its map for the game** is drawn from OpenStreetMap's buildings, roads and grounds around it, in
  the same holographic style as the summit's (in the background: it can take a minute when
  OpenStreetMap is busy, and the page shows it once it's ready). Moving it or changing its width
  draws it again; **Get the map again** picks up buildings added to OpenStreetMap since.
- **Areas:** each location's zones (an area named after it to start with): rename, add, or remove one
  no code is in.
- **On/off:** off hides the location and its codes from the game. A new location starts off when another
  is already on (switch it on once its codes are ready), and on when none is. Players see the codes of every
  location that's on; with more than one, the game's map has a chip for each and opens on the nearest. With
  every location off the game says there are no QR codes right now.
- **Delete** (on its page, or the bin on its card here) takes its areas and its QR codes with it (it asks
  first, saying how many); players keep what they found. Leyte Academic
  Center stays. Its map starts on the plan drawn by hand for the summit; moving it, changing its
  width or **Get the map again** draws it from OpenStreetMap like the others (its codes keep their
  spots on the ground and move onto the new map).

Each QR code's page has a **Location** choice (another location puts the code in the middle of its
map, in its first area), and its map, zones and GPS checks follow it. The Map page, the QR codes
page and the overview switch between locations. The phone tab bar shows "Places"; the team is on the
Account page there.

This needs the update `supabase/migrations/20261022000000_locations.sql` (run it in the SQL Editor):
it starts with Leyte Academic Center, with every code and zone at it. Until it's run, the admin and
the game work as before, and the Locations page says what to run.

QR code numbers start at 1 at each location (Leyte Academic Center's #01–#08, a new location's own
#01, #02…): a number is taken only within its location, and a new code gets the next one there. That
needs the update `supabase/migrations/20261025000000_code_numbers.sql` (run it in the SQL Editor);
until then a number is taken at every location, and adding one says what to run.

## Sponsors

Each QR code can carry a sponsor's logo in a circle on its top-right corner, in the game (on the
map, in the collection and on the 3D code in the camera). On the **Sponsors** page:

- **Add sponsor:** their name and logo (PNG, JPG, WebP or SVG). The page turns the logo into the
  round badge the game shows, right there: a plain white background is taken out, the empty edges
  trimmed, and the logo set as big as fits on a white circle (256 px, WebP), shown on a QR code as
  players will see it. A coloured background stays (it may be part of the logo) unless
  **Take out the background** is ticked. Only the badge is stored (the "sponsors" storage bucket),
  never the file itself.
- **Change** the name or logo on the sponsor's page: it saves by itself, like the other pages, and
  the old badge is deleted.
- **Delete** (on the list or the sponsor's page) asks first and names the codes they're on: those
  codes then have no sponsor.

Then choose each code's sponsor on its page (**Add a sponsor** is there too). The game picks up
changes within a minute, and keeps the badges on the phone for weak signal.

Adding and changing sponsors needs the update `supabase/migrations/20261021000000_sponsor_logos.sql`
(run it in the SQL Editor). It starts with the 8 sponsors the game came with, on their own badges.
Until it's run, the Sponsors page shows those 8 and says what to run, and codes can still be given
any of them.

## Prize desk

Each code a player collects is sent to the database (a find, against their hunter ID), with where
their phone was. A find counts only if the phone was near the code: within the code's distance, plus
20 m and the phone's own GPS error (up to 40 m more). Codes with only a map pin (no GPS spot set on
site) aren't checked, and nothing is in random-spots mode. Who won each prize is worked out from the
finds, by the same rules as the game.

A player who wins a prize gets a **claim code** on their prize card: a QR, and the same 8 characters
under it (`K7M2-P9QX`). At the **Prize desk** page:

1. **Type code**: type it (any case, with or without the dash) and press Enter, or scan the QR with
   a USB barcode scanner, which types it and presses Enter for you. Or **Scan with camera**: hold
   the player's prize QR up to the computer's camera (or a phone's back camera); it's read by
   itself. Each device remembers which of the two it used.
2. The desk shows the prize, the player (name, province, hunter tag) and their confirmed finds, and
   whether it can be given: **Ready to give**, or why not: already claimed (when, and by whom), not
   won, none left, or a test code.
3. **Give prize** marks it claimed and lowers the prize's stock by one, together. The same code a
   second time is refused, and the player's card then says **Claimed**.

Under it: how many of each prize are left and given, and a table of **every prize given** at the
desk (when, the player, the prize, its code, who gave it), with a search. It refreshes every 30
seconds, for gives at another desk. Admins can **Take back** a prize given by mistake (on the card,
or its row): it can be given again, and the stock goes back up. Recent changes says who gave what to
whom.

**Test mode:** finds, prize codes and gives made while it's on are kept apart. Gives don't change the
stock, and once test mode is off none of it counts: testers' codes are refused at the desk.

A prize's page keeps the desk's gives: saving it changes the stock only if you changed the number.

This needs the update `supabase/migrations/20261024000000_prize_desk.sql` (run it in the SQL
Editor). Until it's run, the Prize desk page says what to run, and the game's prize cards say they
need a signal.

## Hunters

Each player gets a hunter ID when they sign up in the game: a 5-letter tag and their hunter QR, for
the "meet a hunter" tasks. The Hunters page lists them, newest first, with each one's province, when
they joined and how many hunters they've met.

- **Delete** a test player or a duplicate with its bin, or tick several (**Tick all** ticks the ones
  showing) and **Delete ticked**. It asks first. Their hunter QR stops working and their meetings go
  (for the hunters they met too); the codes they found and the tasks they've done stay on their
  phone, which gets a new hunter ID the next time the game opens.
- **Recent changes** has one line for each delete: "removed the hunter Ana", or "removed 12 hunters".

Deleting needs the update `supabase/migrations/20261023000000_hunters.sql` (run it in the SQL
Editor). Until it's run, the list shows but deleting says what to run.

## Security

There's no sign-up: an admin adds each organiser, who gets a temporary password and chooses their
own at first sign-in. Every check happens at several levels, so one missed check doesn't open
anything:

1. **The database decides last** (`supabase/migrations`). Row level security is on for every table.
   - Signed out (the game) can read only what's live.
   - Teammates can read everything.
   - Only admins can change anything.

   An account that signed up some other way gets nothing. The team always keeps at least one admin.
   Each change is logged, with who made it, by the database itself, and nobody can edit or delete
   that log.
2. **Every page and every action checks again** (`lib/dal.ts`). The signed-in user is confirmed with
   Supabase Auth on each request, not just read from the cookie, so a removed teammate is out at
   once. Server actions check that an admin is calling them whatever page they're on.
3. **The proxy** (`proxy.ts`) sends anyone signed out to the sign-in page and keeps sessions fresh.

On top of that:

- **The session cookie** is `httpOnly`: page scripts can't read it, because the admin only talks to
  Supabase from the server. In production it's also `Secure` (https only) and `SameSite=Lax`. It
  lasts a week and renews while the admin is being used.
- **Wrong passwords:** after 5 for one email, or 20 from one address, in 15 minutes, the admin stops
  trying for a while. The message is the same for a wrong password and an unknown email.
- **Forms** can't be sent until the page is ready, and they always POST, so nothing typed ends up in
  a URL. The only redirect after sign-in is back to a page of the admin itself.
- **Headers:** the admin can't be framed by another site, and search engines won't index it. It can
  use the location (its own pages only: setting spots, "Show me"), never the camera or microphone.
- **The secret key** stays on the server (`SUPABASE_SECRET_KEY`, never `NEXT_PUBLIC_`). It's used only
  to add, reset and remove sign-ins, after checking that an admin asked.

## Set up

1. **Create a Supabase project** at supabase.com. Singapore is the closest region.
2. **SQL Editor:** run each file in `supabase/migrations/` in order (oldest first), then
   `supabase/seed.sql`. The seed loads the game's current 8 codes (with their sponsors), its zones
   and the event dates. A later update comes as a new file there: run it the same way.
3. **Authentication → Sign In / Providers → Email:**
   - turn **off** "Allow new users to sign up"
   - set the minimum password length to 10
4. **Project Settings → API Keys:** copy `.env.example` to `.env.local` and fill in the project URL,
   the publishable key and the secret key.
5. **Install and add yourself:**
   - `npm install`
   - `npm run first-admin -- you@example.com "Your Name"` (prints a temporary password). If you
     already made that sign-in in the Supabase dashboard (Authentication → Add user, auto-confirmed),
     it's put on the team as it is and keeps the password you set there.
6. **Run it:** `npm run dev`, then open http://localhost:3400 and sign in. You'll choose your own
   password right away.
7. **Deploy:**
   - Make a new Vercel project from this repo.
   - Add the same three variables under Settings → Environment Variables.
   - Keep the address to the team; it isn't linked from the game.

## Where things live

| Path | What it is |
| --- | --- |
| `supabase/migrations/` | The database: tables, rules, change log, sign-in throttle, prize photo and sponsor badge buckets |
| `supabase/seed.sql` | The game's current codes, zones and dates |
| `components/LocationForm.tsx`, `PlaceMap.tsx`, `AreasPanel.tsx`, `PlaceTabs.tsx`, `PlaceMaps.tsx` | A location's page (finding it, its real map, its areas), and switching between locations |
| `lib/osm.ts` | OpenStreetMap: finding a place (Nominatim) and a location's map for the game (Overpass) |
| `components/badge.ts`, `components/SponsorForm.tsx` | A sponsor's round badge, made in the browser from their logo; their page |
| `public/sponsors/`, `BUILT_IN_SPONSORS` in `lib/hunt.ts` | The 8 sponsors the game came with: their badges (made by the game's `scripts/sponsors.mjs`), until one gets a new logo |
| `proxy.ts` | Signed out → sign in; keeps the session fresh |
| `lib/dal.ts` | Who's signed in and their role (`requireTeammate`, `adminOnly`) |
| `lib/actions/` | Every change (server actions), each checking for an admin first |
| `lib/data.ts` | Reads for the pages |
| `components/Shell.tsx` | The frame: side rail, top bar (`Find.tsx` search, `Changes.tsx` latest changes), phone tab bar |
| `components/VenueMap.tsx` | The venue map with draggable pins (the game's 360×520 plan) |
| `components/GpsFix.tsx`, `components/here.ts` | "Use my location here" (averaging the GPS) and the Map page's "Show me" |
| `lib/venue.ts` | Each location's plan ↔ latitude/longitude (`planOf`; the game's `lib/geo.ts` has the same numbers), distances |
| `scripts/first-admin.mjs` | The first admin of a new project |

## The game

The game (INNEV8-AR-JS) reads what is set here: the codes and prizes that are on, the zones and the
event settings, through its own `/api/hunt` (kept 30 seconds) with the public key only. A change
saved here reaches phones within about a minute. See the game's README, "Where the hunt comes from".

## Next

- **Extra tasks:** "Networking" tasks under a code's clue.
