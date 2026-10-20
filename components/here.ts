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
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setProblem(null);
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      (e) => setProblem(locationProblem(e)),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      setHere(null);
      setProblem(null);
    };
  }, [on]);
  return { here, problem };
}
