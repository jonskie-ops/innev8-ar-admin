import type { Metadata } from "next";
import { PasswordForm } from "@/components/AuthForms";
import { Avatar, Head } from "@/components/bits";
import { EventBanner } from "@/components/EventBanner";
import { EventForm } from "@/components/EventForm";
import { HuntControl } from "@/components/HuntControl";
import { CalendarIcon, KeyIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { RoleTable } from "@/components/Roles";
import { TestCleanup } from "@/components/TestCleanup";
import { saveEvent } from "@/lib/actions/event";
import { requireTeammate } from "@/lib/dal";
import { getSettings, listCodes, listLocations, listTeam, testPlay } from "@/lib/data";
import { day, stamp, toLocalInput } from "@/lib/format";
import { DROP_DEFAULT, SEE } from "@/lib/hunt";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings: your account (your details, what your role can do, and your password: choosing
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

  const [s, { locations }, codes, play] = await Promise.all([getSettings(), listLocations(), listCodes(), testPlay()]);
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
          {/* Start or end the hunt now */}
          <HuntControl startsAt={s.starts_at} endsAt={s.ends_at} canEdit={me.role === "admin"} />
          {/* (a fresh form after a change, e.g. Start: its times are the saved ones, not the old ones) */}
          <EventForm
            key={s.updated_at}
            startsAt={toLocalInput(s.starts_at)}
            endsAt={toLocalInput(s.ends_at)}
            testMode={s.test_mode}
            randomSpots={s.random_spots ?? false}
            seenFrom={s.seen_from ?? false}
            seenReady={s.seen_from !== undefined}
            sided={codes.filter((c) => c.seen_width != null).length}
            farView={s.far_view ?? false}
            seeMetres={s.see_metres ?? SEE.default}
            farReady={s.far_view !== undefined}
            pointsDrop={s.points_drop ?? false}
            dropRule={{
              first: s.drop_full ?? DROP_DEFAULT.first,
              every: s.drop_every ?? DROP_DEFAULT.every,
              floor: s.drop_floor ?? DROP_DEFAULT.floor,
            }}
            dropReady={s.points_drop !== undefined}
            claimPlace={s.claim_place}
            save={saveEvent}
            canEdit={me.role === "admin"}
            extra={
              play ? (
                <TestCleanup play={play} canEdit={me.role === "admin"} />
              ) : (
                <p className="banner">Cleaning up test play needs the database update first: run 20261119040000_test_cleanup.sql in the SQL Editor.</p>
              )
            }
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

