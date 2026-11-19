"use server";

import { revalidatePath } from "next/cache";
import { adminOnly } from "../dal";
import { checked, dbError, done, failed, Invalid, NEEDS_DROP, NEEDS_FAR, NEEDS_GPS, NEEDS_SEEN, NOT_ADMIN, text, type FormState } from "../form";
import { fromLocalInput } from "../format";
import { SEE } from "../hunt";
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
  const sb = await supabase();
  // A database without the GPS update has no random spots switch: the game puts each code at its map
  // pin's place then, as with the switch off
  const random_spots = checked(fd, "random_spots");
  const gps = !(await sb.from("settings").select("random_spots").limit(1)).error;
  if (!gps && random_spots) return failed(NEEDS_GPS);
  // Likewise "Seen from" (each code's side): off until its update is run
  const seen_from = checked(fd, "seen_from");
  const seen = !(await sb.from("settings").select("seen_from").limit(1)).error;
  if (!seen && seen_from) return failed(NEEDS_SEEN);
  // Likewise points that drop as more people find a code
  const points_drop = checked(fd, "points_drop");
  const drops = !(await sb.from("settings").select("points_drop").limit(1)).error;
  if (!drops && points_drop) return failed(NEEDS_DROP);
  let drop = {};
  if (drops) {
    const whole = (name: string, label: string, min: number, max: number) => {
      const v = Number(String(fd.get(name) ?? "").trim());
      if (!Number.isInteger(v) || v < min || v > max) throw new Invalid(`${label}: a whole number from ${min} to ${max}.`);
      return v;
    };
    try {
      drop = {
        points_drop,
        drop_full: whole("drop_full", "Finders who get full points", 1, 1000),
        drop_every: whole("drop_every", "Finders per drop", 1, 1000),
        drop_floor: whole("drop_floor", "Lowest share", 1, 100),
      };
    } catch (e) {
      if (e instanceof Invalid) return failed(e.message);
      throw e;
    }
  }
  // And codes seen from farther away than they're collected
  const far_view = checked(fd, "far_view");
  const fars = !(await sb.from("settings").select("far_view").limit(1)).error;
  if (!fars && far_view) return failed(NEEDS_FAR);
  let far = {};
  if (fars) {
    const m = Number(String(fd.get("see_metres") ?? "").trim());
    if (!Number.isInteger(m) || m < SEE.min || m > SEE.max) return failed(`Players see codes from: a whole number of metres from ${SEE.min} to ${SEE.max}.`);
    far = { far_view, see_metres: m };
  }
  const { data, error } = await sb
    .from("settings")
    .update({
      starts_at: starts,
      ends_at: ends,
      test_mode: checked(fd, "test_mode"),
      claim_place,
      ...(gps && { random_spots }),
      ...(seen && { seen_from }),
      ...drop,
      ...far,
    })
    .eq("id", 1)
    .select("id");
  if (error) return failed(dbError(error));
  if (!data?.length) return failed(NOT_ADMIN);
  revalidatePath("/", "layout");
  return done("Saved");
}
