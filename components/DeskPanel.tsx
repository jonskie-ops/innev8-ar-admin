"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { undoClaim } from "@/lib/actions/desk";
import { stamp } from "@/lib/format";
import type { Given } from "@/lib/hunt";
import { Avatar } from "./bits";
import { ConfirmButton } from "./form";
import { SearchIcon } from "./icons";

/** How often (ms) the prizes given and left are fetched again, for gives at another desk. */
const REFRESH_MS = 30_000;

const clock = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const date = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/**
 * The prize desk page: every prize given at the desk (admins can take one back). Checking a card and
 * giving it is the pop-up in DeskCheck (on every page: the floating button, or typing here).
 */
export function DeskPanel({ given, isAdmin }: { given: Given[]; isAdmin: boolean }) {
  const router = useRouter();
  // Gives at another desk show up here too (not while a card's being checked)
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && !document.querySelector("dialog[open]") && router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="desk">
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
