"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOnly } from "../dal";
import { checked, dbError, decimal, done, failed, Invalid, NEEDS_GPS, NOT_ADMIN, oneOf, text, whole, type FormState } from "../form";
import { BUILT_IN_SPONSORS, firstSponsor, RADIUS, RARITIES, TASKS } from "../hunt";
import { pick } from "../random";
import { supabase } from "../supabase";
import { metresBetween, PIN_AREA, toLatLng, toPlan } from "../venue";

/** The code's GPS spot (sent with every save: the form keeps it and the map pin together). */
function readSpot(fd: FormData) {
  const lat = Number(fd.get("lat"));
  const lng = Number(fd.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw new Invalid("The GPS spot isn't a place on the map. Use your location, type it again, or move the pin.");
  const acc = String(fd.get("accuracy") ?? "").trim();
  const accuracy = acc ? Math.round(Math.min(1000, Math.max(0, Number(acc) || 0)) * 10) / 10 : null;
  return {
    lat: Math.round(lat * 1e7) / 1e7,
    lng: Math.round(lng * 1e7) / 1e7,
    accuracy,
    radius: whole(fd, "radius", "Show it within", RADIUS.min, RADIUS.max),
  };
}

function readCode(fd: FormData) {
  return {
    num: whole(fd, "num", "Number", 1, 99),
    name: text(fd, "name", "Name", { max: 40, required: true }),
    zone_id: text(fd, "zone_id", "Zone", { max: 24, required: true }),
    spot: text(fd, "spot", "Spot", { max: 60 }),
    rarity: oneOf(fd, "rarity", "Rarity", RARITIES),
    points: whole(fd, "points", "Points", 0, 10000),
    clue: text(fd, "clue", "Clue", { max: 140 }),
    blurb: text(fd, "blurb", "Description", { max: 200 }),
    x: decimal(fd, "x", "The pin", 0, 360),
    y: decimal(fd, "y", "The pin", 0, 520),
    live: checked(fd, "live"),
    task: oneOf(fd, "task", "Extra task", TASKS.map((t) => t.id)),
    sponsor: text(fd, "sponsor", "Sponsor", { max: 32, required: true }),
    ...readSpot(fd),
  };
}

const NEEDS_NETWORKING =
  "Extra tasks need the networking update first: run supabase/migrations/20261019000000_networking.sql in Supabase's SQL Editor.";

const NEEDS_SPONSORS =
  "Choosing a sponsor needs the sponsors update first: run supabase/migrations/20261019010000_sponsors.sql in Supabase's SQL Editor.";

/** The sponsors a code can have: the organisers' (or before the sponsor logos update, the game's). */
async function sponsorIds() {
  const { data, error } = await (await supabase()).from("sponsors").select("id");
  return ["none", ...(error || !data ? BUILT_IN_SPONSORS : data).map((s: { id: string }) => s.id)];
}

/**
 * Has the database got this column yet (codes.task: the networking update; codes.sponsor: sponsors;
 * codes.radius: GPS)?
 */
async function has(column: "task" | "sponsor" | "radius") {
  const { error } = await (await supabase()).from("codes").select(column).limit(1);
  return !error;
}

/** Saves a QR code (`id` null: adds one, with a new code value for its 3D pattern). */
export async function saveCode(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  let v;
  try {
    v = readCode(fd);
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  const sb = await supabase();
  const taken = `Number ${v.num} is already used by another QR code.`;
  // A database without the networking, sponsors or GPS update yet: save the rest (when none of
  // those was changed; a GPS spot that's just the map pin's place counts as unchanged)
  const { task, sponsor, lat, lng, accuracy, radius, ...rest } = v;
  const [tasks, sponsors, gps, ids] = await Promise.all([has("task"), has("sponsor"), has("radius"), sponsorIds()]);
  if (!ids.includes(sponsor)) return failed("That sponsor was taken off by someone else. Choose another.");
  if (!tasks && task !== "none") return failed(NEEDS_NETWORKING);
  if (!sponsors && sponsor !== firstSponsor(v.num)) return failed(NEEDS_SPONSORS);
  if (!gps && (accuracy !== null || radius !== RADIUS.default || metresBetween({ lat, lng }, toLatLng(v.x, v.y)) > 1))
    return failed(NEEDS_GPS);
  const row = { ...rest, ...(tasks && { task }), ...(sponsors && { sponsor }), ...(gps && { lat, lng, accuracy, radius }) };
  if (!id) {
    const newId = "c" + pick(6, "abcdefghjkmnpqrstuvwxyz23456789");
    const code = `I8AR-${String(v.num).padStart(2, "0")}-${pick(4)}`;
    const { error } = await sb.from("codes").insert({ ...row, id: newId, code });
    if (error) return failed(dbError(error, taken));
    revalidatePath("/", "layout");
    redirect(`/codes/${newId}?added=1`);
  }
  const { data, error } = await sb.from("codes").update(row).eq("id", id).select("id");
  if (error) return failed(dbError(error, taken));
  if (!data?.length) return failed("This QR code was removed by someone else.");
  revalidatePath("/", "layout");
  return done("Saved");
}

export async function deleteCode(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const { error } = await (await supabase()).from("codes").delete().eq("id", id);
  if (error) return failed(dbError(error));
  revalidatePath("/", "layout");
  redirect("/codes");
}

/** On or off in the game, for a QR code or a prize. */
export async function setLive(kind: "codes" | "prizes", id: string, live: boolean): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  if (kind !== "codes" && kind !== "prizes") return failed("Unknown item.");
  const { data, error } = await (await supabase())
    .from(kind)
    .update({ live: live === true })
    .eq("id", String(id))
    .select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("It was removed by someone else.");
  revalidatePath("/", "layout");
  return done(live ? "On" : "Off");
}

/**
 * A QR code's pin, dropped on the Map page's real map: its GPS spot is where it was dropped (set on a
 * map, so no accuracy), and its venue map pin follows. Only where the game's venue map can show it.
 */
export async function moveCode(id: string, lat: number, lng: number): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return failed("That isn't a place on the map.");
  const { x, y } = toPlan(lat, lng);
  const inside = x >= PIN_AREA.x0 && x <= PIN_AREA.x1 && y >= PIN_AREA.y0 && y <= PIN_AREA.y1;
  if (!inside) return failed("That's outside the area the game's map shows.");
  const half = (v: number) => Math.round(v * 2) / 2;
  const spot = (await has("radius")) && { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7, accuracy: null };
  const { data, error } = await (await supabase())
    .from("codes")
    .update({ x: half(x), y: half(y), ...spot })
    .eq("id", String(id))
    .select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("This QR code was removed by someone else.");
  revalidatePath("/", "layout");
  return done("Moved");
}
