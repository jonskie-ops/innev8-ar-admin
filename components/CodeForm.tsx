"use client";
/* eslint-disable @next/next/no-img-element -- the sponsors' small round badges */

import Link from "next/link";
import { useState } from "react";
import type { FormState } from "@/lib/form";
import {
  firstSponsor,
  GAME_URL,
  POINTS,
  RADIUS,
  RARITIES,
  RARITY_LABEL,
  TASKS,
  taskOf,
  type Code,
  type Location,
  type Rarity,
  type SponsorView,
  type Task,
  type Zone,
} from "@/lib/hunt";
import { DEFAULT_LOCATION, intoPinArea, latLngText, metresBetween, parseLatLng, planOf, spotOf, spotUrl } from "@/lib/venue";
import { pad } from "./bits";
import { AutoSaveToast, ConfirmButton, Counter, SaveButton, Status, useAutoSave } from "./form";
import { GpsFix } from "./GpsFix";
import { ExternalIcon, LocateIcon, PinIcon, PlusIcon, TrashIcon } from "./icons";
import { Toggle } from "./LiveSwitch";
import { VenueMap, type Pin } from "./VenueMap";

/** Where a code's GPS spot came from, as the form shows it. */
type Geo = { lat: number; lng: number; accuracy: number | null; from: "pin" | "gps" | "typed" | "saved" };

function geoLabel(g: Geo) {
  const acc = g.accuracy === null ? "" : `, ±${Math.round(g.accuracy)} m`;
  if (g.from === "pin") return "From the map pin";
  if (g.from === "gps") return `Your location${acc}`;
  if (g.from === "typed") return "Typed in";
  return g.accuracy === null ? "Saved spot" : `Set on site${acc}`;
}

/**
 * A QR code: what players read (name, clue, description), where it is (zone, spot, map pin), and
 * what it's worth. Changing the rarity moves the points to that rarity's usual value, unless
 * they'd been set by hand. An existing code saves by itself as it's edited (the map pin too); a new
 * one is added with Add QR code.
 */
export function CodeForm({
  code,
  zones,
  locations,
  sponsors,
  canAddSponsor,
  others,
  save,
  remove,
  canEdit,
}: {
  code: Code;
  /** Every location's areas (each code is in one of its location's) */
  zones: Zone[];
  /** Where it can be (the Locations page's) */
  locations: Pick<Location, "id" | "name" | "lat" | "lng" | "width" | "outlines">[];
  /** Who can sponsor it (the Sponsors page's) */
  sponsors: SponsorView[];
  /** A link to add a sponsor (an admin, with the sponsor logos update) */
  canAddSponsor: boolean;
  others: (Pin & { sponsor?: string; location_id?: string })[];
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<FormState>;
  canEdit: boolean;
}) {
  const { formRef, state, pending, waiting, onSubmit, onChange, changed } = useAutoSave(save, Boolean(remove) && canEdit);
  const [rarity, setRarity] = useState<Rarity>(code.rarity);
  const [points, setPoints] = useState(String(code.points));
  const [pos, setPos] = useState({ x: code.x, y: code.y });
  const [clue, setClue] = useState(code.clue.length);
  const [blurb, setBlurb] = useState(code.blurb.length);
  const [num, setNum] = useState(String(code.num));
  const [suggested, setSuggested] = useState(String(code.num));
  const [task, setTask] = useState<Task>(code.task ?? "none");
  const [sponsor, setSponsor] = useState(code.sponsor ?? firstSponsor(code.num));
  // Where it is: a location, one of its areas, and on its map
  const [locId, setLocId] = useState(code.location_id ?? DEFAULT_LOCATION);
  const location = locations.find((l) => l.id === locId) ?? locations[0];
  const plan = planOf(location);
  const areas = zones.filter((z) => (z.location_id ?? DEFAULT_LOCATION) === location.id);
  const [zone, setZone] = useState(code.zone_id);
  // Its GPS spot (where players find it) and how close they must be. The map pin and the spot move
  // together: moving the pin puts the spot under it, and a spot from GPS or typed in moves the pin.
  const [geo, setGeo] = useState<Geo>(() => {
    const s = spotOf(code, plan);
    return { lat: s.lat, lng: s.lng, accuracy: code.accuracy ?? null, from: s.own ? "saved" : "pin" };
  });
  const [radius, setRadius] = useState(String(code.radius ?? RADIUS.default));
  const [typed, setTyped] = useState("");
  const putSpot = (g: Geo, on = plan) => {
    setGeo(g);
    const p = on.toPlan(g.lat, g.lng);
    setPos(intoPinArea(p.x, p.y, on.pinArea)); // past the game's map: its pin waits at the edge
    changed();
  };
  // Another location: the code starts in the middle of its map, in its first area
  const moveTo = (id: string) => {
    const l = locations.find((x) => x.id === id);
    if (!l) return;
    const p = planOf(l);
    setLocId(id);
    setZone(zones.find((z) => (z.location_id ?? DEFAULT_LOCATION) === id)?.id ?? "");
    // A new code's number, while it's still the one suggested: the next at that location
    const there = others.filter((o) => (o.location_id ?? DEFAULT_LOCATION) === id).map((o) => o.num);
    if (code.id === "new" && num === suggested) {
      const n = String(Math.max(0, ...there) + 1);
      setNum(n);
      setSuggested(n);
    }
    const a = p.pinArea;
    putSpot({ ...p.toLatLng((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2), accuracy: null, from: "pin" }, p);
  };
  const far = metresBetween(geo, location);
  // Past the edge of the game's map: the pin waits at the edge, and players see the code at its spot
  const onPlan = plan.toPlan(geo.lat, geo.lng);
  const edge = intoPinArea(onPlan.x, onPlan.y, plan.pinArea);
  const offMap = Math.hypot(edge.x - onPlan.x, edge.y - onPlan.y) > 3;
  // Which other codes each sponsor is on already
  const onCodes = (id: string) => others.filter((o) => (o.sponsor ?? firstSponsor(o.num)) === id).map((o) => `#${pad(o.num)}`);

  const pickRarity = (r: Rarity) => {
    if (points === String(POINTS[rarity])) setPoints(String(POINTS[r]));
    setRarity(r);
  };
  const me: Pin = { id: code.id, num: Number(num) || code.num, name: code.name, rarity, x: pos.x, y: pos.y, live: true };

  return (
    <form ref={formRef} className="edit" method="post" onSubmit={onSubmit} onChange={onChange}>
      <fieldset className="edit__main" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">What players see</h2>
          <div className="row2 row2--num">
            <label className="field">
              <span className="field__label">Number</span>
              <input name="num" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} required />
            </label>
            <label className="field">
              <span className="field__label">Name</span>
              <input name="name" defaultValue={code.name} maxLength={40} required placeholder="Hall of Icons" />
            </label>
          </div>
          <label className="field">
            <span className="field__label">
              Clue <Counter n={clue} max={140} />
            </span>
            <textarea
              name="clue"
              rows={2}
              defaultValue={code.clue}
              maxLength={140}
              onChange={(e) => setClue(e.target.value.length)}
              placeholder="Where should players look?"
            />
            <span className="field__hint">Shown on the map before the code is found. A hint, not the answer.</span>
          </label>
          <label className="field">
            <span className="field__label">
              Description <Counter n={blurb} max={200} />
            </span>
            <textarea
              name="blurb"
              rows={2}
              defaultValue={code.blurb}
              maxLength={200}
              onChange={(e) => setBlurb(e.target.value.length)}
            />
            <span className="field__hint">Shown on the card once it&apos;s caught.</span>
          </label>
        </section>

        <section className="panel">
          <h2 className="panel__title">Sponsor</h2>
          <p className="field__hint">
            Their logo shows in a circle on the QR code&apos;s top-right corner: on the map, in the collection and in the
            camera.
          </p>
          <div className="sponsors" role="radiogroup" aria-label="Sponsor">
            {sponsors.map((s) => {
              const also = onCodes(s.id);
              return (
                <label key={s.id} className="sponsors__opt">
                  <input type="radio" name="sponsor" value={s.id} checked={sponsor === s.id} onChange={() => setSponsor(s.id)} />
                  <span>
                    <img src={s.badge} alt="" width={52} height={52} />
                    <b>{s.name}</b>
                    <small>{also.length ? `Also on ${also.join(", ")}` : "On no other code"}</small>
                  </span>
                </label>
              );
            })}
            <label className="sponsors__opt">
              <input type="radio" name="sponsor" value="none" checked={sponsor === "none"} onChange={() => setSponsor("none")} />
              <span>
                <i className="sponsors__none" aria-hidden="true" />
                <b>No sponsor</b>
                <small>No logo on the code</small>
              </span>
            </label>
          </div>
          {canAddSponsor && remove && (
            <Link href="/sponsors/new" className="btn btn--ghost btn--sm sponsors__add">
              <PlusIcon />
              Add a sponsor
            </Link>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Extra task</h2>
          <p className="field__hint">
            Networking: something players do after reading the clue. The code stays locked until it&apos;s done, and
            each task needs someone they haven&apos;t met for another code.
          </p>
          <div className="roles tasks" role="radiogroup" aria-label="Extra task">
            {TASKS.map((t) => (
              <label key={t.id} className="roles__opt">
                <input type="radio" name="task" value={t.id} checked={task === t.id} onChange={() => setTask(t.id)} />
                <span>
                  <b>{t.label}</b>
                  <small>{t.hint}</small>
                </span>
              </label>
            ))}
          </div>
          {task !== "none" && (
            <p className="task-preview">
              <small>Under the clue, players read</small>
              {taskOf(task).player}
            </p>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Rarity and points</h2>
          <div className="rarity" role="radiogroup" aria-label="Rarity">
            {RARITIES.map((r) => (
              <label key={r} className={`rarity__opt rarity__opt--${r}`}>
                <input type="radio" name="rarity" value={r} checked={rarity === r} onChange={() => pickRarity(r)} />
                <span>
                  <b>{RARITY_LABEL[r]}</b>
                  <small>{POINTS[r]} pts usually</small>
                </span>
              </label>
            ))}
          </div>
          <label className="field field--short">
            <span className="field__label">Points</span>
            <input name="points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} required />
          </label>
        </section>

        <section className="panel">
          <h2 className="panel__title">In the game</h2>
          <Toggle name="live" defaultChecked={code.live} hint="Off: hidden from players until you turn it on.">
            Live
          </Toggle>
          {code.code && (
            <div className="codeval">
              <span className="field__label">Code value</span>
              <p>
                <code>{code.code}</code>
                <a className="btn btn--ghost btn--sm" href={`${GAME_URL}/?s=${code.code}`} target="_blank" rel="noreferrer">
                  <ExternalIcon />
                  Open in the game
                </a>
              </p>
              <span className="field__hint">Its 3D pattern. Stays the same when you edit, so players keep their catch.</span>
            </div>
          )}
        </section>
      </fieldset>

      <fieldset className="edit__side" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">
            <PinIcon />
            Where it is
          </h2>
          {locations.length > 1 && (
            <label className="field">
              <span className="field__label">Location</span>
              <select value={location.id} onChange={(e) => moveTo(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <span className="field__hint">Another location puts the code in the middle of its map: then place it.</span>
            </label>
          )}
          <input type="hidden" name="location_id" value={location.id} />
          <div className="row2">
            <label className="field">
              <span className="field__label">Zone</span>
              <select name="zone_id" value={areas.some((z) => z.id === zone) ? zone : (areas[0]?.id ?? "")} onChange={(e) => setZone(e.target.value)} required>
                {areas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Spot</span>
              <input name="spot" defaultValue={code.spot} maxLength={60} placeholder="Registration desk" />
            </label>
          </div>
          <span className="field__label">Map pin</span>
          <VenueMap
            key={location.id}
            place={location}
            pins={[...others.filter((o) => (o.location_id ?? DEFAULT_LOCATION) === location.id), me]}
            zones={areas}
            selected={code.id}
            move={
              canEdit
                ? (x, y) => {
                    setPos({ x, y });
                    setGeo({ ...plan.toLatLng(x, y), accuracy: null, from: "pin" });
                    changed(); // the pin's hidden fields change without an event of their own
                  }
                : undefined
            }
            label="Place the pin: tap or drag on the map"
          />
          <span className="field__hint">
            {canEdit ? "Tap or drag on the map to place it: its GPS spot below moves with it. " : ""}Other codes are shown faded.
          </span>
          <input type="hidden" name="x" value={pos.x} />
          <input type="hidden" name="y" value={pos.y} />
        </section>

        <section className="panel">
          <h2 className="panel__title">
            <LocateIcon />
            On the ground
          </h2>
          <p className="field__hint">
            Players see this code when their phone is within the distance below of its GPS spot. Best set on site: stand on
            the spot with your phone and use your location.
          </p>
          <p className="gpsspot">
            <span className="gpsspot__text">
              <code>{latLngText(geo)}</code>
              <small className={geo.from === "pin" ? "gpsspot__from" : "gpsspot__from is-own"}>{geoLabel(geo)}</small>
            </span>
            <a
              className="icon-btn"
              href={spotUrl(geo.lat, geo.lng)}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the GPS spot in Google Maps (new tab)"
              title="Open in Google Maps"
            >
              <ExternalIcon />
            </a>
          </p>
          {geo.from === "gps" && geo.accuracy !== null && geo.accuracy > 30 && (
            <p className="field__hint gpsspot__far">
              Rough: ±{Math.round(geo.accuracy)} m, the phone&apos;s Wi-Fi location rather than GPS. Players could be that far
              off: try again near a window or outside, where the GPS reaches the phone.
            </p>
          )}
          {far > 1500 ? (
            <p className="field__hint gpsspot__far">
              {(far / 1000).toFixed(1)} km from {location.name}: fine for testing somewhere else, but players there
              won&apos;t reach it.
            </p>
          ) : (
            offMap && (
              <p className="field__hint gpsspot__far">
                Past the edge of the game&apos;s map: its pin there waits at the edge, but players find the code at this spot.
              </p>
            )
          )}
          {canEdit && <GpsFix onFix={(r) => putSpot({ ...r, from: "gps" })} />}
          <label className="field">
            <span className="field__label">Or paste it</span>
            <input
              value={typed}
              inputMode="decimal"
              autoComplete="off"
              placeholder="11.178240, 125.002240"
              aria-invalid={typed.trim() !== "" && !parseLatLng(typed)}
              onChange={(e) => {
                e.stopPropagation(); // saved once it reads as a place, not while typing it
                setTyped(e.target.value);
                const p = parseLatLng(e.target.value);
                if (p) putSpot({ ...p, accuracy: null, from: "typed" });
              }}
            />
            <span className="field__hint">
              {typed.trim() !== "" && !parseLatLng(typed)
                ? "Latitude, then longitude, like 11.178240, 125.002240."
                : "From Google Maps: press and hold the spot, then copy the numbers."}
            </span>
          </label>
          <div className="field">
            <span className="field__label">Show it within</span>
            <div className="radius" role="group" aria-label="Show it within">
              {RADIUS.presets.map((p) => (
                <button
                  key={p.m}
                  type="button"
                  className="radius__opt"
                  aria-pressed={Number(radius) === p.m}
                  onClick={() => {
                    setRadius(String(p.m));
                    changed();
                  }}
                >
                  <b>{p.m} m</b>
                  <small>{p.label}</small>
                </button>
              ))}
              <label className="radius__own">
                <input
                  name="radius"
                  inputMode="numeric"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  aria-label="Metres"
                  required
                />
                m
              </label>
            </div>
            <span className="field__hint">
              Phone GPS is good to a few metres outdoors and rougher indoors: give a code inside a bigger distance (
              {RADIUS.min}–{RADIUS.max} m).
            </span>
          </div>
          <input type="hidden" name="lat" value={geo.lat} />
          <input type="hidden" name="lng" value={geo.lng} />
          <input type="hidden" name="accuracy" value={geo.accuracy ?? ""} />
        </section>
      </fieldset>

      {canEdit && (
        <div className="savebar">
          {remove ? <AutoSaveToast state={state} pending={pending} waiting={waiting} /> : <Status state={state} />}
          <span className="savebar__btns">
            {remove ? (
              <ConfirmButton action={remove} question={`Delete #${code.num} ${code.name}? It's gone from the game for everyone. (Turning it off can be undone.)`}>
                <TrashIcon />
                Delete
              </ConfirmButton>
            ) : (
              <SaveButton pending={pending}>Add QR code</SaveButton>
            )}
          </span>
        </div>
      )}
    </form>
  );
}
