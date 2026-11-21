"use client";

import { endHuntNow, startHuntNow } from "@/lib/actions/event";
import { day, summitPhase, time } from "@/lib/format";
import { useNow } from "./Clock";
import { ConfirmButton } from "./form";
import { ClockIcon, LockIcon, QrIcon } from "./icons";

/**
 * Settings: the hunt now, and the button for what's next: Start (not started yet), End (on now) or
 * Start again (over). Start also turns test mode off. Admins only; staff see where it stands.
 */
export function HuntControl({ startsAt, endsAt, canEdit }: { startsAt: string; endsAt: string; canEdit: boolean }) {
  const now = useNow();
  const { phase } = summitPhase(startsAt, endsAt, now ?? undefined);
  const state =
    phase === "live"
      ? { cls: "is-live", Icon: QrIcon, title: "On now", text: `Players are hunting until ${time(endsAt)}, ${day(endsAt)}.` }
      : phase === "ended"
        ? { cls: "is-ended", Icon: LockIcon, title: "Ended", text: `It ended ${time(endsAt)}, ${day(endsAt)}. The leaderboard is final.` }
        : { cls: "is-soon", Icon: ClockIcon, title: "Not started yet", text: `Planned for ${time(startsAt)}, ${day(startsAt)}. Phones show "not started yet" until then.` };
  return (
    <section className={`panel hunt-now ${state.cls}`} aria-labelledby="hunt-now-title">
      <div className="hunt-now__state">
        <span className="hunt-now__icon" aria-hidden="true">
          <state.Icon />
        </span>
        <span>
          <h2 id="hunt-now-title" className="hunt-now__title">
            The hunt: {state.title}
          </h2>
          <p className="hunt-now__text">{state.text}</p>
        </span>
      </div>
      {canEdit &&
        (phase === "live" ? (
          <ConfirmButton
            action={endHuntNow}
            question="End the hunt now? Finds from this moment don't count, and the leaderboard is final. (To reopen it, use Start again.)"
            confirm="End the hunt"
            className="btn btn--ghost btn--quiet-danger hunt-now__btn"
          >
            End the hunt now
          </ConfirmButton>
        ) : (
          <ConfirmButton
            action={startHuntNow}
            question={`${phase === "ended" ? "Start the hunt again" : "Start the hunt now"}? Players can find codes from this moment, and test mode turns off.`}
            confirm={phase === "ended" ? "Start again" : "Start the hunt"}
            tone="primary"
            className="btn btn--primary hunt-now__btn"
          >
            {phase === "ended" ? "Start again" : "Start the hunt now"}
          </ConfirmButton>
        ))}
    </section>
  );
}
