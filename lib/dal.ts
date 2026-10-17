import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabase } from "./supabase";

export type Role = "admin" | "staff";
export type Teammate = { id: string; email: string; name: string; role: Role; mustChangePassword: boolean };

/**
 * Who's signed in, checked with Supabase Auth on every request (not just read from the cookie, so a
 * removed teammate is out at once), and their place on the team: null when they aren't on it.
 */
export const currentUser = cache(async () => {
  const sb = await supabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("team")
    .select("email, name, role, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  const teammate: Teammate | null = data
    ? {
        id: user.id,
        email: data.email,
        name: data.name || data.email.split("@")[0],
        role: data.role,
        mustChangePassword: data.must_change_password,
      }
    : null;
  return { id: user.id, email: user.email ?? "", teammate };
});

/**
 * For pages: the signed-in teammate. Otherwise off to sign in, to "not on the team", or (with a
 * temporary password) to choose their own first.
 */
export async function requireTeammate({ settingPassword = false } = {}): Promise<Teammate> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.teammate) redirect("/no-access");
  if (user.teammate.mustChangePassword && !settingPassword) redirect("/account");
  return user.teammate;
}

/**
 * For server actions, which anyone can call directly: the signed-in admin, or null. Checked again
 * in every action, whatever page it's on.
 */
export async function adminOnly(): Promise<Teammate | null> {
  const me = (await currentUser())?.teammate;
  return me && me.role === "admin" && !me.mustChangePassword ? me : null;
}
