"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Rarity } from "@/lib/hunt";
import type { Here } from "./here";

export type Spot = {
  id: string;
  num: number;
  name: string;
  rarity: Rarity;
  where: string;
  live: boolean;
  /** Its GPS spot (`own` false: worked out from its venue map pin) */
  lat: number;
  lng: number;
  own: boolean;
  /** Players see it within this many metres */
  radius: number;
};

/** Each rarity's colour (as the pins and the venue map show them), for the rings. */
const RING_COLOUR: Record<Rarity, string> = { common: "#12bfea", rare: "#20c9bc", legendary: "#d6b56d" };

/** Free map tiles: Esri's satellite photos (with place names on top), or OpenStreetMap. */
export const TILES = {
  air: [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      native: 18, // no closer photos here
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      native: 18,
      attribution: "",
    },
  ],
  map: [
    {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      native: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  ],
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A location on a real map, with each QR code as a numbered pin inside a ring (how close players must
 * be to see it) and a dashed outline around the area the game's map shows (`area`, its corners; a
 * new one needs a new map: key it by location). The pins stay put (a code moves on its own page). `me`:
 * this phone's location, as a dot with a ring for how sure it is.
 */
export function SatelliteMap({
  spots,
  area,
  view,
  picked,
  me = null,
  onPick,
}: {
  spots: Spot[];
  area: [number, number][];
  view: "air" | "map";
  picked: string | null;
  me?: Here | null;
  onPick: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<Leaflet.TileLayer[]>([]);
  const pins = useRef(new Map<string, Leaflet.Marker>());
  const rings = useRef(new Map<string, Leaflet.Circle>());
  const meMarks = useRef<{ dot: Leaflet.CircleMarker; ring: Leaflet.Circle } | null>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  // The latest of these, for Leaflet's own event handlers
  const latest = useRef({ spots, onPick, area });
  useEffect(() => {
    latest.current = { spots, onPick, area };
  });

  // The map, once (Leaflet needs the browser, so it loads here)
  useEffect(() => {
    let gone = false;
    let made: Leaflet.Map | null = null;
    let sized: ResizeObserver | null = null;
    const store = pins.current;
    const ringStore = rings.current;
    void import("leaflet").then((mod) => {
      const Lf = mod.default;
      if (gone || !box.current) return;
      const area = latest.current.area;
      made = Lf.map(box.current, { maxZoom: 20, minZoom: 12, zoomSnap: 0.5 });
      made.attributionControl.setPrefix(false);
      Lf.polygon(area, { color: "#12bfea", weight: 2, dashArray: "6 6", fill: false, interactive: false }).addTo(made);
      made.fitBounds(Lf.latLngBounds(area), { padding: [28, 28] });
      map.current = made;
      // Bigger or smaller (full screen, a turned phone): fill the new size, keeping the same middle
      const m = made;
      sized = new ResizeObserver(() => m.invalidateSize({ animate: false }));
      sized.observe(box.current);
      setL(Lf);
    });
    return () => {
      gone = true;
      sized?.disconnect();
      made?.remove();
      map.current = null;
      tiles.current = [];
      store.clear();
      ringStore.clear();
      meMarks.current = null;
    };
  }, []);

  // Satellite or map
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    for (const t of tiles.current) t.remove();
    tiles.current = TILES[view].map((t) =>
      L.tileLayer(t.url, {
        maxNativeZoom: t.native,
        maxZoom: 20,
        attribution: t.attribution,
        // OpenStreetMap asks to know which site its tiles are on
        referrerPolicy: "strict-origin-when-cross-origin",
      }).addTo(m),
    );
  }, [L, view]);

  // The pins: one per QR code, in its rarity's colour
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    const here = new Set<string>();
    for (const s of spots) {
      here.add(s.id);
      const cls = [
        "mpin",
        `mpin--${s.rarity}`,
        s.live ? "" : "is-off",
        s.id === picked ? "is-picked" : "",
      ]
        .filter(Boolean)
        .join(" ");
      // Only numbers and class names go in: nothing typed by anyone
      const icon = L.divIcon({ className: "mpin-box", html: `<span class="${cls}">${pad(s.num)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
      // Its ring: players see the code once they're inside it
      const ringStyle = {
        color: RING_COLOUR[s.rarity],
        weight: s.id === picked ? 2.5 : 1.5,
        opacity: s.live ? 0.9 : 0.4,
        dashArray: "5 6",
        fillColor: RING_COLOUR[s.rarity],
        fillOpacity: s.id === picked ? 0.16 : 0.08,
        interactive: false,
      };
      let ring = rings.current.get(s.id);
      if (!ring) {
        ring = L.circle([s.lat, s.lng], { ...ringStyle, radius: s.radius }).addTo(m);
        rings.current.set(s.id, ring);
      } else {
        ring.setLatLng([s.lat, s.lng]);
        ring.setRadius(s.radius);
        ring.setStyle(ringStyle);
      }
      let pin = pins.current.get(s.id);
      if (!pin) {
        const id = s.id;
        const made = L.marker([s.lat, s.lng], { icon, title: `#${s.num} ${s.name}` });
        made.on("click", () => latest.current.onPick(id));
        made.addTo(m);
        pins.current.set(id, made);
        pin = made;
      } else {
        pin.setLatLng([s.lat, s.lng]);
        pin.setIcon(icon);
      }
      pin.setZIndexOffset(s.id === picked ? 1000 : 0);
    }
    for (const [id, pin] of pins.current)
      if (!here.has(id)) {
        pin.remove();
        pins.current.delete(id);
        rings.current.get(id)?.remove();
        rings.current.delete(id);
      }
  }, [L, spots, picked]);

  // This phone, while "Show me" is on: a dot, and a ring for how sure the GPS is. The first fix
  // brings it into view.
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    if (!me) {
      meMarks.current?.dot.remove();
      meMarks.current?.ring.remove();
      meMarks.current = null;
      return;
    }
    if (!meMarks.current) {
      meMarks.current = {
        ring: L.circle([me.lat, me.lng], {
          radius: me.accuracy,
          color: "#4f9dff",
          weight: 1,
          fillColor: "#4f9dff",
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(m),
        dot: L.circleMarker([me.lat, me.lng], {
          radius: 7,
          color: "#ffffff",
          weight: 2.5,
          fillColor: "#2f7bff",
          fillOpacity: 1,
          interactive: false,
        }).addTo(m),
      };
      m.flyTo([me.lat, me.lng], Math.max(m.getZoom(), 19), { duration: 0.6 });
    } else {
      meMarks.current.dot.setLatLng([me.lat, me.lng]);
      meMarks.current.ring.setLatLng([me.lat, me.lng]).setRadius(me.accuracy);
    }
  }, [L, me]);

  // A pick from the list: fly there (or back over the whole area)
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    const s = latest.current.spots.find((x) => x.id === picked);
    if (s) m.flyTo([s.lat, s.lng], Math.max(m.getZoom(), 19), { duration: 0.6 });
    else m.flyToBounds(L.latLngBounds(latest.current.area), { padding: [28, 28], duration: 0.6 });
  }, [L, picked]);

  return (
    <>
      <div ref={box} className="smap" />
      {!L && (
        <p className="gmap__loading" role="status">
          <span className="spin" aria-hidden="true" />
          Loading the map…
        </p>
      )}
    </>
  );
}
