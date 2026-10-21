/** The game's vocabulary, as the admin shows it (same as innev8-ar-js/lib/hunt.ts). */

export type Rarity = "common" | "rare" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "legendary"];
export const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };
/** Points a code is worth by default, by rarity (the game's values). */
export const POINTS: Record<Rarity, number> = { common: 100, rare: 250, legendary: 500 };

/** An area of a location codes are in ("Annex A"); `location_id` missing: before the locations update (Leyte Academic Center). */
export type Zone = { id: string; name: string; label_x: number | null; label_y: number | null; sort: number; location_id?: string };

/**
 * Where the hunt can be played (the Locations page): Leyte Academic Center ("lac", its map drawn by
 * hand) and any added since, each with its map for the game drawn from OpenStreetMap.
 */
export type Location = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** How wide its map is, in metres */
  width: number;
  outlines: MapDrawing;
  live: boolean;
  sort: number;
  updated_at: string;
};
/** A location's map for the game: OpenStreetMap's outlines in its plan units (lib/osm.ts). */
export type Outlines = { buildings: string; roads: string; grounds: string; count: number; at: string };
/** Its map, or that it's being drawn (in the background, after a move) or that drawing it failed. */
export type MapDrawing = Outlines | { drawing: string } | { failed: string } | null;
/** The map as drawn, if it is */
export const drawnMap = (o: MapDrawing | undefined): Outlines | null => (o && "buildings" in o ? o : null);
/** How long drawing may take before it counts as failed (OpenStreetMap can be slow, never this slow) */
const DRAW_MS = 4 * 60 * 1000;
export function mapState(o: MapDrawing | undefined, now = Date.now()): "drawn" | "drawing" | "failed" | "none" {
  if (!o) return "none";
  if ("buildings" in o) return "drawn";
  if ("drawing" in o) return now - Date.parse(o.drawing) < DRAW_MS ? "drawing" : "failed";
  return "failed";
}

/** How wide a location's map is: a building, a campus, a town centre… (metres) */
export const MAP_WIDTH = {
  min: 60,
  max: 2000,
  presets: [
    { m: 150, label: "A building" },
    { m: 300, label: "A campus" },
    { m: 600, label: "A neighbourhood" },
    { m: 1200, label: "A town centre" },
  ],
} as const;

export type Code = {
  id: string;
  code: string;
  num: number;
  name: string;
  zone_id: string;
  spot: string;
  rarity: Rarity;
  points: number;
  clue: string;
  blurb: string;
  x: number;
  y: number;
  live: boolean;
  /** An extra task players do before they can find it (networking) */
  task: Task;
  /** Its sponsor's id (SPONSORS), or "none" */
  sponsor: string;
  /** Where it is (Locations); missing before the locations update: Leyte Academic Center */
  location_id?: string;
  /**
   * Its GPS spot, where players find it. Null (or missing, before the GPS update): where its venue
   * map pin is (spotOf in lib/venue.ts).
   */
  lat?: number | null;
  lng?: number | null;
  /** How sure the phone that set the spot was, in metres; null: set on a map or typed in */
  accuracy?: number | null;
  /** The game shows it to players within this many metres of its spot (RADIUS.default before the update) */
  radius?: number;
  updated_at: string;
};

/**
 * How close players must be to a code for the game to show it, in metres. Phone GPS is good to a
 * few metres outdoors and much rougher indoors, so a code inside gets a bigger distance.
 */
export const RADIUS = {
  default: 10,
  min: 3,
  max: 50,
  presets: [
    { m: 10, label: "Outdoors" },
    { m: 15, label: "By a building" },
    { m: 20, label: "Indoors" },
    { m: 30, label: "Big hall" },
  ],
} as const;

/** The extra tasks a code can have: players do it after reading the clue, and only then can find it. */
export type Task = "none" | "any" | "province" | "selfie";
export const TASKS: { id: Task; label: string; hint: string; player: string }[] = [
  { id: "none", label: "No extra task", hint: "Players can look for it straight after reading the clue.", player: "" },
  {
    id: "any",
    label: "Meet a hunter",
    hint: "They scan another player's hunter QR, or let them scan theirs.",
    player: "Meet another hunter: scan their hunter QR, or let them scan yours.",
  },
  {
    id: "province",
    label: "Meet another province",
    hint: "The same, with a hunter from a different province than theirs.",
    player: "Meet a hunter from another province: scan their hunter QR, or let them scan yours.",
  },
  {
    id: "selfie",
    label: "Selfie together",
    hint: "They take a selfie with another hunter. On trust: the game can't check the photo.",
    player: "Take a selfie with another hunter.",
  },
];
export const taskOf = (id: Task) => TASKS.find((t) => t.id === id) ?? TASKS[0];

/**
 * A QR code's sponsor: the game shows their logo in a circle on the code's top-right corner. The
 * organisers keep them on the Sponsors page (lib/data.ts, listSponsors); `badge` is the address of
 * their round badge.
 */
export type Sponsor = {
  id: string;
  name: string;
  /** In the "sponsors" storage bucket; null: the badge that came with the game (public/sponsors) */
  badge_path: string | null;
  created_at: string;
  updated_at: string;
  badge: string;
};

/**
 * The sponsors that came with the game, before the sponsor logos update: their badges are in
 * public/sponsors (made by the game's scripts/sponsors.mjs). The update starts with these.
 */
export const BUILT_IN_SPONSORS: { id: string; name: string }[] = [
  { id: "converge", name: "Converge" },
  { id: "dost", name: "DOST" },
  { id: "gcash", name: "GCash" },
  { id: "globe", name: "Globe" },
  { id: "oppo", name: "OPPO" },
  { id: "prodigy", name: "Prodigy" },
  { id: "samsung", name: "Samsung" },
  { id: "symphonics", name: "Symphonics" },
];
export const builtInBadge = (id: string) => `/sponsors/${id}.webp`;
/** Code #n's sponsor before the sponsors update (and a new code's to start with): the nth. */
export const firstSponsor = (num: number) => BUILT_IN_SPONSORS[(Math.max(1, num) - 1) % BUILT_IN_SPONSORS.length].id;
/** For showing a code's sponsor: their name and badge, or null (none, or taken off since). */
export type SponsorView = { id: string; name: string; badge: string };
export const sponsorIn = (sponsors: SponsorView[], id: string | undefined): SponsorView | null =>
  sponsors.find((s) => s.id === id) ?? null;

export type PrizeRule = "all" | "count" | "legendary" | "points";
export const PRIZE_RULES: { id: PrizeRule; label: string; value?: string }[] = [
  { id: "all", label: "Collect every QR code" },
  { id: "count", label: "Collect a number of QR codes", value: "QR codes" },
  { id: "legendary", label: "Find the legendary (gold) code" },
  { id: "points", label: "Reach a number of points", value: "points" },
];

export type Prize = {
  id: string;
  name: string;
  description: string;
  photo_path: string | null;
  rule: PrizeRule;
  rule_value: number | null;
  stock: number;
  live: boolean;
  sort: number;
  updated_at: string;
};

/** "Collect all 8 QR codes", "Reach 1,000 points"… */
export function ruleText(p: Pick<Prize, "rule" | "rule_value">, total: number) {
  switch (p.rule) {
    case "all":
      return `Collect all ${total} QR codes`;
    case "count":
      return `Collect ${p.rule_value} QR code${p.rule_value === 1 ? "" : "s"}`;
    case "legendary":
      return "Find the legendary code";
    case "points":
      return `Reach ${(p.rule_value ?? 0).toLocaleString("en-PH")} points`;
  }
}

/** What a prize takes, against the whole hunt: "4 of 8 QR codes" and 50 (%). */
export function prizeNeeds(p: Pick<Prize, "rule" | "rule_value">, codes: number, points: number) {
  const v = p.rule_value ?? 0;
  const of = (part: number, whole: number) => (whole ? Math.round(Math.min(100, (part / whole) * 100)) : 100);
  switch (p.rule) {
    case "all":
      return { needs: `All ${codes} QR codes`, share: 100 };
    case "count":
      return { needs: `${v} of ${codes} QR codes`, share: of(v, codes) };
    case "legendary":
      return { needs: "The legendary code", share: of(1, codes) };
    case "points":
      return { needs: `${v.toLocaleString("en-PH")} of ${points.toLocaleString("en-PH")} pts`, share: of(v, points) };
  }
}

export type Settings = {
  starts_at: string;
  ends_at: string;
  test_mode: boolean;
  claim_place: string;
  /** On: codes hide at random spots around each player instead of at their GPS spots (missing before the GPS update) */
  random_spots?: boolean;
  updated_at: string;
};

export type Member = {
  user_id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  must_change_password: boolean;
  created_at: string;
};

export type Activity = {
  id: number;
  at: string;
  who: string;
  what: string;
  action: "added" | "changed" | "removed";
  label: string;
  changes: string[];
};

/** Where the game lives: a code opens straight ahead as `${GAME_URL}/?s=<code>`. */
export const GAME_URL = "https://innev8-ar-js.vercel.app";
/** The summit's own page on the INNEV8 site (the top bar's link). */
export const SUMMIT_URL = "https://www.innev8.org/ict-summit-2026";
