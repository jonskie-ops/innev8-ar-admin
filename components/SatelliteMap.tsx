"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Rarity } from "@/lib/hunt";
import { PIN_AREA, toLatLng } from "@/lib/venue";

export type Spot = {
  id: string;
  num: number;
  name: string;
  rarity: Rarity;
  where: string;
  live: boolean;
  lat: number;
  lng: number;
};

/** Free map tiles: Esri's satellite photos (with place names on top), or OpenStreetMap. */
const TILES = {
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

/** The area the game's map shows, as latitude/longitude corners. */
const AREA = (
  [
    [PIN_AREA.x0, PIN_AREA.y0],
    [PIN_AREA.x1, PIN_AREA.y0],
    [PIN_AREA.x1, PIN_AREA.y1],
    [PIN_AREA.x0, PIN_AREA.y1],
  ] as const
).map(([x, y]) => {
  const p = toLatLng(x, y);
  return [p.lat, p.lng] as [number, number];
});

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The venue on a real map, with each QR code as a numbered pin and a dashed outline around the area
 * the game's map shows. An admin drags a pin to move its code: `onDrop` saves it, and answers false
 * to put the pin back where it was.
 */
export function SatelliteMap({
  spots,
  view,
  picked,
  saving,
  canEdit,
  onPick,
  onDrop,
}: {
  spots: Spot[];
  view: "air" | "map";
  picked: string | null;
  saving: string | null;
  canEdit: boolean;
  onPick: (id: string) => void;
  onDrop: (id: string, lat: number, lng: number) => Promise<boolean>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<Leaflet.TileLayer[]>([]);
  const pins = useRef(new Map<string, Leaflet.Marker>());
  const [L, setL] = useState<typeof Leaflet | null>(null);
  // The latest of these, for Leaflet's own event handlers
  const latest = useRef({ spots, onPick, onDrop });
  useEffect(() => {
    latest.current = { spots, onPick, onDrop };
  });

  // The map, once (Leaflet needs the browser, so it loads here)
  useEffect(() => {
    let gone = false;
    let made: Leaflet.Map | null = null;
    let sized: ResizeObserver | null = null;
    const store = pins.current;
    void import("leaflet").then((mod) => {
      const Lf = mod.default;
      if (gone || !box.current) return;
      made = Lf.map(box.current, { maxZoom: 20, minZoom: 15, zoomSnap: 0.5 });
      made.attributionControl.setPrefix(false);
      Lf.polygon(AREA, { color: "#12bfea", weight: 2, dashArray: "6 6", fill: false, interactive: false }).addTo(made);
      made.fitBounds(Lf.latLngBounds(AREA), { padding: [28, 28] });
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
        s.id === saving ? "is-saving" : "",
        canEdit ? "can-move" : "",
      ]
        .filter(Boolean)
        .join(" ");
      // Only numbers and class names go in: nothing typed by anyone
      const icon = L.divIcon({ className: "mpin-box", html: `<span class="${cls}">${pad(s.num)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
      let pin = pins.current.get(s.id);
      if (!pin) {
        const id = s.id;
        const made = L.marker([s.lat, s.lng], { icon, draggable: canEdit, title: `#${s.num} ${s.name}`, autoPan: true });
        let from = made.getLatLng();
        made.on("click", () => latest.current.onPick(id));
        made.on("dragstart", () => {
          from = made.getLatLng();
        });
        made.on("dragend", () => {
          const to = made.getLatLng();
          void latest.current.onDrop(id, to.lat, to.lng).then((ok) => {
            if (!ok) made.setLatLng(from);
          });
        });
        made.addTo(m);
        pins.current.set(id, made);
        pin = made;
      } else {
        pin.setLatLng([s.lat, s.lng]);
        pin.setIcon(icon);
        if (canEdit) pin.dragging?.enable();
        else pin.dragging?.disable();
      }
      pin.setZIndexOffset(s.id === picked ? 1000 : 0);
    }
    for (const [id, pin] of pins.current)
      if (!here.has(id)) {
        pin.remove();
        pins.current.delete(id);
      }
  }, [L, spots, picked, saving, canEdit]);

  // A pick from the list: fly there (or back over the whole area)
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    const s = latest.current.spots.find((x) => x.id === picked);
    if (s) m.flyTo([s.lat, s.lng], Math.max(m.getZoom(), 19), { duration: 0.6 });
    else m.flyToBounds(L.latLngBounds(AREA), { padding: [28, 28], duration: 0.6 });
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
