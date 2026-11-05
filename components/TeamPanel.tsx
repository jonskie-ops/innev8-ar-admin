"use client";

import { useId, useRef, useState, useTransition } from "react";
import { addTeammate, removeTeammate, resetPassword, setRole } from "@/lib/actions/team";
import type { FormState } from "@/lib/form";
import type { Member } from "@/lib/hunt";
import { day } from "@/lib/format";
import { CardRail } from "./CardRail";
import { ConfirmButton, OneTimePassword, SaveButton, Status, useForm } from "./form";
import { CloseIcon, KeyIcon, PlusIcon, TrashIcon } from "./icons";
import { Spinner } from "./Progress";
import { RoleList } from "./Roles";

const ROLE_HINT = {
  admin: "Can change everything, and add or remove teammates.",
  staff: "Can look at everything, but not change it.",
};

const nameOf = (m: Member) => m.name || m.email;
const roleName = (r: Member["role"]) => (r === "admin" ? "Admin" : "Staff");
/** "Ana Reyes" is AR, "jondie@example.com" is J */
function initials(name: string) {
  const w = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 && !name.includes("@") ? w[w.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * The organisers, a card each in one row that slides sideways (CardRail: arrows once there are more
 * than fit), you first: their email, role, what they can do and, for an admin on someone else's card,
 * the role switch, a new password and Remove. Adding one (`AddTeammate`) is a pop-up from the page's head.
 */
export function TeamPanel({ members, me, canEdit }: { members: Member[]; me: string; canEdit: boolean }) {
  const team = [...members.filter((m) => m.user_id === me), ...members.filter((m) => m.user_id !== me)];
  return (
    <section className="crew" aria-label="Who can sign in">
      <CardRail label="The team" className="crew__rail">
        {team.map((m) => (
          <li key={m.user_id} className="crew__item">
            <Spotlight m={m} you={m.user_id === me} canEdit={canEdit && m.user_id !== me} />
          </li>
        ))}
      </CardRail>
    </section>
  );
}

/** A teammate's card: who they are, what they can do, and (an admin, someone else) changing it. */
function Spotlight({ m, you, canEdit }: { m: Member; you: boolean; canEdit: boolean }) {
  const [answer, setAnswer] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const [role, setRoleNow] = useState(m.role);
  const name = nameOf(m);
  const change = (to: Member["role"]) => {
    if (to === role || pending) return;
    start(async () => {
      const r = await setRole(m.user_id, to);
      setAnswer(r);
      if (!r?.error) setRoleNow(to);
    });
  };
  return (
    <article className="crew__spot" aria-label={`${name}, ${roleName(role)}`}>
      {/* Their role, in the top-right corner */}
      <span className="crew__badge crew__spot-role">{roleName(role)}</span>
      <div className="crew__spot-head">
        <span className="crew__spot-mono" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="crew__spot-who">
          <h3>
            {name}
            {you && <span className="crew__chip">You</span>}
          </h3>
          <p>
            {roleName(role)} · added {day(m.created_at)}
          </p>
        </div>
      </div>
      <a className="crew__mail" href={`mailto:${m.email}`}>
        {m.email}
      </a>
      {m.must_change_password && <p className="crew__note">Hasn&apos;t signed in yet: their temporary password still works.</p>}

      {answer?.password ? (
        <div className="crew__otp">
          <OneTimePassword who={name} password={answer.password} />
        </div>
      ) : (
        <div className="crew__can">
          <p>What {you ? "you" : name.split(" ")[0]} can do</p>
          <RoleList role={role} />
        </div>
      )}
      {answer?.error && (
        <div className="crew__error">
          <Status state={answer} />
        </div>
      )}

      {/* An admin, someone else: their role switch, a new password and Remove */}
      {canEdit && (
        <div className="crew__spot-foot">
          <div className="crew__seg" role="group" aria-label={`Role for ${name}`}>
            {(["admin", "staff"] as const).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} disabled={pending} onClick={() => change(r)}>
                {roleName(r)}
              </button>
            ))}
            {pending && <Spinner />}
          </div>
          <span className="crew__acts">
            <ConfirmButton
              action={async () => {
                const r = await resetPassword(m.user_id);
                setAnswer(r);
                return r;
              }}
              question={`Give ${name} a new temporary password? Their current one stops working.`}
              confirm="Reset"
              className="icon-btn crew__act"
              label={`Reset ${name}'s password`}
            >
              <KeyIcon />
            </ConfirmButton>
            <ConfirmButton
              action={() => removeTeammate(m.user_id)}
              question={`Remove ${name} from the team? They can't sign in any more.`}
              confirm="Remove"
              className="icon-btn crew__act crew__act--danger"
              label={`Remove ${name}`}
            >
              <TrashIcon />
            </ConfirmButton>
          </span>
        </div>
      )}
    </article>
  );
}

/**
 * Add a teammate: a button for the page's head, opening a pop-up with their name, email and role.
 * Added, it shows their temporary password (once) until it's closed or another is added.
 */
export function AddTeammate() {
  const { state, pending, onSubmit } = useForm(addTeammate);
  const [role, setRoleChoice] = useState<"admin" | "staff">("staff");
  const dialog = useRef<HTMLDialogElement>(null);
  // What's been answered before (shown no more), and a fresh form each time it's opened
  const [seen, setSeen] = useState<number | undefined>(undefined);
  const [round, setRound] = useState(0);
  const now = state && state.at !== seen ? state : null;
  const id = useId();
  const clear = () => {
    setSeen(state?.at);
    setRoleChoice("staff");
    setRound((n) => n + 1);
  };
  const close = () => {
    if (pending) return;
    dialog.current?.close();
    clear();
  };
  return (
    <>
      {/* (phones: a round + at the head's top right, like the other pages' Add) */}
      <button
        type="button"
        className="btn btn--primary btn--sm head__add"
        aria-haspopup="dialog"
        aria-label="Add teammate"
        onClick={() => dialog.current?.showModal()}
      >
        <PlusIcon />
        <span className="head__add-text">Add teammate</span>
      </button>
      <dialog
        ref={dialog}
        className="confirm confirm--form"
        aria-labelledby={`${id}-t`}
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="confirm__box">
          <div className="confirm__head">
            <h2 className="confirm__title" id={`${id}-t`}>
              Add a teammate
            </h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={pending}>
              <CloseIcon />
            </button>
          </div>
          {now?.password ? (
            <div className="addmate">
              <Status state={now} />
              <OneTimePassword who={now.ok?.replace(/ is on the team\.$/, "") ?? "them"} password={now.password} />
              <div className="confirm__btns">
                <button type="button" className="btn btn--ghost" onClick={clear}>
                  Add another
                </button>
                <button type="button" className="btn btn--primary" onClick={close}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form className="addmate" method="post" onSubmit={onSubmit} key={round}>
              <div className="addmate__fields">
                <label className="field">
                  <span className="field__label">Name</span>
                  <input name="name" maxLength={60} required placeholder="Ana Reyes" />
                </label>
                <label className="field">
                  <span className="field__label">Email</span>
                  <input name="email" type="email" maxLength={254} required autoComplete="off" placeholder="ana@example.com" />
                </label>
              </div>
              <div className="field">
                <span className="field__label">Role</span>
                <div className="roles" role="radiogroup" aria-label="Role">
                  {(["staff", "admin"] as const).map((r) => (
                    <label key={r} className="roles__opt">
                      <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRoleChoice(r)} />
                      <span>
                        <b>{r === "admin" ? "Admin" : "Staff"}</b>
                        <small>{ROLE_HINT[r]}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="addmate__end">
                <Status state={now} />
                <SaveButton pending={pending} busy="Adding…">
                  Add to the team
                </SaveButton>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
