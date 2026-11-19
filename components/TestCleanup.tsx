"use client";

import { useState } from "react";
import { cleanUpTestPlay } from "@/lib/actions/hunters";
import { testPlayText, type TestPlay } from "@/lib/hunt";
import { ConfirmButton } from "./form";
import { CheckIcon, TrashIcon } from "./icons";

/**
 * Settings, by test mode: the test play there is (test finds, test prize cards, test players), and an
 * admin's one-click clean-up after a rehearsal. Real finds and prizes given are never touched.
 */
export function TestCleanup({ play, canEdit }: { play: TestPlay; canEdit: boolean }) {
  const [said, setSaid] = useState<string | null>(null);
  const what = testPlayText(play);
  return (
    <section className="panel cleanup" aria-labelledby="cleanup-title">
      <h2 id="cleanup-title" className="panel__title">
        <TrashIcon />
        Clean up test play
      </h2>
      <p className="team__counts">
        <span className="count">
          <b>{play.finds.toLocaleString("en-PH")}</b> test find{play.finds === 1 ? "" : "s"}
        </span>
        <span className="count">
          <b>{play.cards.toLocaleString("en-PH")}</b> test prize card{play.cards === 1 ? "" : "s"}
        </span>
        <span className="count">
          <b>{play.players.toLocaleString("en-PH")}</b> test player{play.players === 1 ? "" : "s"}
        </span>
      </p>
      <span className="field__hint">
        Test players joined before the hunt&apos;s start and have nothing real. Players with real finds or prizes stay (only their test
        play goes), and real finds and prizes given are never touched. A removed player&apos;s phone starts the game over.
      </span>
      {said && (
        <p className="cleanup__done" role="status">
          <CheckIcon />
          {said}
        </p>
      )}
      {canEdit &&
        (what ? (
          <div>
            <ConfirmButton
              action={async () => {
                const r = await cleanUpTestPlay();
                if (r?.ok) setSaid(r.ok);
                return r;
              }}
              question={`Clean up test play? This removes ${what}, for good.`}
              confirm="Clean up"
              className="btn btn--ghost btn--sm btn--quiet-danger"
            >
              <TrashIcon />
              Clean up test play
            </ConfirmButton>
          </div>
        ) : (
          !said && <span className="field__hint">Nothing to clean up.</span>
        ))}
    </section>
  );
}
