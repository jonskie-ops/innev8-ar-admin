"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { setLive } from "@/lib/actions/codes";
import { AskDialog } from "./form";

/**
 * On or off in the game, right from a list: flips at once, with a spinner in the knob until it's
 * saved (and back if it couldn't be). With `ask`, switching it on asks that first, in a pop-up.
 */
export function LiveSwitch({
  kind,
  id,
  live,
  label,
  disabled = false,
  ask,
}: {
  kind: "codes" | "prizes" | "locations";
  id: string;
  live: boolean;
  label: string;
  disabled?: boolean;
  /** Asked before switching it on ("Turn on Office? Leyte Academic Center goes off…"), and its yes */
  ask?: { question: string; confirm: string };
}) {
  const [on, setOn] = useOptimistic(live);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <span className="live">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-busy={pending || undefined}
        className={pending ? "switch is-busy" : "switch"}
        disabled={disabled}
        aria-haspopup={ask && !on ? "dialog" : undefined}
        onClick={() => {
          if (pending) return;
          if (ask && !on) {
            setError(null);
            dialog.current?.showModal();
            return;
          }
          start(async () => {
            setOn(!on);
            const r = await setLive(kind, id, !on);
            setError(r?.error ?? null);
          });
        }}
      >
        <i></i>
      </button>
      <span className="live__text">{on ? "On" : "Off"}</span>
      {ask && (
        <AskDialog ref={dialog} question={ask.question} confirm={ask.confirm} tone="primary" action={() => setLive(kind, id, true)} />
      )}
      {error && (
        <span className="live__err" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

/** The same switch inside a form, as a checkbox. */
export function Toggle({
  name,
  defaultChecked,
  children,
  hint,
  onChange,
  ask,
  onAsked,
}: {
  name: string;
  defaultChecked: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
  onChange?: (on: boolean) => void;
  /** Asked before switching it on: Cancel switches it back off; yes calls `onAsked` (the change, for
   *  the form, is held back until then) */
  ask?: { question: string; confirm: string };
  onAsked?: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <label className="toggle">
        <input
          ref={box}
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          onChange={(e) => {
            if (ask && e.target.checked) {
              e.stopPropagation();
              dialog.current?.showModal();
              return;
            }
            onChange?.(e.target.checked);
          }}
        />
        <span className="switch" aria-hidden="true">
          <i></i>
        </span>
        <span className="toggle__text">
          <b>{children}</b>
          {hint && <small>{hint}</small>}
        </span>
      </label>
      {/* (beside the switch, not in it: a click in the pop-up would flip it) */}
      {ask && (
        <AskDialog
          ref={dialog}
          question={ask.question}
          confirm={ask.confirm}
          tone="primary"
          onYes={() => {
            onChange?.(true);
            onAsked?.();
          }}
          onNo={() => {
            if (box.current) box.current.checked = false;
          }}
        />
      )}
    </>
  );
}
