import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { COOKIE_OPTIONS, cookieLife, supabaseKey, supabaseUrl } from "./config";

/**
 * Supabase as the signed-in organiser (one per request): everything it reads or changes goes
 * through the database's rules as them, so a page or action that forgot a check still can't do
 * more than they're allowed to.
 */
export const supabase = cache(async () => {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, cookieLife(options)));
        } catch {
          // While a page renders cookies can't be written; the proxy keeps the session fresh.
        }
      },
    },
  });
});

/**
 * Supabase with the secret key, past every rule. Only for sign-ins themselves (adding a teammate,
 * resetting their password, removing them), and only after checking that an admin asked.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is missing: copy .env.example to .env.local and fill it in");
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
