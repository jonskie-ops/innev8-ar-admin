"use client";

import { useId, useRef, useState, useTransition } from "react";
import { addTeammate, removeTeammate, resetPassword, setRole } from "@/lib/actions/team";
import type { FormState } from "@/lib/form";
import type { Member } from "@/lib/hunt";
import { day } from "@/lib/format";
import { Avatar } from "./bits";
import { ConfirmButton, OneTimePassword, SaveButton, Status, useForm } from "./form";
import { ChevronRightIcon, CloseIcon, KeyIcon, PlusIcon, ShieldIcon, TrashIcon } from "./icons";
import { Spinner } from "./Progress";
import { RoleList } from "./Roles";

const ROLE_HINT = {
  admin: "Can change everything, and add or remove teammates.",
  staff: "Can look at everything, but not change it.",
};

/**
 * The organisers: who's on the team and each one's role, each opening to what they can do. Adding
 * one (`AddTeammate`) is a pop-up from the page's head.
 */
export function TeamPanel({ members, me, canEdit }: { members: Member[]; me: string; canEdit: boolean }) {
  const admins = members.filter((m) => m.role === "admin").length;
  const waiting = members.filter((m) => m.must_change_password).length;
  return (
    <section className="panel panel--flush team">
      <div className="team__head">
        <h2 className="panel__title">Who can sign in</h2>
        <p className="team__counts">
          <span className="count count--admin">
            <b>{admins}</b> admin{admins === 1 ? "" : "s"}
          </span>
          <span className="count">
            <b>{members.length - admins}</b> staff
          </span>
          {waiting > 0 && (
            <span className="count count--wait">
              <b>{waiting}</b> yet to sign in
            </span>
          )}
        </p>
      </div>
      <ul className="people" role="list">
        {members.map((m) => (
          <Person key={m.user_id} m={m} you={m.user_id === me} canEdit={canEdit && m.user_id !== me} />
        ))}
      </ul>
      <p className="team__foot">
        <ShieldIcon />
        <span>
          Open someone to see what they can do.{" "}
          {canEdit
            ? "Nobody can sign up: only an admin can add someone. The team always keeps at least one admin."
            : "Need to change something? Ask an admin, or ask to be made one."}
        </span>
      </p>
    </section>
  );
}

/** A teammate: their role (changed right here by an admin), and, opened, what that role can do. */
function Person({ m, you, canEdit }: { m: Member; you: boolean; canEdit: boolean }) {
  const [answer, setAnswer] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [role, setRoleNow] = useState(m.role);
  const canId = useId();
  const name = m.name || m.email;
  const toggle = () => setOpen((o) => !o);
  return (
    <li className={open ? "person is-open" : "person"}>
      <Avatar name={name} />
      <button type="button" className="person__who" aria-expanded={open} aria-controls={canId} onClick={toggle}>
        <b>
          {name}
          {you && <span className="tag">You</span>}
          {m.must_change_password && <span className="tag tag--wait">Hasn&apos;t signed in yet</span>}
          {/* (phones: a role that can't be changed here sits by the name) */}
          {!canEdit && <span className={`role role--${role} person__role-in`}>{role === "admin" ? "Admin" : "Staff"}</span>}
        </b>
        <small>
          {m.email}
          <span className="person__added">
            <span className="person__sep"> · </span>added {day(m.created_at)}
          </span>
        </small>
      </button>
      <span className={canEdit ? "person__role" : "person__role is-fixed"}>
        {canEdit ? (
          <select
            aria-label={`Role for ${name}`}
            defaultValue={m.role}
            disabled={pending}
            onChange={(e) => {
              const to = e.target.value as Member["role"];
              start(async () => {
                const r = await setRole(m.user_id, to);
                setAnswer(r);
                if (!r?.error) setRoleNow(to);
              });
            }}
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        ) : (
          <span className={`role role--${role}`}>{role === "admin" ? "Admin" : "Staff"}</span>
        )}
        {pending && <Spinner />}
      </span>
      <span className="person__acts">
        {canEdit && (
          <>
          <ConfirmButton
            action={async () => {
              const r = await resetPassword(m.user_id);
              setAnswer(r);
              return r;
            }}
            question={`Give ${name} a new temporary password? Their current one stops working.`}
            confirm="Reset"
            className="icon-btn person__key"
            label={`Reset ${name}'s password`}
          >
            <KeyIcon />
          </ConfirmButton>
          <ConfirmButton
            action={() => removeTeammate(m.user_id)}
            question={`Remove ${name} from the team? They can't sign in any more.`}
            confirm="Remove"
            className="icon-btn icon-btn--danger person__bin"
            label={`Remove ${name}`}
          >
            <TrashIcon />
          </ConfirmButton>
          </>
        )}
        <button
          type="button"
          className="icon-btn person__more"
          aria-expanded={open}
          aria-controls={canId}
          aria-label={`What ${name} can do`}
          onClick={toggle}
        >
          <ChevronRightIcon />
        </button>
      </span>
      <div className="person__can" id={canId} hidden={!open}>
        <p className="person__can-title">
          What {you ? "you" : name.split(" ")[0]} can do as {role === "admin" ? "an admin" : "staff"}
        </p>
        <RoleList role={role} />
      </div>
      {answer?.password ? (
        <div className="person__otp">
          <OneTimePassword who={name} password={answer.password} />
        </div>
      ) : (
        answer?.error && (
          <div className="person__otp">
            <Status state={answer} />
          </div>
        )
      )}
    </li>
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
