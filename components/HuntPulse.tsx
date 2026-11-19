"use client";

import { useEffect, useState } from "react";
import { readPulse } from "@/lib/actions/pulse";
import { ago } from "@/lib/format";
import type { Pulse } from "@/lib/hunt";

/** How often the numbers are read again while the Overview is on screen */
const REFRESH_MS = 30_000;

const num = (n: number) => n.toLocaleString("en-PH");

/**
 * How the hunt is going, on the Overview: players joined, finds so far, points earned and prizes
 * given, read again every 30 s while the page is on screen (so it can be left open; a fresh page
 * starts it again with its own). `at`: when the page read them (so "2 minutes ago" reads the same on the server and here). `shop`: there's a prize
 * that costs points, so the points still to spend show.
 */
export function HuntPulse({ pulse, at, shop }: { pulse: Pulse; at: number; shop: boolean }) {
  const [p, setP] = useState(pulse);
  const [now, setNow] = useState(at);
  useEffect(() => {
    let alive = true;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void readPulse()
        .then((next) => {
          if (!alive) return;
          if (next) setP(next);
          setNow(Date.now());
        })
        .catch(() => {});
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const tiles = [
    {
      key: "joined",
      label: "Players joined",
      value: p.joined,
      note: p.joined ? `${num(p.hunting)} found a code` : "Nobody yet",
    },
    {
      key: "finds",
      label: "Finds so far",
      value: p.finds,
      note: p.last ? `Last one ${ago(p.last, now)}` : "None yet",
    },
    {
      key: "points",
      label: "Points earned",
      value: p.earned,
      note: shop ? `${num(Math.max(0, p.earned - p.spent))} still to spend` : "By every player together",
    },
    {
      key: "prizes",
      label: "Prizes given",
      value: p.given,
      note: `${num(p.stock)} left in stock`,
    },
  ];

  return (
    <section aria-labelledby="pulse-title">
      <div className="shead">
        <h2 id="pulse-title">How the hunt is going</h2>
        {p.test ? (
          <span className="more pulse__test">Test mode: test play counts</span>
        ) : (
          <span className="more">
            <span className="pulse__dot" aria-hidden="true" />
            Updates every 30 s
          </span>
        )}
      </div>
      <dl className="pulse" aria-live="polite">
        {tiles.map((t) => (
          <div key={t.key} className={`pulse__tile pulse__tile--${t.key}`}>
            <dt>{t.label}</dt>
            <dd>{num(t.value)}</dd>
            <dd className="pulse__note">{t.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
