"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterAdd } from "@/lib/back";
import { adminOnly, huntLock } from "../dal";
import { checked, dbError, done, failed, Invalid, NEEDS_PHOTO_LOOK, NEEDS_POINT_PRIZES, NEEDS_PRIZE_CODE, HUNT_LOCKED, NOT_ADMIN, oneOf, text, whole, type FormState } from "../form";
import { PHOTO_ZOOM, type PhotoFit, type PrizeRule } from "../hunt";
import { supabase } from "../supabase";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX = 5 * 1024 * 1024;
const RULES: PrizeRule[] = ["all", "count", "legendary", "points", "code", "cost", "board"];

function readPrize(fd: FormData) {
  const rule = oneOf(fd, "rule", "Who wins", RULES);
  return {
    name: text(fd, "name", "Name", { max: 60, required: true }),
    description: text(fd, "description", "Description", { max: 300 }),
    rule,
    rule_value:
      rule === "count"
        ? whole(fd, "rule_value", "The number of QR codes", 1, 99)
        : rule === "points" || rule === "cost"
          ? whole(fd, "rule_value", "The points", 1, 100000)
          : null,
    // A chosen code: which, and the sentence players read (only sent then, so a database without
    // the prize code update still saves the other rules)
    ...(rule === "code" && {
      rule_code: text(fd, "rule_code", "The QR code", { max: 40, required: true }),
      rule_text: text(fd, "rule_text", "What players read", { max: 80, required: true }),
    }),
    stock: whole(fd, "stock", "Stock", 0, 100000),
    live: checked(fd, "live"),
    // How its photo sits in its box (kept apart below: a database without the photo look update
    // has no such columns)
    photo_fit: oneOf<PhotoFit>(fd, "photo_fit", "Photo fit", ["cover", "contain"]),
    photo_zoom: whole(fd, "photo_zoom", "The photo's size", PHOTO_ZOOM.min, PHOTO_ZOOM.max),
  };
}

/** Saving a chosen-code prize to a database without the prize code update */
const noCodeRule = (e: { code?: string }) => ["PGRST204", "42703", "23514"].includes(e.code ?? "");
/** What a refused save says: a rule the database doesn't have yet names its update */
const saveError = (rule: PrizeRule, e: { code?: string; message: string }) =>
  rule === "code" && noCodeRule(e) ? NEEDS_PRIZE_CODE : rule === "cost" && e.code === "23514" ? NEEDS_POINT_PRIZES : dbError(e);

/** Saves a prize (`id` null: adds one), with its photo: a new one replaces the old. */
export async function savePrize(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  if (await huntLock()) return failed(HUNT_LOCKED);
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
  // The photo's look: saved when the database has the columns; otherwise only the default (as
  // every photo was) goes through, and anything else says what to run
  const { photo_fit, photo_zoom, ...fields } = v;
  const { error: noLook } = await sb.from("prizes").select("photo_fit").limit(1);
  if (noLook && (photo_fit !== "cover" || photo_zoom !== PHOTO_ZOOM.default)) return failed(NEEDS_PHOTO_LOOK);
  v = noLook ? fields : v;
  if (v.rule === "code") {
    const { data: code } = await sb.from("codes").select("id").eq("id", v.rule_code!).maybeSingle();
    if (!code) return failed("That QR code was deleted by someone else. Choose another.");
  }
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
      return failed(saveError(v.rule, error));
    }
    revalidatePath("/", "layout");
    redirect(afterAdd(fd, `/prizes/${data.id}`, "prize"));
  }
  const { data, error } = await sb.from("prizes").update(row).eq("id", id).select("id");
  if (error || !data?.length) {
    await cleanup();
    return failed(error ? saveError(v.rule, error) : "This prize was removed by someone else.");
  }
  if (photo !== undefined && old) await sb.storage.from("prizes").remove([old]);
  revalidatePath("/", "layout");
  return done("Saved");
}

export async function deletePrize(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  if (await huntLock()) return failed(HUNT_LOCKED);
  const sb = await supabase();
  const { data, error } = await sb.from("prizes").delete().eq("id", id).select("photo_path");
  if (error) return failed(dbError(error));
  const photo = data?.[0]?.photo_path;
  if (photo) await sb.storage.from("prizes").remove([photo]);
  revalidatePath("/", "layout");
  redirect("/prizes");
}
