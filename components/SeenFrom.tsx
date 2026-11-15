"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { compassPoint, SEEN } from "@/lib/hunt";
import { bearingTo, offsetBy } from "@/lib/venue";
import { TILES } from "./SatelliteMap";

type Spot = { lat: number; lng: number };

/** The fan's corners: the code's spot, then its arc (`dir` its middle, `width` wide, `r` metres out). */
function fan(spot: Spot, dir: number, width: number, r: number): [number, number][] {
  const pts: [number, number][] = [[spot.lat, spot.lng]];
  const steps = Math.max(6, Math.round(width / 6));
  for (let i = 0; i <= steps; i++) {
    const p = offsetBy(spot, dir - width / 2 + (width * i) / steps, r);
    pts.push([p.lat, p.lng]);
  }
  return pts;
}

/**
 * A code's "Seen from" side: Everywhere (no side), or a fan out from its GPS spot toward where players
 * must stand to see it, so they walk around a wall or a building first. The fan is set on a satellite
 * map around the spot: drag its handle (or tap the map) to point it, or turn it with the buttons; its
 * width is one of the presets. Sent with the form as seen_dir / seen_width (both empty: Everywhere).
 * It only counts in the game while the event's "Seen from one side" switch is on (`on`).
 */
export function SeenFrom({
  spot,
  radius,
  dir,
  width,
  onChange,
  on,
  ready,
  canEdit,
}: {
  spot: Spot;
  /** Players see the code within this many metres */
  radius: number;
  dir: number | null;
  width: number | null;
  onChange: (dir: number | null, width: number | null) => void;
  /** The event's switch (Settings) */
  on: boolean;
  /** The database has the seen-from update */
  ready: boolean;
  canEdit: boolean;
}) {
  const sided = width !== null && dir !== null;
  const pick = (w: number | null) => onChange(w === null ? null : (dir ?? 0), w);
  const turn = (by: number) => dir !== null && onChange((dir + by + 360) % 360, width);

  return (
    <div className="field seenfrom">
      <span className="field__label">Seen from</span>
      <div className="radius" role="group" aria-label="Seen from">
        <button type="button" className="radius__opt" aria-pressed={!sided} disabled={!canEdit} onClick={() => pick(null)}>
          <b>Everywhere</b>
          <small>Any side</small>
        </button>
        {SEEN.presets.map((p) => (
          <button
            key={p.w}
            type="button"
            className="radius__opt"
            aria-pressed={width === p.w}
            disabled={!canEdit || !ready}
            onClick={() => pick(p.w)}
          >
            <b>{p.label}</b>
            <small>{p.hint}</small>
          </button>
        ))}
      </div>
      {!ready ? (
        <span className="field__hint">
          Needs its update first: run supabase/migrations/20261115000000_seen_from.sql in Supabase&apos;s SQL Editor.
        </span>
      ) : sided ? (
        <>
          <FanMap spot={spot} radius={radius} dir={dir} width={width} onDir={(d) => onChange(d, width)} canEdit={canEdit} />
          <div className="seenfrom__turn">
            <span className="seenfrom__dir">
              Players stand to the <b>{compassPoint(dir)}</b> ({dir}°), {width}° wide
            </span>
            {canEdit && (
              <span className="seenfrom__btns">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => turn(-15)} aria-label="Turn the side 15° anticlockwise">
                  ↺ 15°
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => turn(15)} aria-label="Turn the side 15° clockwise">
                  15° ↻
                </button>
              </span>
            )}
          </div>
          <span className="field__hint">
            Point the fan at the side players must stand on: from anywhere else (behind the wall or building) the code stays
            hidden, even up close. {canEdit ? "Drag its handle or tap the map to turn it. " : ""}Big obstacles work best:
            phone GPS can&apos;t tell which side of a thin wall indoors someone is on.
          </span>
        </>
      ) : (
        <span className="field__hint">Players see it from every side.</span>
      )}
      {ready && sided && !on && (
        <p className="field__hint gpsspot__far">
          &quot;Seen from one side&quot; is off in <Link href="/account">Settings</Link>: players see this code from every side
          until it&apos;s turned on.
        </p>
      )}
      <input type="hidden" name="seen_dir" value={sided ? dir : ""} />
      <input type="hidden" name="seen_width" value={sided ? width : ""} />
    </div>
  );
}

/** The satellite map around the spot: the code's ring (its distance), the fan, and the fan's handle. */
function FanMap({
  spot,
  radius,
  dir,
  width,
  onDir,
  canEdit,
}: {
  spot: Spot;
  radius: number;
  dir: number;
  width: number;
  onDir: (dir: number) => void;
  canEdit: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<{ ring: Leaflet.Circle; fan: Leaflet.Polygon; dot: Leaflet.CircleMarker; handle: Leaflet.Marker } | null>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  // How far out the fan reaches: past the ring, so its handle is easy to grab
  const reach = Math.max(radius * 1.6, 14);
  // The latest of these, for Leaflet's own event handlers
  const latest = useRef({ spot, onDir, dir, reach });
  useEffect(() => {
    latest.current = { spot, onDir, dir, reach };
  });
  const dragging = useRef(false);

  // The map, once (Leaflet needs the browser, so it loads here)
  useEffect(() => {
    let gone = false;
    let made: Leaflet.Map | null = null;
    let sized: ResizeObserver | null = null;
    void import("leaflet").then((mod) => {
      const Lf = mod.default;
      if (gone || !box.current) return;
      made = Lf.map(box.current, { maxZoom: 21, minZoom: 15, zoomSnap: 0.5, scrollWheelZoom: false });
      made.attributionControl.setPrefix(false);
      for (const t of TILES.air)
        Lf.tileLayer(t.url, { maxNativeZoom: t.native, maxZoom: 21, attribution: t.attribution }).addTo(made);
      const m = made;
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (!canEdit) return;
        latest.current.onDir(Math.round(bearingTo(latest.current.spot, e.latlng)));
      });
      sized = new ResizeObserver(() => m.invalidateSize({ animate: false }));
      sized.observe(box.current);
      map.current = m;
      setL(Lf);
    });
    return () => {
      gone = true;
      sized?.disconnect();
      made?.remove();
      map.current = null;
      layers.current = null;
    };
    // (canEdit doesn't change while the page is open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The ring, the fan and its handle, as the spot, distance and side change
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    const tip = offsetBy(spot, dir, reach);
    const pts = fan(spot, dir, width, reach);
    if (!layers.current) {
      const handle = L.marker([tip.lat, tip.lng], {
        draggable: canEdit,
        keyboard: false,
        icon: L.divIcon({ className: "seenfrom__handle-box", html: '<span class="seenfrom__handle"></span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
        title: canEdit ? "Drag to turn the side" : "The side players stand on",
      });
      handle.on("dragstart", () => (dragging.current = true));
      handle.on("drag", () => latest.current.onDir(Math.round(bearingTo(latest.current.spot, handle.getLatLng()))));
      handle.on("dragend", () => {
        dragging.current = false;
        // Back onto the fan's arc, where it was let go
        const { spot: s, dir: d, reach: r } = latest.current;
        const p = offsetBy(s, d, r);
        handle.setLatLng([p.lat, p.lng]);
      });
      layers.current = {
        ring: L.circle([spot.lat, spot.lng], { radius, color: "#12bfea", weight: 1.5, dashArray: "5 6", fill: false, interactive: false }).addTo(m),
        fan: L.polygon(pts, { color: "#33d17a", weight: 2, fillColor: "#33d17a", fillOpacity: 0.28, interactive: false }).addTo(m),
        dot: L.circleMarker([spot.lat, spot.lng], { radius: 6, color: "#ffffff", weight: 2, fillColor: "#12bfea", fillOpacity: 1, interactive: false }).addTo(m),
        handle: handle.addTo(m),
      };
      m.fitBounds(L.latLng(spot.lat, spot.lng).toBounds(reach * 2.6), { animate: false });
    } else {
      const { ring, fan: f, dot, handle } = layers.current;
      ring.setLatLng([spot.lat, spot.lng]).setRadius(radius);
      f.setLatLngs(pts);
      dot.setLatLng([spot.lat, spot.lng]);
      // (while it's dragged, the handle follows the finger: put it back on the arc once let go)
      if (!dragging.current) handle.setLatLng([tip.lat, tip.lng]);
    }
  }, [L, spot, radius, dir, width, reach, canEdit]);

  // A new spot (GPS, typed, the pin moved): bring it back into view
  useEffect(() => {
    const m = map.current;
    if (!L || !m || !layers.current) return;
    m.fitBounds(L.latLng(spot.lat, spot.lng).toBounds(reach * 2.6), { animate: false });
    // (only when the spot itself moves)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, spot.lat, spot.lng]);

  return (
    <div className="seenfrom__map">
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
