"use client";

import { useEffect, useState } from "react";

/** Where this phone (or computer) is, and how sure it is, in metres. */
export type Here = { lat: number; lng: number; accuracy: number };

/** Why there's no location, in words. */
export function locationProblem(e: GeolocationPositionError | "insecure" | "none") {
  if (e === "insecure") return "Location needs the admin open over https (the live site), not a local address.";
  if (e === "none") return "This browser can't tell where it is.";
  if (e.code === e.PERMISSION_DENIED) return "Location is blocked for this site. Allow it in your browser's site settings, then try again.";
  if (e.code === e.TIMEOUT) return "No GPS fix yet. Step outside or near a window, and try again.";
  return "Your location isn't available right now. Turn on location (GPS) on the phone, and try again.";
}

/** How long to wait for an exact GPS fix before also taking the phone's rough location (Wi-Fi, cell towers). */
const ROUGH_AFTER_MS = 6000;

/**
 * Follows the phone's location until the returned function is called. Asks for the exact GPS fix;
 * if none has come after a few seconds (indoors, or the GPS just switched on, it can take a minute),
 * it also takes the phone's quicker rough location, so readings always start coming. A rough reading
 * soon after a much better one is left out, so the spot doesn't jump back and forth. `onError` hears
 * the exact fix's problems (and the rough one's "blocked").
 */
export function watchHere(onReading: (r: Here) => void, onError: (e: GeolocationPositionError) => void, { fresh = false } = {}) {
  let best: { accuracy: number; at: number } | null = null;
  const take = (p: GeolocationPosition) => {
    const r = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy || 999 };
    const now = Date.now();
    if (best && now - best.at < 10000 && r.accuracy > Math.max(best.accuracy * 2, best.accuracy + 20)) return;
    if (!best || r.accuracy <= best.accuracy * 2 || now - best.at >= 10000) best = { accuracy: r.accuracy, at: now };
    onReading(r);
  };
  const geo = navigator.geolocation;
  const exact = geo.watchPosition(take, onError, { enableHighAccuracy: true, maximumAge: fresh ? 0 : 2000, timeout: 30000 });
  let rough: number | null = null;
  const later = window.setTimeout(() => {
    if (best) return;
    rough = geo.watchPosition(take, (e) => e.code === e.PERMISSION_DENIED && onError(e), {
      enableHighAccuracy: false,
      maximumAge: 10000,
      timeout: 30000,
    });
  }, ROUGH_AFTER_MS);
  return () => {
    window.clearTimeout(later);
    geo.clearWatch(exact);
    if (rough !== null) geo.clearWatch(rough);
  };
}

/**
 * The phone's location, followed while `on` (the Map page's "where am I", for walking the venue to
 * check the codes' spots). Null until the first fix.
 */
export function useHere(on: boolean): { here: Here | null; problem: string | null } {
  const [here, setHere] = useState<Here | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    if (!window.isSecureContext) return void queueMicrotask(() => setProblem(locationProblem("insecure")));
    if (!navigator.geolocation) return void queueMicrotask(() => setProblem(locationProblem("none")));
    const stop = watchHere(
      (r) => {
        setProblem(null);
        setHere(r);
      },
      (e) => setProblem(locationProblem(e)),
    );
    return () => {
      stop();
      setHere(null);
      setProblem(null);
    };
  }, [on]);
  return { here, problem };
}
