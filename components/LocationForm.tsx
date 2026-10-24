"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { findPlaces } from "@/lib/actions/locations";
import type { FormState } from "@/lib/form";
import { deleteQuestion, turnOnQuestion } from "@/lib/format";
import { MAP_WIDTH, mapState, type Location, type Rarity } from "@/lib/hunt";
import { latLngText, parseLatLng } from "@/lib/venue";
import { pad } from "./bits";
import { AutoSaveToast, ConfirmButton, SaveButton, Status, useAutoSave } from "./form";
import { GpsFix } from "./GpsFix";
import { LocateIcon, MapIcon, PlacesIcon, PlusIcon, QrIcon, SearchIcon, TrashIcon } from "./icons";
import { Toggle } from "./LiveSwitch";
import { PlaceMap } from "./PlaceMap";
import { Spinner } from "./Progress";
import { VenueMap } from "./VenueMap";

type Found = { name: string; address: string; lat: number; lng: number };
export type PlacedCode = { id: string; num: number; name: string; rarity: Rarity; x: number; y: number; live: boolean };

/**
 * A location: its name and address, where it is (searched for, the phone's GPS, pasted, or tapped on
 * the map) and how wide its map is; whether it's on in the game; and its map as the game draws it,
 * from OpenStreetMap's buildings and roads (drawn again when it's moved or resized). Leyte Academic
 * Center starts on the plan drawn by hand for the summit, until its map is drawn from OpenStreetMap
 * like the others'. An existing location saves by itself as it's edited; a new one is added with Add
 * location.
 */
export function LocationForm({
  location,
  codes,
  othersOn = [],
  save,
  remove,
  redraw,
  canEdit,
  side,
}: {
  location: Location;
  codes: PlacedCode[];
  /** The other locations that are on (one at a time: switching this on turns them off, asked first) */
  othersOn?: string[];
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<FormState>;
  redraw?: () => Promise<FormState>;
  canEdit: boolean;
  /** More for the side column, under its QR codes (the location's areas) */
  side?: React.ReactNode;
}) {
  const isNew = !remove && location.id === "new";
  // Leyte Academic Center still on its hand-drawn plan
  const hand = location.id === "lac" && location.outlines == null;
  const { formRef, state, pending, waiting, onSubmit, onChange, changed } = useAutoSave(save, !isNew && canEdit);
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address);
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(isNew ? null : { lat: location.lat, lng: location.lng });
  const [width, setWidth] = useState(String(location.width));
  const [view, setView] = useState<"air" | "map">("air");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [searchNote, setSearchNote] = useState("");
  const [searching, startSearch] = useTransition();
  const [typed, setTyped] = useState("");
  const [drawn, setDrawn] = useState<FormState>(null);
  const [drawing, startDraw] = useTransition();
  const w = Math.min(MAP_WIDTH.max, Math.max(MAP_WIDTH.min, Number(width) || MAP_WIDTH.min));
  // While its map is being drawn (in the background, after a move): look again every few seconds
  const router = useRouter();
  const drawingNow = !isNew && mapState(location.outlines) === "drawing";
  useEffect(() => {
    if (!drawingNow) return;
    const t = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(t);
  }, [drawingNow, router]);

  const putAt = (lat: number, lng: number) => {
    setAt({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 });
    changed();
  };
  const search = () => {
    const term = q.trim();
    if (!term) return;
    startSearch(async () => {
      const r = await findPlaces(term);
      setFound(r.places);
      setSearchNote(r.error ?? "");
    });
  };
  const pick = (f: Found) => {
    putAt(f.lat, f.lng);
    if (!name.trim()) setName(f.name);
    if (!address.trim()) setAddress(f.address);
    setFound(null);
    setQ("");
  };

  return (
    <form ref={formRef} className="edit" method="post" onSubmit={onSubmit} onChange={onChange}>
      <fieldset className="edit__main" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">The location</h2>
          <label className="field">
            <span className="field__label">Name</span>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Robinsons Place Tacloban" />
            <span className="field__hint">As players see it on the game&apos;s map.</span>
          </label>
          <label className="field">
            <span className="field__label">Address</span>
            <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} placeholder="Marasbaras, Tacloban City, Leyte" />
          </label>
        </section>

        <section className="panel">
          <h2 className="panel__title">
            <PlacesIcon />
            Where it is
          </h2>
          {hand && (
            <p className="field__hint">
              Its map is drawn by hand for the summit for now. Moving it, changing its width or Get the map again draws it
              from OpenStreetMap like the other locations&apos;.
            </p>
          )}
          <>
              <div className="field">
                <span className="field__label">Find it</span>
                <div className="placefind">
                  <input
                    value={q}
                    type="search"
                    autoComplete="off"
                    placeholder="A place, building or town"
                    aria-label="Find a place"
                    onChange={(e) => {
                      e.stopPropagation(); // typing a search isn't a change to save
                      setQ(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      search();
                    }}
                  />
                  <button type="button" className="btn btn--ghost btn--sm" onClick={search} disabled={searching || q.trim().length < 3}>
                    {searching ? <Spinner /> : <SearchIcon />}
                    Find
                  </button>
                </div>
                {searchNote && <span className="field__hint gpsspot__far">{searchNote}</span>}
                {found && found.length > 0 && (
                  <ul className="placefind__list" role="list">
                    {found.map((f) => (
                      <li key={`${f.lat},${f.lng}`}>
                        <button type="button" onClick={() => pick(f)}>
                          <PlacesIcon />
                          <span>
                            <b>{f.name}</b>
                            <small>{f.address}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canEdit && <GpsFix onFix={(r) => putAt(r.lat, r.lng)} />}
              <label className="field">
                <span className="field__label">Or paste it</span>
                <input
                  value={typed}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="11.207972, 125.007607"
                  aria-invalid={typed.trim() !== "" && !parseLatLng(typed)}
                  onChange={(e) => {
                    e.stopPropagation();
                    setTyped(e.target.value);
                    const p = parseLatLng(e.target.value);
                    if (p) putAt(p.lat, p.lng);
                  }}
                />
                <span className="field__hint">
                  {typed.trim() !== "" && !parseLatLng(typed)
                    ? "Latitude, then longitude, like 11.207972, 125.007607."
                    : "From Google Maps: press and hold the place, then copy the numbers."}
                </span>
              </label>
              <div className="field">
                <span className="placemap__head">
                  <span className="field__label">On the map {at && <code>{latLngText(at)}</code>}</span>
                  <span className="seg" role="group" aria-label="Show as">
                    <button type="button" aria-pressed={view === "air"} onClick={() => setView("air")}>
                      Satellite
                    </button>
                    <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
                      Map
                    </button>
                  </span>
                </span>
                <PlaceMap lat={at?.lat ?? null} lng={at?.lng ?? null} width={w} view={view} onMove={canEdit ? putAt : undefined} />
                <span className="field__hint">
                  {at
                    ? "Tap the map or drag the pin to move its middle. The dashed outline is what the game's map shows: the QR codes go inside it."
                    : "Find it above, use your location, or tap the map where it is."}
                </span>
              </div>
              <div className="field">
                <span className="field__label">How wide its map is</span>
                <div className="radius" role="group" aria-label="How wide its map is">
                  {MAP_WIDTH.presets.map((p) => (
                    <button
                      key={p.m}
                      type="button"
                      className="radius__opt"
                      aria-pressed={Number(width) === p.m}
                      onClick={() => {
                        setWidth(String(p.m));
                        changed();
                      }}
                    >
                      <b>{p.m < 1000 ? `${p.m} m` : `${p.m / 1000} km`}</b>
                      <small>{p.label}</small>
                    </button>
                  ))}
                  <label className="radius__own">
                    <input
                      name="width"
                      inputMode="numeric"
                      value={width}
                      onChange={(e) => setWidth(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      aria-label="Metres"
                      required
                    />
                    m
                  </label>
                </div>
                <span className="field__hint">
                  West to east ({MAP_WIDTH.min}–{MAP_WIDTH.max.toLocaleString("en-PH")} m). Just big enough for the QR codes: the
                  smaller, the closer players see the buildings.
                </span>
              </div>
              <input type="hidden" name="lat" value={at?.lat ?? ""} />
              <input type="hidden" name="lng" value={at?.lng ?? ""} />
          </>
        </section>
      </fieldset>

      <fieldset className="edit__side" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">In the game</h2>
          <Toggle
            name="live"
            defaultChecked={location.live}
            ask={othersOn.length ? turnOnQuestion(name.trim() || "this location", othersOn) : undefined}
            onAsked={changed}
            hint={
              isNew && !location.live
                ? `Starts off, as ${othersOn[0] ?? "another location"} is on: switch it on once its QR codes are ready (only one location is on at a time). Off: its QR codes are hidden from the game.`
                : othersOn.length
                  ? `Only one location is on at a time: switching this on turns ${othersOn.join(", ")} off. Off: its QR codes are hidden from the game.`
                  : "Only one location is on at a time. Off: its QR codes are hidden from the game."
            }
          >
            On
          </Toggle>
        </section>

        {!isNew && (
          <section className="panel">
            <h2 className="panel__title">
              <MapIcon />
              The game&apos;s map
            </h2>
            <VenueMap place={location} pins={codes} zones={[]} label={`Map of ${location.name}`} />
            <p className="field__hint">
              {hand
                ? "Drawn by hand for the summit: Annex A–B, the courtyard and parking. Get the map again draws it from OpenStreetMap like the other locations': its QR codes keep their spots on the ground and move onto the new map."
                : location.outlines && "buildings" in location.outlines
                  ? `${location.outlines.count} building${location.outlines.count === 1 ? "" : "s"}, with the roads and grounds, from OpenStreetMap. Drawn again when you move it or change its width.`
                  : drawingNow
                    ? "Drawing it from OpenStreetMap's buildings and roads: this can take a minute. Players see a plain grid until then."
                    : "Not drawn: OpenStreetMap didn't answer. Players see a plain grid until it is: get it again below."}
            </p>
            {redraw && canEdit && (
              <span className="mapdraw">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={drawing || drawingNow}
                  onClick={() => startDraw(async () => setDrawn(await redraw()))}
                >
                  {drawing || drawingNow ? <Spinner /> : <MapIcon />}
                  {drawing || drawingNow ? "Drawing…" : "Get the map again"}
                </button>
                {!drawingNow && drawn?.error && <Status state={drawn} />}
              </span>
            )}
          </section>
        )}

        {!isNew && (
          <section className="panel">
            <h2 className="panel__title">
              <QrIcon />
              QR codes here
            </h2>
            {codes.length ? (
              <ul className="sponsored" role="list">
                {codes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/codes/${c.id}`} className={`sponsored__code ccard--${c.rarity}${c.live ? "" : " is-off"}`}>
                      <b>#{pad(c.num)}</b>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">None yet.</p>
            )}
            {canEdit && (
              <Link href={`/codes/new?at=${location.id}`} className="btn btn--ghost btn--sm sponsors__add">
                <PlusIcon />
                Add a QR code here
              </Link>
            )}
          </section>
        )}
        {side}
        {isNew && (
          <p className="banner">
            <LocateIcon />
            Once it&apos;s added, its map for the game is drawn from OpenStreetMap, and you can add its QR codes.
          </p>
        )}
      </fieldset>

      {canEdit && (
        <div className="savebar">
          {!isNew ? <AutoSaveToast state={state} pending={pending} waiting={waiting} /> : <Status state={state} />}
          <span className="savebar__btns">
            {remove ? (
              <ConfirmButton action={remove} question={deleteQuestion(location.name, codes.length)}>
                <TrashIcon />
                Delete
              </ConfirmButton>
            ) : isNew ? (
              <SaveButton pending={pending} busy="Adding…">
                Add location
              </SaveButton>
            ) : null}
          </span>
        </div>
      )}
    </form>
  );
}
