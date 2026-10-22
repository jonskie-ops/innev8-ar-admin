"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { giveClaim, lookupClaim, undoClaim, type DeskAnswer } from "@/lib/actions/desk";
import { stamp } from "@/lib/format";
import { ruleText, type DeskClaim, type Given } from "@/lib/hunt";
import { Avatar } from "./bits";
import { DeskCamera } from "./DeskCamera";
import { ConfirmButton } from "./form";
import { AlertIcon, CameraIcon, CheckIcon, GiftIcon, KeyboardIcon, SearchIcon } from "./icons";
import { Spinner } from "./Progress";

export type DeskPrize = { id: string; name: string; rule: DeskClaim["prize"]["rule"]; rule_value: number | null; stock: number };
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
  if (c.claimedAt) return { ready: false, note: `Already claimed, ${stamp(c.claimedAt)}${c.claimedBy ? ` (given by ${c.claimedBy})` : ""}` };
  if (!c.won) return { ready: false, note: "Not won: their confirmed finds don't add up to this prize" };
  if (!c.test && c.prize.stock <= 0) return { ready: false, note: "None left: add stock on the prize's page first" };
  return { ready: true, note: c.test ? "Ready to give (test mode: the stock stays)" : `Ready to give · ${c.prize.stock.toLocaleString("en-PH")} in stock` };
}

/**
 * The prize desk: a player's prize card checked (its code typed, a USB scanner typing it, or its QR
 * read by the camera), shown beside it with whether it can be given, and given. Under them: what's
 * left of each prize, and every prize given at the desk (admins can take one back).
 */
export function DeskPanel({ given, prizes, total, isAdmin }: { given: Given[]; prizes: DeskPrize[]; total: number; isAdmin: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("type");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<DeskAnswer | null>(null);
  const [gave, setGave] = useState<{ who: string; prize: string; note: string; at: number } | null>(null);
  const [pending, start] = useTransition();
  const last = useRef<{ code: string; until: number } | null>(null);
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
    start(async () => setAnswer(await lookupClaim(code)));
  };
  // Ready for the next card: the box empty (typing), or the camera reading again
  const next = () => {
    if (claim) last.current = { code: claim.code, until: Date.now() + SAME_CARD_MS };
    setAnswer(null);
    setText("");
    if (mode === "type") input.current?.focus();
  };
  const fromCamera = (code: string) => {
    if (last.current && last.current.code === code && Date.now() < last.current.until) return;
    check(code);
  };

  const counts = given.reduce<Record<string, number>>((n, g) => ({ ...n, [g.prizeId]: (n[g.prizeId] ?? 0) + 1 }), {});

  return (
    <div className="desk">
      <div className="desk__top">
        <section className="panel desk__check" aria-labelledby="desk-check">
          <div className="desk__check-head">
            <h2 className="panel__title" id="desk-check">
              Check a prize card
            </h2>
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
        </section>

        {claim && state ? (
          <section className={state.ready ? "panel desk__claim is-ready" : "panel desk__claim is-not"} aria-label="The prize card">
            <div className="desk__prize">
              <span className="desk__photo">{claim.prize.photo ? <img src={claim.prize.photo} alt="" /> : <GiftIcon />}</span>
              <span>
                <b>{claim.prize.name}</b>
                <small>{ruleText({ rule: claim.prize.rule, rule_value: claim.prize.value }, total)}</small>
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
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await giveClaim(claim.code);
                      if (r.error) return setAnswer({ ...r, claim });
                      setGave({ who: claim.hunter.name, prize: claim.prize.name, note: r.ok ?? "Given", at: r.at });
                      next();
                    })
                  }
                >
                  {pending ? <Spinner /> : <GiftIcon />}
                  Give prize
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
          <section className="panel desk__claim desk__empty" aria-label="The prize card">
            <GiftIcon />
            <p>
              {mode === "type" ? "Type or scan a prize card's code" : "Hold a prize card's QR up to the camera"}: the player, their prize
              and whether it can be given show here.
            </p>
          </section>
        )}
      </div>

      <section aria-labelledby="desk-left">
        <h2 className="desk__h" id="desk-left">
          Prizes left
        </h2>
        {prizes.length ? (
          <ul className="desk__stock" role="list">
            {prizes.map((p) => (
              <li key={p.id} className={p.stock ? undefined : "is-out"}>
                <b>{p.name}</b>
                <small>{ruleText(p, total)}</small>
                <span className="desk__nums">
                  <strong>{p.stock ? p.stock.toLocaleString("en-PH") : "None"}</strong> left ·{" "}
                  {(counts[p.id] ?? 0).toLocaleString("en-PH")} given
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">No prizes are on. Add them on the Prizes page.</p>
        )}
      </section>

      <GivenTable given={given} isAdmin={isAdmin} />
    </div>
  );
}

/** Every prize given at the desk, newest first: found by player, prize, code or who gave it. */
function GivenTable({ given, isAdmin }: { given: Given[]; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = words.length
    ? given.filter((g) => {
        const t = `${g.hunter} ${g.province} ${g.tag} ${g.prize} ${g.code} ${g.code.slice(0, 4)}-${g.code.slice(4)} ${g.by ?? ""}`.toLowerCase();
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
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player, prize, code or who gave it" aria-label="Find a prize given" />
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
