"use client";
/* eslint-disable @next/next/no-img-element -- Qufoo is a small, already sized sprite */

import { useState } from "react";
import type { FormState } from "@/lib/form";
import { day, fromLocalInput, time } from "@/lib/format";
import { dropPoints, dropSteps, POINTS, RARITIES, RARITY_LABEL, SEE, type DropRule } from "@/lib/hunt";
import { useNow } from "./Clock";
import { AutoSaveToast, useAutoSave } from "./form";
import { ClockIcon, EyeIcon, FlaskIcon, GiftIcon, LocateIcon, LockIcon, QrIcon, TrophyIcon } from "./icons";
import { Toggle } from "./LiveSwitch";

/** "1 day, 10 hours" between two moments. */
function howLong(ms: number) {
  const h = Math.round(ms / 3600000);
  const d = Math.floor(h / 24);
  const parts = [d && `${d} day${d === 1 ? "" : "s"}`, h % 24 && `${h % 24} hour${h % 24 === 1 ? "" : "s"}`].filter(Boolean);
  return parts.join(", ") || "under an hour";
}

/**
 * When the hunt runs, test mode, and where players claim prizes (Philippine time), with what players
 * would see right now with these settings, as they're edited. Saves by itself as it's edited.
 */
export function EventForm({
  startsAt,
  endsAt,
  testMode,
  randomSpots,
  seenFrom,
  seenReady,
  sided,
  farView,
  seeMetres,
  farReady,
  pointsDrop,
  dropRule,
  dropReady,
  claimPlace,
  save,
  canEdit,
}: {
  startsAt: string;
  endsAt: string;
  testMode: boolean;
  /** On: codes hide at random spots around each player, not at their GPS spots (for trying it anywhere) */
  randomSpots: boolean;
  /** On: a code with a "Seen from" side shows only to players standing on that side */
  seenFrom: boolean;
  /** The database has the seen-from update (else the switch says to run it) */
  seenReady: boolean;
  /** How many QR codes have a "Seen from" side set */
  sided: number;
  /** On: players see codes from `seeMetres` away, locked until they're within the code's own distance */
  farView: boolean;
  seeMetres: number;
  /** The database has the see-from-afar update (else the switch says to run it) */
  farReady: boolean;
  /** On: a code's points drop as more people find it */
  pointsDrop: boolean;
  dropRule: DropRule;
  /** The database has the points drop update (else the switch says to run it) */
  dropReady: boolean;
  claimPlace: string;
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  canEdit: boolean;
}) {
  const { formRef, state, pending, waiting, onSubmit, onChange } = useAutoSave(save, canEdit);
  const [starts, setStarts] = useState(startsAt);
  const [ends, setEnds] = useState(endsAt);
  const [test, setTest] = useState(testMode);
  const [random, setRandom] = useState(randomSpots);
  const [sides, setSides] = useState(seenFrom);
  const [farOn, setFarOn] = useState(farView);
  const [see, setSee] = useState(String(seeMetres));
  const [drop, setDrop] = useState(pointsDrop);
  const [first, setFirst] = useState(String(dropRule.first));
  const [every, setEvery] = useState(String(dropRule.every));
  const [floor, setFloor] = useState(String(dropRule.floor));
  const whole = (v: string, min: number, max: number) => (/^\d+$/.test(v.trim()) && +v >= min && +v <= max ? +v : null);
  const rf = whole(first, 1, 1000), re = whole(every, 1, 1000), rl = whole(floor, 1, 100);
  const rule: DropRule | null = rf !== null && re !== null && rl !== null ? { first: rf, every: re, floor: rl } : null;
  const [place, setPlace] = useState(claimPlace);
  const now = useNow();

  const a = fromLocalInput(starts);
  const b = fromLocalInput(ends);
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  const valid = Boolean(a && b && tb > ta);
  const phase = !valid || now === null ? null : now >= tb ? "ended" : now >= ta ? "live" : "soon";
  const seeM = /^\d+$/.test(see.trim()) ? +see : null;
  const where = random
    ? " Codes appear at random spots around each player, wherever they are."
    : ` ${
        farOn && seeM
          ? `Each code shows in the camera from ${seeM} m away and can be collected once a player is within its distance of its GPS spot`
          : "Each code appears once a player is within its distance of its GPS spot"
      }${sides && sided ? `, and ${sided === 1 ? "the code" : `the ${sided} codes`} with a "Seen from" side only from that side` : ""}.`;
  const seen =
    phase === null || !a || !b
      ? null
      : phase === "ended"
        ? { Icon: LockIcon, title: "The hunt is over", text: "Players see that the hunt has closed. Their codes and points stay on their phone." }
        : phase === "live"
          ? {
              Icon: QrIcon,
              title: "The hunt is on",
              text: `Players hunt the QR codes until ${time(b)}, ${day(b)}.${where}${test ? " The scanner shows its test tools." : ""}`,
            }
          : test
            ? {
                Icon: FlaskIcon,
                title: "Open, for testing",
                text: `Anyone with the link can play now, and the scanner shows its test tools.${where} Turn test mode off before the summit.`,
              }
            : { Icon: ClockIcon, title: "A countdown", text: `Players see the countdown to ${day(a)}, ${time(a)}, when the hunt opens.` };

  return (
    <form ref={formRef} className="evform" method="post" onSubmit={onSubmit} onChange={onChange}>
      <fieldset className="cols" disabled={!canEdit}>
        <div className="stack">
          <section className="panel">
            <h2 className="panel__title">
              <ClockIcon />
              When the hunt runs
            </h2>
            <div className="row2">
              <label className="field">
                <span className="field__label">Opens</span>
                <input
                  type="datetime-local"
                  name="starts_at"
                  defaultValue={startsAt}
                  required
                  onChange={(e) => setStarts(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Closes</span>
                <input
                  type="datetime-local"
                  name="ends_at"
                  defaultValue={endsAt}
                  required
                  onChange={(e) => setEnds(e.target.value)}
                />
              </label>
            </div>
            {valid && a && b ? (
              <ol className="runs" role="list" aria-label="The hunt">
                <li>
                  <small>Opens</small>
                  <b>{day(a)}</b>
                  <span>{time(a)}</span>
                </li>
                <li className="runs__line">
                  <span>Runs {howLong(tb - ta)}</span>
                </li>
                <li>
                  <small>Closes</small>
                  <b>{day(b)}</b>
                  <span>{time(b)}</span>
                </li>
              </ol>
            ) : (
              <p className="status status--error">The hunt has to close after it opens.</p>
            )}
            <span className="field__hint">
              Philippine time. Before it opens, players see a countdown; after it closes, the hunt ends.
            </span>
          </section>

          <section className="panel">
            <h2 className="panel__title">
              <GiftIcon />
              The prize desk
            </h2>
            <label className="field">
              <span className="field__label">Where players claim prizes</span>
              <input
                name="claim_place"
                defaultValue={claimPlace}
                maxLength={60}
                required
                onChange={(e) => setPlace(e.target.value)}
              />
            </label>
            <div className="prizecard">
              <span className="prizecard__icon" aria-hidden="true">
                <GiftIcon />
              </span>
              <p>
                <small>On a winner&apos;s prize card</small>
                <span>
                  Show this screen at the <b>{place.trim() || "…"}</b>.
                </span>
              </p>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className={test ? "panel testcard is-on" : "panel testcard"}>
            <h2 className="panel__title">
              <FlaskIcon />
              Test mode
              <span className={test ? "pill-state is-on" : "pill-state"}>{test ? "On" : "Off"}</span>
            </h2>
            <Toggle
              name="test_mode"
              defaultChecked={testMode}
              onChange={setTest}
              hint="On: anyone can play before the event, and the scanner shows its test tools (radar, arrows to the codes). Turn it off for the real launch."
            >
              Let people play before the summit
            </Toggle>
            <Toggle
              name="random_spots"
              defaultChecked={randomSpots}
              onChange={setRandom}
              hint="On: codes appear at random spots around each player, wherever they are: for trying the scanner away from the venue. Off: each code is at its GPS spot, and shows within its distance."
            >
              Random spots
            </Toggle>
          </section>

          <section className={sides ? "panel testcard is-on" : "panel testcard"}>
            <h2 className="panel__title">
              <EyeIcon />
              Seen from one side
              <span className={sides ? "pill-state is-on" : "pill-state"}>{sides ? "On" : "Off"}</span>
            </h2>
            <Toggle
              name="seen_from"
              defaultChecked={seenFrom}
              onChange={setSides}
              hint={
                seenReady ? (
                  <>
                    On: a QR code with a &quot;Seen from&quot; side shows only to players standing on that side, so they walk
                    around a wall or a building to find it. Off: every code shows from every side.{" "}
                    {sided
                      ? `${sided} QR code${sided === 1 ? " has" : "s have"} a side set.`
                      : "No QR code has a side yet: set one on a code's page, under On the ground."}
                  </>
                ) : (
                  "Needs its update first: run supabase/migrations/20261115000000_seen_from.sql in Supabase's SQL Editor."
                )
              }
            >
              Walls and obstacles
            </Toggle>
          </section>

          <section className={farOn ? "panel testcard is-on" : "panel testcard"}>
            <h2 className="panel__title">
              <LocateIcon />
              See codes from farther away
              <span className={farOn ? "pill-state is-on" : "pill-state"}>{farOn ? "On" : "Off"}</span>
            </h2>
            <Toggle
              name="far_view"
              defaultChecked={farView}
              onChange={setFarOn}
              hint={
                farReady
                  ? "On: players see a QR code in the camera from farther away, locked, with how far to walk; they collect it once within its own distance (on the code's page, 10 m unless changed). Off: a code shows only within its own distance."
                  : "Needs its update first: run supabase/migrations/20261119010000_see_from_afar.sql in Supabase's SQL Editor."
              }
            >
              Show codes before players can collect them
            </Toggle>
            {farReady && (
              <label className="field">
                <span className="field__label">Players see codes from</span>
                <span className="dropnums__in">
                  <input type="number" name="see_metres" min={SEE.min} max={SEE.max} step={1} defaultValue={seeMetres} required onChange={(e) => setSee(e.target.value)} />
                  <small>metres</small>
                </span>
                <span className="field__hint">
                  {/^\d+$/.test(see.trim()) && +see >= SEE.min && +see <= SEE.max
                    ? `From ${+see} m away a code shows in the camera, locked: "walk closer". A code whose own distance is ${+see} m or more shows only when it can be collected.`
                    : `A whole number of metres from ${SEE.min} to ${SEE.max}.`}
                </span>
              </label>
            )}
          </section>

          <section className={drop ? "panel testcard is-on" : "panel testcard"}>
            <h2 className="panel__title">
              <TrophyIcon />
              Points drop as more find a code
              <span className={drop ? "pill-state is-on" : "pill-state"}>{drop ? "On" : "Off"}</span>
            </h2>
            <Toggle
              name="points_drop"
              defaultChecked={pointsDrop}
              onChange={setDrop}
              hint={
                dropReady
                  ? "On: the first players to find each QR code get its full points, and later finders get less, so finding codes early pays. Points already earned stay. Off: every finder gets the code's full points."
                  : "Needs its update first: run supabase/migrations/20261119000000_points_drop.sql in Supabase's SQL Editor."
              }
            >
              Reward the first finders
            </Toggle>
            {dropReady && (
              <>
                <div className="dropnums">
                  <label className="field">
                    <span className="field__label">Full points for the first</span>
                    <span className="dropnums__in">
                      <input type="number" name="drop_full" min={1} max={1000} step={1} defaultValue={dropRule.first} required onChange={(e) => setFirst(e.target.value)} />
                      <small>finders</small>
                    </span>
                  </label>
                  <label className="field">
                    <span className="field__label">Then 10% less every</span>
                    <span className="dropnums__in">
                      <input type="number" name="drop_every" min={1} max={1000} step={1} defaultValue={dropRule.every} required onChange={(e) => setEvery(e.target.value)} />
                      <small>finders</small>
                    </span>
                  </label>
                  <label className="field">
                    <span className="field__label">Never below</span>
                    <span className="dropnums__in">
                      <input type="number" name="drop_floor" min={1} max={100} step={1} defaultValue={dropRule.floor} required onChange={(e) => setFloor(e.target.value)} />
                      <small>% of the points</small>
                    </span>
                  </label>
                </div>
                {rule ? (
                  <table className={drop ? "droptable" : "droptable is-off"} aria-label="Points by finder">
                    <thead>
                      <tr>
                        <th scope="col">Finder</th>
                        {RARITIES.map((r) => (
                          <th key={r} scope="col">
                            {RARITY_LABEL[r]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dropSteps(rule).map((s) => (
                        <tr key={s.from}>
                          <th scope="row">{s.to === null ? `#${s.from} on` : s.to === s.from ? `#${s.from}` : `#${s.from}–${s.to}`}</th>
                          {RARITIES.map((r) => (
                            <td key={r}>{dropPoints(POINTS[r], s.from, rule).toLocaleString("en-PH")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="status status--error">Use whole numbers: finders from 1 to 1,000, the lowest share from 1 to 100%.</p>
                )}
                <span className="field__hint">
                  For codes worth the usual points; a code with its own points drops the same way. Test-mode finds are counted apart from
                  real ones.
                </span>
              </>
            )}
          </section>

          <section className="panel seen">
            <h2 className="panel__title">What players see now</h2>
            <div className="seen__body" aria-live="polite">
              <div className="seen__phone" aria-hidden="true">
                <img src="/assets/img/mascot/idle.webp" alt="" width="320" height="340" />
                {seen && (
                  <span className="seen__icon">
                    <seen.Icon />
                  </span>
                )}
              </div>
              <p className="seen__text">
                {seen ? (
                  <>
                    <b>{seen.title}</b>
                    {seen.text}
                  </>
                ) : (
                  <span className="empty">{valid ? "…" : "Set when the hunt opens and closes."}</span>
                )}
              </p>
            </div>
            <span className="field__hint">With the settings on this page, as you change them. They save by themselves 3 seconds after your last change.</span>
          </section>
        </div>
      </fieldset>
      {canEdit && <AutoSaveToast state={state} pending={pending} waiting={waiting} />}
    </form>
  );
}
