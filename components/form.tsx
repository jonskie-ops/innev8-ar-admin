"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { ADDED, type AddedKind } from "@/lib/back";
import { failed, type FormState } from "@/lib/form";
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

/** How long after the last change an auto-saving form saves. */
const AUTO_SAVE_MS = 3000;

/**
 * A form that saves by itself, with no Save button: 3 seconds after the last change (typing, a
 * toggle, a choice, a photo), and straight away when the organiser leaves the page. Saves run one
 * after another, so an older one can never land after a newer one. Changes the form makes in code
 * (e.g. a dragged map pin into hidden fields) call `changed`. Closing the tab with a change not
 * saved yet asks first.
 *
 * `auto` false (adding something new): a plain form that saves when it's sent, as useForm does.
 */
export function useAutoSave(action: Action, auto: boolean) {
  const manual = useForm(action);
  const [state, setState] = useState<FormState>(null);
  const [saving, setSaving] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const dirty = useRef(false); // changed since the last save was sent
  const sending = useRef(0); // saves sent and not answered yet
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ action, state });
  useEffect(() => {
    latest.current = { action, state };
  });

  // `mounted` false: the page is going away, so nothing is shown for this save
  const send = useCallback((form: HTMLFormElement, mounted = true) => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const fd = new FormData(form);
    sending.current++;
    if (mounted) {
      setWaiting(false);
      setSaving((n) => n + 1);
    }
    queue.current = queue.current.then(async () => {
      let r: FormState;
      try {
        r = await latest.current.action(latest.current.state, fd);
      } catch {
        dirty.current = true; // not saved: leaving asks first, and the next change sends it again
        r = failed("Couldn't save. Check your connection: your next change tries again.");
      }
      sending.current--;
      if (mounted) {
        setState(r);
        setSaving((n) => n - 1);
      }
    });
  }, []);

  const changed = useCallback(() => {
    if (!auto) return;
    dirty.current = true;
    setWaiting(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => formRef.current && send(formRef.current), AUTO_SAVE_MS);
  }, [auto, send]);

  useEffect(() => {
    if (!auto) return;
    const form = formRef.current;
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || sending.current) e.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => {
      removeEventListener("beforeunload", warn);
      if (form) send(form, false);
    };
  }, [auto, send]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!auto) return manual.onSubmit(e);
    e.preventDefault();
    dirty.current = true;
    send(e.currentTarget);
  };

  return auto
    ? { formRef, onSubmit, onChange: changed, changed, state, pending: saving > 0, waiting }
    : { formRef, onSubmit, onChange: undefined, changed, state: manual.state, pending: manual.pending, waiting: false };
}

/**
 * An auto-saving form's toast, at the bottom of the screen wherever the organiser has scrolled to:
 * "Saving automatically…" from the first change until it's saved, then "All changes saved" for 3
 * seconds before it fades. What's wrong stays until the next change. One element throughout, so it
 * changes in place rather than blinking out and back.
 */
export function AutoSaveToast({ state, pending, waiting }: { state: FormState; pending: boolean; waiting: boolean }) {
  const ready = useHydrated();
  if (!ready) return null;
  const saving = pending || waiting;
  if (!saving && !state) return null;
  const kind = saving ? "" : state?.error ? " is-error" : " is-done";
  return createPortal(
    <p className={`savetoast${kind}`} role={kind === " is-error" ? "alert" : "status"}>
      {saving ? <Spinner /> : state?.error ? <AlertIcon /> : <CheckIcon />}
      {saving ? "Saving automatically…" : (state?.error ?? "All changes saved")}
    </p>,
    document.body,
  );
}

/**
 * Something just added ("QR code added"): the same toast as "All changes saved", shown once on the
 * page the Add went on to (its `?added=1`). The flag comes off the address straight away, so a
 * reload doesn't say it again.
 */
export function AddedToast({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("added")) return;
    url.searchParams.delete("added");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  if (!ready) return null;
  return createPortal(
    <p className="savetoast is-done" role="status">
      <CheckIcon />
      {children}
    </p>,
    document.body,
  );
}

// ---- An Add goes back to the page its form was opened from (lib/back.ts)

const TRAIL = "i8adm-trail";
/** This tab's page now and the one before it (sessionStorage). */
type Trail = { now?: string; prev?: string };
function readTrail(): Trail {
  try {
    return (JSON.parse(sessionStorage.getItem(TRAIL) ?? "{}") as Trail) ?? {};
  } catch {
    return {};
  }
}

/** In the frame: notes each page this tab goes to (without an `?added=`), for BackField. */
export function BackTrail() {
  const path = usePathname();
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("added");
    const here = url.pathname + url.search;
    const t = readTrail();
    if (t.now === here) return;
    try {
      sessionStorage.setItem(TRAIL, JSON.stringify({ now: here, prev: t.now }));
    } catch {}
  }, [path]);
  return null;
}

/** On an add form: the page it was opened from, sent with the Add so it goes back there. */
export function BackField() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = readTrail();
    const from = [t.now, t.prev].find((p) => p && p.split("?")[0] !== window.location.pathname);
    if (ref.current) ref.current.value = from ?? "";
  }, []);
  return <input ref={ref} type="hidden" name="back" defaultValue="" />;
}

/** In the frame: "QR code added" (…) on the page an Add went back to, until it's left. */
export function AddedFlash() {
  const path = usePathname();
  const kind = useSearchParams().get("added");
  const text = kind && kind in ADDED ? ADDED[kind as AddedKind] : null;
  const [shown, setShown] = useState<{ path: string; text: string } | null>(null);
  // (AddedToast takes the flag off the address; the toast stays until another page)
  if (text && (shown?.path !== path || shown.text !== text)) setShown({ path, text });
  else if (!text && shown && shown.path !== path) setShown(null);
  return shown && shown.path === path ? <AddedToast>{shown.text}</AddedToast> : null;
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

/** "Delete #05? It's gone from the game." → its title ("Delete #05?") and the rest. */
function splitQuestion(q: string) {
  const at = q.indexOf("? ");
  return at < 0 ? { title: q, more: "" } : { title: q.slice(0, at + 1), more: q.slice(at + 2) };
}

/**
 * A button that asks first, in a pop-up ("Delete #05?", what that does, Cancel / Delete), then runs
 * `action`. The pop-up keeps the keyboard in it; Esc, Cancel or a click beside it closes it (not
 * while the action runs), and what goes wrong is said in it.
 */
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
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => dialog.current?.showModal()}
        aria-label={label}
        aria-haspopup="dialog"
      >
        {children}
      </button>
      <AskDialog ref={dialog} question={question} confirm={confirm} action={action} />
    </>
  );
}

/**
 * The pop-up that asks first ("Turn on Office?", what that does, Cancel / Turn on), opened by its
 * owner with `ref.current.showModal()`. Its yes runs `action` (and `onYes` once it's done); Esc,
 * Cancel or a click beside it closes it (`onNo`), not while the action runs.
 */
export function AskDialog({
  ref,
  question,
  confirm,
  tone = "danger",
  action,
  onYes,
  onNo,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  question: string;
  confirm: string;
  tone?: "danger" | "primary";
  action?: () => Promise<FormState>;
  onYes?: () => void;
  onNo?: () => void;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { title, more } = splitQuestion(question);
  const no = () => {
    if (pending) return;
    ref.current?.close();
    setError(null);
    onNo?.();
  };
  const btn = `btn btn--${tone}`;
  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={`${id}-t`}
      aria-describedby={more ? `${id}-q` : undefined}
      // (it sits inside lists and forms: its clicks and keys stay its own; a click on the dimmed
      // page beside it closes it)
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) no();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        no();
      }}
    >
      <div className="confirm__box">
        <h2 className="confirm__title" id={`${id}-t`}>
          {title}
        </h2>
        {more && (
          <p className="confirm__q" id={`${id}-q`}>
            {more}
          </p>
        )}
        {error && (
          <p className="confirm__err" role="alert">
            <AlertIcon />
            {error}
          </p>
        )}
        <div className="confirm__btns">
          <button type="button" className="btn btn--ghost" onClick={no} disabled={pending} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={pending ? `${btn} is-busy` : btn}
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() =>
              start(async () => {
                const r = action ? await action() : null;
                setError(r?.error ?? null);
                if (r?.error) return;
                ref.current?.close();
                onYes?.();
              })
            }
          >
            {pending && <Spinner />}
            {confirm}
          </button>
        </div>
      </div>
    </dialog>
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
