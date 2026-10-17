import "server-only";
import { cache } from "react";
import { supabaseUrl } from "./config";
import type { Activity, Code, Member, Prize, Settings, Zone } from "./hunt";
import { supabase } from "./supabase";

/**
 * Reads for the pages, as the signed-in organiser (the database's rules apply). Each is read once per
 * request: the frame (search, latest changes) and the page share it. (Server actions don't read
 * through here, so nothing they change is answered from before.)
 */

type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
async function read<T>(query: Result<T>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export const listCodes = cache(async () => read<Code[]>((await supabase()).from("codes").select("*").order("num")));
export const getCode = async (id: string) =>
  read<Code | null>((await supabase()).from("codes").select("*").eq("id", id).maybeSingle());
export const listZones = cache(async () =>
  read<Zone[]>((await supabase()).from("zones").select("*").order("sort").order("name")),
);

export const listPrizes = cache(async () =>
  read<Prize[]>((await supabase()).from("prizes").select("*").order("sort").order("created_at")),
);
export const getPrize = async (id: string) =>
  read<Prize | null>((await supabase()).from("prizes").select("*").eq("id", id).maybeSingle());

export const getSettings = cache(async () =>
  read<Settings>((await supabase()).from("settings").select("*").single()),
);

export const listTeam = cache(async () =>
  read<Member[]>((await supabase()).from("team").select("*").order("role").order("created_at")),
);

export const recentActivity = cache(async (n = 12) =>
  read<Activity[]>((await supabase()).from("activity").select("*").order("at", { ascending: false }).limit(n)),
);

/** A prize photo's address (the bucket is public, like the game's own images). */
export const photoUrl = (path: string | null) =>
  path ? `${supabaseUrl()}/storage/v1/object/public/prizes/${path}` : null;
