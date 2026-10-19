# QR Hunt Admin

The organisers' side of the INNEV8 QR Code Hunt (Regional ICT Summit 2026): a separate website,
for the team only, where they set what the game shows. It uses the same Supabase database the game
will read from.

| Page | What's set there |
| --- | --- |
| **Overview** | The summit (days to go, test mode), every QR code as a card, where they are and how many of each rarity, the prizes (what each one takes), the latest changes with who made them, and the team |
| **QR codes** | The venue map and every code's number: tap one (or use ← →) and its details show beside it, with its switch, its code value and a link to try it in the game. Edit opens its page: name, clue, description, rarity and points, zone and spot, and its pin (drag it). Codes can be added and deleted |
| **Map** | Leyte Academic Center on a real map, with each QR code as a pin (its pin on the venue map turned into real coordinates). Admins drag a pin to move its code, inside the area the game's map shows. Satellite (Esri) and street (OpenStreetMap) maps through Leaflet, free and without a key; Google's map to look at; directions |
| **Prizes** | Name, photo, description, who wins it (all the codes, a number of codes, the legendary code, or a number of points) and how many are in stock |
| **Event** | When the hunt starts and ends (Philippine time), test mode, and where players claim prizes |
| **Team** | Who can sign in, as **admin** (changes everything) or **staff** (looks, can't change) |
| **Account** | Your password |

Every page has the same frame: the pages as icons down the side, with your account and sign out at
its foot (on phones, a tab bar along the bottom and sign out in the top bar), and a top bar with
search (QR codes, prizes and pages; press `/`), the latest changes, a link to the summit page (innev8.org/ict-summit-2026), and who's
signed in.

Next 16 (App Router, `proxy.ts`), React 19, Supabase (Auth, Postgres, Storage) through
`@supabase/ssr`. It looks like the game (same colours, fonts, QR tiles, venue map and Qufoo) and
works on a phone.

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
- **Headers:** the admin can't be framed by another site, and search engines won't index it.
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
| `supabase/migrations/` | The database: tables, rules, change log, sign-in throttle, prize photo bucket |
| `supabase/seed.sql` | The game's current codes, zones and dates |
| `public/sponsors/`, `SPONSORS` in `lib/hunt.ts` | The sponsors a code can have: their round badges, made by the game's `scripts/sponsors.mjs` |
| `proxy.ts` | Signed out → sign in; keeps the session fresh |
| `lib/dal.ts` | Who's signed in and their role (`requireTeammate`, `adminOnly`) |
| `lib/actions/` | Every change (server actions), each checking for an admin first |
| `lib/data.ts` | Reads for the pages |
| `components/Shell.tsx` | The frame: side rail, top bar (`Find.tsx` search, `Changes.tsx` latest changes), phone tab bar |
| `components/VenueMap.tsx` | The venue map with draggable pins (the game's 360×520 plan) |
| `scripts/first-admin.mjs` | The first admin of a new project |

## The game

The game (INNEV8-AR-JS) reads what is set here: the codes and prizes that are on, the zones and the
event settings, through its own `/api/hunt` (kept 30 seconds) with the public key only. A change
saved here reaches phones within about a minute. See the game's README, "Where the hunt comes from".

## Next

- **Prize desk:** finds sent to the database, and staff scan a player's prize QR to mark it claimed.
- **Extra tasks:** "Networking" tasks under a code's clue.
