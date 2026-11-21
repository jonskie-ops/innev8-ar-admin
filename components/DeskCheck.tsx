"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import { useEffect, useRef, useState, useTransition } from "react";
import { checkWinner, giveClaim, lookupClaim, lookupWinner, undoClaim, type DeskAnswer, type Repeat, type WinnerAnswer } from "@/lib/actions/desk";
import { stamp } from "@/lib/format";
import { photoStyle, ruleText, type DeskClaim, type PhotoFit } from "@/lib/hunt";
import { Avatar } from "./bits";
import { badgeInText, DeskCamera } from "./DeskCamera";
import { ConfirmButton } from "./form";
import { AlertIcon, CameraIcon, CheckIcon, CloseIcon, GiftIcon, KeyboardIcon, QrIcon, SearchIcon } from "./icons";
import { Spinner } from "./Progress";

export type DeskPrize = { id: string; name: string; rule: DeskClaim["prize"]["rule"]; rule_value: number | null; rule_text?: string | null; photo_fit?: PhotoFit; photo_zoom?: number; stock: number };
type Mode = "type" | "camera";

/** After a card, the camera doesn't read that same card again for this long (ms): it's still held up. */
const SAME_CARD_MS = 6_000;

/** Whether a looked-up claim can be given, and if not, why (the desk's words). */
function standingOf(c: DeskClaim): { ready: boolean; note: string } {
  if (c.test && !c.testNow) return { ready: false, note: "Test code: it doesn't count now that test mode is off" };
  if (c.claimedAt)
    return { ready: false, note: `Already claimed${c.givenTo ? ` by ${c.givenTo}` : ""}, ${stamp(c.claimedAt)}${c.claimedBy ? ` (given by ${c.claimedBy})` : ""}` };
  // A points prize: what it costs, and what they have to spend
  const cost = c.prize.rule === "cost" ? (c.prize.value ?? 0) : null;
  const pts = (n: number) => `${n.toLocaleString("en-PH")} point${n === 1 ? "" : "s"}`;
  if (!c.won)
    return {
      ready: false,
      note:
        cost !== null
          ? `Not enough points: they have ${pts(c.standing.balance ?? 0)} to spend, and it costs ${pts(cost)}`
          : "Not won: their confirmed finds don't add up to this prize",
    };
  if (!c.test && c.prize.stock <= 0) return { ready: false, note: "None left: add stock on the prize's page first" };
  const takes = cost !== null ? ` · takes ${pts(cost)}` : "";
  return {
    ready: true,
    note: c.test ? `Ready to give${takes} (test mode: the stock stays)` : `Ready to give${takes} · ${c.prize.stock.toLocaleString("en-PH")} in stock`,
  };
}

/**
 * Checking a player's prize card, in a pop-up on any page: its QR read by the scanner, the camera on
 * the whole screen (the floating button on phones opens it so, ready to scan), or its code typed (on
 * the Prize desk page, a USB scanner or typing anywhere opens it so: `typing`). Then shown there with
 * whether it can be given, and given to the person whose name (from their ID or badge) is typed: one
 * person playing as two players is warned about.
 */
export function DeskCheck({ prizes, total, isAdmin, typing }: { prizes: DeskPrize[]; total: number; isAdmin: boolean; typing: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("camera");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<DeskAnswer | null>(null);
  const [gave, setGave] = useState<{ who: string; prize: string; note: string; at: number } | null>(null);
  // The person's name from their ID or badge, and an earlier give of this prize to that name
  const [person, setPerson] = useState("");
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [pending, start] = useTransition();
  const last = useRef<{ code: string; until: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const claim = answer?.claim;
  const state = claim ? standingOf(claim) : null;
  // A winner's hunter QR (the leaderboard prizes): who, and which prize they get
  const [win, setWin] = useState<(WinnerAnswer & { tag?: string; pin?: string }) | null>(null);
  const [prizeId, setPrizeId] = useState("");
  const winner = win?.winner;
  const busy = Boolean(claim) || Boolean(winner) || pending;

  const pick = (m: Mode) => {
    setMode(m);
    setAnswer(null);
  };
  const check = (code: string) => {
    setGave(null);
    setPerson("");
    setRepeat(null);
    setPrizeId("");
    // A hunter QR: a winner to check
    if (code.startsWith("HUNTER:")) {
      const [, tag, pin] = code.split(":");
      setAnswer(null);
      start(async () => {
        const r = await lookupWinner(tag, pin);
        setWin({ ...r, tag, pin });
        // The prize for their place, picked for them (if there is one, and it's still there)
        const w = r.winner;
        const mine = w?.me ? w.prizes.find((p) => p.rank === w.me!.rank && (w.test || p.stock > 0)) : undefined;
        if (mine && !w?.checked.length) setPrizeId(mine.id);
      });
      return;
    }
    setWin(null);
    start(async () => setAnswer(await lookupClaim(code)));
  };
  // Ready for the next card: the box empty (typing), or the camera reading again
  const next = () => {
    if (claim) last.current = { code: claim.code, until: Date.now() + SAME_CARD_MS };
    if (win?.tag) last.current = { code: `HUNTER:${win.tag}:${win.pin}`, until: Date.now() + SAME_CARD_MS };
    setAnswer(null);
    setWin(null);
    setPrizeId("");
    setText("");
    setPerson("");
    setRepeat(null);
    if (mode === "type") input.current?.focus();
  };
  const fromCamera = (code: string) => {
    if (last.current && last.current.code === code && Date.now() < last.current.until) return;
    check(code);
  };

  // The pop-up: opened by the floating button (the scanner), or by a USB scanner (or typing) on the
  // Prize desk page, its first character kept; closed, it starts again from an empty box (and the camera stops)
  const openDesk = (typed = "") => {
    setMode(typed ? "type" : "camera");
    setText(typed);
    setOpen(true);
  };
  const close = () => {
    if (pending) return;
    dialog.current?.close();
    setOpen(false);
    setAnswer(null);
    setWin(null);
    setPrizeId("");
    setGave(null);
    setText("");
    setPerson("");
    setRepeat(null);
  };
  // Given to the person named; `again`: past the warning that this name already had it
  const give = (c: DeskClaim, again = false) =>
    start(async () => {
      const r = await giveClaim(c.code, person, again);
      if (r.repeat) return setRepeat(r.repeat);
      if (r.error) return setAnswer({ ...r, claim: c });
      setGave({ who: `${c.hunter.name} (${person.trim().replace(/\s+/g, " ")})`, prize: c.prize.name, note: r.ok ?? "Given", at: r.at });
      next();
    });
  // Checked: this winner gets the chosen leaderboard prize
  const mark = () => {
    const w = win;
    const prize = w?.winner?.prizes.find((p) => p.id === prizeId);
    if (!w?.winner || !w.tag || !w.pin || !prize) return;
    start(async () => {
      const r = await checkWinner(w.tag!, w.pin!, prize.id, person);
      if (r.error) return setWin({ ...w, error: r.error });
      setGave({ who: `${w.winner!.hunter.name} (${person.trim().replace(/\s+/g, " ")})`, prize: prize.name, note: r.ok ?? "Checked", at: r.at });
      next();
    });
  };
  useEffect(() => {
    if (!open) return;
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open || !typing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[a-z0-9]$/i.test(e.key)) return;
      if (t.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      openDesk(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, typing]);

  // The card read (or typed), with whether it can be given
  const card = claim && state && (
    <section className={state.ready ? "panel desk__claim is-ready" : "panel desk__claim is-not"} aria-label="The prize card">
      <div className="desk__prize">
        <span className="desk__photo">
          {claim.prize.photo ? (
            <img
              src={claim.prize.photo}
              alt=""
              style={(() => {
                const p = prizes.find((x) => x.id === claim.prize.id);
                return photoStyle(p?.photo_fit, p?.photo_zoom);
              })()}
            />
          ) : (
            <GiftIcon />
          )}
        </span>
        <span>
          <b>{claim.prize.name}</b>
          <small>{ruleText(prizes.find((p) => p.id === claim.prize.id) ?? { rule: claim.prize.rule, rule_value: claim.prize.value }, total)}</small>
        </span>
      </div>
      <div className="desk__who">
        <Avatar name={claim.hunter.name} />
        <span>
          <b>
            {claim.hunter.name}
            <span className="tag">{claim.hunter.tag}</span>
            {claim.test && <span className="tag tag--wait">Test</span>}
          </b>
          <small>
            {claim.hunter.province} · {claim.standing.count} of {claim.standing.total} QR codes ·{" "}
            {claim.standing.score.toLocaleString("en-PH")} points
            {claim.standing.spent ? ` (${claim.standing.balance?.toLocaleString("en-PH") ?? 0} left to spend)` : ""}
            {claim.standing.legendary ? " · found the legendary code" : ""}
          </small>
        </span>
      </div>
      <p className={state.ready ? "desk__state is-ready" : "desk__state is-not"} role="status">
        {state.ready ? <CheckIcon /> : <AlertIcon />}
        {state.note}
      </p>
      {state.ready && (
        <label className="field desk__person">
          <span className="field__label">Their name, from their ID or badge</span>
          <input
            value={person}
            onChange={(e) => {
              setPerson(e.target.value);
              setRepeat(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && person.trim() && !pending) give(claim, Boolean(repeat));
            }}
            placeholder="Juan Dela Cruz"
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            aria-describedby="desk-person-hint"
          />
          <span className="field__hint" id="desk-person-hint">
            Kept with the prize, so one person can&apos;t get it twice as another player.
          </span>
        </label>
      )}
      {repeat && (
        <p className="desk__state is-warn" role="alert">
          <AlertIcon />
          <span>
            {claim.prize.name} was already given to {repeat.to}, {stamp(repeat.at)}
            {repeat.hunter ? `, as the player ${repeat.hunter}${repeat.tag ? ` (${repeat.tag})` : ""}` : ""}
            {repeat.by ? `, by ${repeat.by}` : ""}. If it&apos;s the same person, don&apos;t give it again.
          </span>
        </p>
      )}
      {answer?.error && (
        <p className="status status--error" role="alert">
          <AlertIcon />
          {answer.error}
        </p>
      )}
      <div className="desk__acts">
        {state.ready && (
          <button type="button" className="btn btn--primary desk__give" disabled={pending || !person.trim()} onClick={() => give(claim, Boolean(repeat))}>
            {pending ? <Spinner /> : <GiftIcon />}
            {repeat ? "Different person: give it" : "Give prize"}
          </button>
        )}
        {isAdmin && claim.claimedAt && !(claim.test && !claim.testNow) && (
          <ConfirmButton
            action={async () => {
              const r = await undoClaim(claim.code);
              if (!r.error) setAnswer(await lookupClaim(claim.code));
              return r.error ? { error: r.error, at: r.at } : null;
            }}
            question={`Take ${claim.prize.name} back from ${claim.hunter.name}? Only if it was given by mistake: it can be given again, and the stock goes back up.`}
            confirm="Take back"
          >
            Take back
          </ConfirmButton>
        )}
        <button type="button" className="btn btn--ghost" onClick={next}>
          {mode === "camera" ? (state.ready ? "Cancel, scan again" : "Scan the next card") : state.ready ? "Cancel" : "Next player"}
        </button>
      </div>
    </section>
  );
  // A winner's hunter QR: valid (their own phone, live) or already checked, and the prize they get
  const checked = winner?.checked[0];
  const winnerCard = winner && (
    <section className={checked ? "panel desk__claim is-not" : "panel desk__claim is-ready"} aria-label="Their hunter QR">
      <div className="desk__who">
        <Avatar name={winner.hunter.name} />
        <span>
          <b>
            {winner.hunter.name}
            <span className="tag">{winner.hunter.tag}</span>
            {winner.test && <span className="tag tag--wait">Test</span>}
          </b>
          <small>
            {winner.hunter.province} ·{" "}
            {winner.me
              ? `#${winner.me.rank} on the leaderboard${winner.final ? " (final)" : ""} · ${winner.me.score.toLocaleString("en-PH")} points · ${winner.me.codes} QR codes`
              : "Not on the leaderboard yet"}
          </small>
        </span>
      </div>
      <p className={checked ? "desk__state is-not" : "desk__state is-ready"} role="status">
        {checked ? <AlertIcon /> : <CheckIcon />}
        {checked
          ? `Already checked: they got ${checked.prize}, ${stamp(checked.at)}${checked.by ? `, by ${checked.by}` : ""}.`
          : "Valid hunter QR: their own phone, live."}
      </p>
      {!checked &&
        (winner.prizes.length ? (
          <>
            <div className="desk__pick" role="radiogroup" aria-label="The leaderboard prize they get">
              <span className="field__label">The leaderboard prize they get</span>
              {winner.prizes.map((p) => {
                const out = !winner.test && p.stock <= 0;
                return (
                  <label key={p.id} className={out ? "desk__opt is-out" : "desk__opt"}>
                    <input type="radio" name="winner-prize" checked={prizeId === p.id} disabled={out} onChange={() => setPrizeId(p.id)} />
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.rank ? `For #${p.rank}${winner.me?.rank === p.rank ? " (their place)" : ""} · ` : ""}
                        {p.to ? `Given to ${p.to}` : out ? "None left" : `${p.stock.toLocaleString("en-PH")} left`}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
            <label className="field desk__person">
              <span className="field__label">Their name, from their ID or badge</span>
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && person.trim() && prizeId && !pending) mark();
                }}
                placeholder="Juan Dela Cruz"
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </>
        ) : (
          <p className="field__hint">No leaderboard prizes are on. In Prizes, add one with &ldquo;the leaderboard decides&rdquo;.</p>
        ))}
      {win?.error && (
        <p className="status status--error" role="alert">
          <AlertIcon />
          {win.error}
        </p>
      )}
      <div className="desk__acts">
        {!checked && winner.prizes.length > 0 && (
          <button type="button" className="btn btn--primary desk__give" disabled={pending || !prizeId || !person.trim()} onClick={mark}>
            {pending ? <Spinner /> : <CheckIcon />}
            Mark as checked
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={next}>
          {mode === "camera" ? "Scan the next one" : "Next player"}
        </button>
      </div>
    </section>
  );
  // The last prize given, and a code that isn't a prize card
  const after = (
    <>
      {gave && (
        <p key={gave.at} className="desk__gave" role="status">
          <CheckIcon />
          <span>
            <b>
              Gave {gave.prize} to {gave.who}
            </b>
            <small>{gave.note}. Ready for the next player.</small>
          </span>
        </p>
      )}
      {answer?.error && !claim && (
        <p className="status status--error" role="alert">
          <AlertIcon />
          {answer.error}
        </p>
      )}
      {win?.error && !winner && (
        <p className="status status--error" role="alert">
          <AlertIcon />
          {win.error}
        </p>
      )}
    </>
  );

  return (
    <>
      {/* (phones) Floating above the tabs on every page: the scanner, ready to read a prize card */}
      <button
        type="button"
        className="deskfab"
        aria-haspopup="dialog"
        aria-label="Scan a prize card or a hunter QR"
        title="Scan a prize card or a hunter QR"
        onClick={() => openDesk()}
      >
        <QrIcon />
      </button>
      <dialog
        ref={dialog}
        className={mode === "camera" ? "confirm confirm--desk confirm--scan" : "confirm confirm--desk"}
        aria-labelledby="desk-check"
        // (a click on the dimmed page beside it closes it; its keys stay its own)
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {open &&
          (mode === "camera" ? (
            // The scanner: the camera on the whole screen, reading while no card is up; a card read
            // comes up over it (the camera waits behind it, for the next one)
            <div className="scan">
              <DeskCamera paused={busy} onCode={fromCamera} />
              <div className="scan__top">
                <h2 className="scan__title" id="desk-check">
                  <QrIcon />
                  <span className="sr-only">Scan a prize card</span>
                </h2>
                <button type="button" className="scan__close" aria-label="Close" onClick={close} disabled={pending}>
                  <CloseIcon />
                </button>
              </div>
              {card || winnerCard ? (
                <div className="scan__sheet">{card || winnerCard}</div>
              ) : (
                <div className="scan__foot">
                  {after}
                  <button type="button" className="scan__type" aria-label="Type code" title="Type code" onClick={() => pick("type")}>
                    <KeyboardIcon />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="confirm__box desk__box">
              <div className="confirm__head">
                <h2 className="confirm__title" id="desk-check">
                  {claim ? "Their prize card" : winner ? "Their hunter QR" : "Check a prize card"}
                </h2>
                <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={pending}>
                  <CloseIcon />
                </button>
              </div>
              {card || winnerCard || (
                <>
                  <div className="seg" role="group" aria-label="How to check it">
                    <button type="button" className="seg__btn" aria-pressed="true">
                      <KeyboardIcon />
                      Type code
                    </button>
                    <button type="button" className="seg__btn" aria-pressed="false" onClick={() => pick("camera")}>
                      <CameraIcon />
                      Scan with camera
                    </button>
                  </div>
                  <form
                    className="desk__find"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!text.trim()) return;
                      // (their hunter tag and PIN, as written under their hunter QR: a winner to check)
                      const badge = badgeInText(text);
                      check(badge ? `HUNTER:${badge.tag}:${badge.pin}` : text);
                    }}
                  >
                    <label className="field">
                      <span className="field__label">Prize code</span>
                      <span className="desk__input">
                        <SearchIcon />
                        <input
                          ref={input}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="K7M2-P9QX"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          autoFocus
                          aria-describedby="desk-hint"
                        />
                      </span>
                      <span className="field__hint" id="desk-hint">
                        The code under the QR on the player&apos;s prize card, or their hunter tag and PIN (Me tab). A USB scanner types
                        it for you.
                      </span>
                    </label>
                    <button type="submit" className="btn btn--primary" disabled={pending || !text.trim()}>
                      {pending && !claim ? <Spinner /> : null}
                      Check
                    </button>
                  </form>
                  {after}
                </>
              )}
            </div>
          ))}
      </dialog>
    </>
  );
}
