"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, signIn, signOut } from "@/lib/actions/auth";
import { SaveButton, Status, useForm } from "./form";
import { CheckIcon, EyeIcon, EyeOffIcon, LockIcon, LogoutIcon } from "./icons";
import { Spinner } from "./Progress";

/** A password field with a show/hide button. */
function Password({
  name,
  label,
  autoComplete,
  autoFocus,
  onValue,
}: {
  name: string;
  label: string;
  autoComplete: string;
  autoFocus?: boolean;
  onValue?: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="pw">
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={72}
          autoFocus={autoFocus}
          onChange={onValue && ((e) => onValue(e.target.value))}
        />
        <button
          type="button"
          className="pw__eye"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </label>
  );
}

export function SignInForm({ next }: { next: string }) {
  const { state, pending, onSubmit } = useForm(signIn);
  return (
    <form className="signin__form" method="post" onSubmit={onSubmit}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span className="field__label">Email</span>
        <input name="email" type="email" autoComplete="username" required autoFocus maxLength={254} />
      </label>
      <Password name="password" label="Password" autoComplete="current-password" />
      <Status state={state} />
      <SaveButton pending={pending} busy="Signing in…">
        <LockIcon />
        Sign in
      </SaveButton>
    </form>
  );
}

/** How hard a new password would be to guess, roughly: 0 too short, then 1 weak to 4 strong. */
function strength(p: string) {
  if (p.length < 10) return 0;
  let s = 1;
  if (p.length >= 14) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s++;
  if (p.length >= 20) s++;
  return Math.min(s, 4);
}
const STRENGTH = ["Too short: at least 10 characters", "Weak", "Fair", "Good", "Strong"];

/** Changing the password: the current one first, unless it's the temporary one they just signed in with. */
export function PasswordForm({ first }: { first: boolean }) {
  const { state, pending, onSubmit } = useForm(changePassword);
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const score = strength(next);
  return (
    <form className="stack" method="post" onSubmit={onSubmit} key={state?.ok ? state.at : "pw"}>
      {!first && <Password name="current" label="Current password" autoComplete="current-password" />}
      <div className="field">
        <Password name="password" label="New password" autoComplete="new-password" autoFocus={first} onValue={setNext} />
        {next && (
          <span className={`meter meter--${score}`} aria-live="polite">
            <span className="meter__bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            {STRENGTH[score]}
          </span>
        )}
      </div>
      <div className="field">
        <Password name="again" label="New password again" autoComplete="new-password" onValue={setAgain} />
        {again && (
          <span className={again === next ? "match is-ok" : "match"} aria-live="polite">
            {again === next ? (
              <>
                <CheckIcon />
                They match
              </>
            ) : (
              "Not the same yet"
            )}
          </span>
        )}
      </div>
      <span className="field__hint">At least 10 characters. A short sentence is easy to remember and hard to guess.</span>
      <div className="row-end">
        <Status state={state} />
        <SaveButton pending={pending}>{first ? "Set my password" : "Change password"}</SaveButton>
      </div>
    </form>
  );
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--ghost btn--sm btn--quiet-danger" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <Spinner /> : <LogoutIcon />}
      Sign out of this device
    </button>
  );
}

/** Signing out here, from the account page. */
export function SignOutForm() {
  return (
    <form action={signOut}>
      <SignOutButton />
    </form>
  );
}
