import type { Metadata } from "next";
import { PasswordForm, SignOutForm } from "@/components/AuthForms";
import { Avatar, Head } from "@/components/bits";
import { EventBanner } from "@/components/EventBanner";
import { EventForm } from "@/components/EventForm";
import { CalendarIcon, KeyIcon, LockIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { RoleTable } from "@/components/Roles";
import { saveEvent } from "@/lib/actions/event";
import { requireTeammate } from "@/lib/dal";
import { getSettings, listLocations, listTeam } from "@/lib/data";
import { day, stamp, toLocalInput } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings: your account (your details, what your role can do, this device, and your password: choosing
 * it, the first time) and the event's settings (when the hunt runs, test mode, and the prize desk).
 */
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

  // The first time: only choosing the password, in the middle of the page
  if (first)
    return (
      <div className="first-pw">
        <Head
          eyebrow="Welcome"
          title="Choose your password"
          lead={`Welcome to the team, ${me.name.split(" ")[0]}. You signed in with a temporary password: choose your own to continue. Only you will know it.`}
        />
        {password}
      </div>
    );

  const [s, { locations }] = await Promise.all([getSettings(), listLocations()]);
  return (
    <>
      <Head
        eyebrow="Settings"
        title="Settings"
        lead="Your account, and the event's settings: when the hunt runs, test mode, and the prize desk."
      />
      <section className="setsec" aria-labelledby="account-title">
        <h2 id="account-title" className="setsec__title">
          <UserIcon />
          Your account
        </h2>
        <div className="cols">
          <div className="stack">
            {profile}
            {roles(me.role)}
          </div>
          <div className="stack">
            {password}
            {device}
          </div>
        </div>
      </section>
      {/* The event (was its own page): when the hunt runs, test mode, and the prize desk */}
      <section id="event" className="setsec" aria-labelledby="event-title">
        <header className="setsec__head">
          <h2 id="event-title" className="setsec__title">
            <CalendarIcon />
            Event settings
          </h2>
          <p className="setsec__lead">
            When the hunt runs, test mode, and the prize desk. Last changed {stamp(s.updated_at)}.
          </p>
        </header>
        <div className="stack">
          <EventBanner
            startsAt={s.starts_at}
            endsAt={s.ends_at}
            testMode={s.test_mode}
            place={locations.filter((l) => l.live).map((l) => l.name).join(" · ") || "No location on"}
          />
          <EventForm
            startsAt={toLocalInput(s.starts_at)}
            endsAt={toLocalInput(s.ends_at)}
            testMode={s.test_mode}
            randomSpots={s.random_spots ?? false}
            claimPlace={s.claim_place}
            save={saveEvent}
            canEdit={me.role === "admin"}
          />
        </div>
      </section>
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
