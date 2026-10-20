/**
 * Leyte Academic Center grounds, Palo, Leyte, as drawn on the venue map (360×520 plan units, about
 * 3.3 units per metre; rotated from north so the buildings sit square).
 * Building, parking and driveway outlines: © OpenStreetMap contributors, ODbL
 * (ways 246376275, 104625261, 293135659, 245978057, 1192820998).
 */
export const VENUE = {
  /** Annex A. */
  annex: "M54.1 206.9L267.2 206.8L267.1 57.5L54.1 57.5Z",
  /** Corner of the main Leyte Academic Center building (context only). */
  academic: "M29.5 670.6L39.4 387.9L-27.7 387.9L-33.6 601.8L-112.7 600.7L-189.3 599.6L-185.8 385.1L-257.5 382.1L-260.2 665.1L-111.5 667.9Z",
  /** Parking. */
  parking: "M78.9 662.3L78.9 638.8L64.5 638.8L65.2 441.1L232.9 438.4L233.3 664.3L184.1 662.8L188.1 495.6L120.2 493.5L118.2 662.3Z",
  /** East driveway. */
  roads: "M284 710.4L293.3 609.9L302.9 466.7L312.1 411.4L318 324.2L319.2 237.2L319.5 193.9L318.2 186L315.7 178.9L311.9 173.7L307.2 171.7L295.3 171.4L286.8 171.1L279.5 171.2",
} as const;

/**
 * Where a QR code's pin can go: what the game's venue map shows (VenueMap's view, x 26–334 and
 * y 36–262), less a 4-unit margin so a pin is never cut off at its edge.
 */
export const PIN_AREA = { x0: 30, x1: 330, y0: 40, y1: 258 } as const;

/** The venue on Google Maps (admin only; the game doesn't link out). */
export const PLACE = {
  name: "Leyte Academic Center",
  address: "Barangay Pawing, Palo, Leyte",
  /** Its place page, and directions to it */
  link: "https://www.google.com/maps/search/?api=1&query=Leyte%20Academic%20Center%2C%20Pawing%2C%20Palo%2C%20Leyte",
  directions: "https://www.google.com/maps/dir/?api=1&destination=Leyte%20Academic%20Center%2C%20Pawing%2C%20Palo%2C%20Leyte",
  query: "Leyte Academic Center, Pawing, Palo, Leyte",
};

/**
 * Back from plan units to latitude and longitude: the plan was drawn from OpenStreetMap by turning
 * the grounds 116.6° and scaling 3.3 units to the metre around a point near Annex A, so this undoes
 * that (exact for the outlines; a pin is as close as it was placed on the plan).
 */
const LAT0 = 11.17824;
const LON0 = 125.00224;
const EARTH = 6371000;
const TURN = (112 * Math.PI) / 180; // from north
const SQUARE = (4.6 * Math.PI) / 180; // the extra turn that squares the buildings up
const PER_M = 3.3;
const ORIGIN = { x: 92.888067, y: -121.087091 }; // metres, at plan (180, 260)

export function toLatLng(x: number, y: number) {
  const xa = (x - 180) / PER_M + ORIGIN.x;
  const ya = (y - 260) / PER_M + ORIGIN.y;
  const xr = xa * Math.cos(SQUARE) - ya * Math.sin(SQUARE);
  const yr = -(xa * Math.sin(SQUARE) + ya * Math.cos(SQUARE));
  const east = xr * Math.cos(TURN) + yr * Math.sin(TURN);
  const north = -xr * Math.sin(TURN) + yr * Math.cos(TURN);
  const lat = LAT0 + (north / EARTH) * (180 / Math.PI);
  const lng = LON0 + (east / (EARTH * Math.cos((LAT0 * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

/** And the other way, latitude and longitude to plan units (for a pin dropped on a real map). */
export function toPlan(lat: number, lng: number) {
  const east = ((lng - LON0) * Math.PI) / 180 * EARTH * Math.cos((LAT0 * Math.PI) / 180);
  const north = ((lat - LAT0) * Math.PI) / 180 * EARTH;
  const xr = east * Math.cos(TURN) - north * Math.sin(TURN);
  const yr = -(east * Math.sin(TURN) + north * Math.cos(TURN));
  const xa = xr * Math.cos(SQUARE) + yr * Math.sin(SQUARE);
  const ya = -xr * Math.sin(SQUARE) + yr * Math.cos(SQUARE);
  return { x: 180 + (xa - ORIGIN.x) * PER_M, y: 260 + (ya - ORIGIN.y) * PER_M };
}

/** A plan position moved inside PIN_AREA (a GPS spot past the game's map shows at its edge). */
export const intoPinArea = (x: number, y: number) => ({
  x: Math.min(PIN_AREA.x1, Math.max(PIN_AREA.x0, x)),
  y: Math.min(PIN_AREA.y1, Math.max(PIN_AREA.y0, y)),
});

/**
 * A QR code's place on the ground: its own GPS spot, or else where its pin is on the venue map.
 * `own` false: worked out from the pin.
 */
export function spotOf(c: { lat?: number | null; lng?: number | null; x: number; y: number }) {
  return c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng, own: true } : { ...toLatLng(c.x, c.y), own: false };
}

/** Metres between two places (flat-earth: exact enough across a venue, and for a few kilometres). */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const k = Math.PI / 180;
  const north = (b.lat - a.lat) * k * EARTH;
  const east = (b.lng - a.lng) * k * EARTH * Math.cos(((a.lat + b.lat) / 2) * k);
  return Math.hypot(north, east);
}

/** How far a place is from the venue (Annex A), in metres. */
export const fromVenue = (p: { lat: number; lng: number }) => metresBetween(p, { lat: LAT0, lng: LON0 });

/**
 * A spot typed or pasted in: "11.17824, 125.00224" (as Google Maps copies it), with or without the
 * comma, or a Google Maps link with "@11.17824,125.00224" or "?q=11.17824,125.00224" in it.
 */
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  // (not starting inside another number, so "125.0, 11.1" the wrong way round isn't read as 25.0, 11.1)
  const m = input.match(/(?<![\d.])(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** "11.178240, 125.002240" */
export const latLngText = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

/** Google Maps, embedded: a place (or "lat,lng") with its pin, as a map or from the air. */
export const embedUrl = (q: string, view: "map" | "air", zoom: number) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=${view === "air" ? "k" : "m"}&z=${zoom}&hl=en&output=embed`;
/** A spot in Google Maps itself */
export const spotUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;
