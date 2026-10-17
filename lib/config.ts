/**
 * Where the Supabase project is, and how the sign-in cookie is kept. No secrets here (the secret key
 * is read in lib/supabase.ts only), so the proxy can use it too.
 */

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing: copy .env.example to .env.local and fill it in`);
  return value;
}

export const supabaseUrl = () => env("SUPABASE_URL").replace(/\/+$/, "");
/** The project's publishable ("anon") key: what it can do is limited by the database's rules. */
export const supabaseKey = () => env("SUPABASE_PUBLISHABLE_KEY");

/**
 * The session cookie: out of reach of the page's scripts (the admin only talks to Supabase from the
 * server), and sent over https only in production.
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** A week: written again each time Supabase renews the session, so a week of not using it signs you out. */
const SESSION_DAYS = 7;
/** @supabase/ssr always asks for 400 days; this keeps the admin's week (removals stay at 0). */
export const cookieLife = <T extends { maxAge?: number }>(options: T): T =>
  options.maxAge ? { ...options, maxAge: SESSION_DAYS * 86400 } : options;
