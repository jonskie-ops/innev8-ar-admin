"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterAdd } from "@/lib/back";
import { after } from "next/server";
import { adminOnly } from "../dal";
import { checked, dbError, done, failed, Invalid, NEEDS_LOCATIONS, NOT_ADMIN, text, whole, type FormState } from "../form";
import { MAP_WIDTH, mapState, type MapDrawing } from "../hunt";
import { fetchOutlines, searchPlaces, type Found } from "../osm";
import { supabase } from "../supabase";
import { DEFAULT_LOCATION, intoPinArea, metresBetween, planOf, type Where } from "../venue";

/** An id from a name ("SM City Tacloban" → "sm-city-tacloban"), not one in `taken`, at most 24 characters. */
function idFrom(name: string, taken: Set<string>) {
  const trim = (v: string, max: number) => v.slice(0, max).replace(/^-+|-+$/g, "");
  const base =
    trim(
      name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/, ""),
      24,
    ) || "place";
  for (let n = 1; ; n++) {
    const id = n === 1 && base !== "new" ? base : `${trim(base, 24 - String(n).length - 1)}-${n}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * Leyte Academic Center leaving its hand-drawn plan for a map from OpenStreetMap (north up, around
 * `to`): each of its codes keeps its spot on the ground (one worked out from its pin gets that spot
 * for its own), and its pin moves to that spot on the new map; the zones' name tags (placed on the
 * hand-drawn plan) go.
 */
async function leaveHandPlan(sb: Awaited<ReturnType<typeof supabase>>, to: Omit<Where, "outlines">) {
  const hand = planOf(null);
  const next = planOf({ ...to, outlines: "osm" });
  const { data: codes } = await sb.from("codes").select("id, x, y, lat, lng").eq("location_id", DEFAULT_LOCATION);
  for (const c of codes ?? []) {
    const spot = c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : hand.toLatLng(c.x, c.y);
    const p = next.toPlan(spot.lat, spot.lng);
    const pin = intoPinArea(p.x, p.y, next.pinArea);
    const half = (v: number) => Math.round(v * 2) / 2;
    await sb.from("codes").update({ x: half(pin.x), y: half(pin.y), lat: spot.lat, lng: spot.lng }).eq("id", c.id);
  }
  await sb.from("zones").update({ label_x: null, label_y: null }).eq("location_id", DEFAULT_LOCATION);
}

/**
 * Draws a location's map from OpenStreetMap once the answer has gone back (it can take a minute when
 * OpenStreetMap is busy): the page says it's drawing until then. Kept only if the location hasn't
 * moved again since (that move draws its own).
 */
async function drawLater(where: Omit<Where, "outlines">) {
  const sb = await supabase();
  after(async () => {
    const drawn = await fetchOutlines(where).catch(() => null);
    const { data: now } = await sb.from("locations").select("lat, lng, width").eq("id", where.id).maybeSingle();
    if (!now || now.lat !== where.lat || now.lng !== where.lng || now.width !== where.width) return;
    const outlines: MapDrawing = drawn ?? { failed: new Date().toISOString() };
    await sb.from("locations").update({ outlines }).eq("id", where.id);
  });
}

/** Only one location is on in the game at a time: the others go off when one is switched on. */
async function onlyOn(sb: Awaited<ReturnType<typeof supabase>>, id: string) {
  await sb.from("locations").update({ live: false }).eq("live", true).neq("id", id);
}

function readPlace(fd: FormData) {
  const lat = Number(fd.get("lat"));
  const lng = Number(fd.get("lng"));
  if (!String(fd.get("lat") ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw new Invalid("Choose where it is: search for it, use your location, paste its coordinates or tap the map.");
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    width: whole(fd, "width", "The map's width", MAP_WIDTH.min, MAP_WIDTH.max),
  };
}

/**
 * Saves a location (`id` null: adds one, with an area named after it for its codes). Moving it or
 * changing its map's width draws its map for the game again, from OpenStreetMap: for Leyte Academic
 * Center, still on its hand-drawn plan, that's when it changes to a map from OpenStreetMap too.
 */
export async function saveLocation(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  let v;
  try {
    v = {
      name: text(fd, "name", "Name", { max: 60, required: true }),
      address: text(fd, "address", "Address", { max: 120 }),
      live: checked(fd, "live"),
      ...readPlace(fd),
    };
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  const sb = await supabase();
  const { data: all, error: notYet } = await sb.from("locations").select("id, name, lat, lng, width, sort, outlines");
  if (notYet) return failed(NEEDS_LOCATIONS);
  const old = id ? all.find((l) => l.id === id) : null;
  if (id && !old) return failed("This location was removed by someone else.");
  const same = all.find((l) => l.id !== id && l.name.toLowerCase() === v.name.toLowerCase());
  if (same) return failed(`There's already a location called ${same.name}.`);

  // Its map for the game: drawn again (in the background) when it moved more than a few metres, got
  // wider or narrower, or has none (Leyte Academic Center on its hand-drawn plan has none, but keeps
  // that plan until it's moved, resized or drawn on purpose)
  const handDrawn = id === DEFAULT_LOCATION && old?.outlines == null;
  const shifted = !!old && (old.width !== v.width || metresBetween(old, { lat: v.lat, lng: v.lng }) > 3);
  const moved = !old || shifted || (!handDrawn && mapState(old.outlines) === "none");
  if (moved && handDrawn) await leaveHandPlan(sb, { id: DEFAULT_LOCATION, lat: v.lat, lng: v.lng, width: v.width });
  const row = moved ? { ...v, outlines: { drawing: new Date().toISOString() } } : v;

  if (!id) {
    const newId = idFrom(v.name, new Set(all.map((l) => l.id)));
    const sort = Math.max(0, ...all.map((l) => l.sort ?? 0)) + 1;
    const { error } = await sb.from("locations").insert({ ...row, id: newId, sort });
    if (error) return failed(dbError(error, "Someone added a location with that name just now. Try again."));
    if (v.live) await onlyOn(sb, newId);
    // An area for its codes to start with
    const { data: zones } = await sb.from("zones").select("id");
    await sb.from("zones").insert({ id: idFrom(v.name, new Set((zones ?? []).map((z) => z.id))), name: v.name, location_id: newId, sort: 1 });
    await drawLater({ id: newId, lat: v.lat, lng: v.lng, width: v.width });
    revalidatePath("/", "layout");
    redirect(afterAdd(fd, `/locations/${newId}`, "location"));
  }
  const { data, error } = await sb.from("locations").update(row).eq("id", id).select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("This location was removed by someone else.");
  if (v.live) await onlyOn(sb, id!);
  if (moved) await drawLater({ id: id!, lat: v.lat, lng: v.lng, width: v.width });
  revalidatePath("/", "layout");
  return done("Saved");
}

/**
 * Draws a location's map for the game again from OpenStreetMap (its buildings may have been added
 * since). For Leyte Academic Center still on its hand-drawn plan: draws it from OpenStreetMap instead.
 */
export async function redrawMap(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const sb = await supabase();
  const { data: l } = await sb.from("locations").select("id, lat, lng, width, outlines").eq("id", id).maybeSingle();
  if (!l) return failed("This location was removed by someone else.");
  if (l.id === DEFAULT_LOCATION && l.outlines == null) await leaveHandPlan(sb, l);
  const { error } = await sb.from("locations").update({ outlines: { drawing: new Date().toISOString() } }).eq("id", id);
  if (error) return failed(dbError(error));
  await drawLater(l);
  revalidatePath("/", "layout");
  return done("Drawing it…");
}

/**
 * Removes a location, with its areas and its QR codes (gone from the game, as deleting each would:
 * players keep what they found, as their finds don't hang on the code). Any of them, Leyte Academic
 * Center and the last one too (until another is added there are no QR codes to add).
 */
export async function deleteLocation(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const sb = await supabase();
  const { data: all, error: notYet } = await sb.from("locations").select("id");
  if (notYet) return failed(NEEDS_LOCATIONS);
  if (!all.some((l) => l.id === id)) return failed("This location was removed by someone else.");
  const { error: codesError } = await sb.from("codes").delete().eq("location_id", String(id));
  if (codesError) return failed(dbError(codesError));
  const { error } = await sb.from("locations").delete().eq("id", String(id));
  if (error) return failed(dbError(error));
  revalidatePath("/", "layout");
  redirect("/locations");
}

/** An area of a location (`zoneId` null: a new one): its name, as players read it ("Somewhere in the Main hall"). */
export async function saveZone(locationId: string, zoneId: string | null, name: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return failed("Give the area a name.");
  if (clean.length > 40) return failed("That name is too long (40 characters at most).");
  const sb = await supabase();
  const { data: zones, error: notYet } = await sb.from("zones").select("id, name, location_id, sort");
  if (notYet || zones.some((z) => z.location_id === undefined)) return failed(NEEDS_LOCATIONS);
  if (zones.some((z) => z.id !== zoneId && z.location_id === locationId && z.name.toLowerCase() === clean.toLowerCase()))
    return failed(`There's already an area called ${clean} here.`);
  const { error } = zoneId
    ? await sb.from("zones").update({ name: clean }).eq("id", zoneId).eq("location_id", locationId)
    : await sb.from("zones").insert({
        id: idFrom(clean, new Set(zones.map((z) => z.id))),
        name: clean,
        location_id: locationId,
        sort: Math.max(0, ...zones.filter((z) => z.location_id === locationId).map((z) => z.sort ?? 0)) + 1,
      });
  if (error) return failed(dbError(error, `There's already an area called ${clean} here.`));
  revalidatePath("/", "layout");
  return done(zoneId ? "Renamed" : "Added");
}

/** Removes an area: only when no QR code is in it, and not a location's last one. */
export async function deleteZone(zoneId: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const sb = await supabase();
  const { data: zone } = await sb.from("zones").select("id, location_id").eq("id", zoneId).maybeSingle();
  if (!zone) return failed("This area was removed by someone else.");
  const { count: codes } = await sb.from("codes").select("id", { count: "exact", head: true }).eq("zone_id", zoneId);
  if (codes) return failed(`${codes} QR code${codes === 1 ? " is" : "s are"} in it: move ${codes === 1 ? "it" : "them"} to another area first.`);
  const { count: left } = await sb.from("zones").select("id", { count: "exact", head: true }).eq("location_id", zone.location_id);
  if ((left ?? 0) <= 1) return failed("A location keeps at least one area for its codes.");
  const { error } = await sb.from("zones").delete().eq("id", zoneId);
  if (error) return failed(dbError(error));
  revalidatePath("/", "layout");
  return done("Removed");
}

/** Places matching a search, for adding a location. */
export async function findPlaces(q: string): Promise<{ places: Found[]; error?: string }> {
  if (!(await adminOnly())) return { places: [], error: NOT_ADMIN };
  const term = String(q ?? "").trim().slice(0, 120);
  if (term.length < 3) return { places: [], error: "Type at least 3 letters." };
  try {
    const places = await searchPlaces(term);
    return places.length ? { places } : { places, error: `Nothing found for “${term}”. Try the town's name too.` };
  } catch {
    return { places: [], error: "The place search didn't answer just now. Try again, or paste the coordinates instead." };
  }
}
