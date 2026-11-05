"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { orderSponsors } from "@/lib/actions/sponsors";
import type { FormState } from "@/lib/form";
import { CardRail } from "./CardRail";
import { AutoSaveToast } from "./form";

const TURN = 2400; // ms for one full turn
const EDGE = 64; // px from the row's end where a dragged card slides the row along
const HOLD = 350; // ms a finger holds a card still before it's picked up

type Drag = {
  id: string;
  list: HTMLUListElement;
  card: HTMLElement;
  /** Where on the card it was picked up, and where the pointer is now */
  grab: number;
  x: number;
  /** How far the card is shifted from its place in the row, to stay under the pointer */
  shift: number;
  /** The order when it was picked up */
  start: string[];
  frame: number;
};

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * The Sponsors page's cards, in one row. Hovering a card turns its logo coin round and round; leaving
 * it lets the turn it's on finish, so the coin always stops facing you (no snapping back).
 *
 * `sortable` (admins): a card can be picked up (the cursor shows a hand) and moved along the row: with
 * a mouse, press it and move; with a finger, hold it a moment, then move. Near an end the row slides
 * on, and the others make room; let go and the new order is saved. Each card is an <li> with `data-id` and its sponsor's id as `key`.
 */
export function SponsorCoins({ children, sortable = false }: { children: ReactNode; sortable?: boolean }) {
  const spins = useRef(new WeakMap<Element, Animation>());
  const drag = useRef<Drag | null>(null);

  // ---- The coins
  // The card the pointer came into or left; null while it only moves inside one card
  const crossed = (e: MouseEvent) => {
    const card = (e.target as Element).closest(".spcard");
    return card && !card.contains(e.relatedTarget as Node | null) ? card.querySelector(".spcard__spin") : null;
  };

  const start = (e: MouseEvent) => {
    const coin = crossed(e);
    if (!coin || drag.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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

  // ---- The order
  const cards = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const idOf = (c: ReactElement) => String(c.key).replace(/^\.\$/, "");
  const given = cards.map(idOf);
  // The order on screen: as dragged here, until the page brings a different set of sponsors
  const [moved, setMoved] = useState<string[] | null>(null);
  const order = moved && sameIds(moved, given) ? moved : given;
  const shown = order.map((id) => cards.find((c) => idOf(c) === id)!);

  const [dragging, setDragging] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [saving, setSaving] = useState(false);
  // Where each card was before the last move, so the others glide to their new places
  const before = useRef(new Map<string, number>());

  const cardsOf = (list: HTMLUListElement) => [...list.children] as HTMLElement[];
  const remember = (list: HTMLUListElement) => {
    before.current = new Map(cardsOf(list).map((li) => [li.dataset.id ?? "", li.getBoundingClientRect().left]));
  };

  const save = async (next: string[], was: string[]) => {
    setSaving(true);
    setState(null);
    try {
      const done = await orderSponsors(next);
      setState(done);
      if (done?.error) setMoved(was);
    } catch {
      setState({ error: "Couldn't save the order. Try again.", at: Date.now() });
      setMoved(was);
    } finally {
      setSaving(false);
    }
  };

  /** Keeps the dragged card under the pointer, wherever its place in the row now is. */
  const follow = () => {
    const d = drag.current;
    if (!d) return;
    const home = d.card.getBoundingClientRect().left - d.shift;
    d.shift = d.x - d.grab - home;
    d.card.style.transform = `translate3d(${d.shift}px, -6px, 0)`;
  };

  /** The dragged card's place: before the first card whose middle is right of its own. */
  const place = () => {
    const d = drag.current;
    if (!d) return;
    const others = cardsOf(d.list).filter((li) => li !== d.card);
    const middle = d.x - d.grab + d.card.offsetWidth / 2;
    let at = others.findIndex((li) => {
      const r = li.getBoundingClientRect();
      return middle < r.left + r.width / 2;
    });
    if (at < 0) at = others.length;
    const next = others.map((li) => li.dataset.id ?? "");
    next.splice(at, 0, d.id);
    if (next.join() !== cardsOf(d.list).map((li) => li.dataset.id).join()) {
      remember(d.list);
      setMoved(next);
    }
    follow();
  };

  // After a move: the other cards glide from where they were, and the dragged one stays under the pointer
  useLayoutEffect(() => {
    const list = drag.current?.list ?? document.querySelector<HTMLUListElement>(".spcards .crail");
    if (!list || !before.current.size) return;
    for (const li of cardsOf(list)) {
      const was = before.current.get(li.dataset.id ?? "");
      if (was === undefined || li === drag.current?.card) continue;
      const dx = was - li.getBoundingClientRect().left;
      if (Math.abs(dx) > 1) li.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 180, easing: "ease-out" });
    }
    before.current = new Map();
    follow();
  }, [order]);

  /** Near an end of the row, a dragged card slides it along (and keeps finding its place). */
  const slide = () => {
    const d = drag.current;
    if (!d) return;
    const r = d.list.getBoundingClientRect();
    const by = d.x < r.left + EDGE ? -12 : d.x > r.right - EDGE ? 12 : 0;
    if (by) {
      d.list.scrollLeft += by;
      place();
    }
    d.frame = requestAnimationFrame(slide);
  };

  /** Picks the card up: from here on it follows the pointer. */
  const begin = (card: HTMLElement, list: HTMLUListElement, x: number, pointer: number) => {
    try {
      card.setPointerCapture(pointer);
    } catch {
      // (the pointer is already gone: nothing to follow)
      return;
    }
    const left = card.getBoundingClientRect().left;
    drag.current = { id: card.dataset.id ?? "", list, card, grab: x - left, x, shift: 0, start: order, frame: 0 };
    drag.current.frame = requestAnimationFrame(slide);
    setDragging(drag.current.id);
    follow();
  };

  // A card pressed but not picked up yet: with a mouse it's picked up once it moves; with a finger once
  // it's held still for a moment (moving first is a swipe along the row). Let go before that: a click.
  const held = useRef<{ card: HTMLElement; list: HTMLUListElement; x: number; y: number; pointer: number; finger: boolean; timer: number } | null>(null);
  // The click that ends a drag doesn't open the sponsor
  const dropped = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    const t = e.target as Element;
    const card = t.closest<HTMLElement>("li[data-id]");
    if (!sortable || !card || e.button !== 0 || saving || drag.current) return;
    // The card's buttons (in use, delete) don't move it
    if (t.closest("button")) return;
    const finger = e.pointerType !== "mouse";
    const press = { card, list: e.currentTarget, x: e.clientX, y: e.clientY, pointer: e.pointerId, finger, timer: 0 };
    if (finger)
      press.timer = window.setTimeout(() => {
        if (held.current !== press) return;
        held.current = null;
        begin(press.card, press.list, press.x, press.pointer);
        navigator.vibrate?.(12);
      }, HOLD);
    held.current = press;
  };

  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    const press = held.current;
    if (press) {
      const far = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      if (press.finger) {
        // Moved before the hold: a swipe, so the row slides as usual
        if (far > 8) {
          clearTimeout(press.timer);
          held.current = null;
        }
        return;
      }
      if (far < 5) return;
      held.current = null;
      begin(press.card, press.list, press.x, press.pointer);
    }
    if (!drag.current) return;
    drag.current.x = e.clientX;
    place();
  };

  const onPointerUp = () => {
    if (held.current) clearTimeout(held.current.timer);
    held.current = null;
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    drag.current = null;
    setDragging(null);
    dropped.current = true;
    window.setTimeout(() => (dropped.current = false), 0);
    // It glides back into its place (the card's own transition)
    d.card.style.transform = "";
    const next = cardsOf(d.list).map((li) => li.dataset.id ?? "");
    if (next.join() !== d.start.join()) void save(next, d.start);
  };

  const onClickCapture = (e: MouseEvent) => {
    if (!dropped.current) return;
    dropped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // While a card is held or dragged by a finger, the row mustn't scroll, and the phone's long-press menu
  // on the link mustn't open (a listener that can say no, so it's there from the start of the touch)
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = rail.current?.querySelector(".crail");
    if (!sortable || !list) return;
    const still = (e: Event) => {
      if (drag.current) e.preventDefault();
    };
    list.addEventListener("touchmove", still, { passive: false });
    return () => list.removeEventListener("touchmove", still);
  }, [sortable]);

  return (
    <>
      {/* One row of cards, slid sideways with the arrows at its ends (or a swipe) */}
      <div ref={rail} className="spcards-box">
        <CardRail
          label="Sponsors"
          className={`spcards${sortable ? " can-sort" : ""}${dragging ? " is-sorting" : ""}`}
          listProps={{
            onMouseOver: start,
            onMouseOut: stop,
            ...(sortable && {
              onPointerDown,
              onPointerMove,
              onPointerUp,
              onPointerCancel: onPointerUp,
              onClickCapture,
              // (no browser drag of the logo or the link: the card itself moves)
              onDragStart: (e) => e.preventDefault(),
              onContextMenu: (e) => {
                if (held.current || drag.current) e.preventDefault();
              },
            }),
          }}
        >
          {shown.map((c) =>
            idOf(c) === dragging ? cloneElement(c as ReactElement<{ className?: string }>, { className: `${(c.props as { className?: string }).className ?? ""} is-dragging` }) : c,
          )}
        </CardRail>
      </div>
      <AutoSaveToast state={state} pending={saving} waiting={false} />
    </>
  );
}
