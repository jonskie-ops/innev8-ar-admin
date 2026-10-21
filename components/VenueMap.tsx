"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { drawnMap, mapState, type Location, type Outlines, type Rarity, type Zone } from "@/lib/hunt";
import { planOf, VENUE, type Plan } from "@/lib/venue";

/**
 * A location flat from above, as the game's map draws it (same 360×520 plan units, same outlines),
 * with each QR code as a numbered pin: Leyte Academic Center's Annex A–B and courtyard (drawn by
 * hand), or another location's buildings, roads and grounds from OpenStreetMap (`place`).
 * - Plain: pins link to their code's details.
 * - With `pick`: tapping a pin picks it (the `selected` one stands out), without leaving the page.
 * - With `move`: the `selected` pin is the one being placed; tap or drag on the map to put it there
 *   (arrow keys work too), the others are shown for reference.
 */

const PARTITIONS = [
  "M54 120H267M54 136H267", // Annex A: corridor
  "M107 57.5V120M160 57.5V120M213 57.5V120", // Annex A: rooms
  "M160 136V160M160 182V207", // Annex A: halls
].join("");
const BOOTHS = [
  [66, 148, 22],
  [118, 150, 22],
  [118, 184, 22],
  [180, 148, 22],
  [238, 150, 20],
  [238, 184, 20],
];

export type Pin = { id: string; num: number; name: string; rarity: Rarity; x: number; y: number; live: boolean };

type View = Plan["view"];
const at = (VIEW: View, x: number, y: number) =>
  ({ "--x": `${((x - VIEW.x) / VIEW.w) * 100}%`, "--y": `${((y - VIEW.y) / VIEW.h) * 100}%` }) as CSSProperties;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function VenueMap({
  pins,
  zones,
  selected,
  move,
  pick,
  label = "Map of the venue",
  place = null,
  still = false,
}: {
  pins: Pin[];
  zones: Zone[];
  selected?: string;
  move?: (x: number, y: number) => void;
  pick?: (id: string) => void;
  label?: string;
  /** The location (none: Leyte Academic Center) */
  place?: Pick<Location, "id" | "lat" | "lng" | "width" | "outlines"> | null;
  /** Pins that are only pictures (inside a link already, as on the Locations page's cards) */
  still?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const plan = planOf(place);
  const VIEW = plan.view;
  const osm = plan.hand ? null : drawnMap(place?.outlines);
  const state = plan.hand ? "drawn" : mapState(place?.outlines);
  const [dragging, setDragging] = useState(false);

  const putPin = (e: PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || !move) return;
    const x = VIEW.x + ((e.clientX - r.left) / r.width) * VIEW.w;
    const y = VIEW.y + ((e.clientY - r.top) / r.height) * VIEW.h;
    move(
      Math.round(clamp(x, VIEW.x + 4, VIEW.x + VIEW.w - 4) * 2) / 2,
      Math.round(clamp(y, VIEW.y + 4, VIEW.y + VIEW.h - 4) * 2) / 2,
    );
  };
  const nudge = (e: KeyboardEvent, pin: Pin) => {
    const step = e.shiftKey ? 10 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d || !move) return;
    e.preventDefault();
    move(clamp(pin.x + d[0], VIEW.x + 4, VIEW.x + VIEW.w - 4), clamp(pin.y + d[1], VIEW.y + 4, VIEW.y + VIEW.h - 4));
  };

  return (
    <div
      ref={boxRef}
      className={`vmap${move ? " vmap--edit" : ""}${dragging ? " is-dragging" : ""}`}
      role="group"
      aria-label={label}
      onPointerDown={
        move
          ? (e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              putPin(e);
            }
          : undefined
      }
      onPointerMove={move && dragging ? putPin : undefined}
      onPointerUp={move ? () => setDragging(false) : undefined}
      onPointerCancel={move ? () => setDragging(false) : undefined}
    >
      <svg className="vmap__floor" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        {plan.hand ? <HandDrawn /> : osm ? <FromOsm osm={osm} /> : null}
      </svg>
      {!osm && state !== "drawn" && (
        <span className="vmap__empty">
          {state === "drawing" ? (
            <>
              <span className="spin" aria-hidden="true" />
              Drawing its map from OpenStreetMap…
            </>
          ) : state === "failed" ? (
            "OpenStreetMap didn't answer: get the map again on the location's page"
          ) : (
            "Its map is drawn once it's saved"
          )}
        </span>
      )}

      {zones
        .filter((z) => z.label_x !== null && z.label_y !== null)
        .map((z) => (
          <span key={z.id} className="vmap__zone" style={at(VIEW, z.label_x!, z.label_y!)} aria-hidden="true">
            {z.name}
          </span>
        ))}

      {pins.map((p) => {
        const cls = `vpin vpin--${p.rarity}${p.live ? "" : " is-off"}${p.id === selected ? " is-selected" : ""}`;
        const head = <span className="vpin__head">{String(p.num).padStart(2, "0")}</span>;
        if (move)
          return p.id === selected ? (
            <span
              key={p.id}
              className={cls}
              style={at(VIEW, p.x, p.y)}
              tabIndex={0}
              role="img"
              aria-label={`Pin for #${p.num}: drag it, tap the map, or use the arrow keys`}
              onKeyDown={(e) => nudge(e, p)}
            >
              {head}
            </span>
          ) : (
            <span key={p.id} className={`${cls} is-other`} style={at(VIEW, p.x, p.y)} aria-hidden="true">
              {head}
            </span>
          );
        if (still)
          return (
            <span key={p.id} className={cls} style={at(VIEW, p.x, p.y)} aria-hidden="true">
              {head}
            </span>
          );
        if (pick)
          return (
            <button
              key={p.id}
              type="button"
              className={cls}
              style={at(VIEW, p.x, p.y)}
              aria-pressed={p.id === selected}
              aria-label={`#${p.num} ${p.name}${p.live ? "" : " (off)"}`}
              title={`#${p.num} ${p.name}`}
              onClick={() => pick(p.id)}
            >
              {head}
            </button>
          );
        return (
          <Link
            key={p.id}
            href={`/codes?code=${p.id}`}
            className={cls}
            style={at(VIEW, p.x, p.y)}
            aria-label={`#${p.num} ${p.name}${p.live ? "" : " (off)"}`}
            title={`#${p.num} ${p.name}`}
          >
            {head}
          </Link>
        );
      })}
      <span className="vmap__credit">© OpenStreetMap contributors</span>
    </div>
  );
}

/** Leyte Academic Center: Annex A–B, the walkway, parking and the east driveway, drawn by hand. */
function HandDrawn() {
  return (
    <>
      <path className="vmap__road" d={VENUE.roads} />
      <path className="vmap__lot" d={VENUE.parking} />
      <path className="vmap__walk" d="M54 228H316" />
      <path className="vmap__slab" d={VENUE.annex} />
      {BOOTHS.map(([x, y, w]) => (
        <rect key={`${x},${y}`} className="vmap__booth" x={x} y={y} width={w} height="12" rx="2" />
      ))}
      <path className="vmap__room" d={PARTITIONS} />
      <path className="vmap__wall" d={VENUE.annex} />
    </>
  );
}

/** Another location: OpenStreetMap's grounds, roads and buildings around it. */
function FromOsm({ osm }: { osm: Outlines }) {
  return (
    <>
      <path className="vmap__lot" d={osm.grounds} />
      <path className="vmap__road vmap__road--osm" d={osm.roads} />
      <path className="vmap__slab" d={osm.buildings} />
      <path className="vmap__wall vmap__wall--osm" d={osm.buildings} />
    </>
  );
}
