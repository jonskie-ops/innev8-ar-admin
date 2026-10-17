"use client";

import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const START = "i8admin:navigate";
const HOLD = "i8admin:hold";
const FREE = "i8admin:free";

/** For navigation that isn't a link click (the search's results): show the bar. */
export const startNavigation = () => window.dispatchEvent(new Event(START));

type Run = { phase: "idle" | "loading" | "done"; from: string; held: boolean };

/**
 * The bar along the top while another page loads. It starts on a click on a link to another page of
 * the admin (or when a page's outline shows), runs while that outline is up, and fills and fades once
 * the page is there.
 */
export function NavProgress() {
  const path = usePathname();
  const [run, setRun] = useState<Run>({ phase: "idle", from: "", held: false });
  const [holds, setHolds] = useState(0);

  useEffect(() => {
    const begin = () => setRun((r) => ({ phase: "loading", from: location.pathname, held: r.phase === "loading" && r.held }));
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      // A link that does something on the page instead (the prize carousel's side photos)
      if (a.closest("[data-stay]")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      begin();
    };
    const onHold = () => {
      setHolds((n) => n + 1);
      setRun((r) => ({ phase: "loading", from: r.phase === "loading" ? r.from : location.pathname, held: true }));
    };
    const onFree = () => setHolds((n) => Math.max(0, n - 1));
    window.addEventListener("click", onClick, true);
    window.addEventListener(START, begin);
    window.addEventListener(HOLD, onHold);
    window.addEventListener(FREE, onFree);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener(START, begin);
      window.removeEventListener(HOLD, onHold);
      window.removeEventListener(FREE, onFree);
    };
  }, []);

  useEffect(() => {
    if (run.phase === "idle") return;
    if (run.phase === "done") {
      const t = setTimeout(() => setRun((r) => ({ ...r, phase: "idle" })), 500);
      return () => clearTimeout(t);
    }
    // Loading: done once the page is there (a new page, and no outline up). A moment's grace, since
    // a page's outline says so just after the page changes
    const there = holds === 0 && (path !== run.from || run.held);
    const t = setTimeout(() => setRun((r) => ({ ...r, phase: "done" })), there ? 60 : 15000);
    return () => clearTimeout(t);
  }, [run, holds, path]);

  return (
    <div className={`navbar is-${run.phase}`} aria-hidden="true">
      <i />
    </div>
  );
}

/** Inside a page's outline (loading.tsx): keeps the bar going while it's up. */
export function HoldProgress() {
  useEffect(() => {
    window.dispatchEvent(new Event(HOLD));
    return () => {
      window.dispatchEvent(new Event(FREE));
    };
  }, []);
  return null;
}

/** Inside a menu link: a ring that spins around its icon while its page is on the way. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span className={pending ? "lp is-pending" : "lp"} aria-hidden="true" />;
}

/** A small spinner, in the text colour (inside buttons). */
export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}
