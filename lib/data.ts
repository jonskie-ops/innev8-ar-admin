import "server-only";
import { cache } from "react";
import { supabaseUrl } from "./config";
import { BUILT_IN_SPONSORS, builtInBadge, type Activity, type Code, type Location, type Member, type Prize, type Settings, type Sponsor, type Zone } from "./hunt";
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

/** How many players have a hunter ID, and how many meetings there have been (null before the networking update). */
export const hunterStats = cache(async (): Promise<{ hunters: number; meetings: number } | null> => {
  const { data, error } = await (await supabase()).rpc("hunter_stats");
  return error || !data ? null : (data as { hunters: number; meetings: number });
});

/** A prize photo's address (the bucket is public, like the game's own images). */
export const photoUrl = (path: string | null) =>
  path ? `${supabaseUrl()}/storage/v1/object/public/prizes/${path}` : null;

/** Leyte Academic Center, as the locations update starts it (for a database without it yet). */
const LAC: Location = {
  id: "lac",
  name: "Leyte Academic Center",
  address: "Barangay Pawing, Palo, Leyte",
  lat: 11.17687,
  lng: 125.003127,
  width: 100,
  outlines: null,
  live: true,
  sort: 0,
  updated_at: "",
};

/**
 * The locations, Leyte Academic Center first. `ready` false: the database hasn't got the locations
 * update yet, so there's only Leyte Academic Center and it can't be changed.
 */
export const listLocations = cache(async (): Promise<{ locations: Location[]; ready: boolean }> => {
  const { data, error } = await (await supabase()).from("locations").select("*").order("sort").order("created_at");
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") throw new Error(error.message);
    return { locations: [LAC], ready: false };
  }
  return { locations: data as Location[], ready: true };
});

/** A code's (or zone's) location id: Leyte Academic Center's before the locations update. */
export const locationOf = (c: { location_id?: string }) => c.location_id ?? "lac";

/** A sponsor badge's address: theirs in the "sponsors" bucket, or the one that came with the game. */
export const badgeUrl = (s: { id: string; badge_path: string | null }) =>
  s.badge_path ? `${supabaseUrl()}/storage/v1/object/public/sponsors/${s.badge_path}` : builtInBadge(s.id);

/**
 * The sponsors, by name. `ready` false: the database hasn't got the sponsor logos update yet, so
 * these are the ones that came with the game, and they can't be changed.
 */
export const listSponsors = cache(async (): Promise<{ sponsors: Sponsor[]; ready: boolean }> => {
  const { data, error } = await (await supabase()).from("sponsors").select("*");
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") throw new Error(error.message);
    const sponsors = BUILT_IN_SPONSORS.map((s) => ({ ...s, badge_path: null, created_at: "", updated_at: "", badge: builtInBadge(s.id) }));
    return { sponsors, ready: false };
  }
  const sponsors = (data as Omit<Sponsor, "badge">[])
    .map((s) => ({ ...s, badge: badgeUrl(s) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return { sponsors, ready: true };
});
