"use client";

import { useEffect, useRef, useState } from "react";
import { moveCode } from "@/lib/actions/codes";
import { embedUrl, metresBetween, PIN_AREA, PLACE, spotUrl, toPlan } from "@/lib/venue";
import { pad } from "./bits";
import { useHydrated } from "./form";
import { useHere } from "./here";
import { AlertIcon, CheckIcon, ExpandIcon, ExternalIcon, LocateIcon, PinIcon, ShrinkIcon } from "./icons";
import { SatelliteMap, type Spot } from "./SatelliteMap";

/** "8 m", "120 m", "2.4 km" */
const howFar = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

type View = "air" | "map" | "google";
const VIEWS: [View, string][] = [
  ["air", "Satellite"],
  ["map", "Map"],
  ["google", "Google"],
];

/**
 * The venue on a real map beside the QR codes: pick one to go to it. On the satellite or street map
 * each code's ring shows how close players must be to see it, and an admin drags a code's pin to
 * move it (it saves at once, and the venue map follows); Google's map is there to look at, as Google
 * shows it. "Show me" puts this phone on the map with each code's distance, for walking the venue to
 * check the spots before the summit.
 */
export function MapBoard({ spots, canEdit, initial = null }: { spots: Spot[]; canEdit: boolean; initial?: string | null }) {
  const ready = useHydrated();
  const [showMe, setShowMe] = useState(false);
  const { here, problem } = useHere(showMe);
  const [picked, setPicked] = useState<string | null>(() => (spots.some((s) => s.id === initial) ? initial : null));
  const [view, setView] = useState<View>("air");
  const [loaded, setLoaded] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean; at: number } | null>(null);
  const mapBox = useRef<HTMLElement>(null);
  // Full screen: the browser's own where it can; where it can't (iPhone), the map fills the window
  const [real, setReal] = useState(false);
  const [filled, setFilled] = useState(false);
  const full = real || filled;
  useEffect(() => {
    const on = () => setReal(document.fullscreenElement !== null && document.fullscreenElement === mapBox.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => {
    if (!filled) return;
    // The page under it stays still, and the phone's tab bar steps aside
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    root.dataset.fullMap = "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFilled(false);
    document.addEventListener("keydown", esc);
    return () => {
      root.style.overflow = was;
      delete root.dataset.fullMap;
      document.removeEventListener("keydown", esc);
    };
  }, [filled]);
  const toggleFull = async () => {
    const el = mapBox.current;
    if (!el) return;
    if (document.fullscreenElement) return void (await document.exitFullscreen());
    if (filled) return setFilled(false);
    if (typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // Not allowed here: fill the window instead
      }
    }
    setFilled(true);
  };
  const spot = spots.find((s) => s.id === picked) ?? null;
  const src = spot ? embedUrl(`${spot.lat},${spot.lng}`, "air", 19) : embedUrl(PLACE.query, "air", 18);

  // On a phone the list is under the map: bring the map back into view to show the pick
  const pick = (id: string | null) => {
    setPicked(id);
    const top = mapBox.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // A pin dropped: inside the game's map area, it's saved; otherwise (or if saving fails) it goes back
  const drop = async (id: string, lat: number, lng: number) => {
    const s = spots.find((x) => x.id === id);
    if (!s) return false;
    const { x, y } = toPlan(lat, lng);
    if (x < PIN_AREA.x0 || x > PIN_AREA.x1 || y < PIN_AREA.y0 || y > PIN_AREA.y1) {
      setNote({ text: `Put #${pad(s.num)} inside the dashed outline: that's the area the game's map shows.`, error: true, at: Date.now() });
      return false;
    }
    setSaving(id);
    setPicked(id);
    const r = await moveCode(id, lat, lng);
    setSaving(null);
    if (r?.error) {
      setNote({ text: r.error, error: true, at: Date.now() });
      return false;
    }
    setNote({ text: `Moved #${pad(s.num)} ${s.name}.`, error: false, at: Date.now() });
    return true;
  };

  return (
    <div className="gmap">
      <section ref={mapBox} className={filled ? "panel gmap__map is-full" : "panel gmap__map"} aria-label="Map of the venue">
        <div className="gmap__bar">
          <p className="gmap__what" aria-live="polite">
            {spot ? (
              <>
                <span className={`gmap__num gmap__num--${spot.rarity}`}>{pad(spot.num)}</span>
                <span>
                  <b>{spot.name}</b>
                  <small>{spot.where}</small>
                </span>
              </>
            ) : (
              <>
                <span className="gmap__num gmap__num--venue">
                  <PinIcon />
                </span>
                <span>
                  <b>{PLACE.name}</b>
                  <small>{PLACE.address}</small>
                </span>
              </>
            )}
          </p>
          <div className="gmap__tools">
            <button
              type="button"
              className={showMe ? "btn btn--ghost btn--sm gmap__me is-on" : "btn btn--ghost btn--sm gmap__me"}
              aria-pressed={showMe}
              onClick={() => setShowMe(!showMe)}
              title="Show where this phone is, and how far each code is"
            >
              <LocateIcon />
              {showMe && here ? `±${Math.round(here.accuracy)} m` : "Show me"}
            </button>
            <div className="seg" role="group" aria-label="Show as">
              {VIEWS.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="gmap__frame">
          {view === "google" ? (
            <>
              {/* Only once the page is running, so its "loaded" is never missed; a new one per place,
                  so moving the map doesn't add to the browser's Back history */}
              {ready && (
                <iframe
                  key={src}
                  src={src}
                  title={spot ? `Google map: #${spot.num} ${spot.name}` : `Google map: ${PLACE.name}`}
                  allowFullScreen
                  onLoad={() => setLoaded(src)}
                />
              )}
              {loaded !== src && (
                <p className="gmap__loading" role="status">
                  <span className="spin" aria-hidden="true" />
                  Loading the map…
                </p>
              )}
            </>
          ) : (
            <SatelliteMap
              spots={spots}
              view={view}
              picked={picked}
              saving={saving}
              canEdit={canEdit}
              me={showMe ? here : null}
              onPick={pick}
              onDrop={drop}
            />
          )}
          {showMe && problem && (
            <p className="gmap__toast is-error" role="alert">
              <AlertIcon />
              {problem}
            </p>
          )}
          {note && (
            <p
              key={note.at}
              className={note.error ? "gmap__toast is-error" : "gmap__toast status--fade"}
              role={note.error ? "alert" : "status"}
            >
              {note.error ? <AlertIcon /> : <CheckIcon />}
              {note.text}
            </p>
          )}
          <button
            type="button"
            className="gmap__full"
            aria-label={full ? "Exit full screen" : "Full screen"}
            title={full ? "Exit full screen (Esc)" : "Full screen"}
            aria-pressed={full}
            onClick={() => void toggleFull()}
          >
            {full ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
        </div>

        <p className="gmap__note">
          {view === "google"
            ? "Google's map is for looking. To move a QR code, drag its pin on Satellite or Map."
            : canEdit
              ? "Drag a pin to move its QR code: it saves at once, and its pin on the venue map moves too. Pins stay inside the dashed outline, the area the game's map shows. Each ring is how close players must be to see that code: change it on the code's page, where you can also set the spot from your phone's GPS while standing on it."
              : "Each QR code is at its pin; its ring is how close players must be to see it. Only admins can move pins."}
        </p>
      </section>

      <aside className="panel gmap__list" aria-label="Show on the map">
        <h2 className="panel__title">Show on the map</h2>
        <ul className="spots" role="list">
          <li className={picked === null ? "spot is-picked" : "spot"}>
            <button type="button" className="spot__main" aria-pressed={picked === null} onClick={() => pick(null)}>
              <span className="gmap__num gmap__num--venue">
                <PinIcon />
              </span>
              <span className="spot__text">
                <b>The venue</b>
                <small>{PLACE.name}</small>
              </span>
            </button>
            <a
              href={PLACE.link}
              target="_blank"
              rel="noopener"
              className="icon-btn"
              aria-label="Open the venue in Google Maps (new tab)"
              title="Open in Google Maps"
            >
              <ExternalIcon />
            </a>
          </li>
          {spots.map((s) => {
            const away = showMe && here ? metresBetween(here, s) : null;
            return (
            <li key={s.id} className={`${picked === s.id ? "spot is-picked" : "spot"}${s.live ? "" : " is-off"}`}>
              <button type="button" className="spot__main" aria-pressed={picked === s.id} onClick={() => pick(s.id)}>
                <span className={`gmap__num gmap__num--${s.rarity}`}>
                  {saving === s.id ? <span className="spin" aria-label="Saving" /> : pad(s.num)}
                </span>
                <span className="spot__text">
                  <b>
                    {s.name}
                    {!s.live && <span className="tag tag--off">Off</span>}
                  </b>
                  <small>
                    {s.where}
                    {s.where && " · "}
                    within {s.radius} m{s.own ? "" : " · from the venue map pin"}
                  </small>
                  {away !== null && (
                    <small className={away <= s.radius ? "spot__away is-in" : "spot__away"}>
                      {away <= s.radius ? `You're in range: ${howFar(away)} away` : `${howFar(away)} away`}
                    </small>
                  )}
                </span>
              </button>
              <a
                href={spotUrl(s.lat, s.lng)}
                target="_blank"
                rel="noopener"
                className="icon-btn"
                aria-label={`Open #${s.num} ${s.name} in Google Maps (new tab)`}
                title="Open in Google Maps"
              >
                <ExternalIcon />
              </a>
            </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
