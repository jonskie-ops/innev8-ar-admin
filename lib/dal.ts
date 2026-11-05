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
/** For server actions anyone on the team may do (the prize desk): the teammate, or null. */
export async function teammateOnly(): Promise<Teammate | null> {
  const me = (await currentUser())?.teammate;
  return me && !me.mustChangePassword ? me : null;
}

export async function adminOnly(): Promise<Teammate | null> {
  const me = (await currentUser())?.teammate;
  return me && me.role === "admin" && !me.mustChangePassword ? me : null;
}

/**
 * The hunt is on (between its start and end, test mode off): QR codes, prizes and locations stay as
 * they are until it ends (`until`), so nobody's progress or prize changes under them (a code switched
 * on would "un-win" the All codes prize; a prize switched off would still be given at the desk). The
 * prize desk works as usual. Null when they can be changed. Their pages show them read-only, and
 * their actions check it too.
 */
export const huntLock = cache(async (): Promise<{ until: string } | null> => {
  const { data } = await (await supabase()).from("settings").select("starts_at, ends_at, test_mode").maybeSingle();
  if (!data || data.test_mode) return null;
  const now = Date.now();
  return now >= new Date(data.starts_at).getTime() && now < new Date(data.ends_at).getTime() ? { until: data.ends_at } : null;
});
