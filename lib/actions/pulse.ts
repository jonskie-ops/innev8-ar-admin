"use server";

import { teammateOnly } from "../dal";
import { toPulse, type Pulse } from "../hunt";
import { supabase } from "../supabase";

/** The Overview's numbers, read again (it asks every 30 s while it's on screen). Null: not now. */
export async function readPulse(): Promise<Pulse | null> {
  if (!(await teammateOnly())) return null;
  const { data, error } = await (await supabase()).rpc("hunt_pulse");
  return error ? null : toPulse(data);
}
