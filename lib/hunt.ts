import type { CSSProperties } from "react";

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
  /**
   * Seen from one side only (while the event's "Seen from" switch is on): the middle of the side players
   * must stand on, in compass degrees from north, and how wide it is in degrees. Null (or missing,
   * before the seen-from update): seen from every side.
   */
  seen_dir?: number | null;
  seen_width?: number | null;
  updated_at: string;
};

/** How wide a code's "Seen from" side can be, in degrees (as the database allows), and the usual choices. */
export const SEEN = {
  min: 30,
  max: 300,
  default: 120,
  presets: [
    { w: 180, label: "Half", hint: "One side of a wall" },
    { w: 120, label: "Wide", hint: "Round a corner" },
    { w: 90, label: "Narrow", hint: "Through a gap" },
  ],
} as const;

/** "N", "NE", … for a compass direction in degrees. */
export function compassPoint(deg: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

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
  /** What their logo stands for, under their name on the Sponsors page (none before the sponsor descriptions update) */
  description?: string;
  /** Their place on the Sponsors page, set by dragging (none before the sponsor order update: by name) */
  sort?: number;
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

export type PrizeRule = "all" | "count" | "legendary" | "points" | "code";
export const PRIZE_RULES: { id: PrizeRule; label: string; value?: string }[] = [
  { id: "all", label: "Collect every QR code" },
  { id: "count", label: "Collect a number of QR codes", value: "QR codes" },
  { id: "legendary", label: "Find the legendary (gold) code" },
  { id: "points", label: "Reach a number of points", value: "points" },
  { id: "code", label: "Find a chosen QR code" },
];

export type Prize = {
  id: string;
  name: string;
  description: string;
  photo_path: string | null;
  rule: PrizeRule;
  rule_value: number | null;
  /** "code": the code to find (null if it's been deleted since), and the sentence players read
   *  (both missing before the prize code update) */
  rule_code?: string | null;
  rule_text?: string | null;
  /** How its photo sits in its box: filling it (cropped) or whole, zoomed (%); missing before the
   *  photo look update */
  photo_fit?: PhotoFit;
  photo_zoom?: number;
  stock: number;
  live: boolean;
  sort: number;
  updated_at: string;
};

export type PhotoFit = "cover" | "contain";
export const PHOTO_ZOOM = { min: 50, max: 200, default: 100 } as const;

/**
 * A prize photo's look, as the style on its <img> (every photo box crops what spills over): filling
 * the box or the whole photo, then zoomed. Nothing for the default (filling, 100%).
 */
export function photoStyle(fit: PhotoFit | null | undefined, zoom: number | null | undefined): CSSProperties | undefined {
  const z = zoom ?? PHOTO_ZOOM.default;
  if ((fit ?? "cover") === "cover" && z === PHOTO_ZOOM.default) return undefined;
  return { objectFit: fit ?? "cover", transform: z === PHOTO_ZOOM.default ? undefined : `scale(${z / 100})` };
}

/** "Collect all 8 QR codes", "Reach 1,000 points", or the organisers' own ("Get the Symphonics QR") */
export function ruleText(p: Pick<Prize, "rule" | "rule_value" | "rule_text">, total: number) {
  switch (p.rule) {
    case "all":
      return `Collect all ${total} QR codes`;
    case "count":
      return `Collect ${p.rule_value} QR code${p.rule_value === 1 ? "" : "s"}`;
    case "legendary":
      return "Find the legendary code";
    case "points":
      return `Reach ${(p.rule_value ?? 0).toLocaleString("en-PH")} points`;
    case "code":
      return p.rule_text || "Find a chosen QR code";
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
    case "code":
      return { needs: "A chosen QR code", share: of(1, codes) };
  }
}

export type Settings = {
  starts_at: string;
  ends_at: string;
  test_mode: boolean;
  claim_place: string;
  /** On: codes hide at random spots around each player instead of at their GPS spots (missing before the GPS update) */
  random_spots?: boolean;
  /** On: a code with a "Seen from" side shows only to players on that side (missing before the seen-from update) */
  seen_from?: boolean;
  /**
   * On: a code's points drop as more people find it (missing before the points drop update): the first
   * `drop_full` finders get its full points, then every `drop_every` finders 10% less, never below
   * `drop_floor`% (dropPoints, as the database's find_points).
   */
  points_drop?: boolean;
  drop_full?: number;
  drop_every?: number;
  drop_floor?: number;
  /**
   * On: players see a code in the camera from `see_metres` away (locked, "walk closer") and collect it
   * within its own distance (missing before the see-from-afar update).
   */
  far_view?: boolean;
  see_metres?: number;
  updated_at: string;
};
/** How far away players see codes with "see codes from farther away" on: 30 m to start. */
export const SEE = { default: 30, min: 10, max: 200 };

/** The points drop rule: full points for the first `first` finders, then 10% less every `every`, never below `floor`%. */
export type DropRule = { first: number; every: number; floor: number };
export const DROP_DEFAULT: DropRule = { first: 10, every: 2, floor: 10 };
/** What the `place`th finder (1, 2, …) of a code worth `full` gets with the rule on (the database's find_points). */
export function dropPoints(full: number, place: number, r: DropRule) {
  if (place <= r.first) return full;
  const pct = Math.max(r.floor, 100 - 10 * Math.ceil((place - r.first) / Math.max(r.every, 1)));
  return Math.max(1, Math.round((full * pct) / 100));
}
/**
 * The rule as steps for a table: which finders get which share of the points ("#11–12": 90%), up to
 * the lowest share, which every later finder gets ("#27 on").
 */
export function dropSteps(r: DropRule): { from: number; to: number | null; pct: number }[] {
  const steps = [{ from: 1, to: r.first as number | null, pct: 100 }];
  for (let pct = 90, from = r.first + 1; ; pct -= 10, from += r.every) {
    if (pct <= r.floor) {
      steps.push({ from, to: null, pct: r.floor });
      return steps;
    }
    steps.push({ from, to: from + r.every - 1, pct });
  }
}

export type Member = {
  user_id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  must_change_password: boolean;
  created_at: string;
};

/**
 * A hunter's place on the leaderboard, ranked as the game ranks them (lib/data.ts listBoard, the same
 * as the database's leaderboard function): their points, codes found, and when they found their last.
 */
export type BoardEntry = { rank: number; id: string; tag: string; name: string; province: string; score: number; codes: number; last: string };

/** A player's hunter ID (made when they sign up in the game), and how many hunters they've met. */
export type Hunter = {
  id: string;
  tag: string;
  name: string;
  province: string;
  created_at: string;
  meetings: number;
};

/** A player's standing, as the database works it out from their finds (the prize desk). */
export type Standing = { count: number; total: number; finds: number; score: number; legendary: boolean };

/** A claim code at the prize desk: whose it is, the prize, and how it stands. */
export type DeskClaim = {
  code: string;
  /** Made in test mode, and whether test mode is on now */
  test: boolean;
  testNow: boolean;
  claimedAt: string | null;
  claimedBy: string | null;
  /** The person's name as the desk typed it from their ID (null before …_desk_names.sql) */
  givenTo?: string | null;
  hunter: { id: string; name: string; province: string; tag: string };
  prize: { id: string; name: string; photo: string | null; rule: PrizeRule; value: number | null; stock: number; live: boolean };
  standing: Standing;
  won: boolean;
};

/** A prize given at the desk: when, to whom (the player, and the name on their ID), which, its claim code, and who gave it. */
export type Given = {
  code: string;
  at: string;
  by: string | null;
  givenTo: string | null;
  hunter: string;
  province: string;
  tag: string;
  prizeId: string;
  prize: string;
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
