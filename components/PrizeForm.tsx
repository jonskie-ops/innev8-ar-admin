"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import { useEffect, useState } from "react";
import type { FormState } from "@/lib/form";
import { PRIZE_RULES, type Prize, type PrizeRule } from "@/lib/hunt";
import { AutoSaveToast, ConfirmButton, Counter, SaveButton, Status, useAutoSave } from "./form";
import { ImageIcon, TrashIcon } from "./icons";
import { Toggle } from "./LiveSwitch";

/**
 * A prize: what it is (name, photo, description), who wins it, and how many there are. An existing
 * prize saves by itself as it's edited; a new one is added with Add prize.
 */
export function PrizeForm({
  prize,
  photo,
  total,
  save,
  remove,
  canEdit,
}: {
  prize: Prize;
  photo: string | null;
  total: number;
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<FormState>;
  canEdit: boolean;
}) {
  const { formRef, state, pending, waiting, onSubmit, onChange } = useAutoSave(save, Boolean(remove) && canEdit);
  const [rule, setRule] = useState<PrizeRule>(prize.rule);
  const [desc, setDesc] = useState(prize.description.length);
  const [picked, setPicked] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  // Saved: the new photo (or none) comes back from the server; the file field starts over
  const [saved, setSaved] = useState(photo);
  if (photo !== saved) {
    setSaved(photo);
    setPicked(null);
    setDropPhoto(false);
  }
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked)), [picked]);
  const shown = picked ?? (dropPhoto ? null : photo);

  return (
    <form ref={formRef} className="edit" method="post" onSubmit={onSubmit} onChange={onChange}>
      <fieldset className="edit__main" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">The prize</h2>
          <label className="field">
            <span className="field__label">Name</span>
            <input name="name" defaultValue={prize.name} maxLength={60} required placeholder="INNEV8 summit kit" />
          </label>
          <label className="field">
            <span className="field__label">
              Description <Counter n={desc} max={300} />
            </span>
            <textarea
              name="description"
              rows={3}
              defaultValue={prize.description}
              maxLength={300}
              onChange={(e) => setDesc(e.target.value.length)}
              placeholder="What's in it, who it's from…"
            />
          </label>
        </section>

        <section className="panel">
          <h2 className="panel__title">Who wins it</h2>
          <div className="rules" role="radiogroup" aria-label="Who wins it">
            {PRIZE_RULES.map((r) => (
              <label key={r.id} className="rules__opt">
                <input type="radio" name="rule" value={r.id} checked={rule === r.id} onChange={() => setRule(r.id)} />
                <span className="rules__text">
                  {r.id === "all" ? `Collect all ${total} QR codes` : r.label}
                </span>
                {r.value && rule === r.id && (
                  <span className="rules__value">
                    <input
                      name="rule_value"
                      inputMode="numeric"
                      defaultValue={prize.rule === r.id ? (prize.rule_value ?? "") : r.id === "count" ? 4 : 1000}
                      aria-label={`How many ${r.value}`}
                      required
                    />
                    {r.value}
                  </span>
                )}
              </label>
            ))}
          </div>
          <label className="field field--short">
            <span className="field__label">In stock</span>
            <input name="stock" inputMode="numeric" defaultValue={prize.stock} required />
            {/* (what it was when this page got it: left alone, the prize desk's gives since then stay) */}
            <input type="hidden" name="stock_was" value={prize.stock} />
            <span className="field__hint">How many you have to give away.</span>
          </label>
        </section>
      </fieldset>

      <fieldset className="edit__side" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">
            <ImageIcon />
            Photo
          </h2>
          <div className="photo">
            {shown ? (
              <img src={shown} alt="" className="photo__img" />
            ) : (
              <span className="photo__none">
                <ImageIcon />
                No photo yet
              </span>
            )}
          </div>
          <label className="btn btn--ghost btn--sm photo__pick">
            <input
              key={saved ?? ""}
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPicked(f ? URL.createObjectURL(f) : null);
                if (f) setDropPhoto(false);
              }}
            />
            {photo || picked ? "Choose another photo" : "Choose a photo"}
          </label>
          {photo && !picked && (
            <label className="check">
              <input type="checkbox" name="remove_photo" checked={dropPhoto} onChange={(e) => setDropPhoto(e.target.checked)} />
              Remove the photo
            </label>
          )}
          <span className="field__hint">JPG, PNG or WebP, up to 5 MB. Square works best.</span>
        </section>
        <section className="panel">
          <h2 className="panel__title">In the game</h2>
          <Toggle name="live" defaultChecked={prize.live} hint="Off: players don't see it.">
            Live
          </Toggle>
        </section>
      </fieldset>

      {canEdit && (
        <div className="savebar">
          {remove ? <AutoSaveToast state={state} pending={pending} waiting={waiting} /> : <Status state={state} />}
          <span className="savebar__btns">
            {remove ? (
              <ConfirmButton action={remove} question={`Delete ${prize.name}?`}>
                <TrashIcon />
                Delete
              </ConfirmButton>
            ) : (
              <SaveButton pending={pending}>Add prize</SaveButton>
            )}
          </span>
        </div>
      )}
    </form>
  );
}
