"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { day, time } from "@/lib/format";
import type { BoardEntry } from "@/lib/hunt";
import { SearchIcon, TrophyIcon } from "./icons";

/** How often the board is read again while it's open (players' new finds show up by themselves) */
const REFRESH_MS = 10_000;
/** How many rows show at first (and each Show more adds) */
const PAGE = 100;

/** "3:42 PM" today, "Thu, Nov 5, 3:42 PM" another day (Philippine time) */
function when(iso: string) {
  const today = day(new Date().toISOString()) === day(iso);
  return today ? time(iso) : `${day(iso)}, ${time(iso)}`;
}

/**
 * The leaderboard page, as it would show on a big screen: a trophy over "Top hunters", then every
 * hunter with a confirmed find, ranked as the game ranks them, in large rows (rank, gold, silver and
 * bronze for the first three; name and tag; province and their last find; points and codes found).
 * Find one by name, province or tag. It reads the board again every 10 s while it's on screen, so it
 * can be left open (or put on a projector, with the browser's full screen) to follow the hunt.
 */
export function LeaderboardPanel({
  entries,
  final,
  testMode,
  started,
}: {
  entries: BoardEntry[];
  final: boolean;
  testMode: boolean;
  /** The hunt has started (its start date has passed) */
  started: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = words.length
    ? entries.filter((e) => words.every((w) => `${e.name} ${e.province} ${e.tag}`.toLowerCase().includes(w)))
    : entries;
  const rows = matching.slice(0, shown);
  const latest = entries.reduce<string | null>((l, e) => (!l || e.last > l ? e.last : l), null);
  const state = final ? "Final results" : testMode ? "Test mode" : started ? "Live" : "Not started yet";

  return (
    <section className="lbview" aria-labelledby="lb-title">
      <header className="lbview__head">
        <div className="lbview__title">
          <p>INNEV8 QR Hunt · {state}</p>
          <h1 id="lb-title">Top hunters</h1>
        </div>
        <div className="lbview__side">
          {entries[0] && (
            <p className="team__counts">
              <span className="count">
                <b>{entries[0].score.toLocaleString("en-PH")}</b> top score
              </span>
              {latest && (
                <span className="count">
                  last find <b>{when(latest)}</b>
                </span>
              )}
            </p>
          )}
          {/* The trophy carries how many hunters are on the board, like a notification count */}
          <span className="lbview__icon" title={`${entries.length.toLocaleString("en-PH")} on the board`}>
            <TrophyIcon />
            <b className="lbview__badge" aria-label={`${entries.length.toLocaleString("en-PH")} on the board`}>
              {entries.length > 999 ? "999+" : entries.length.toLocaleString("en-PH")}
            </b>
          </span>
        </div>
      </header>

      <div className="lbview__bar">
        {entries.length > 0 && (
          <label className="hunters__find">
            <SearchIcon />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Name, province or tag"
              aria-label="Find a hunter on the board"
            />
          </label>
        )}
      </div>

      {rows.length ? (
        <ol className="lbview__list" role="list">
          {rows.map((e) => (
            <li key={e.id} className={`lbview__row${e.rank <= 3 ? ` is-top is-${e.rank}` : ""}`}>
              <span className="lboard__rank" aria-label={`Number ${e.rank}`}>
                {e.rank}
              </span>
              <span className="lbview__who">
                <b>
                  <span className="lbview__name">{e.name}</span>
                  <span className="tag" title="Their hunter tag (under their hunter QR)">
                    {e.tag}
                  </span>
                </b>
                <small>
                  {e.province} · last find {when(e.last)}
                </small>
              </span>
              <span className="lbview__score">
                <b>{e.score.toLocaleString("en-PH")}</b>
                <small>
                  pts · {e.codes} code{e.codes === 1 ? "" : "s"}
                </small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lbview__empty">
          {entries.length ? "Nobody on the board matches that." : "Nobody's on the board yet: it fills as players find QR codes."}
        </p>
      )}
      {matching.length > rows.length && (
        <div className="lbview__more">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({(matching.length - rows.length).toLocaleString("en-PH")} left)
          </button>
        </div>
      )}
    </section>
  );
}
