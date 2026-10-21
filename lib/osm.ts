import "server-only";
import type { Outlines } from "./hunt";
import { planOf, type Where } from "./venue";

/**
 * OpenStreetMap, for the locations: finding a place by name (Nominatim) and drawing a location's map
 * for the game from the buildings, roads and grounds around it (Overpass). Both are free services
 * that ask to know who's asking, and to be asked rarely: only when an organiser searches, adds a
 * location or moves one. Map data © OpenStreetMap contributors, ODbL (both maps credit it).
 */
const AGENT = "INNEV8-QR-Hunt-Admin/1.0 (+https://innev8.org)";

export type Found = { name: string; address: string; lat: number; lng: number };

/** Places matching what was typed ("SM City Tacloban", "Palo, Leyte"…), best first; Philippine places come first. */
export async function searchPlaces(q: string): Promise<Found[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "6", addressdetails: "0", "accept-language": "en", countrycodes: "ph" }).toString();
  let list = await nominatim(url);
  if (!list.length) {
    url.searchParams.delete("countrycodes");
    list = await nominatim(url);
  }
  return list;
}

async function nominatim(url: URL): Promise<Found[]> {
  const res = await fetch(url, { headers: { "User-Agent": AGENT }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[];
  return rows.map((r) => {
    const parts = r.display_name.split(", ");
    const name = r.name || parts[0];
    return {
      name: name.slice(0, 60),
      address: parts.filter((p) => p !== name).slice(0, 4).join(", ").slice(0, 120),
      lat: Number(r.lat),
      lng: Number(r.lon),
    };
  });
}

/**
 * A location's map for the game: OpenStreetMap's outlines around it, as SVG drawings in its plan
 * units (lib/venue.ts, planOf). `buildings` and `grounds` (parking, parks, fields) are closed shapes,
 * `roads` lines. Taken from a little past what the game's map shows (it fades out at its edges); the
 * nearest buildings first, up to what keeps the game's download small.
 */
export type { Outlines } from "./hunt";

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const ROADS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|path|track";
const MAX_BUILDINGS = 450;
const MAX_ROADS = 260;
const MAX_GROUNDS = 80;
/** The whole drawing's size limit, in characters (it goes to every phone with the hunt) */
const MAX_CHARS = 90000;

type Point = { lat: number; lon: number };
/** A way, or a relation (a big building drawn as a multipolygon: its outer rings come as members) */
type Way = {
  type: string;
  tags?: Record<string, string>;
  geometry?: Point[];
  members?: { type: string; role: string; geometry?: Point[] }[];
};

export async function fetchOutlines(where: Where): Promise<Outlines> {
  const plan = planOf(where);
  // What the game's map can show, with its fade: ±width east-west, ±1.3 width north-south
  const dLat = (1.3 * where.width) / 111320;
  const dLng = where.width / (111320 * Math.cos((where.lat * Math.PI) / 180));
  const box = [where.lat - dLat, where.lng - dLng, where.lat + dLat, where.lng + dLng].map((v) => v.toFixed(6)).join(",");
  const query = `[out:json][timeout:60];(way["building"](${box});rel["building"](${box});way["highway"~"^(${ROADS})$"](${box});way["amenity"="parking"](${box});way["leisure"~"^(park|pitch|garden|playground|sports_centre)$"](${box});way["landuse"~"^(grass|recreation_ground)$"](${box}););out geom qt;`;
  let ways: Way[] | null = null;
  let last: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(75000), // it can take its time when it's busy
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      ways = ((await res.json()) as { elements: Way[] }).elements;
      break;
    } catch (e) {
      last = e;
    }
  }
  if (!ways) throw last instanceof Error ? last : new Error("overpass");
  // A relation's outer rings, as ways of their own with its tags
  ways = ways.flatMap((w) =>
    w.type === "relation"
      ? (w.members ?? []).filter((m) => m.role === "outer" && m.geometry?.length).map((m) => ({ type: "way", tags: w.tags, geometry: m.geometry }))
      : [w],
  );

  const r1 = (v: number) => Math.round(v * 10) / 10;
  /** A way in plan units, without points closer than `min` to the one before */
  const points = (w: Way, min: number) => {
    const out: [number, number][] = [];
    for (const g of w.geometry ?? []) {
      const p = plan.toPlan(g.lat, g.lon);
      const q: [number, number] = [r1(p.x), r1(p.y)];
      const prev = out[out.length - 1];
      if (!prev || Math.hypot(q[0] - prev[0], q[1] - prev[1]) >= min) out.push(q);
    }
    return out;
  };
  const path = (pts: [number, number][], closed: boolean) =>
    pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + (closed ? "Z" : "");
  const near = (pts: [number, number][]) => {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return Math.hypot(cx - 180, (cy - 260) * 0.8);
  };
  const shapes = (keep: (t: Record<string, string>) => boolean, closed: boolean, min: number, max: number) =>
    ways!
      .filter((w) => w.type === "way" && keep(w.tags ?? {}))
      .map((w) => points(w, min))
      .filter((pts) => pts.length >= (closed ? 3 : 2))
      .map((pts) => ({ d: path(pts, closed), far: near(pts) }))
      .sort((a, b) => a.far - b.far)
      .slice(0, max);

  const buildings = shapes((t) => Boolean(t.building), true, 0.6, MAX_BUILDINGS);
  const roads = shapes((t) => Boolean(t.highway), false, 1.2, MAX_ROADS);
  const grounds = shapes((t) => !t.building && !t.highway, true, 1.2, MAX_GROUNDS);
  // Too much for the phones: the farthest go first
  const size = () => [buildings, roads, grounds].flat().reduce((n, s) => n + s.d.length, 0);
  while (size() > MAX_CHARS && (buildings.length || roads.length)) {
    if (buildings.length >= roads.length) buildings.pop();
    else roads.pop();
  }
  return {
    buildings: buildings.map((s) => s.d).join(""),
    roads: roads.map((s) => s.d).join(""),
    grounds: grounds.map((s) => s.d).join(""),
    count: buildings.length,
    at: new Date().toISOString(),
  };
}
