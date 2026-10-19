/** The game's vocabulary, as the admin shows it (same as innev8-ar-js/lib/hunt.ts). */

export type Rarity = "common" | "rare" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "legendary"];
export const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };
/** Points a code is worth by default, by rarity (the game's values). */
export const POINTS: Record<Rarity, number> = { common: 100, rare: 250, legendary: 500 };

export type Zone = { id: string; name: string; label_x: number | null; label_y: number | null; sort: number };

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
  updated_at: string;
};

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
 * logos come with the game (its scripts/sponsors.mjs makes them), copied to public/sponsors.
 */
export const SPONSORS: { id: string; name: string }[] = [
  { id: "converge", name: "Converge" },
  { id: "dost", name: "DOST" },
  { id: "gcash", name: "GCash" },
  { id: "globe", name: "Globe" },
  { id: "oppo", name: "OPPO" },
  { id: "prodigy", name: "Prodigy" },
  { id: "samsung", name: "Samsung" },
  { id: "symphonics", name: "Symphonics" },
];
export const sponsorOf = (id: string | undefined) => SPONSORS.find((s) => s.id === id) ?? null;
export const sponsorBadge = (id: string) => `/sponsors/${id}.webp`;
/** Code #n's sponsor before the sponsors update (and a new code's to start with): the nth. */
export const firstSponsor = (num: number) => SPONSORS[(Math.max(1, num) - 1) % SPONSORS.length].id;

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
