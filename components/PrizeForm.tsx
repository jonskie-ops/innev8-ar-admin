"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import { useEffect, useState } from "react";
import type { FormState } from "@/lib/form";
import { PHOTO_ZOOM, photoStyle, PRIZE_RULES, type PhotoFit, type Prize, type PrizeRule } from "@/lib/hunt";
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
  codes,
  save,
  remove,
  canEdit,
}: {
  prize: Prize;
  photo: string | null;
  total: number;
  /** The codes a prize can be for ("Find a chosen QR code"): "#03 Capstone Rooms" */
  codes: { id: string; label: string }[];
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<FormState>;
  canEdit: boolean;
}) {
  const { formRef, state, pending, waiting, onSubmit, onChange, changed } = useAutoSave(save, Boolean(remove) && canEdit);
  // How the photo sits in its box, everywhere it's shown: filling it or whole, and its size
  const [fit, setFit] = useState<PhotoFit>(prize.photo_fit ?? "cover");
  const [zoom, setZoom] = useState(prize.photo_zoom ?? PHOTO_ZOOM.default);
  const pickFit = (f: PhotoFit) => {
    setFit(f);
    changed();
  };
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
          {/* Its name, and beside it how many there are */}
          <div className="row2 row2--stock">
            <label className="field">
              <span className="field__label">Name</span>
              <input name="name" defaultValue={prize.name} maxLength={60} required placeholder="INNEV8 summit kit" />
            </label>
            <label className="field">
              <span className="field__label">In stock</span>
              <input name="stock" inputMode="numeric" defaultValue={prize.stock} required title="How many you have to give away" />
              {/* (what it was when this page got it: left alone, the prize desk's gives since then stay) */}
              <input type="hidden" name="stock_was" value={prize.stock} />
            </label>
          </div>
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
          {/* A chosen code: which one, and the sentence players read */}
          {rule === "code" && (
            <div className="row2 rules__code">
              <label className="field">
                <span className="field__label">The QR code</span>
                <select name="rule_code" defaultValue={prize.rule_code ?? ""} required>
                  <option value="" disabled>
                    Choose a QR code
                  </option>
                  {codes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {prize.rule === "code" && !prize.rule_code && (
                  <span className="field__hint is-bad">Its QR code was deleted: choose another, or nobody can win it.</span>
                )}
              </label>
              <label className="field">
                <span className="field__label">What players read</span>
                <input name="rule_text" defaultValue={prize.rule_text ?? ""} maxLength={80} required placeholder="Get the Symphonics QR" />
                <span className="field__hint">Whoever finds that code wins it.</span>
              </label>
            </div>
          )}
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
              <img src={shown} alt="" className="photo__img" style={photoStyle(fit, zoom)} />
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
          {/* Its look, wherever it's shown (the photo itself is kept as it is) */}
          <input type="hidden" name="photo_fit" value={fit} />
          {shown && (
            <div className="photolook">
              <div className="seg" role="group" aria-label="How the photo fits">
                <button type="button" aria-pressed={fit === "cover"} onClick={() => pickFit("cover")}>
                  Fill the box
                </button>
                <button type="button" aria-pressed={fit === "contain"} onClick={() => pickFit("contain")}>
                  Whole photo
                </button>
              </div>
              <label className="photolook__size">
                <span className="field__label">
                  Size <b>{zoom}%</b>
                </span>
                <input
                  type="range"
                  name="photo_zoom"
                  min={PHOTO_ZOOM.min}
                  max={PHOTO_ZOOM.max}
                  step={5}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              {(fit !== "contain" || zoom !== PHOTO_ZOOM.default) && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setFit("contain");
                    setZoom(PHOTO_ZOOM.default);
                    changed();
                  }}
                >
                  Original size
                </button>
              )}
            </div>
          )}
          {!shown && <input type="hidden" name="photo_zoom" value={zoom} />}
          <span className="field__hint">
            JPG, PNG or WebP, up to 5 MB. Fill the box crops its edges; Whole photo shows all of it. The size zooms it in or out.
          </span>
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
