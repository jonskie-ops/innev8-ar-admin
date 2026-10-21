"use server";

import { revalidatePath } from "next/cache";
import { adminOnly } from "../dal";
import { dbError, done, failed, NOT_ADMIN, type FormState } from "../form";
import { supabase } from "../supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes players' hunter IDs (one, or the ones ticked): their hunter QR stops working and their
 * meetings go. The codes they found stay on their phone, which gets a new hunter ID the next time the
 * game opens. One call, so Recent changes has one line for it.
 */
export async function deleteHunters(ids: string[]): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const want = [...new Set(ids)].filter((id) => UUID.test(id));
  if (!want.length) return failed("Choose a hunter to delete.");
  const { data: gone, error } = await (await supabase()).rpc("delete_hunters", { p_ids: want });
  if (error) {
    // (no such function: the database hasn't got the update yet)
    if (error.code === "PGRST202" || error.code === "42883")
      return failed("Not deleted: the database needs the hunters update first (20261023000000_hunters.sql, in the SQL Editor).");
    return failed(dbError(error));
  }
  if (!gone) return failed("They were already deleted.");
  revalidatePath("/", "layout");
  return done(gone === 1 ? "Deleted" : `Deleted ${gone} hunters`);
}
