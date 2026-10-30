"use client";

import { useEffect, useRef, useState } from "react";
import { areaOf, embedUrl, mapsLinks, metresBetween, planOf, PLACE, spotUrl, type Where } from "@/lib/venue";
import { pad } from "./bits";
import { useHydrated } from "./form";
import { useHere } from "./here";
import { AlertIcon, ExpandIcon, ExternalIcon, GlobeIcon, InfoIcon, LocateIcon, MapIcon, PinIcon, SatelliteIcon, ShrinkIcon } from "./icons";
import { SatelliteMap, type Spot } from "./SatelliteMap";

/** "8 m", "120 m", "2.4 km" */
const howFar = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

type View = "air" | "map" | "google";
/** (shown as their icons) */
const VIEWS: [View, string, (p: { className?: string }) => React.ReactNode][] = [
  ["air", "Satellite", SatelliteIcon],
  ["map", "Map", MapIcon],
  ["google", "Google", GlobeIcon],
];


/**
 * The venue on a real map beside the QR codes: pick one to go to it. On the satellite or street map
 * each code's ring shows how close players must be to see it (its pin stays put: a code moves on its own
 * page); Google's map is there to look at, as Google shows it. "Show me" puts this phone on the map with each code's distance, for walking the venue to
 * check the spots before the summit.
 */
export function MapBoard({
  spots,
  place,
  initial = null,
}: {
  spots: Spot[];
  /** The location shown, and its codes in `spots` */
  place: Where & { name: string; address: string };
  initial?: string | null;
}) {
  const ready = useHydrated();
  const plan = planOf(place);
  const links = mapsLinks(place);
  // Google's map: Leyte Academic Center by its name, any other by where it is
  const query = plan.hand ? PLACE.query : `${place.lat},${place.lng}`;
  const [showMe, setShowMe] = useState(false);
  const { here, problem } = useHere(showMe);
  const [picked, setPicked] = useState<string | null>(() => (spots.some((s) => s.id === initial) ? initial : null));
  const [view, setView] = useState<View>("air");
  const [loaded, setLoaded] = useState("");
  const mapBox = useRef<HTMLElement>(null);
  // Full screen: the browser's own where it can; where it can't (iPhone), the map fills the window
  const [real, setReal] = useState(false);
  const [filled, setFilled] = useState(false);
  const full = real || filled;
  // How the map works is behind an "i" on it (tapped, or hovered); Esc or a tap elsewhere hides it
  const [info, setInfo] = useState(false);
  const infoBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!info) return;
    const outside = (e: PointerEvent) => {
      if (!infoBox.current?.contains(e.target as Node)) setInfo(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setInfo(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [info]);
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
  const src = spot ? embedUrl(`${spot.lat},${spot.lng}`, "air", 19) : embedUrl(query, "air", plan.hand ? 18 : 17);

  // On a phone the list is under the map: bring the map back into view to show the pick
  const pick = (id: string | null) => {
    setPicked(id);
    const top = mapBox.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const howTo =
    view === "google"
      ? "Google's map is for looking. Satellite and Map show each QR code's pin."
      : "Each QR code is at its pin; its ring is how close players must be to see it. The dashed outline is the area the game's map shows. To move a code, or change its ring, open its page: there you can also set its spot from your phone's GPS while standing on it.";

  // "Show me": on the map under Full screen, as an icon
  const meButton = (
    <button
      type="button"
      className={showMe ? "gmap__ctl gmap__me is-on" : "gmap__ctl gmap__me"}
      aria-pressed={showMe}
      aria-label={showMe && here ? `Show me (±${Math.round(here.accuracy)} m)` : "Show me"}
      onClick={() => setShowMe(!showMe)}
      title="Show where this phone is, and how far each code is"
    >
      <LocateIcon />
    </button>
  );

  return (
    <div className="gmap">
      <section ref={mapBox} className={filled ? "panel gmap__map is-full" : "panel gmap__map"} aria-label={`Map of ${place.name}`}>
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
                  <b>{place.name}</b>
                  <small>{place.address}</small>
                </span>
              </>
            )}
          </p>
          <div className="gmap__tools">
            <div className="seg gmap__views" role="group" aria-label="Show as">
              {VIEWS.map(([v, label, Icon]) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} aria-label={label} title={label}>
                  <Icon className="gmap__view-ico" />
                  <span className="gmap__view-label">{label}</span>
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
                  title={spot ? `Google map: #${spot.num} ${spot.name}` : `Google map: ${place.name}`}
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
              key={place.id}
              spots={spots}
              area={areaOf(plan)}
              view={view}
              picked={picked}
              me={showMe ? here : null}
              onPick={pick}
            />
          )}
          {showMe && problem && (
            <p className="gmap__toast is-error" role="alert">
              <AlertIcon />
              {problem}
            </p>
          )}
          {/* Full screen, Show me and how it works: one bar down the map's right, like its zoom */}
          <div className="gmap__ctls">
            <button
              type="button"
              className="gmap__ctl gmap__full"
              aria-label={full ? "Exit full screen" : "Full screen"}
              title={full ? "Exit full screen (Esc)" : "Full screen"}
              aria-pressed={full}
              onClick={() => void toggleFull()}
            >
              {full ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
            {meButton}
            {/* How the map works, behind an "i" */}
            <div className="gmap__info" ref={infoBox}>
              <button
                type="button"
                className="gmap__ctl gmap__info-btn"
                aria-label="How the map works"
                aria-expanded={info}
                aria-controls="gmap-howto"
                onClick={() => setInfo(!info)}
              >
                <InfoIcon />
              </button>
              <p id="gmap-howto" className={info ? "gmap__tip is-open" : "gmap__tip"} role="tooltip">
                {howTo}
              </p>
            </div>
          </div>
        </div>

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
                <b>The whole location</b>
                <small>{place.name}</small>
              </span>
            </button>
            <a
              href={links.link}
              target="_blank"
              rel="noopener"
              className="icon-btn"
              aria-label={`Open ${place.name} in Google Maps (new tab)`}
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
                  {pad(s.num)}
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
