"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import Link from "next/link";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { GiftIcon } from "./icons";

export type PrizeSlide = {
  id: string;
  name: string;
  photo: string | null;
  /** How the photo sits in its box (the prize's photo fit and size) */
  look?: CSSProperties;
  /** "4 of 8 QR codes", "The gold code"… and that share of the hunt, 0–100 */
  needs: string;
  share: number;
  stock: number;
  live: boolean;
  updated: string;
};

/**
 * The overview's prizes, one at a time: the photos fanned out (tap one at the side, a dot, or use the
 * arrow keys to bring it to the front), and for the one in front, how much of the hunt it takes.
 */
export function PrizeCarousel({ prizes }: { prizes: PrizeSlide[] }) {
  const [at, setAt] = useState(0);
  const n = prizes.length;
  const i0 = Math.min(at, n - 1);
  const p = prizes[i0];
  const go = (i: number) => setAt((i + n) % n);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      go(i0 + (e.key === "ArrowRight" ? 1 : -1));
    }
  };

  return (
    <div className="pc">
      <div className="pc__stage" role="group" aria-label="Prize photos" onKeyDown={onKeyDown}>
        {prizes.map((x, i) => {
          // How far from the front, the short way round
          let d = i - i0;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const front = d === 0;
          const photo = x.photo ? (
            <img src={x.photo} alt="" loading="lazy" style={x.look} />
          ) : (
            <span className="pc__ph">
              <GiftIcon />
            </span>
          );
          // The same element front and side, so it glides between the two
          return (
            <Link
              key={x.id}
              href={`/prizes/${x.id}`}
              className={front ? "pc__card is-front" : "pc__card"}
              style={{ "--d": d, "--ad": Math.abs(d) } as CSSProperties}
              data-far={Math.abs(d) > 2 || undefined}
              data-stay={front ? undefined : true}
              tabIndex={front ? undefined : -1}
              aria-label={front ? `Open ${x.name}` : `Show ${x.name}`}
              onClick={
                front
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      go(i);
                    }
              }
            >
              {photo}
            </Link>
          );
        })}
      </div>
      {n > 1 && (
        <div className="pc__dots">
          {prizes.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-label={`Show ${x.name}`}
              aria-current={i === i0 || undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}

      <h3 className="pc__name">
        <Link href={`/prizes/${p.id}`}>{p.name}</Link>
      </h3>
      <p className="pc__need">
        <span>Needs</span>
        <span>{p.needs}</span>
      </p>
      <span className="bar" role="img" aria-label={`${p.share}% of the hunt`}>
        <i style={{ width: `${p.share}%` }} />
      </span>
      <dl className="pc__stats">
        <div>
          <dt>In stock</dt>
          <dd className={p.stock ? undefined : "is-out"}>{p.stock ? p.stock.toLocaleString("en-PH") : "None"}</dd>
        </div>
        <div>
          <dt>In the game</dt>
          <dd className={p.live ? "is-on" : undefined}>{p.live ? "Yes" : "Off"}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{p.updated}</dd>
        </div>
      </dl>
    </div>
  );
}
