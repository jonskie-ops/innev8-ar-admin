"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOnly } from "../dal";
import { checked, dbError, done, failed, Invalid, NOT_ADMIN, oneOf, text, whole, type FormState } from "../form";
import type { PrizeRule } from "../hunt";
import { supabase } from "../supabase";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX = 5 * 1024 * 1024;
const RULES: PrizeRule[] = ["all", "count", "legendary", "points"];

function readPrize(fd: FormData) {
  const rule = oneOf(fd, "rule", "Who wins", RULES);
  return {
    name: text(fd, "name", "Name", { max: 60, required: true }),
    description: text(fd, "description", "Description", { max: 300 }),
    rule,
    rule_value:
      rule === "count"
        ? whole(fd, "rule_value", "The number of QR codes", 1, 99)
        : rule === "points"
          ? whole(fd, "rule_value", "The points", 1, 100000)
          : null,
    stock: whole(fd, "stock", "Stock", 0, 100000),
    live: checked(fd, "live"),
  };
}

/** Saves a prize (`id` null: adds one), with its photo: a new one replaces the old. */
export async function savePrize(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  let v;
  try {
    v = readPrize(fd);
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  const upload = fd.get("photo");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  if (file && !PHOTO_TYPES[file.type]) return failed("The photo must be a JPG, PNG or WebP image.");
  if (file && file.size > PHOTO_MAX) return failed("The photo is over 5 MB. Use a smaller one.");

  const sb = await supabase();
  let old: string | null = null;
  if (id) {
    const { data } = await sb.from("prizes").select("photo_path").eq("id", id).maybeSingle();
    if (!data) return failed("This prize was removed by someone else.");
    old = data.photo_path;
  }
  let photo: string | null | undefined; // undefined: unchanged
  if (file) {
    const path = `${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`;
    const { error } = await sb.storage
      .from("prizes")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) return failed("Couldn't upload the photo. Try again.");
    photo = path;
  } else if (checked(fd, "remove_photo")) photo = null;
  // The stock as this page had it: not changed here, so the prize desk's gives since then stay
  const { stock, ...rest } = v;
  const base = id && fd.get("stock_was") === String(stock) ? rest : v;
  const row = photo === undefined ? base : { ...base, photo_path: photo };
  const cleanup = () => photo && sb.storage.from("prizes").remove([photo]);

  if (!id) {
    const { data, error } = await sb.from("prizes").insert(row).select("id").single();
    if (error) {
      await cleanup();
      return failed(dbError(error));
    }
    revalidatePath("/", "layout");
    redirect(`/prizes/${data.id}?added=1`);
  }
  const { data, error } = await sb.from("prizes").update(row).eq("id", id).select("id");
  if (error || !data?.length) {
    await cleanup();
    return failed(error ? dbError(error) : "This prize was removed by someone else.");
  }
  if (photo !== undefined && old) await sb.storage.from("prizes").remove([old]);
  revalidatePath("/", "layout");
  return done("Saved");
}

export async function deletePrize(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const sb = await supabase();
  const { data, error } = await sb.from("prizes").delete().eq("id", id).select("photo_path");
  if (error) return failed(dbError(error));
  const photo = data?.[0]?.photo_path;
  if (photo) await sb.storage.from("prizes").remove([photo]);
  revalidatePath("/", "layout");
  redirect("/prizes");
}
