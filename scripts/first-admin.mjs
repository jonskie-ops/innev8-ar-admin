// The first admin, for a new Supabase project (after that, admins add people on the Team page):
//   npm run first-admin -- you@example.com "Your Name"
// Prints a temporary password; you choose your own the first time you sign in.
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const [email, name = ""] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run first-admin -- you@example.com "Your Name"');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Fill in .env.local first (copy .env.example).");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: team, error: teamError } = await sb.from("team").select("user_id").limit(1);
if (teamError) {
  console.error(`Couldn't read the team (${teamError.message}). Did you run supabase/migrations/*.sql?`);
  process.exit(1);
}
if (team.length) {
  console.error("The team already has an admin: add people from the admin's Team page instead.");
  process.exit(1);
}

// Already a sign-in (made in the Supabase dashboard, Authentication → Add user): on the team as it is,
// keeping the password set there
const wanted = email.toLowerCase();
let existing = null;
for (let page = 1; !existing; page++) {
  const { data: list, error: listError } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (listError) {
    console.error(`Couldn't look up sign-ins: ${listError.message}`);
    process.exit(1);
  }
  existing = list.users.find((u) => u.email?.toLowerCase() === wanted) ?? null;
  if (list.users.length < 200) break;
}
if (existing) {
  if (!existing.email_confirmed_at) {
    console.error(`${email}'s email isn't confirmed yet, so it can't sign in. Confirm it in the dashboard (or re-add it with "Auto Confirm User").`);
    process.exit(1);
  }
  const { error: joinError } = await sb
    .from("team")
    .insert({ user_id: existing.id, email: wanted, name, role: "admin", must_change_password: false });
  if (joinError) {
    console.error(`Couldn't add you to the team: ${joinError.message}`);
    process.exit(1);
  }
  console.log(`\n${name || email} is the first admin. Sign in as ${email} with the password you set in the dashboard.\n`);
  process.exit(0);
}

const ABC = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
let password;
do password = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ABC[randomInt(ABC.length)]).join("")).join("-");
while (!(/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)));

const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error || !data.user) {
  console.error(`Couldn't create the sign-in: ${error?.message}`);
  process.exit(1);
}
const { error: joinError } = await sb
  .from("team")
  .insert({ user_id: data.user.id, email: email.toLowerCase(), name, role: "admin" });
if (joinError) {
  await sb.auth.admin.deleteUser(data.user.id);
  console.error(`Couldn't add you to the team: ${joinError.message}`);
  process.exit(1);
}
console.log(`\n${name || email} is the first admin. Sign in as ${email} with this temporary password:\n\n    ${password}\n\nYou'll choose your own right after.\n`);
