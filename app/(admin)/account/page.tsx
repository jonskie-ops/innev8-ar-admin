import type { Metadata } from "next";
import Link from "next/link";
import { PasswordForm, SignOutForm } from "@/components/AuthForms";
import { Avatar, Head } from "@/components/bits";
import { HunterIcon, KeyIcon, LockIcon, ShieldIcon, TeamIcon } from "@/components/icons";
import { RoleTable } from "@/components/Roles";
import { requireTeammate } from "@/lib/dal";
import { listTeam } from "@/lib/data";
import { day } from "@/lib/format";

export const metadata: Metadata = { title: "Your account" };

/** Your details, what your role can do, this device, and your password (choosing it, the first time). */
export default async function AccountPage() {
  const me = await requireTeammate({ settingPassword: true });
  const first = me.mustChangePassword;
  const since = (await listTeam()).find((t) => t.user_id === me.id)?.created_at;
  const role = me.role === "admin" ? "Admin" : "Staff";

  const password = (
    <section className="panel">
      <h2 className="panel__title">
        <KeyIcon />
        {first ? "Your password" : "Change password"}
      </h2>
      <PasswordForm first={first} />
    </section>
  );
  const profile = (
    <section className="panel profile">
      <Avatar name={me.name} className="avatar--xl" />
      <div className="profile__who">
        <h2>{me.name}</h2>
        <p>{me.email}</p>
        <p className="profile__tags">
          <span className={`role-badge role-badge--${me.role}`}>
            <ShieldIcon />
            {role}
          </span>
          {since && <span>On the team since {day(since)}</span>}
        </p>
      </div>
      <p className="field__hint profile__note">To change your name, email or role, ask another admin.</p>
    </section>
  );

  return (
    <>
      <Head
        eyebrow="Settings"
        title={first ? "Choose your password" : "Your account"}
        lead={
          first
            ? `Welcome to the team, ${me.name.split(" ")[0]}. You signed in with a temporary password: choose your own to continue. Only you will know it.`
            : "Your details, what you can do here, and your password."
        }
      />
      {!first && (
        <p className="phone-team">
          <Link href="/hunters" className="btn btn--ghost btn--sm">
            <HunterIcon />
            Hunters: the players
          </Link>
          <Link href="/team" className="btn btn--ghost btn--sm">
            <TeamIcon />
            The team: who can sign in
          </Link>
        </p>
      )}
      <div className="cols">
        {/* The first time, the password comes first (on a phone, it's on top) */}
        {first ? password : <div className="stack">{profile}{roles(me.role)}</div>}
        {first ? (
          <div className="stack">
            {profile}
            {roles(me.role)}
          </div>
        ) : (
          <div className="stack">
            {password}
            {device}
          </div>
        )}
      </div>
    </>
  );
}

const roles = (mine: "admin" | "staff") => (
  <section className="panel">
    <h2 className="panel__title">
      <ShieldIcon />
      What you can do
    </h2>
    <RoleTable mine={mine} />
  </section>
);

const device = (
  <section className="panel device">
    <h2 className="panel__title">
      <LockIcon />
      This device
    </h2>
    <p>
      You&apos;re signed in here. You stay signed in for a week while you use the admin; after a week away, you sign in
      again. On a shared computer, sign out when you&apos;re done.
    </p>
    <SignOutForm />
  </section>
);
