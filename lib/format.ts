import type { Activity } from "./hunt";

/** Times are the summit's: Philippine time, whatever the organiser's phone is set to. */
const TZ = "Asia/Manila";

const dayFmt = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const stampFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TZ,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const day = (iso: string) => dayFmt.format(new Date(iso));
export const time = (iso: string) => timeFmt.format(new Date(iso));
export const stamp = (iso: string) => stampFmt.format(new Date(iso));

const mdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
/** "Nov 20–21", "Nov 30 – Dec 1", "Nov 20" */
export function dateSpan(from: string, to: string) {
  const md = (iso: string) => {
    const p = Object.fromEntries(mdFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return [p.month, p.day];
  };
  const [m1, d1] = md(from);
  const [m2, d2] = md(to);
  if (m1 === m2) return d1 === d2 ? `${m1} ${d1}` : `${m1} ${d1}–${d2}`;
  return `${m1} ${d1} – ${m2} ${d2}`;
}

/** For a datetime-local field: "2026-11-20T08:00", in Philippine time. */
export function toLocalInput(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Back from a datetime-local field (Philippine time, no daylight saving). */
export function fromLocalInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
/** "2 minutes ago", "yesterday"… */
export function ago(iso: string, now = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const a = Math.abs(s);
  if (a < 45) return "just now";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 7) return rtf.format(Math.round(s / 86400), "day");
  return stamp(iso);
}

/** Where the summit is: coming up (and in how many days), on now, or over. */
export function summitPhase(starts: string, ends: string, now = Date.now()) {
  const a = new Date(starts).getTime();
  const b = new Date(ends).getTime();
  const phase = now >= b ? ("ended" as const) : now >= a ? ("live" as const) : ("soon" as const);
  return { phase, days: Math.ceil((a - now) / 86400000) };
}

/** "in 34 days", "now", "ended" for the event. */
export function untilEvent(starts: string, ends: string, now = Date.now()) {
  const a = new Date(starts).getTime();
  const b = new Date(ends).getTime();
  if (now >= b) return "Ended";
  if (now >= a) return "On now";
  const days = Math.ceil((a - now) / 86400000);
  return days <= 1 ? "Starts tomorrow" : `Starts in ${days} days`;
}

/** What changed, in words: the fields of each table. */
const FIELD: Record<string, string> = {
  num: "number",
  name: "name",
  zone_id: "zone",
  spot: "spot",
  rarity: "rarity",
  points: "points",
  clue: "clue",
  blurb: "description",
  task: "extra task",
  sponsor: "sponsor",
  x: "map pin",
  y: "map pin",
  lat: "GPS spot",
  lng: "GPS spot",
  accuracy: "GPS spot",
  radius: "distance",
  random_spots: "random spots",
  description: "description",
  photo_path: "photo",
  badge_path: "logo",
  location_id: "location",
  address: "address",
  width: "map size",
  outlines: "map",
  rule: "who wins",
  rule_value: "who wins",
  rule_code: "who wins",
  rule_text: "who wins",
  stock: "stock",
  sort: "order",
  starts_at: "dates",
  ends_at: "dates",
  test_mode: "test mode",
  claim_place: "prize desk",
  role: "role",
  label_x: "map label",
  label_y: "map label",
};
const KIND: Record<string, string> = {
  codes: "QR code",
  prizes: "prize",
  sponsors: "sponsor",
  locations: "location",
  zones: "zone",
  team: "teammate",
  hunters: "hunter",
  claims: "prize",
  settings: "",
};

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** "changed the clue and map pin of", "turned off", "added the QR code"… (before the label) */
export function didWhat(a: Activity) {
  const kind = KIND[a.what] ?? a.what;
  if (a.what === "hunters" && /^\d+ hunters$/.test(a.label)) return "removed"; // ("removed 12 hunters": deleted together)
  if (a.what === "claims") return a.action === "removed" ? "took back" : "gave"; // ("gave Tote bag to Ana", at the prize desk)
  if (a.action === "added") return `added the ${kind}`;
  if (a.action === "removed") return `removed the ${kind}`;
  const live = a.changes.find((c) => c.startsWith("live:"));
  // (a location's latitude and longitude: where it is, not a code's GPS spot)
  const word = (c: string) => (a.what === "locations" && (c === "lat" || c === "lng") ? "place" : (FIELD[c] ?? c));
  const fields = [...new Set(a.changes.filter((c) => !c.startsWith("live:")).map(word))];
  const parts = [];
  if (live) parts.push(live === "live:on" ? "turned on" : "turned off");
  if (fields.length) parts.push(`changed the ${list(fields)} of`);
  return parts.join(" and ");
}

/** Deleting a location: what goes with it (its areas, and its QR codes if it has any). */
export function deleteQuestion(name: string, codes: number) {
  if (!codes) return `Delete ${name}, with its areas?`;
  const them = codes === 1 ? "its QR code" : `its ${codes} QR codes`;
  return `Delete ${name}, with its areas and ${them}? ${codes === 1 ? "It's" : "They're"} gone from the game for everyone; players keep what they found.`;
}
