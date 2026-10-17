"use client";

import { useState, useTransition } from "react";
import { addTeammate, removeTeammate, resetPassword, setRole } from "@/lib/actions/team";
import type { FormState } from "@/lib/form";
import type { Member } from "@/lib/hunt";
import { day } from "@/lib/format";
import { Avatar } from "./bits";
import { ConfirmButton, OneTimePassword, SaveButton, Status, useForm } from "./form";
import { KeyIcon, PlusIcon, ShieldIcon, TrashIcon } from "./icons";
import { Spinner } from "./Progress";
import { RoleTable } from "./Roles";

const ROLE_HINT = {
  admin: "Can change everything, and add or remove teammates.",
  staff: "Can look at everything, but not change it.",
};

/**
 * The organisers: who's on the team and each one's role (left); adding one, with a temporary
 * password, and what each role can do (right).
 */
export function TeamPanel({ members, me, canEdit }: { members: Member[]; me: string; canEdit: boolean }) {
  const admins = members.filter((m) => m.role === "admin").length;
  const waiting = members.filter((m) => m.must_change_password).length;
  const roles = (
    <section className="panel">
      <h2 className="panel__title">
        <ShieldIcon />
        Who can do what
      </h2>
      <RoleTable />
      <span className="field__hint">
        {canEdit
          ? "Nobody can sign up: only an admin can add someone. The team always keeps at least one admin."
          : "Need to change something? Ask an admin, or ask to be made one."}
      </span>
    </section>
  );
  return (
    <div className="cols">
      <div className="stack">
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
        </section>
        {/* Under the list for admins (the add form takes the right); on the right for staff */}
        {canEdit && roles}
      </div>
      {canEdit ? <AddTeammate /> : roles}
    </div>
  );
}

function Person({ m, you, canEdit }: { m: Member; you: boolean; canEdit: boolean }) {
  const [answer, setAnswer] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const name = m.name || m.email;
  return (
    <li className="person">
      <Avatar name={name} />
      <span className="person__who">
        <b>
          {name}
          {you && <span className="tag">You</span>}
          {m.must_change_password && <span className="tag tag--wait">Hasn&apos;t signed in yet</span>}
        </b>
        <small>
          {m.email} · added {day(m.created_at)}
        </small>
      </span>
      <span className="person__role">
        {canEdit ? (
          <select
            aria-label={`Role for ${name}`}
            defaultValue={m.role}
            disabled={pending}
            onChange={(e) => {
              const role = e.target.value;
              start(async () => setAnswer(await setRole(m.user_id, role)));
            }}
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        ) : (
          <span className={`role role--${m.role}`}>{m.role === "admin" ? "Admin" : "Staff"}</span>
        )}
        {pending && <Spinner />}
      </span>
      {canEdit && (
        <span className="person__acts">
          <ConfirmButton
            action={async () => {
              const r = await resetPassword(m.user_id);
              setAnswer(r);
              return r;
            }}
            question={`Give ${name} a new temporary password? Their current one stops working.`}
            confirm="Reset"
            className="icon-btn"
            label={`Reset ${name}'s password`}
          >
            <KeyIcon />
          </ConfirmButton>
          <ConfirmButton
            action={() => removeTeammate(m.user_id)}
            question={`Remove ${name} from the team? They can't sign in any more.`}
            confirm="Remove"
            className="icon-btn icon-btn--danger"
            label={`Remove ${name}`}
          >
            <TrashIcon />
          </ConfirmButton>
        </span>
      )}
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

function AddTeammate() {
  const { state, pending, onSubmit } = useForm(addTeammate);
  const [role, setRoleChoice] = useState<"admin" | "staff">("staff");
  return (
    <section className="panel">
      <h2 className="panel__title">
        <PlusIcon />
        Add a teammate
      </h2>
      <form className="addmate" method="post" onSubmit={onSubmit} key={state?.password ? state.at : "form"}>
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
          {!state?.password && <Status state={state} />}
          <SaveButton pending={pending} busy="Adding…">
            Add to the team
          </SaveButton>
        </div>
      </form>
      {state?.password && (
        <>
          <Status state={state} />
          <OneTimePassword who={state.ok?.replace(/ is on the team\.$/, "") ?? "them"} password={state.password} />
        </>
      )}
    </section>
  );
}
