"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/actions/auth";
import { SUMMIT_URL } from "@/lib/hunt";
import { Avatar } from "./bits";
import { AddedFlash, BackTrail } from "./form";
import { Changes, type Change } from "./Changes";
import { DeskCheck, type DeskPrize } from "./DeskCheck";
import { Find, type Findable } from "./Find";
import { I8Mark } from "./I8Mark";
import {
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
  UserIcon,
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
  { href: "/team", label: "Team", short: "Team", Icon: TeamIcon },
] as const;
/** When the newest hunter this browser has seen on the Hunters page joined (kept on the organiser's own device). */
const SEEN_HUNTER = "i8admin-seen-hunter";
const seenListeners = new Set<() => void>();
const subscribeSeen = (fn: () => void) => {
  seenListeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    seenListeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
const readSeenHunter = () => {
  try {
    return localStorage.getItem(SEEN_HUNTER) ?? "";
  } catch {
    return "";
  }
};
const markSeenHunter = (at: string) => {
  try {
    localStorage.setItem(SEEN_HUNTER, at);
  } catch {}
  seenListeners.forEach((fn) => fn());
};

/** On phones, the tab bar has room for all but the hunters and the team (found with search there) */
const TABS = NAV.filter(({ href }) => href !== "/hunters" && href !== "/team");

/**
 * The admin's frame: a rail of icons down the side, with your account and sign out at its foot (on
 * phones, a tab bar along the bottom, and a gear in the top bar with both), and a top bar with search, the
 * latest changes, the summit's page, and who's signed in. `locked`: a temporary password still to change, so
 * only the Account page. Hunters has a dot while someone has joined since this browser last opened it
 * (`newestHunter`: when the newest one joined).
 */
export function Shell({
  me,
  find,
  changes,
  newestHunter = null,
  desk,
  children,
}: {
  me: { name: string; email: string; role: "admin" | "staff"; locked: boolean };
  find: Findable[];
  changes: Change[];
  newestHunter?: string | null;
  /** For checking a prize card on any page: the prizes that can be won, and how many codes are in the game. */
  desk?: { prizes: DeskPrize[]; total: number };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const current = (href: string) =>
    (href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) ? ("page" as const) : undefined;
  // New hunters: a dot on Hunters until it's opened (then, and while it's open, they're seen)
  const seenHunter = useSyncExternalStore(subscribeSeen, readSeenHunter, () => null);
  const onHunters = path === "/hunters";
  useEffect(() => {
    if (onHunters && newestHunter) markSeenHunter(newestHunter);
  }, [onHunters, newestHunter]);
  const newHunters = !onHunters && seenHunter !== null && !!newestHunter && newestHunter > seenHunter;

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
              {NAV.map(({ href, label, Icon }) => {
                const dot = href === "/hunters" && newHunters;
                return (
                  <Link key={href} href={href} className="rail__link" aria-current={current(href)}>
                    <Icon />
                    {dot && <i className="rail__dot" aria-hidden="true" />}
                    <LinkPending />
                    <span className="rail__tip">{dot ? `${label} (new)` : label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="rail__end">
              <Link href="/account" className="rail__link" aria-current={current("/account")}>
                <GearIcon />
                <LinkPending />
                <span className="rail__tip">Settings</span>
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
                <PhoneMenu current={current("/account")} teamPage={current("/team")} />
              </div>
            </header>
          )}
          <main className="main">{children}</main>
        </div>
      </div>

      {/* Checking a prize card, right where you are: the floating camera button on phones (and typing
          or a USB scanner on the Prize desk page) */}
      {!me.locked && desk && <DeskCheck prizes={desk.prizes} total={desk.total} isAdmin={me.role === "admin"} typing={!!current("/desk")} />}
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

/**
 * On phones (and tablets), the top bar's gear (in place of the profile picture): a little menu with your
 * account, the team, the live site (the summit page), the app's settings, and sign out under them. (On
 * computers, these are in the rail and the top bar.)
 */
function PhoneMenu({ current, teamPage }: { current?: "page"; teamPage?: "page" }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="topbar__out" ref={box}>
      <button
        ref={button}
        type="button"
        className="square-btn topbar__gear"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label="Settings and sign out"
        title="Settings"
        onClick={() => setOpen(!open)}
      >
        <GearIcon />
      </button>
      {open && (
        <div id={`${id}-menu`} className="setmenu">
          <Link href="/account" className="setmenu__item" aria-current={current} onClick={() => setOpen(false)}>
            <UserIcon />
            Account
          </Link>
          {/* (the tab bar has no room for it) */}
          <Link href="/team" className="setmenu__item" aria-current={teamPage} onClick={() => setOpen(false)}>
            <TeamIcon />
            Team
          </Link>
          {/* (the top bar's globe, which phones have no room for) */}
          <a href={SUMMIT_URL} target="_blank" rel="noopener" className="setmenu__item" aria-label="Live site: the summit page, innev8.org (new tab)" onClick={() => setOpen(false)}>
            <GlobeIcon />
            Live site
          </a>
          <Link href="/account" className="setmenu__item" onClick={() => setOpen(false)}>
            <GearIcon />
            App settings
          </Link>
          <form action={signOut}>
            <SignOutButton />
          </form>
        </div>
      )}
    </div>
  );
}

/** Sign out (in the rail, or the gear's menu on phones): a spinner in place of the icon while it signs out. */
function SignOutButton({ rail = false }: { rail?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={rail ? "rail__link rail__out" : "setmenu__item setmenu__out"}
      aria-label={rail ? (pending ? "Signing out" : "Sign out") : undefined}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? <Spinner /> : <LogoutIcon />}
      {rail ? <span className="rail__tip">Sign out</span> : pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
