"use client";

import { useState } from "react";
import type { FormState } from "@/lib/form";
import { GAME_URL, POINTS, RARITIES, RARITY_LABEL, TASKS, taskOf, type Code, type Rarity, type Task, type Zone } from "@/lib/hunt";
import { ConfirmButton, Counter, SaveButton, Status, useForm } from "./form";
import { ExternalIcon, PinIcon, TrashIcon } from "./icons";
import { Toggle } from "./LiveSwitch";
import { VenueMap, type Pin } from "./VenueMap";

/**
 * A QR code: what players read (name, clue, description), where it is (zone, spot, map pin), and
 * what it's worth. Changing the rarity moves the points to that rarity's usual value, unless
 * they'd been set by hand.
 */
export function CodeForm({
  code,
  zones,
  others,
  save,
  remove,
  canEdit,
}: {
  code: Code;
  zones: Zone[];
  others: Pin[];
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<FormState>;
  canEdit: boolean;
}) {
  const { state, pending, onSubmit } = useForm(save);
  const [rarity, setRarity] = useState<Rarity>(code.rarity);
  const [points, setPoints] = useState(String(code.points));
  const [pos, setPos] = useState({ x: code.x, y: code.y });
  const [clue, setClue] = useState(code.clue.length);
  const [blurb, setBlurb] = useState(code.blurb.length);
  const [num, setNum] = useState(String(code.num));
  const [task, setTask] = useState<Task>(code.task ?? "none");

  const pickRarity = (r: Rarity) => {
    if (points === String(POINTS[rarity])) setPoints(String(POINTS[r]));
    setRarity(r);
  };
  const me: Pin = { id: code.id, num: Number(num) || code.num, name: code.name, rarity, x: pos.x, y: pos.y, live: true };

  return (
    <form className="edit" method="post" onSubmit={onSubmit}>
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
          <div className="row2">
            <label className="field">
              <span className="field__label">Zone</span>
              <select name="zone_id" defaultValue={code.zone_id} required>
                {zones.map((z) => (
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
            pins={[...others, me]}
            zones={zones}
            selected={code.id}
            move={canEdit ? (x, y) => setPos({ x, y }) : undefined}
            label="Place the pin: tap or drag on the map"
          />
          <span className="field__hint">{canEdit ? "Tap or drag on the map to place it. " : ""}Other codes are shown faded.</span>
          <input type="hidden" name="x" value={pos.x} />
          <input type="hidden" name="y" value={pos.y} />
        </section>
      </fieldset>

      {canEdit && (
        <div className="savebar">
          <Status state={state} />
          <span className="savebar__btns">
            {remove && (
              <ConfirmButton action={remove} question={`Delete #${code.num} ${code.name}? It's gone from the game for everyone. (Turning it off can be undone.)`}>
                <TrashIcon />
                Delete
              </ConfirmButton>
            )}
            <SaveButton pending={pending}>{remove ? "Save changes" : "Add QR code"}</SaveButton>
          </span>
        </div>
      )}
    </form>
  );
}
