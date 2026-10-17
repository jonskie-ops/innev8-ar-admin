"use server";

import { revalidatePath } from "next/cache";
import { adminOnly } from "../dal";
import { dbError, done, failed, Invalid, NOT_ADMIN, oneOf, text, type FormState } from "../form";
import { tempPassword } from "../random";
import { supabase, supabaseAdmin } from "../supabase";

const ROLES = ["admin", "staff"] as const;

/**
 * Adds an organiser: their sign-in, with a temporary password shown once to the admin who added
 * them. They choose their own the first time they sign in.
 */
export async function addTeammate(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  let name, email, role;
  try {
    name = text(fd, "name", "Name", { max: 60, required: true });
    email = text(fd, "email", "Email", { max: 254, required: true }).toLowerCase();
    role = oneOf(fd, "role", "Role", ROLES);
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failed("That email doesn't look right.");
  const password = tempPassword();
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.status === 422)
      return failed("Someone with that email already has a sign-in.");
    return failed("Couldn't add them. Try again.");
  }
  const { error: joinError } = await (await supabase())
    .from("team")
    .insert({ user_id: data.user.id, email, name, role });
  if (joinError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return failed(dbError(joinError));
  }
  revalidatePath("/", "layout");
  return done(`${name} is on the team.`, { password });
}

export async function setRole(userId: string, role: string): Promise<FormState> {
  const me = await adminOnly();
  if (!me) return failed(NOT_ADMIN);
  if (userId === me.id) return failed("You can't change your own role. Ask another admin.");
  if (role !== "admin" && role !== "staff") return failed("Choose a role.");
  const { data, error } = await (await supabase()).from("team").update({ role }).eq("user_id", userId).select("user_id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("They were removed by someone else.");
  revalidatePath("/", "layout");
  return done("Saved");
}

/** A new temporary password, for a teammate who forgot theirs. */
export async function resetPassword(userId: string): Promise<FormState> {
  const me = await adminOnly();
  if (!me) return failed(NOT_ADMIN);
  if (userId === me.id) return failed("Change your own password on your Account page.");
  const password = tempPassword();
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { password });
  if (error) return failed("Couldn't reset it. Try again.");
  await (await supabase()).from("team").update({ must_change_password: true }).eq("user_id", userId);
  revalidatePath("/", "layout");
  return done("New temporary password", { password });
}

export async function removeTeammate(userId: string): Promise<FormState> {
  const me = await adminOnly();
  if (!me) return failed(NOT_ADMIN);
  if (userId === me.id) return failed("You can't remove yourself. Ask another admin.");
  // Off the team first (the log says who did it), then their sign-in
  const { data, error } = await (await supabase()).from("team").delete().eq("user_id", userId).select("user_id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("They were already removed.");
  await supabaseAdmin().auth.admin.deleteUser(userId);
  revalidatePath("/", "layout");
  return done("Removed");
}
