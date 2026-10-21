"use client";

import { useState, useTransition, type ChangeEvent, type KeyboardEvent } from "react";
import { deleteZone, saveZone } from "@/lib/actions/locations";
import type { FormState } from "@/lib/form";
import { Status } from "./form";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Spinner } from "./Progress";

export type Area = { id: string; name: string; codes: number };

/**
 * A location's areas (zones): what each QR code's page offers under Zone, and what players read
 * before they've found a code ("Somewhere in the Main hall"). Rename one, add one, or remove one no
 * code is in (a location keeps at least one). Each saves at once, on its own: it sits in the
 * location's form (its side column), so it has no form of its own, Enter presses its button, and its
 * typing isn't a change to the location.
 */
export function AreasPanel({ locationId, areas, canEdit }: { locationId: string; areas: Area[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const typed = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    set(e.target.value);
  };
  const onEnter = (go: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); // (not the location's form)
    go();
  };
  const rename = (id: string) => run(() => saveZone(locationId, id, text), () => setEditing(null));
  const add = () => fresh.trim() && run(() => saveZone(locationId, null, fresh), () => setFresh(""));
  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (!r?.error) after?.();
    });

  return (
    <section className="panel areas" aria-labelledby="areas-title">
      <h2 className="panel__title" id="areas-title">
        Areas
      </h2>
      <p className="field__hint">
        Each QR code is in one of these (its page&apos;s Zone). Before it&apos;s found, players read where to look: “Somewhere
        in the {areas[0]?.name ?? "Main hall"}”.
      </p>
      <ul className="areas__list" role="list">
        {areas.map((a) => (
          <li key={a.id} className="areas__row">
            {editing === a.id ? (
              <div className="areas__edit">
                <input value={text} onChange={typed(setText)} onKeyDown={onEnter(() => rename(a.id))} maxLength={40} aria-label="Area name" autoFocus />
                <button type="button" className="icon-btn" aria-label="Save the name" disabled={pending} onClick={() => rename(a.id)}>
                  {pending ? <Spinner /> : <CheckIcon />}
                </button>
              </div>
            ) : (
              <>
                <span className="areas__name">
                  <b>{a.name}</b>
                  <small>{a.codes ? `${a.codes} QR code${a.codes === 1 ? "" : "s"}` : "No QR code"}</small>
                </span>
                {canEdit && (
                  <span className="areas__btns">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Rename ${a.name}`}
                      onClick={() => {
                        setEditing(a.id);
                        setText(a.name);
                        setState(null);
                      }}
                    >
                      <PencilIcon />
                    </button>
                    {!a.codes && areas.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        aria-label={`Remove ${a.name}`}
                        disabled={pending}
                        onClick={() => run(() => deleteZone(a.id))}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="areas__edit areas__add">
          <input value={fresh} onChange={typed(setFresh)} onKeyDown={onEnter(add)} maxLength={40} placeholder="Main hall" aria-label="New area's name" />
          <button type="button" className="btn btn--ghost btn--sm" disabled={pending || !fresh.trim()} onClick={add}>
            <PlusIcon />
            Add area
          </button>
        </div>
      )}
      <Status state={state} />
    </section>
  );
}
