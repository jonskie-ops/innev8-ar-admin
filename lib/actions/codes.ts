"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOnly } from "../dal";
import { checked, dbError, decimal, done, failed, Invalid, NOT_ADMIN, oneOf, text, whole, type FormState } from "../form";
import { RARITIES } from "../hunt";
import { pick } from "../random";
import { supabase } from "../supabase";
import { PIN_AREA } from "../venue";

function readCode(fd: FormData) {
  return {
    num: whole(fd, "num", "Number", 1, 99),
    name: text(fd, "name", "Name", { max: 40, required: true }),
    zone_id: text(fd, "zone_id", "Zone", { max: 24, required: true }),
    spot: text(fd, "spot", "Spot", { max: 60 }),
    rarity: oneOf(fd, "rarity", "Rarity", RARITIES),
    points: whole(fd, "points", "Points", 0, 10000),
    clue: text(fd, "clue", "Clue", { max: 140 }),
    blurb: text(fd, "blurb", "Description", { max: 200 }),
    x: decimal(fd, "x", "The pin", 0, 360),
    y: decimal(fd, "y", "The pin", 0, 520),
    live: checked(fd, "live"),
  };
}

/** Saves a QR code (`id` null: adds one, with a new code value for its 3D pattern). */
export async function saveCode(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  let v;
  try {
    v = readCode(fd);
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  const sb = await supabase();
  const taken = `Number ${v.num} is already used by another QR code.`;
  if (!id) {
    const newId = "c" + pick(6, "abcdefghjkmnpqrstuvwxyz23456789");
    const code = `I8AR-${String(v.num).padStart(2, "0")}-${pick(4)}`;
    const { error } = await sb.from("codes").insert({ ...v, id: newId, code });
    if (error) return failed(dbError(error, taken));
    revalidatePath("/", "layout");
    redirect(`/codes/${newId}?added=1`);
  }
  const { data, error } = await sb.from("codes").update(v).eq("id", id).select("id");
  if (error) return failed(dbError(error, taken));
  if (!data?.length) return failed("This QR code was removed by someone else.");
  revalidatePath("/", "layout");
  return done("Saved");
}

export async function deleteCode(id: string): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const { error } = await (await supabase()).from("codes").delete().eq("id", id);
  if (error) return failed(dbError(error));
  revalidatePath("/", "layout");
  redirect("/codes");
}

/** On or off in the game, for a QR code or a prize. */
export async function setLive(kind: "codes" | "prizes", id: string, live: boolean): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  if (kind !== "codes" && kind !== "prizes") return failed("Unknown item.");
  const { data, error } = await (await supabase())
    .from(kind)
    .update({ live: live === true })
    .eq("id", String(id))
    .select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("It was removed by someone else.");
  revalidatePath("/", "layout");
  return done(live ? "On" : "Off");
}

/** A QR code's pin, moved on the Map page: only where the game's venue map can show it. */
export async function moveCode(id: string, x: number, y: number): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const inside =
    Number.isFinite(x) && Number.isFinite(y) && x >= PIN_AREA.x0 && x <= PIN_AREA.x1 && y >= PIN_AREA.y0 && y <= PIN_AREA.y1;
  if (!inside) return failed("That's outside the area the game's map shows.");
  const half = (v: number) => Math.round(v * 2) / 2;
  const { data, error } = await (await supabase())
    .from("codes")
    .update({ x: half(x), y: half(y) })
    .eq("id", String(id))
    .select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed("This QR code was removed by someone else.");
  revalidatePath("/", "layout");
  return done("Moved");
}
