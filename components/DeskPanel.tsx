"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { giveClaim, lookupClaim, undoClaim, type DeskAnswer, type Repeat } from "@/lib/actions/desk";
import { stamp } from "@/lib/format";
import { photoStyle, ruleText, type DeskClaim, type Given, type PhotoFit } from "@/lib/hunt";
import { Avatar } from "./bits";
import { DeskCamera } from "./DeskCamera";
import { ConfirmButton } from "./form";
import { AlertIcon, CameraIcon, CheckIcon, CloseIcon, GiftIcon, KeyboardIcon, QrIcon, SearchIcon } from "./icons";
import { Spinner } from "./Progress";

export type DeskPrize = { id: string; name: string; rule: DeskClaim["prize"]["rule"]; rule_value: number | null; rule_text?: string | null; photo_fit?: PhotoFit; photo_zoom?: number; stock: number };
type Mode = "type" | "camera";

/** This device's choice of typing or the camera (kept on it, for the next time). */
const MODE_KEY = "i8admin-desk-mode";
/** How often (ms) the prizes given and left are fetched again, for gives at another desk. */
const REFRESH_MS = 30_000;
/** After a card, the camera doesn't read that same card again for this long (ms): it's still held up. */
const SAME_CARD_MS = 6_000;

const clock = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const date = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Whether a looked-up claim can be given, and if not, why (the desk's words). */
function standingOf(c: DeskClaim): { ready: boolean; note: string } {
  if (c.test && !c.testNow) return { ready: false, note: "Test code: it doesn't count now that test mode is off" };
  if (c.claimedAt)
    return { ready: false, note: `Already claimed${c.givenTo ? ` by ${c.givenTo}` : ""}, ${stamp(c.claimedAt)}${c.claimedBy ? ` (given by ${c.claimedBy})` : ""}` };
  if (!c.won) return { ready: false, note: "Not won: their confirmed finds don't add up to this prize" };
  if (!c.test && c.prize.stock <= 0) return { ready: false, note: "None left: add stock on the prize's page first" };
  return { ready: true, note: c.test ? "Ready to give (test mode: the stock stays)" : `Ready to give · ${c.prize.stock.toLocaleString("en-PH")} in stock` };
}

/**
 * The prize desk: a player's prize card checked in a pop-up (its code typed, a USB scanner typing it,
 * or its QR read by the camera), then shown there with whether it can be given, and given to the
 * person whose name (from their ID or badge) is typed: one person playing as two players is warned
 * about. Under it: every prize given at the desk (admins can take one back).
 */
export function DeskPanel({ given, prizes, total, isAdmin }: { given: Given[]; prizes: DeskPrize[]; total: number; isAdmin: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("type");
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

  // The mode this device used last time
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "camera") setMode("camera"); // eslint-disable-line react-hooks/set-state-in-effect -- (a remembered choice)
    } catch {}
  }, []);
  const pick = (m: Mode) => {
    setMode(m);
    setAnswer(null);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  // Gives at another desk show up here too (not while a card's being checked)
  const busy = Boolean(claim) || pending;
  useEffect(() => {
    if (busy) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [busy, router]);

  const check = (code: string) => {
    setGave(null);
    setPerson("");
    setRepeat(null);
    start(async () => setAnswer(await lookupClaim(code)));
  };
  // Ready for the next card: the box empty (typing), or the camera reading again
  const next = () => {
    if (claim) last.current = { code: claim.code, until: Date.now() + SAME_CARD_MS };
    setAnswer(null);
    setText("");
    setPerson("");
    setRepeat(null);
    if (mode === "type") input.current?.focus();
  };
  const fromCamera = (code: string) => {
    if (last.current && last.current.code === code && Date.now() < last.current.until) return;
    check(code);
  };

  // The pop-up: opened by its button, or by a USB scanner (or typing) anywhere on the page, its first
  // character kept; closed, it starts again from an empty box (and the camera stops)
  const openDesk = (typed = "") => {
    if (typed) {
      setMode("type");
      setText(typed);
    }
    setOpen(true);
  };
  const close = () => {
    if (pending) return;
    dialog.current?.close();
    setOpen(false);
    setAnswer(null);
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
  useEffect(() => {
    if (!open) return;
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[a-z0-9]$/i.test(e.key)) return;
      if (t.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      openDesk(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="desk">
      <button type="button" className="panel desk__open" aria-haspopup="dialog" onClick={() => openDesk()}>
        <span className="desk__open-ico">
          <QrIcon />
        </span>
        <span className="desk__open-text">
          <b>Check a prize card</b>
          <small>Type its code, scan its QR with the camera, or just start scanning with a USB scanner.</small>
        </span>
        <span className="btn btn--primary btn--sm" aria-hidden="true">
          <SearchIcon />
          Check a card
        </span>
      </button>

      <dialog
        ref={dialog}
        className="confirm confirm--desk"
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
        {open && (
          <div className="confirm__box desk__box">
            <div className="confirm__head">
              <h2 className="confirm__title" id="desk-check">
                {claim ? "Their prize card" : "Check a prize card"}
              </h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={pending}>
                <CloseIcon />
              </button>
            </div>
            {claim && state ? (
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
                      {claim.standing.score.toLocaleString("en-PH")} points{claim.standing.legendary ? " · found the legendary code" : ""}
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
                    <button
                      type="button"
                      className="btn btn--primary desk__give"
                      disabled={pending || !person.trim()}
                      onClick={() => give(claim, Boolean(repeat))}
                    >
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
                    {state.ready ? "Cancel" : "Next player"}
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="seg" role="group" aria-label="How to check it">
                  <button type="button" className="seg__btn" aria-pressed={mode === "type"} onClick={() => pick("type")}>
                    <KeyboardIcon />
                    Type code
                  </button>
                  <button type="button" className="seg__btn" aria-pressed={mode === "camera"} onClick={() => pick("camera")}>
                    <CameraIcon />
                    Scan with camera
                  </button>
                </div>

                {mode === "type" ? (
                  <form
                    className="desk__find"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (text.trim()) check(text);
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
                        The code under the QR on the player&apos;s prize card. A USB scanner types it for you.
                      </span>
                    </label>
                    <button type="submit" className="btn btn--primary" disabled={pending || !text.trim()}>
                      {pending && !claim ? <Spinner /> : null}
                      Check
                    </button>
                  </form>
                ) : (
                  <DeskCamera paused={busy} onCode={fromCamera} />
                )}

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
              </>
            )}
          </div>
        )}
      </dialog>

      <GivenTable given={given} isAdmin={isAdmin} />
    </div>
  );
}

/** Every prize given at the desk, newest first: found by player, name, prize, code or who gave it. */
function GivenTable({ given, isAdmin }: { given: Given[]; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = words.length
    ? given.filter((g) => {
        const t = `${g.hunter} ${g.province} ${g.tag} ${g.givenTo ?? ""} ${g.prize} ${g.code} ${g.code.slice(0, 4)}-${g.code.slice(4)} ${g.by ?? ""}`.toLowerCase();
        return words.every((w) => t.includes(w));
      })
    : given;
  return (
    <section className="panel panel--flush desk__log" aria-labelledby="desk-log">
      <div className="desk__log-head">
        <h2 className="panel__title" id="desk-log">
          Given at the desk <span className="count">{given.length.toLocaleString("en-PH")}</span>
        </h2>
        {given.length > 0 && (
          <label className="hunters__find">
            <SearchIcon />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player, name, prize, code or who gave it" aria-label="Find a prize given" />
          </label>
        )}
      </div>
      {rows.length ? (
        <div className="desk__table-wrap">
          <table className="desk__table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Player</th>
                <th scope="col">Name on ID</th>
                <th scope="col">Prize</th>
                <th scope="col">Code</th>
                <th scope="col">Given by</th>
                {isAdmin && (
                  <th scope="col">
                    <span className="sr-only">Take back</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.code}>
                  <td>
                    <time dateTime={g.at} title={stamp(g.at)}>
                      <b>{clock.format(new Date(g.at))}</b>
                      <small>{date.format(new Date(g.at))}</small>
                    </time>
                  </td>
                  <td>
                    <span className="desk__player">
                      <Avatar name={g.hunter} />
                      <span>
                        <b>{g.hunter}</b>
                        <small>
                          {g.province}
                          {g.tag && ` · ${g.tag}`}
                        </small>
                      </span>
                    </span>
                  </td>
                  <td>{g.givenTo ?? "—"}</td>
                  <td>{g.prize}</td>
                  <td>
                    <code>
                      {g.code.slice(0, 4)}-{g.code.slice(4)}
                    </code>
                  </td>
                  <td>{g.by ?? "—"}</td>
                  {isAdmin && (
                    <td className="desk__row-acts">
                      <ConfirmButton
                        action={async () => {
                          const r = await undoClaim(g.code);
                          return r.error ? { error: r.error, at: r.at } : null;
                        }}
                        question={`Take ${g.prize} back from ${g.hunter}? Only if it was given by mistake: it can be given again, and the stock goes back up.`}
                        confirm="Take back"
                      >
                        Take back
                      </ConfirmButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty desk__none">
          {given.length ? `Nothing given matches “${q.trim()}”.` : "No prizes given yet. Each one given here shows up, with who gave it."}
        </p>
      )}
    </section>
  );
}
