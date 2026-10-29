"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/actions/auth";
import { SUMMIT_URL } from "@/lib/hunt";
import { Avatar } from "./bits";
import { AddedFlash, BackTrail } from "./form";
import { Changes, type Change } from "./Changes";
import { Find, type Findable } from "./Find";
import { I8Mark } from "./I8Mark";
import {
  CalendarIcon,
  DeskIcon,
  GearIcon,
  GiftIcon,
  GlobeIcon,
  HomeIcon,
  HunterIcon,
  LogoutIcon,
  MapIcon,
  PlacesIcon,
  QrIcon,
  ShieldIcon,
  SponsorIcon,
  TeamIcon,
} from "./icons";
import { LinkPending, NavProgress, Spinner } from "./Progress";

const NAV = [
  { href: "/", label: "Overview", short: "Home", Icon: HomeIcon },
  { href: "/codes", label: "QR codes", short: "Codes", Icon: QrIcon },
  { href: "/map", label: "Map", short: "Map", Icon: MapIcon },
  { href: "/locations", label: "Locations", short: "Places", Icon: PlacesIcon },
  { href: "/prizes", label: "Prizes", short: "Prizes", Icon: GiftIcon },
  { href: "/desk", label: "Prize desk", short: "Desk", Icon: DeskIcon },
  { href: "/sponsors", label: "Sponsors", short: "Sponsors", Icon: SponsorIcon },
  { href: "/hunters", label: "Hunters", short: "Hunters", Icon: HunterIcon },
  { href: "/event", label: "Event", short: "Event", Icon: CalendarIcon },
  { href: "/team", label: "Team", short: "Team", Icon: TeamIcon },
] as const;
/** On phones, the tab bar has room for all but the prize desk, the hunters and the team (on the Account page there) */
const TABS = NAV.filter(({ href }) => href !== "/desk" && href !== "/hunters" && href !== "/team");

/**
 * The admin's frame: a rail of icons down the side, with your account and sign out at its foot (on
 * phones, a tab bar along the bottom and sign out in the top bar), and a top bar with search, the
 * latest changes, the summit's page, and who's signed in. `locked`: a temporary password still to change, so
 * only the Account page.
 */
export function Shell({
  me,
  find,
  changes,
  children,
}: {
  me: { name: string; email: string; role: "admin" | "staff"; locked: boolean };
  find: Findable[];
  changes: Change[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const current = (href: string) =>
    (href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) ? ("page" as const) : undefined;

  return (
    <div className="shell">
      <NavProgress />
      <BackTrail />
      <Suspense fallback={null}>
        <AddedFlash />
      </Suspense>
      {/* (a temporary password still to change: no menu or top bar, only choosing a password) */}
      <div className={me.locked ? "frame is-locked" : "frame"}>
        {!me.locked && (
          <aside className="rail">
            <Link href="/" className="rail__logo" aria-label="QR Hunt Admin: overview">
              <I8Mark />
            </Link>
            <nav className="rail__nav" aria-label="Admin">
              {NAV.map(({ href, label, Icon }) => (
                <Link key={href} href={href} className="rail__link" aria-current={current(href)}>
                  <Icon />
                  <LinkPending />
                  <span className="rail__tip">{label}</span>
                </Link>
              ))}
            </nav>
            <div className="rail__end">
              <Link href="/account" className="rail__link" aria-current={current("/account")}>
                <GearIcon />
                <LinkPending />
                <span className="rail__tip">Your account</span>
              </Link>
              <form action={signOut}>
                <SignOutButton rail />
              </form>
            </div>
          </aside>
        )}

        <div className="stage">
          {!me.locked && (
            <header className="topbar">
              <Link href="/" className="topbar__logo" aria-label="QR Hunt Admin: overview">
                <I8Mark />
              </Link>
              <Find items={find} />
              <div className="topbar__acts">
                <Changes changes={changes} />
                <a
                  href={SUMMIT_URL}
                  target="_blank"
                  rel="noopener"
                  className="round-btn topbar__site"
                  aria-label="Open the summit page, innev8.org (new tab)"
                  title="Summit page: innev8.org/ict-summit-2026"
                >
                  <GlobeIcon />
                </a>
              </div>
              <div className="me">
                <Link href="/account" className="me__link" aria-current={current("/account")} title="Your account">
                  <Avatar name={me.name} />
                  <span className="me__text">
                    <b>{me.name}</b>
                    <small>
                      <ShieldIcon />
                      {me.role === "admin" ? "Admin" : "Staff"}
                    </small>
                  </span>
                </Link>
                <form action={signOut} className="topbar__out">
                  <SignOutButton />
                </form>
              </div>
            </header>
          )}
          <main className="main">{children}</main>
        </div>
      </div>

      {!me.locked && (
        <nav className="tabbar" aria-label="Admin">
          {TABS.map(({ href, short, Icon }) => (
            <Link key={href} href={href} className="tab" aria-current={current(href)}>
              <Icon />
              <LinkPending />
              {short}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Sign out (in the rail, or the top bar on phones): a spinner in place of the icon while it signs out. */
function SignOutButton({ rail = false }: { rail?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={rail ? "rail__link rail__out" : "square-btn"}
      aria-label={pending ? "Signing out" : "Sign out"}
      title={rail ? undefined : "Sign out"}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? <Spinner /> : <LogoutIcon />}
      {rail && <span className="rail__tip">Sign out</span>}
    </button>
  );
}
