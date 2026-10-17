"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";

/**
 * A row of cards that scrolls sideways: swipe it, or use the arrows at its ends (shown only while
 * there's more that way).
 */
export function CardRail({ label, children }: { label: string; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ back: false, on: false });

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const check = () =>
      setMore({ back: el.scrollLeft > 4, on: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  const page = (dir: 1 | -1) => list.current?.scrollBy({ left: dir * list.current.clientWidth * 0.9, behavior: "smooth" });

  return (
    <div className="crail-box">
      <ul ref={list} className="crail" role="list" aria-label={label}>
        {children}
      </ul>
      <button
        type="button"
        className="crail__arrow crail__arrow--back"
        aria-label="Scroll back"
        hidden={!more.back}
        onClick={() => page(-1)}
      >
        <ArrowLeftIcon />
      </button>
      <button type="button" className="crail__arrow" aria-label="Scroll on" hidden={!more.on} onClick={() => page(1)}>
        <ArrowRightIcon />
      </button>
    </div>
  );
}
