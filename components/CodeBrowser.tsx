"use client";
/* eslint-disable @next/next/no-img-element -- the sponsors' small round badges */

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GAME_URL, RARITIES, RARITY_LABEL, taskOf, type Location, type Rarity, type SponsorView, type Task, type Zone } from "@/lib/hunt";
import { pad, SponsorBadge } from "./bits";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  ExternalIcon,
  MapIcon,
  PencilIcon,
  PinIcon,
} from "./icons";
import { LiveSwitch } from "./LiveSwitch";
import { QrGlyph } from "./QrGlyph";
import { VenueMap } from "./VenueMap";

export type CodeItem = {
  id: string;
  num: number;
  name: string;
  code: string;
  rarity: Rarity;
  points: number;
  live: boolean;
  zone: string;
  spot: string;
  clue: string;
  blurb: string;
  task: Task;
  /** Its sponsor, or null (none) */
  sponsor: SponsorView | null;
  /** Its location's id */
  location: string;
  x: number;
  y: number;
  /** "2 hours ago", and the exact time */
  ago: string;
  stamp: string;
};

/**
 * The QR codes: the venue map and every code's number under it (between ‹ › arrows) on the left; tap
 * one, on the map or below it, and its details show on the right. The arrow keys go to the next or previous code, and the page's
 * address keeps the one being looked at (/codes?code=px05), so it can be shared or reloaded.
 */
export function CodeBrowser({
  codes,
  zones,
  locations,
  initial,
  canEdit,
}: {
  codes: CodeItem[];
  zones: Zone[];
  /** The map shows the picked code's location, with its codes */
  locations: Pick<Location, "id" | "name" | "lat" | "lng" | "width" | "outlines">[];
  initial: string | null;
  canEdit: boolean;
}) {
  const [picked, setPicked] = useState(() => (codes.some((c) => c.id === initial) ? initial : (codes[0]?.id ?? null)));
  const detail = useRef<HTMLElement>(null);
  const chips = useRef<HTMLUListElement>(null);
  const i = Math.max(
    0,
    codes.findIndex((c) => c.id === picked),
  );
  const c = codes[i];
  const sponsor = c?.sponsor;
  const place = locations.find((l) => l.id === c?.location) ?? locations[0];

  // With more numbers than fit, slide the row so the picked one is in view (sideways only)
  useEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: left - (row.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [picked]);

  const pick = (id: string) => {
    setPicked(id);
    window.history.replaceState(null, "", `?code=${encodeURIComponent(id)}`);
    // Stacked (phone, narrow window): bring the details into view if they're below
    const box = detail.current?.getBoundingClientRect();
    if (box && window.innerWidth < 1100 && box.top > window.innerHeight - 140)
      detail.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const step = (d: 1 | -1) => codes.length && pick(codes[(i + d + codes.length) % codes.length].id);

  // ← → for the previous and next code, when not typing somewhere
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], [role=slider]")) return;
      e.preventDefault();
      latest.current(e.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!c) return null;

  return (
    <div className="qb">
      <section className="panel qb__map" aria-label="Map and numbers">
        {/* The legend sits on the map, in its corner */}
        <div className="qb__mapbox">
          <VenueMap
            key={place.id}
            place={place}
            pins={codes.filter((x) => x.location === place.id)}
            zones={zones.filter((z) => (z.location_id ?? "lac") === place.id)}
            selected={c.id}
            pick={pick}
            label={`Map of ${place.name}: tap a number`}
          />
          {locations.length > 1 && <span className="qb__place">{place.name}</span>}
          <ul className="legend qb__legend" role="list" aria-label="Pin colours">
            {RARITIES.map((r) => (
              <li key={r} className={`legend__item legend__item--${r}`}>
                {RARITY_LABEL[r]}
              </li>
            ))}
            <li className="legend__item legend__item--off">Off</li>
          </ul>
        </div>

        {/* ‹ 01 02 03 … › under the map: the numbers centred, sliding sideways when there are many */}
        <nav className="qpager" aria-label="QR codes">
          <button type="button" className="qpager__arrow" aria-label="Previous QR code" title="Previous (←)" onClick={() => step(-1)}>
            <ChevronLeftIcon />
          </button>
          <ul ref={chips} className="qchips" role="list">
            {codes.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={`qchip qchip--${x.rarity}${x.live ? "" : " is-off"}`}
                  aria-pressed={x.id === c.id}
                  aria-label={`#${x.num} ${x.name}${x.live ? "" : " (off)"}`}
                  title={`#${x.num} ${x.name}`}
                  onClick={() => pick(x.id)}
                >
                  {pad(x.num)}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="qpager__arrow" aria-label="Next QR code" title="Next (→)" onClick={() => step(1)}>
            <ChevronRightIcon />
          </button>
        </nav>
      </section>

      <section
        ref={detail}
        className={`panel qd qd--${c.rarity}${c.live ? "" : " is-off"}`}
        aria-live="polite"
        aria-label={`#${c.num} ${c.name}`}
      >
        <div className="qd__cover">
          <span className="qd__num">#{pad(c.num)}</span>
          <span className="qd__steps">
            <button
              type="button"
              className="qd__step"
              aria-label="Previous QR code"
              title="Previous (←)"
              onClick={() => step(-1)}
            >
              <ArrowLeftIcon />
            </button>
            <span className="qd__count">
              {i + 1} / {codes.length}
            </span>
            <button
              type="button"
              className="qd__step"
              aria-label="Next QR code"
              title="Next (→)"
              onClick={() => step(1)}
            >
              <ArrowRightIcon />
            </button>
          </span>
          <span className="ccard__floor qd__floor" aria-hidden="true" />
          {/* A new tile per code, so its float and scan line start afresh */}
          <span key={c.id} className="qd__qr" style={{ "--i": c.num } as CSSProperties} aria-hidden="true">
            <QrGlyph seed={c.id} />
            <span className="qr-clip">
              <span className="ccard__beam" />
            </span>
            <SponsorBadge sponsor={c.sponsor} />
          </span>
        </div>

        <div className="qd__head">
          <div className="qd__title">
            <h2>{c.name}</h2>
            <p>
              <PinIcon />
              {c.zone}
              {c.spot && ` · ${c.spot}`}
              {locations.length > 1 && ` · ${place.name}`}
            </p>
          </div>
          <span className="qd__worth">
            <b>{c.points.toLocaleString("en-PH")}</b>
            <small>pts</small>
            <span className={`rbadge rbadge--${c.rarity}`}>{RARITY_LABEL[c.rarity]}</span>
          </span>
        </div>

        <div className="qd__live">
          <span>
            <b>In the game</b>
            <small>{c.live ? "Players can find it now." : "Hidden: players can't find it."}</small>
          </span>
          <LiveSwitch
            key={c.id}
            kind="codes"
            id={c.id}
            live={c.live}
            label={`#${c.num} ${c.name} in the game`}
            disabled={!canEdit}
          />
        </div>

        <div className="qd__words">
          <div>
            <p className="qd__label">Clue</p>
            {c.clue ? <blockquote className="qd__clue">{c.clue}</blockquote> : <p className="empty">No clue yet.</p>}
          </div>
          {c.task !== "none" && (
            <div>
              <p className="qd__label">Extra task</p>
              <p className="qd__task">
                <b>{taskOf(c.task).label}</b>
                {taskOf(c.task).player}
              </p>
            </div>
          )}
          <div>
            <p className="qd__label">When it&apos;s found</p>
            {c.blurb ? <p className="qd__blurb">{c.blurb}</p> : <p className="empty">No description yet.</p>}
          </div>
          <div>
            <p className="qd__label">Sponsor</p>
            {sponsor ? (
              <p className="qd__sponsor">
                <img src={sponsor.badge} alt="" width={28} height={28} />
                {sponsor.name}
              </p>
            ) : (
              <p className="empty">No sponsor.</p>
            )}
          </div>
        </div>

        <dl className="qd__facts">
          <div>
            <dt>Code</dt>
            <dd>
              <CopyCode value={c.code} />
            </dd>
          </div>
          <div>
            <dt>Last changed</dt>
            <dd title={c.stamp}>{c.ago}</dd>
          </div>
        </dl>

        <div className="qd__acts">
          <Link href={`/codes/${c.id}`} className="btn btn--primary btn--sm">
            {canEdit ? <PencilIcon /> : <EyeIcon />}
            {canEdit ? "Edit" : "All details"}
          </Link>
          <Link href={`/map?code=${encodeURIComponent(c.id)}`} className="btn btn--ghost btn--sm">
            <MapIcon />
            On the map
          </Link>
          <a
            href={`${GAME_URL}/?s=${encodeURIComponent(c.code)}`}
            target="_blank"
            rel="noopener"
            className="btn btn--ghost btn--sm"
            title="Opens the game straight to this code. It counts as found in the game on this device."
          >
            <ExternalIcon />
            Try in the game
          </a>
        </div>
      </section>
    </div>
  );
}

/** The code's value, with a button to copy it. */
function CopyCode({ value }: { value: string }) {
  const [copied, setCopied] = useState("");
  return (
    <span className="qd__code">
      <code>{value}</code>
      <button
        type="button"
        className="icon-btn"
        aria-label={copied === value ? "Copied" : `Copy ${value}`}
        title={copied === value ? "Copied" : "Copy"}
        onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(value))}
      >
        {copied === value ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  );
}
