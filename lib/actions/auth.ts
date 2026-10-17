"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "../dal";
import { done, failed, type FormState } from "../form";
import { supabase, supabaseAdmin } from "../supabase";

const WINDOW_MS = 15 * 60 * 1000;
const PER_ACCOUNT = 5;
const PER_ADDRESS = 20;
const TOO_MANY = "Too many wrong tries. Wait 15 minutes, then try again.";

/**
 * Wrong passwords lately, for this email and from this address (see sign_in_failures in the
 * migration): past the limit, the admin doesn't even ask Supabase.
 */
async function tooManyTries(email: string, ip: string) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const log = () => supabaseAdmin().from("sign_in_failures");
  const [byEmail, byIp] = await Promise.all([
    log().select("id").eq("email", email).gte("at", since).limit(PER_ACCOUNT),
    log().select("id").eq("ip", ip).gte("at", since).limit(PER_ADDRESS),
  ]);
  return (byEmail.data?.length ?? 0) >= PER_ACCOUNT || (byIp.data?.length ?? 0) >= PER_ADDRESS;
}
async function noteFailure(email: string, ip: string) {
  const log = () => supabaseAdmin().from("sign_in_failures");
  await log().insert({ email, ip });
  await log().delete().lt("at", new Date(Date.now() - 86400000).toISOString()); // a day is plenty
}
async function clientAddress() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

/** Only back to a page of this site after signing in. */
function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return failed("Enter your email and password.");
  const ip = await clientAddress();
  if (await tooManyTries(email, ip)) return failed(TOO_MANY);
  const sb = await supabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) return failed(TOO_MANY);
    // Not a wrong password: say what it is, and don't count it
    if (error?.code === "email_not_confirmed")
      return failed("This sign-in's email isn't confirmed yet. Ask an admin (Supabase dashboard → Authentication).");
    if (!error?.status || error.status >= 500)
      return failed("Can't reach the sign-in service right now. Check your connection and try again.");
    await noteFailure(email, ip);
    // The same answer for a wrong password and an unknown email
    return failed("That email and password don't match. Check them and try again.");
  }
  await supabaseAdmin().from("sign_in_failures").delete().eq("email", email);
  const { data: member } = await sb.from("team").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!member) {
    await sb.auth.signOut({ scope: "local" });
    return failed("This account isn't on the organiser team. Ask an admin to add you.");
  }
  redirect(safeNext(fd.get("next")));
}

export async function signOut() {
  await (await supabase()).auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user?.teammate) return failed("Your session ended. Sign in again.");
  const first = user.teammate.mustChangePassword;
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const again = String(fd.get("again") ?? "");
  if (next.length < 10) return failed("Use at least 10 characters.");
  if (next.length > 72) return failed("Use 72 characters or fewer.");
  if (next !== again) return failed("The two new passwords don't match.");
  const sb = await supabase();
  if (!first) {
    // Someone at an unlocked laptop can't change it without knowing it
    const { error } = await sb.auth.signInWithPassword({ email: user.email, password: current });
    if (error) return failed("Your current password isn't right.");
    if (current === next) return failed("That's your current password. Choose a new one.");
  }
  const { error } = await sb.auth.updateUser({ password: next });
  if (error) {
    if (error.code === "same_password") return failed("Choose a password you haven't used here before.");
    if (error.code === "weak_password") return failed("Choose a stronger password: mix letters, numbers and symbols.");
    return failed("Couldn't change your password. Try again.");
  }
  if (first) {
    await sb.rpc("password_changed");
    redirect("/");
  }
  return done("Password changed.");
}
