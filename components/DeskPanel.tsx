"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */

import { useRef, useState, useTransition } from "react";
import { giveClaim, lookupClaim, undoClaim, type DeskAnswer } from "@/lib/actions/desk";
import { ago, stamp } from "@/lib/format";
import { ruleText, type DeskClaim, type DeskGiven } from "@/lib/hunt";
import { Avatar } from "./bits";
import { ConfirmButton } from "./form";
import { AlertIcon, CheckIcon, GiftIcon, SearchIcon } from "./icons";
import { Spinner } from "./Progress";

export type DeskPrize = { id: string; name: string; rule: DeskClaim["prize"]["rule"]; rule_value: number | null; stock: number };

/** Whether a looked-up claim can be given, and if not, why (the desk's words). */
function standingOf(c: DeskClaim): { ready: boolean; note: string } {
  if (c.test && !c.testNow) return { ready: false, note: "Test code: it doesn't count now that test mode is off" };
  if (c.claimedAt) return { ready: false, note: `Already claimed, ${stamp(c.claimedAt)}${c.claimedBy ? ` (given by ${c.claimedBy})` : ""}` };
  if (!c.won) return { ready: false, note: "Not won: their confirmed finds don't add up to this prize" };
  if (!c.test && c.prize.stock <= 0) return { ready: false, note: "None left: add stock on the prize's page first" };
  return { ready: true, note: c.test ? "Ready to give (test mode: the stock stays)" : `Ready to give · ${c.prize.stock.toLocaleString("en-PH")} in stock` };
}

/**
 * The prize desk: type the code on a player's prize card (or scan its QR: a USB scanner types it and
 * presses Enter), check whose it is and that it's theirs to have, and give the prize. Then it's ready
 * for the next player. Beside it: what's left of each prize, and the latest given.
 */
export function DeskPanel({
  given,
  prizes,
  total,
  isAdmin,
}: {
  given: DeskGiven;
  prizes: DeskPrize[];
  total: number;
  isAdmin: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<DeskAnswer | null>(null);
  const [gave, setGave] = useState<{ who: string; prize: string; note: string; at: number } | null>(null);
  const [pending, start] = useTransition();
  const claim = answer?.claim;
  const state = claim ? standingOf(claim) : null;
  const next = () => {
    setText("");
    input.current?.focus();
  };

  return (
    <div className="cols desk">
      <div className="stack">
        <section className="panel">
          <form
            className="desk__find"
            onSubmit={(e) => {
              e.preventDefault();
              setGave(null);
              start(async () => setAnswer(await lookupClaim(text)));
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
                Type the code under the QR on the player&apos;s prize card, or scan the QR (a USB scanner types it for you).
              </span>
            </label>
            <button type="submit" className="btn btn--primary" disabled={pending || !text.trim()}>
              {pending && !claim ? <Spinner /> : null}
              Check
            </button>
          </form>

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

        {claim && state && (
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
                      setAnswer(null);
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
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setAnswer(null);
                  next();
                }}
              >
                {state.ready ? "Cancel" : "Next player"}
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="stack">
        <section className="panel">
          <h2 className="panel__title">
            <GiftIcon />
            Prizes left
          </h2>
          {prizes.length ? (
            <ul className="desk__stock" role="list">
              {prizes.map((p) => (
                <li key={p.id}>
                  <span>
                    <b>{p.name}</b>
                    <small>{ruleText(p, total)}</small>
                  </span>
                  <span className="desk__nums">
                    <b className={p.stock ? undefined : "is-out"}>{p.stock ? `${p.stock.toLocaleString("en-PH")} left` : "None left"}</b>
                    <small>{(given.counts[p.id] ?? 0).toLocaleString("en-PH")} given</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No prizes are on. Add them on the Prizes page.</p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel__title">Given lately</h2>
          {given.recent.length ? (
            <ol className="desk__recent" role="list">
              {given.recent.map((g) => (
                <li key={g.code}>
                  <Avatar name={g.hunter} />
                  <span>
                    <b>
                      {g.prize} to {g.hunter}
                    </b>
                    <small>
                      {g.province}
                      {g.given_by ? ` · by ${g.given_by}` : ""}
                    </small>
                  </span>
                  <time dateTime={g.at} title={stamp(g.at)} suppressHydrationWarning>
                    {ago(g.at)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">No prizes given yet. Each one given here shows up, with who gave it.</p>
          )}
        </section>
      </div>
    </div>
  );
}
