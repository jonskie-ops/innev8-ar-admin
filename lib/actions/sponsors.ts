"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOnly } from "../dal";
import { dbError, done, failed, Invalid, NEEDS_SPONSOR_LOGOS, NOT_ADMIN, text, type FormState } from "../form";
import { supabase } from "../supabase";

/** The bucket's limit is 512 KB; a badge (256 px) is a few dozen. */
const BADGE_MAX = 300 * 1024;

/**
 * The round badge the page made from the chosen logo (components/badge.ts), sent as a data address
 * in the "badge" field: a WebP or PNG. Null: unchanged.
 */
function readBadge(fd: FormData) {
  const v = fd.get("badge");
  if (typeof v !== "string" || !v) return null;
  const m = /^data:image\/(webp|png);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) throw new Invalid("The logo didn't come through. Choose it again.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > BADGE_MAX) throw new Invalid("The logo is too big. Choose it again.");
  const ascii = (a: number, b: number) => bytes.subarray(a, b).toString("latin1");
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  const isWebp = bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if ((m[1] === "png" && !isPng) || (m[1] === "webp" && !isWebp)) throw new Invalid("The logo didn't come through. Choose it again.");
  return { bytes, type: `image/${m[1]}`, ext: m[1] };
}

/** A new sponsor's id, from their name ("Smart Communications" → "smart-communications"), not one in use. */
function newId(name: string, taken: Set<string>) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 28)
      .replace(/^-+|-+$/g, "") || "sponsor";
  for (let n = 1; ; n++) {
    const id = n === 1 && base !== "none" && base !== "new" ? base : `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
}

/** Saves a sponsor (`id` null: adds one, which needs a logo), with their badge: a new one replaces the old. */
export async function saveSponsor(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  let name, badge;
  try {
    name = text(fd, "name", "Name", { max: 40, required: true });
    badge = readBadge(fd);
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  if (!id && !badge) return failed("Choose their logo.");

  const sb = await supabase();
  const { data: all, error: notYet } = await sb.from("sponsors").select("id, name, badge_path");
  if (notYet) return failed(NEEDS_SPONSOR_LOGOS);
  const old = id ? all.find((s) => s.id === id) : null;
  if (id && !old) return failed("This sponsor was taken off by someone else.");
  const same = all.find((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase());
  if (same) return failed(`There's already a sponsor called ${same.name}.`);

  let path: string | undefined; // undefined: badge unchanged
  if (badge) {
    path = `${crypto.randomUUID()}.${badge.ext}`;
    const { error } = await sb.storage
      .from("sponsors")
      .upload(path, new Blob([new Uint8Array(badge.bytes)], { type: badge.type }), { contentType: badge.type, cacheControl: "31536000" });
    if (error) return failed("Couldn't upload the logo. Try again.");
  }
  const row = path === undefined ? { name } : { name, badge_path: path };
  const cleanup = () => path && sb.storage.from("sponsors").remove([path]);

  if (!id) {
    const sponsorId = newId(name, new Set(all.map((s) => s.id)));
    const { error } = await sb.from("sponsors").insert({ ...row, id: sponsorId });
    if (error) {
      await cleanup();
      return failed(dbError(error, "Someone added a sponsor with that name just now. Try again."));
    }
    revalidatePath("/", "layout");
    redirect(`/sponsors/${sponsorId}?added=1`);
  }
  const { data, error } = await sb.from("sponsors").update(row).eq("id", id).select("id");
  if (error || !data?.length) {
    await cleanup();
    return failed(error ? dbError(error) : "This sponsor was taken off by someone else.");
  }
  if (path && old?.badge_path) await sb.storage.from("sponsors").remove([old.badge_path]);
  revalidatePath("/", "layout");
  return done("Saved");
}

/** Takes a sponsor off: the codes that had them have none (the database sees to that), and their badge goes. */
export async function deleteSponsor(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const sb = await supabase();
  const { data, error } = await sb.from("sponsors").delete().eq("id", String(id)).select("badge_path");
  if (error) return failed(dbError(error));
  const badge = data?.[0]?.badge_path;
  if (badge) await sb.storage.from("sponsors").remove([badge]);
  revalidatePath("/", "layout");
  redirect("/sponsors");
}
