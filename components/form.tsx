"use client";

import {
  startTransition,
  useActionState,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import type { FormState } from "@/lib/form";
import { AlertIcon, CheckIcon, CopyIcon } from "./icons";
import { Spinner } from "./Progress";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/**
 * A form wired to a server action, without React's reset after each submit: what the organiser
 * typed stays put when the action says something's wrong.
 */
export function useForm(action: Action) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

const never = () => () => {};
/** False until the page's scripts are running (the server's HTML can't submit through the action yet). */
export const useHydrated = () =>
  useSyncExternalStore(
    never,
    () => true,
    () => false,
  );

/** The action's answer: "Saved" fades after a moment; an error stays until the next try. */
export function Status({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p key={state.at} className="status status--error" role="alert">
        <AlertIcon />
        {state.error}
      </p>
    );
  if (!state.ok) return null;
  return (
    <p key={state.at} className={state.password ? "status status--ok" : "status status--ok status--fade"} role="status">
      <CheckIcon />
      {state.ok}
    </p>
  );
}

/**
 * The form's submit button: off until the page is ready, so a form can never be sent the browser's
 * own way (as a URL, with what was typed in it).
 */
export function SaveButton({ pending, children = "Save", busy = "Saving…" }: { pending: boolean; children?: ReactNode; busy?: string }) {
  const ready = useHydrated();
  return (
    <button
      type="submit"
      className={pending ? "btn btn--primary btn--sm is-busy" : "btn btn--primary btn--sm"}
      disabled={pending || !ready}
      aria-busy={pending || undefined}
    >
      {pending && <Spinner />}
      {pending ? busy : children}
    </button>
  );
}

/** A button that asks first ("Delete #05? Cancel / Delete"), then runs `action`. */
export function ConfirmButton({
  action,
  question,
  confirm = "Delete",
  className = "btn btn--ghost btn--sm btn--quiet-danger",
  children,
  label,
}: {
  action: () => Promise<FormState>;
  question: string;
  confirm?: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!asking)
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} aria-label={label}>
        {children}
      </button>
    );
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span className="confirm__q">{question}</span>
      <span className="confirm__btns">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(false)} autoFocus>
          Cancel
        </button>
        <button
          type="button"
          className={pending ? "btn btn--danger btn--sm is-busy" : "btn btn--danger btn--sm"}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() =>
            start(async () => {
              const r = await action();
              setError(r?.error ?? null);
              if (!r?.error) setAsking(false);
            })
          }
        >
          {pending && <Spinner />}
          {confirm}
        </button>
      </span>
      {error && (
        <span className="confirm__err" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

/** A temporary password, shown once, with a copy button. */
export function OneTimePassword({ who, password }: { who: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="otp">
      <p className="otp__who">Temporary password for {who}</p>
      <p className="otp__row">
        <code className="otp__pw">{password}</code>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            void navigator.clipboard?.writeText(password).then(() => setCopied(true));
          }}
        >
          <CopyIcon />
          {copied ? "Copied" : "Copy"}
        </button>
      </p>
      <p className="otp__note">
        Send it to them privately (not in a group chat). They choose their own password the first time they sign in.
        It isn&apos;t shown again.
      </p>
    </div>
  );
}

/** A count under a text field: "38 / 140". */
export function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span className={n > max ? "counter is-over" : "counter"} aria-live="polite">
      {n} / {max}
    </span>
  );
}
