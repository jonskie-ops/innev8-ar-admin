"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ago, stamp } from "@/lib/format";
import { Avatar } from "./bits";
import { BellIcon } from "./icons";

export type Change = { id: number; who: string; did: string; label: string; at: string; action: string };

/** The newest change this browser has seen in the list (kept on the organiser's own device). */
const KEY = "i8admin-seen-change";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
const readSeen = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const markSeen = (at: string) => {
  try {
    localStorage.setItem(KEY, at);
  } catch {}
  listeners.forEach((fn) => fn());
};

/** Who changed what lately, as a list (the overview's, and the bell's). */
export function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ol className="who-list" role="list">
      {changes.map((c) => (
        <li key={c.id} className="who">
          <Avatar name={c.who} />
          <p className="who__text">
            <b>
              {c.who}
              <i className={`who__dot who__dot--${c.action}`} aria-hidden="true" />
            </b>
            <small>
              {c.did} <span>{c.label}</span>
            </small>
          </p>
          <time dateTime={c.at} title={stamp(c.at)} suppressHydrationWarning>
            {ago(c.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

/** The bell in the top bar: the latest changes, with a dot while there's one this browser hasn't seen. */
export function Changes({ changes }: { changes: Change[] }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const seen = useSyncExternalStore(subscribe, readSeen, () => null);
  const newest = changes[0]?.at ?? "";
  const unseen = seen !== null && newest > seen;

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="changes" ref={box}>
      <button
        ref={button}
        type="button"
        className="round-btn"
        aria-expanded={open}
        aria-controls={`${id}-pop`}
        aria-label={unseen ? "Latest changes (new)" : "Latest changes"}
        title="Latest changes"
        onClick={() => {
          if (!open && newest) markSeen(newest);
          setOpen(!open);
        }}
      >
        <BellIcon />
        {unseen && <i className="round-btn__dot" aria-hidden="true" />}
      </button>
      {open && (
        <div id={`${id}-pop`} className="pop" role="region" aria-label="Latest changes">
          <p className="pop__title">Latest changes</p>
          {changes.length ? (
            <ChangeList changes={changes} />
          ) : (
            <p className="empty pop__empty">No changes yet. Each change made here shows up with who made it.</p>
          )}
        </div>
      )}
    </div>
  );
}
