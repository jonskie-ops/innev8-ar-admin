"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

const TURN = 2400; // ms for one full turn

/**
 * The Sponsors page's list of cards. Hovering a card turns its logo coin round and round; leaving
 * it lets the turn it's on finish, so the coin always stops facing you (no snapping back).
 */
export function SponsorCoins({ children }: { children: ReactNode }) {
  const spins = useRef(new WeakMap<Element, Animation>());

  // The card the pointer came into or left; null while it only moves inside one card
  const crossed = (e: MouseEvent) => {
    const card = (e.target as Element).closest(".spcard");
    return card && !card.contains(e.relatedTarget as Node | null) ? card.querySelector(".spcard__spin") : null;
  };

  const start = (e: MouseEvent) => {
    const coin = crossed(e);
    if (!coin || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const turning = spins.current.get(coin);
    if (turning?.playState === "running") return turning.effect?.updateTiming({ iterations: Infinity });
    spins.current.set(
      coin,
      coin.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }], { duration: TURN, iterations: Infinity }),
    );
  };

  const stop = (e: MouseEvent) => {
    const coin = crossed(e);
    const turning = coin && spins.current.get(coin);
    if (turning) turning.effect?.updateTiming({ iterations: Math.floor(Number(turning.currentTime) / TURN) + 1 });
  };

  return (
    <ul className="spcards" role="list" onMouseOver={start} onMouseOut={stop}>
      {children}
    </ul>
  );
}
