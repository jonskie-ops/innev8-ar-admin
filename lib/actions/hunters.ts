"use server";

import { revalidatePath } from "next/cache";
import { adminOnly } from "../dal";
import { dbError, done, failed, NOT_ADMIN, type FormState } from "../form";
import { testPlayText } from "../hunt";
import { supabase } from "../supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Ana", "Ana and Ben", "Ana, Ben and Carlo" */
const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]);

/**
 * Deletes players' hunter IDs (one, or the ones ticked): their hunter QR stops working, and their
 * meetings, finds and prize cards go. The game on their phone still shows the codes it found, and
 * gets a new hunter ID the next time it opens. One call, so Recent changes has one line for it.
 *
 * A hunter who's been given a prize at the desk (not in test mode) stays, and so none are deleted:
 * their prize records go with them otherwise (Every prize given would lose it, the stock stays
 * lowered, and the desk's same-name check couldn't see it). The database refuses it too
 * (…_hunter_prizes_and_sessions.sql).
 */
export async function deleteHunters(ids: string[]): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const want = [...new Set(ids)].filter((id) => UUID.test(id));
  if (!want.length) return failed("Choose a hunter to delete.");
  const sb = await supabase();
  // (no claims table before the prize desk update: nobody's been given anything)
  const { data: given } = await sb
    .from("claims")
    .select("hunter_id")
    .in("hunter_id", want)
    .not("claimed_at", "is", null)
    .eq("test", false);
  const keep = [...new Set((given ?? []).map((c: { hunter_id: string }) => c.hunter_id))];
  if (keep.length) {
    const { data: who } = await sb.from("hunters").select("name").in("id", keep);
    const names = (who ?? []).map((h: { name: string }) => h.name);
    return failed(givenMessage(names.length ? listOf(names) : keep.length > 1 ? "They" : "This hunter", keep.length > 1, want.length > keep.length));
  }
  const { data: gone, error } = await sb.rpc("delete_hunters", { p_ids: want });
  if (error) {
    // (no such function: the database hasn't got the update yet)
    if (error.code === "PGRST202" || error.code === "42883")
      return failed("Not deleted: the database needs the hunters update first (20261023000000_hunters.sql, in the SQL Editor).");
    // Given a prize just now, at the desk
    if (error.code === "P0001" && error.hint === "given")
      return failed(givenMessage(want.length > 1 ? "One of them" : "This hunter", false, false));
    return failed(dbError(error));
  }
  if (!gone) return failed("They were already deleted.");
  revalidatePath("/", "layout");
  return done(gone === 1 ? "Deleted" : `Deleted ${gone} hunters`);
}

/**
 * Cleans up test play (Settings): every test find, every test prize card, and the test players (who
 * joined before the start and have nothing real). Real finds and prizes given stay. The database does
 * it in one go (…_test_cleanup.sql), with one line in Recent changes.
 */
export async function cleanUpTestPlay(): Promise<FormState> {
  if (!(await adminOnly())) return failed(NOT_ADMIN);
  const { data, error } = await (await supabase()).rpc("test_play", { p_remove: true });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      return failed("Not cleaned up: the database needs the update first (20261119040000_test_cleanup.sql, in the SQL Editor).");
    return failed(dbError(error));
  }
  const d = (data ?? {}) as { error?: string; finds?: number; cards?: number; players?: number };
  if (d.error) return failed(NOT_ADMIN);
  const what = testPlayText({ finds: Number(d.finds) || 0, cards: Number(d.cards) || 0, players: Number(d.players) || 0 });
  revalidatePath("/", "layout");
  return done(what ? `Removed ${what}` : "There was no test play to clean up");
}

/** Why they weren't deleted: who was given a prize, and (with others ticked) what to do */
function givenMessage(who: string, many: boolean, others: boolean) {
  return `Not deleted: ${who} ${many ? "were" : "was"} given a prize at the prize desk, so they stay on the list, with the record of the prize.${others ? " Untick them to delete the others." : ""}`;
}
