/** What a form's server action answers, and reading its fields safely. */

export type FormState = {
  ok?: string;
  error?: string;
  /** A temporary password to pass on (shown once) */
  password?: string;
  /** When it answered: the same message twice still shows */
  at?: number;
} | null;

export const done = (ok: string, extra: Omit<NonNullable<FormState>, "ok" | "at"> = {}): FormState => ({
  ok,
  ...extra,
  at: Date.now(),
});
export const failed = (error: string): FormState => ({ error, at: Date.now() });

export const NOT_ADMIN = "Only admins can change this. Ask an admin on your team.";

/** Thrown by the readers below; actions turn it into the form's message. */
export class Invalid extends Error {}

export function text(fd: FormData, name: string, label: string, { max = 200, required = false } = {}) {
  const v = fd.get(name);
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (required && !s) throw new Invalid(`${label} can't be empty.`);
  if (s.length > max) throw new Invalid(`${label} is too long (${s.length} of ${max} characters).`);
  return s;
}

export function whole(fd: FormData, name: string, label: string, min: number, max: number) {
  const s = String(fd.get(name) ?? "").trim();
  const n = Number(s);
  if (!s || !Number.isInteger(n)) throw new Invalid(`${label} must be a whole number.`);
  if (n < min || n > max) throw new Invalid(`${label} must be between ${min} and ${max.toLocaleString("en-PH")}.`);
  return n;
}

export function decimal(fd: FormData, name: string, label: string, min: number, max: number) {
  const n = Number(fd.get(name));
  if (!Number.isFinite(n) || n < min || n > max) throw new Invalid(`${label} is off the map.`);
  return Math.round(n * 10) / 10;
}

export function oneOf<T extends string>(fd: FormData, name: string, label: string, options: readonly T[]) {
  const v = fd.get(name);
  if (typeof v !== "string" || !options.includes(v as T)) throw new Invalid(`Choose a ${label.toLowerCase()}.`);
  return v as T;
}

export const checked = (fd: FormData, name: string) => fd.get(name) === "on";

/** Postgres errors, in words. */
export function dbError(e: { code?: string; message: string }, taken = "That's already used.") {
  if (e.code === "23505") return taken;
  if (e.code === "23503") return "It's still in use.";
  if (e.code === "23514") return "One of the values is out of range.";
  if (e.code === "42501") return NOT_ADMIN;
  if (e.code === "P0001") return e.message;
  return "Couldn't save. Check your connection and try again.";
}
