"use client";

import { useEffect, useRef, useState } from "react";
import { locationProblem } from "./here";
import { AlertIcon, LocateIcon } from "./icons";

/** How long to listen to the GPS: long enough for the readings to settle and average out. */
const LISTEN_MS = 15000;
/** Done early is allowed once there's this many readings. */
const ENOUGH = 3;

type Reading = { lat: number; lng: number; accuracy: number };

/**
 * The phone's readings averaged into one spot, the better ones counting more (weight 1/accuracy²),
 * after dropping any much worse than the best. Its accuracy is the middle reading's: GPS errors
 * don't cancel out the way the average would suggest.
 */
function settle(rs: Reading[]): Reading {
  const best = Math.min(...rs.map((r) => r.accuracy));
  const keep = rs.filter((r) => r.accuracy <= Math.max(best * 2, best + 5));
  let w = 0;
  let lat = 0;
  let lng = 0;
  for (const r of keep) {
    const k = 1 / Math.max(1, r.accuracy) ** 2;
    w += k;
    lat += r.lat * k;
    lng += r.lng * k;
  }
  const accs = keep.map((r) => r.accuracy).sort((a, b) => a - b);
  return { lat: lat / w, lng: lng / w, accuracy: Math.round(accs[Math.floor(accs.length / 2)] * 10) / 10 };
}

/**
 * "Use my location here": an organiser stands on the QR code's spot with a phone and taps it. It
 * listens to the GPS for 15 seconds, showing how sure the phone is as it goes, then `onFix` gets the
 * spot. Using the same kind of reading the players' phones will get means the spot matches what they
 * see, errors near buildings included. Stop cancels; Done uses what it has so far.
 */
export function GpsFix({ onFix, disabled = false }: { onFix: (r: Reading) => void; disabled?: boolean }) {
  const [state, setState] = useState<{ on: boolean; rs: Reading[]; left: number; problem: string | null }>({
    on: false,
    rs: [],
    left: LISTEN_MS,
    problem: null,
  });
  const watch = useRef<number | null>(null);
  const tick = useRef<number | undefined>(undefined);
  const readings = useRef<Reading[]>([]);
  const latest = useRef(onFix);
  useEffect(() => {
    latest.current = onFix;
  });

  const stop = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    window.clearInterval(tick.current);
  };
  useEffect(() => stop, []);

  const finish = () => {
    stop();
    const rs = readings.current;
    setState((s) => ({ ...s, on: false }));
    if (rs.length) latest.current(settle(rs));
  };

  const start = () => {
    if (!window.isSecureContext) return setState((s) => ({ ...s, problem: locationProblem("insecure") }));
    if (!navigator.geolocation) return setState((s) => ({ ...s, problem: locationProblem("none") }));
    readings.current = [];
    setState({ on: true, rs: [], left: LISTEN_MS, problem: null });
    const began = Date.now();
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const r = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        readings.current = [...readings.current, r];
        setState((s) => ({ ...s, rs: readings.current, problem: null }));
      },
      (e) => {
        // Blocked: nothing more will come. Anything else (a moment without a fix, near a building) is
        // passing: keep listening, and say so only while there's no reading yet.
        if (e.code === e.PERMISSION_DENIED) {
          stop();
          setState((s) => ({ ...s, on: false, problem: locationProblem(e) }));
        } else if (!readings.current.length) setState((s) => ({ ...s, problem: locationProblem(e) }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
    tick.current = window.setInterval(() => {
      const left = LISTEN_MS - (Date.now() - began);
      if (left <= 0) {
        if (readings.current.length) finish();
        else setState((s) => ({ ...s, left: 0 })); // still waiting for a first fix (the timeout says if none comes)
      } else setState((s) => ({ ...s, left }));
    }, 250);
  };

  const { on, rs, left, problem } = state;
  const now = rs.length ? settle(rs) : null;
  return (
    <div className="gpsfix">
      {on ? (
        <div className="gpsfix__live" role="status">
          <span className="gpsfix__ring" aria-hidden="true">
            <LocateIcon />
          </span>
          <span className="gpsfix__text">
            <b>{now ? `Listening… ±${Math.round(now.accuracy)} m` : "Finding you…"}</b>
            <small>
              Hold the phone still on the spot · {rs.length} reading{rs.length === 1 ? "" : "s"}
              {left > 0 ? ` · ${Math.ceil(left / 1000)} s` : ""}
            </small>
            <span className="gpsfix__bar" aria-hidden="true">
              <i style={{ width: `${Math.round(100 * (1 - left / LISTEN_MS))}%` }} />
            </span>
          </span>
          <span className="gpsfix__btns">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => (stop(), setState((s) => ({ ...s, on: false })))}>
              Stop
            </button>
            <button type="button" className="btn btn--primary btn--sm" disabled={rs.length < ENOUGH} onClick={finish}>
              Done
            </button>
          </span>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm gpsfix__go" onClick={start} disabled={disabled}>
          <LocateIcon />
          Use my location here
        </button>
      )}
      {problem && (
        <p className="status status--error" role="alert">
          <AlertIcon />
          {problem}
        </p>
      )}
    </div>
  );
}
