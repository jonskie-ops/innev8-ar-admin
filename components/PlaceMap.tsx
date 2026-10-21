"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import { areaOf, planOf } from "@/lib/venue";
import { TILES } from "./SatelliteMap";

/**
 * Where a location is, on a real map: its middle as a pin, and a dashed outline around what its map
 * in the game will show (`width` metres across). Tap the map or drag the pin to move it (`onMove`);
 * a move from elsewhere (a search, the phone's GPS) brings it into view.
 */
export function PlaceMap({
  lat,
  lng,
  width,
  view,
  onMove,
}: {
  lat: number | null;
  lng: number | null;
  width: number;
  view: "air" | "map";
  onMove?: (lat: number, lng: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<Leaflet.TileLayer[]>([]);
  const marks = useRef<{ pin: Leaflet.Marker; area: Leaflet.Polygon } | null>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  const latest = useRef(onMove);
  const wide = useRef(width);
  // Moved here (tap or drag): no need to bring it into view
  const ownMove = useRef(false);
  useEffect(() => {
    latest.current = onMove;
    wide.current = width;
  });

  useEffect(() => {
    let gone = false;
    let made: Leaflet.Map | null = null;
    let sized: ResizeObserver | null = null;
    void import("leaflet").then((mod) => {
      const Lf = mod.default;
      if (gone || !box.current) return;
      // The Philippines, until there's a place
      made = Lf.map(box.current, { maxZoom: 20, minZoom: 3, zoomSnap: 0.5 }).setView([11.2, 124.9], 6);
      made.attributionControl.setPrefix(false);
      made.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (!latest.current) return;
        ownMove.current = true;
        latest.current(e.latlng.lat, e.latlng.lng);
      });
      map.current = made;
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
      marks.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    for (const t of tiles.current) t.remove();
    tiles.current = TILES[view].map((t) =>
      L.tileLayer(t.url, {
        maxNativeZoom: t.native,
        maxZoom: 20,
        attribution: t.attribution,
        referrerPolicy: "strict-origin-when-cross-origin",
      }).addTo(m),
    );
  }, [L, view]);

  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    if (lat === null || lng === null) {
      marks.current?.pin.remove();
      marks.current?.area.remove();
      marks.current = null;
      return;
    }
    const corners = areaOf(planOf({ id: "place", lat, lng, width }));
    if (!marks.current) {
      const icon = L.divIcon({ className: "mpin-box", html: '<span class="mpin mpin--place"></span>', iconSize: [30, 30], iconAnchor: [15, 15] });
      const pin = L.marker([lat, lng], { icon, draggable: Boolean(latest.current), autoPan: true, title: "The middle of its map" });
      pin.on("drag", () => {
        const p = pin.getLatLng();
        const c = areaOf(planOf({ id: "place", lat: p.lat, lng: p.lng, width: wide.current }));
        marks.current?.area.setLatLngs(c);
      });
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        ownMove.current = true;
        latest.current?.(p.lat, p.lng);
      });
      marks.current = {
        area: L.polygon(corners, { color: "#12bfea", weight: 2, dashArray: "6 6", fillColor: "#12bfea", fillOpacity: 0.06, interactive: false }).addTo(m),
        pin: pin.addTo(m),
      };
    } else {
      marks.current.pin.setLatLng([lat, lng]);
      marks.current.area.setLatLngs(corners);
    }
    if (!ownMove.current) m.fitBounds(L.latLngBounds(corners), { padding: [24, 24], animate: false });
    ownMove.current = false;
  }, [L, lat, lng, width]);

  return (
    <div className="placemap">
      <div ref={box} className="smap" />
      {!L && (
        <p className="gmap__loading" role="status">
          <span className="spin" aria-hidden="true" />
          Loading the map…
        </p>
      )}
    </div>
  );
}
