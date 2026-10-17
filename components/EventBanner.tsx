"use client";

import { dateSpan } from "@/lib/format";
import { PLACE } from "@/lib/venue";
import { untilParts, useNow } from "./Clock";

/**
 * The summit at the top of the Event page: its dates and place, and a live countdown to the hunt
 * opening (or, while it's on, to it closing). As saved, not as being edited below.
 */
export function EventBanner({ startsAt, endsAt, testMode }: { startsAt: string; endsAt: string; testMode: boolean }) {
  const now = useNow();
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  const phase = now === null ? null : now >= b ? "ended" : now >= a ? "live" : "soon";
  const parts = now === null ? null : untilParts(phase === "live" ? b : a, now);
  const badge = testMode
    ? ["badge badge--test", "Test mode"]
    : phase === "live"
      ? ["badge badge--live", "On now"]
      : phase === "ended"
        ? ["badge badge--ended", "Ended"]
        : ["badge", "Coming up"];
  const units: [keyof NonNullable<typeof parts>, string][] = [
    ["days", "Days"],
    ["hours", "Hours"],
    ["min", "Min"],
    ["sec", "Sec"],
  ];

  return (
    <section className="evb" aria-label="The summit">
      <span className="evb__bg" aria-hidden="true" />
      <div className="evb__text">
        <p className="evb__top">
          <span className={badge[0]}>{badge[1]}</span>
          <span>
            {dateSpan(startsAt, endsAt)} · {PLACE.name}
          </span>
        </p>
        <h2>Regional ICT Summit 2026</h2>
        <p className="evb__sub">
          {phase === "ended" ? "The hunt is over." : phase === "live" ? "The hunt closes in" : "The hunt opens in"}
        </p>
      </div>
      {phase !== "ended" && (
        <div className="evb__clock" role="timer" aria-label="Countdown">
          {units.map(([k, label]) => (
            <span key={k} className="evb__unit">
              <b suppressHydrationWarning>{parts ? String(parts[k]).padStart(2, "0") : "––"}</b>
              <small>{label}</small>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
