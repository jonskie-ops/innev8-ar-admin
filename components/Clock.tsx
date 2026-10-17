"use client";

import { useSyncExternalStore } from "react";

/**
 * The time now, ticking each second, for countdowns: one timer however many use it. Null until the
 * page is running (the server's time and the browser's would never match).
 */
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, 1000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
function snapshot() {
  if (!now) now = Date.now();
  return now;
}

export const useNow = () => useSyncExternalStore(subscribe, snapshot, () => null);

/** "34 days 05 h 12 m 40 s" as parts, to a moment (all zero once it's passed). */
export function untilParts(to: number, from: number) {
  const s = Math.max(0, Math.floor((to - from) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), sec: s % 60 };
}
