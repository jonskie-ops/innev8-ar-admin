"use client";

import { useState } from "react";
import { deleteHunters } from "@/lib/actions/hunters";
import { day } from "@/lib/format";
import type { Hunter } from "@/lib/hunt";
import { Avatar } from "./bits";
import { ConfirmButton } from "./form";
import { SearchIcon, TrashIcon } from "./icons";

/** How many rows show at first (and each Show more adds). */
const PAGE = 100;

/**
 * The players with a hunter ID: find one by name, province or tag; an admin deletes one, or ticks
 * several and deletes those (test players, duplicates).
 */
export function HuntersPanel({ hunters, canEdit }: { hunters: Hunter[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = words.length
    ? hunters.filter((h) => {
        const text = `${h.name} ${h.province} ${h.tag}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : hunters;
  const rows = matching.slice(0, shown);
  // (ticked ones that were deleted, here or by someone else, drop out)
  const chosen = hunters.filter((h) => ticked.has(h.id));
  const allTicked = rows.length > 0 && rows.every((h) => ticked.has(h.id));
  const tick = (ids: string[], on: boolean) =>
    setTicked((t) => {
      const next = new Set(t);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const meetings = hunters.reduce((n, h) => n + h.meetings, 0) / 2;
  const provinces = new Set(hunters.map((h) => h.province)).size;

  return (
    <section className="panel panel--flush team hunters">
      <div className="team__head">
        <p className="team__counts">
          <span className="count count--admin">
            <b>{hunters.length.toLocaleString("en-PH")}</b> hunter{hunters.length === 1 ? "" : "s"}
          </span>
          <span className="count">
            <b>{provinces}</b> province{provinces === 1 ? "" : "s"}
          </span>
          <span className="count">
            <b>{meetings.toLocaleString("en-PH")}</b> meeting{meetings === 1 ? "" : "s"}
          </span>
        </p>
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
            aria-label="Find a hunter"
          />
        </label>
      </div>

      {canEdit && rows.length > 0 && (
        <div className="hunters__bar">
          <label className="check">
            <input type="checkbox" checked={allTicked} onChange={(e) => tick(rows.map((h) => h.id), e.target.checked)} />
            {allTicked ? "Untick these" : `Tick ${rows.length === matching.length ? "all" : "these"} ${rows.length}`}
          </label>
          {chosen.length > 0 && (
            <ConfirmButton
              action={async () => {
                const r = await deleteHunters(chosen.map((h) => h.id));
                if (!r?.error) setTicked(new Set());
                return r;
              }}
              question={`Delete ${chosen.length === 1 ? chosen[0].name : `these ${chosen.length} hunters`}? Their hunter QR stops working and their meetings are removed.`}
              confirm="Delete"
              className="btn btn--ghost btn--sm btn--quiet-danger"
            >
              <TrashIcon />
              Delete {chosen.length} ticked
            </ConfirmButton>
          )}
        </div>
      )}

      {rows.length ? (
        <ul className="people" role="list">
          {rows.map((h) => (
            <li key={h.id} className={canEdit ? "person hunter is-tickable" : "person hunter"}>
              {canEdit && (
                <input
                  type="checkbox"
                  className="hunter__tick"
                  checked={ticked.has(h.id)}
                  onChange={(e) => tick([h.id], e.target.checked)}
                  aria-label={`Tick ${h.name}`}
                />
              )}
              <Avatar name={h.name} />
              <span className="person__who">
                <b>
                  {h.name}
                  <span className="tag" title="Their hunter tag (under their hunter QR)">
                    {h.tag}
                  </span>
                </b>
                <small>
                  {h.province} · joined {day(h.created_at)} ·{" "}
                  {h.meetings ? `met ${h.meetings} hunter${h.meetings === 1 ? "" : "s"}` : "hasn't met anyone yet"}
                </small>
              </span>
              {canEdit && (
                <span className="person__acts">
                  <ConfirmButton
                    action={() => deleteHunters([h.id])}
                    question={`Delete ${h.name} (${h.province})? Their hunter QR stops working and their meetings are removed.`}
                    confirm="Delete"
                    className="icon-btn icon-btn--danger"
                    label={`Delete ${h.name}`}
                  >
                    <TrashIcon />
                  </ConfirmButton>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty hunters__none">
          {hunters.length
            ? `No hunter matches “${q.trim()}”.`
            : "No hunters yet. Each player gets a hunter ID (and a hunter QR) when they sign up in the game."}
        </p>
      )}

      {matching.length > rows.length && (
        <div className="hunters__more">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({(matching.length - rows.length).toLocaleString("en-PH")} left)
          </button>
        </div>
      )}
    </section>
  );
}
