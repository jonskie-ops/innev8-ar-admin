"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLive } from "@/lib/actions/codes";

/**
 * On or off in the game, right from a list: flips at once, with a spinner in the knob until it's
 * saved (and back if it couldn't be).
 */
export function LiveSwitch({
  kind,
  id,
  live,
  label,
  disabled = false,
}: {
  kind: "codes" | "prizes" | "locations";
  id: string;
  live: boolean;
  label: string;
  disabled?: boolean;
}) {
  const [on, setOn] = useOptimistic(live);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
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
        onClick={() => {
          if (pending) return;
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
}: {
  name: string;
  defaultChecked: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
  onChange?: (on: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        onChange={onChange && ((e) => onChange(e.target.checked))}
      />
      <span className="switch" aria-hidden="true">
        <i></i>
      </span>
      <span className="toggle__text">
        <b>{children}</b>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
