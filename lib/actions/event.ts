"use server";

import { revalidatePath } from "next/cache";
import { adminOnly } from "../dal";
import { checked, dbError, done, failed, Invalid, NOT_ADMIN, text, type FormState } from "../form";
import { fromLocalInput } from "../format";
import { supabase } from "../supabase";

export async function saveEvent(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const starts = fromLocalInput(String(fd.get("starts_at") ?? ""));
  const ends = fromLocalInput(String(fd.get("ends_at") ?? ""));
  if (!starts) return failed("Choose when the hunt starts.");
  if (!ends) return failed("Choose when the hunt ends.");
  if (ends <= starts) return failed("The hunt has to end after it starts.");
  let claim_place;
  try {
    claim_place = text(fd, "claim_place", "Where players claim prizes", { max: 60, required: true });
  } catch (e) {
    if (e instanceof Invalid) return failed(e.message);
    throw e;
  }
  const { data, error } = await (await supabase())
    .from("settings")
    .update({ starts_at: starts, ends_at: ends, test_mode: checked(fd, "test_mode"), claim_place })
    .eq("id", 1)
    .select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed(NOT_ADMIN);
  revalidatePath("/", "layout");
  return done("Saved");
}
