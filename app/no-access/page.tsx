import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { I8Mark } from "@/components/I8Mark";
import { LogoutIcon } from "@/components/icons";
import { signOut } from "@/lib/actions/auth";
import { currentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Not on the team" };

/** Signed in, but not an organiser (or removed from the team since). */
export default async function NoAccessPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.teammate) redirect("/");
  return (
    <main className="signin">
      <div className="signin__bg" aria-hidden="true"></div>
      <div className="signin__card">
        <I8Mark className="signin__mark" />
        <h1>Not on the team</h1>
        <p className="signin__lead">
          {user.email} isn&apos;t on the organiser team, so there&apos;s nothing here for it. If you should have
          access, ask an admin to add you.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn btn--ghost btn--sm">
            <LogoutIcon />
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
