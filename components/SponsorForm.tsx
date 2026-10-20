"use client";
/* eslint-disable @next/next/no-img-element -- the sponsor's badge: a small picture made on the page, or from Supabase storage */

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import type { FormState } from "@/lib/form";
import type { Rarity } from "@/lib/hunt";
import { LOGO_TYPES, makeBadge, type Background } from "./badge";
import { pad } from "./bits";
import { AutoSaveToast, ConfirmButton, SaveButton, Status, useAutoSave } from "./form";
import { ImageIcon, TrashIcon } from "./icons";
import { QrGlyph } from "./QrGlyph";

/** A code the sponsor is on, for the list on their page. */
export type SponsoredCode = { id: string; num: number; name: string; rarity: Rarity; live: boolean };

/**
 * A sponsor: their name and logo. The logo chosen becomes their round badge right here (components/
 * badge.ts), shown on a QR code as the game will show it. An existing sponsor saves by itself as
 * it's edited; a new one is added with Add sponsor.
 */
export function SponsorForm({
  sponsor,
  codes,
  save,
  remove,
  canEdit,
}: {
  sponsor: { id: string; name: string; badge: string | null };
  codes: SponsoredCode[];
  save: (state: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<FormState>;
  canEdit: boolean;
}) {
  const { formRef, state, pending, waiting, onSubmit, onChange, changed } = useAutoSave(save, Boolean(remove) && canEdit);
  const [name, setName] = useState(sponsor.name);
  // The logo chosen and the badge made from it (sent with the next save), or what's wrong with it
  const [logo, setLogo] = useState<{ file: File; badge: string; background: Background; cut: boolean } | null>(null);
  const [problem, setProblem] = useState("");
  const [making, setMaking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Saved: the stored badge comes back from the server, so the one made here can go
  const [saved, setSaved] = useState(sponsor.badge);
  if (sponsor.badge !== saved) {
    setSaved(sponsor.badge);
    setLogo(null);
  }
  const shown = logo?.badge ?? sponsor.badge;

  const make = async (file: File, cut?: boolean) => {
    setMaking(true);
    setProblem("");
    try {
      const made = await makeBadge(file, cut);
      setLogo({ file, ...made });
      changed();
    } catch (e) {
      setProblem(e instanceof Error && !/security|tainted/i.test(e.name + e.message) ? e.message : "Couldn't read that logo. Try a PNG or JPG.");
    } finally {
      setMaking(false);
    }
  };

  return (
    <form ref={formRef} className="edit" method="post" onSubmit={onSubmit} onChange={onChange}>
      <fieldset className="edit__main" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">The sponsor</h2>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              placeholder="Smart Communications"
              autoFocus={!remove}
            />
            <span className="field__hint">How it&apos;s written here and in the game (“Sponsored by {name.trim() || "…"}” on the logo).</span>
          </label>
        </section>

        <section className="panel">
          <h2 className="panel__title">On the QR codes</h2>
          {codes.length ? (
            <ul className="sponsored" role="list">
              {codes.map((c) => (
                <li key={c.id}>
                  <Link href={`/codes/${c.id}`} className={`sponsored__code ccard--${c.rarity}${c.live ? "" : " is-off"}`}>
                    <b>#{pad(c.num)}</b>
                    {c.name}
                    {!c.live && <small>Off</small>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{remove ? "On no QR code yet." : "None yet."}</p>
          )}
          <p className="field__hint">
            Each QR code&apos;s sponsor is chosen on that code&apos;s page{remove ? "" : ", once this one is added"}.
          </p>
        </section>
      </fieldset>

      <fieldset className="edit__side" disabled={!canEdit}>
        <section className="panel">
          <h2 className="panel__title">
            <ImageIcon />
            Logo
          </h2>
          <div className="badgebox">
            {shown ? (
              <>
                <img src={shown} alt={`${name || "The sponsor"}'s badge`} className="badgebox__badge" width={112} height={112} />
                {/* As the game shows it: on the QR code's top-right corner */}
                <span className="badgebox__qr ccard--common" style={{ "--i": 0 } as CSSProperties} aria-hidden="true">
                  <QrGlyph seed={sponsor.id} />
                  <img src={shown} alt="" className="qr-sponsor" />
                </span>
              </>
            ) : (
              <span className="photo__none">
                <ImageIcon />
                No logo yet
              </span>
            )}
            {making && <span className="badgebox__making">Making the badge…</span>}
          </div>
          {/* The badge made here goes with the save; the file itself stays on this computer */}
          <input type="hidden" name="badge" value={logo?.badge ?? ""} />
          <label className="btn btn--ghost btn--sm photo__pick">
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_TYPES}
              aria-label="Choose their logo"
              onChange={(e) => {
                e.stopPropagation();
                const f = e.target.files?.[0];
                if (f) void make(f);
                e.target.value = "";
              }}
            />
            {shown ? "Choose another logo" : "Choose their logo"}
          </label>
          {logo && logo.background !== "none" && (
            <label className="check">
              <input
                type="checkbox"
                checked={logo.cut}
                onChange={(e) => {
                  e.stopPropagation();
                  // Ticked at once; the badge follows when it's made again
                  setLogo({ ...logo, cut: e.target.checked });
                  void make(logo.file, e.target.checked);
                }}
              />
              Take out the background
            </label>
          )}
          {problem && (
            <p className="status status--error" role="alert">
              {problem}
            </p>
          )}
          <span className="field__hint">
            PNG, JPG, WebP or SVG. A plain white background is taken out. A coloured one stays, as it may be part of the
            logo: tick “Take out the background” to take it out too.
          </span>
        </section>
      </fieldset>

      {canEdit && (
        <div className="savebar">
          {remove ? <AutoSaveToast state={state} pending={pending} waiting={waiting} /> : <Status state={state} />}
          <span className="savebar__btns">
            {remove ? (
              <ConfirmButton
                action={remove}
                question={
                  codes.length
                    ? `Take ${sponsor.name} off? ${codes.map((c) => `#${pad(c.num)}`).join(", ")} will have no sponsor.`
                    : `Take ${sponsor.name} off?`
                }
              >
                <TrashIcon />
                Delete
              </ConfirmButton>
            ) : (
              <SaveButton pending={pending || making}>Add sponsor</SaveButton>
            )}
          </span>
        </div>
      )}
    </form>
  );
}
