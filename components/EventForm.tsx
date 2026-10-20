"use client";
/* eslint-disable @next/next/no-img-element -- Qufoo is a small, already sized sprite */

import { useState } from "react";
import type { FormState } from "@/lib/form";
import { day, fromLocalInput, time } from "@/lib/format";
import { useNow } from "./Clock";
import { AutoSaveToast, useAutoSave } from "./form";
import { ClockIcon, FlaskIcon, GiftIcon, LockIcon, QrIcon } from "./icons";
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
  claimPlace,
  save,
  canEdit,
}: {
  startsAt: string;
  endsAt: string;
  testMode: boolean;
  /** On: codes hide at random spots around each player, not at their GPS spots (for trying it anywhere) */
  randomSpots: boolean;
  claimPlace: string;
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  canEdit: boolean;
}) {
  const { formRef, state, pending, waiting, onSubmit, onChange } = useAutoSave(save, canEdit);
  const [starts, setStarts] = useState(startsAt);
  const [ends, setEnds] = useState(endsAt);
  const [test, setTest] = useState(testMode);
  const [random, setRandom] = useState(randomSpots);
  const [place, setPlace] = useState(claimPlace);
  const now = useNow();

  const a = fromLocalInput(starts);
  const b = fromLocalInput(ends);
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  const valid = Boolean(a && b && tb > ta);
  const phase = !valid || now === null ? null : now >= tb ? "ended" : now >= ta ? "live" : "soon";
  const where = random
    ? " Codes appear at random spots around each player, wherever they are."
    : " Each code appears once a player is within its distance of its GPS spot.";
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
