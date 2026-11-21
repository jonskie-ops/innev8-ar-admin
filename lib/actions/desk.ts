"use server";

import { revalidatePath } from "next/cache";
import { stamp } from "../format";
import { adminOnly, teammateOnly } from "../dal";
import { photoUrl } from "../data";
import type { DeskClaim } from "../hunt";
import { NOT_ADMIN } from "../form";
import { supabase } from "../supabase";

/**
 * The prize desk: a player's claim code (typed, or scanned from their prize card) looked up, and
 * their prize given, once. The database does the checking (…_prize_desk.sql): anyone on the team can
 * look up and give; only admins can take a prize back.
 */

/** The same person (by name) was already given this prize, as another player: when, to whom, by whom. */
export type Repeat = { at: string; by: string | null; to: string; hunter: string | null; tag: string | null };
export type DeskAnswer = { claim?: DeskClaim; ok?: string; error?: string; repeat?: Repeat; at: number };

const NEEDS_DESK = "The prize desk needs the database update first (20261024000000_prize_desk.sql, in the SQL Editor).";
const NEEDS_NAMES = "their name isn't kept until the database update 20261029010000_desk_names.sql is run";
const NOT_TEAM = "Sign in again to use the prize desk.";
const said = (r: Omit<DeskAnswer, "at">): DeskAnswer => ({ ...r, at: Date.now() });
// (no such function: the database hasn't got the update yet)
const missing = (e: { code?: string } | null) => e?.code === "PGRST202" || e?.code === "42883";

type Refusal = { error: string; at?: string; by?: string | null; to?: string | null };
function why(r: Refusal) {
  switch (r.error) {
    case "nocode":
      return "No prize has this code. Check it with the player, and try again.";
    case "noperson":
      return "Type their name, from their ID or summit badge.";
    case "claimed":
      return `Already claimed${r.to ? ` by ${r.to}` : ""}${r.at ? `, ${stamp(r.at)}` : ""}${r.by ? ` (given by ${r.by})` : ""}.`;
    case "test":
      return "This code is from test mode: it doesn't count now that test mode is off.";
    case "notwon":
      return "They haven't won this prize: their confirmed finds don't add up to it.";
    case "points":
      return "They don't have enough points to spend on this prize.";
    case "nostock":
      return "None of this prize left. Add stock on its page first.";
    case "notgiven":
      return "It hasn't been given, so there's nothing to take back.";
    case "admin":
      return NOT_ADMIN;
    default:
      return NOT_TEAM;
  }
}

/** What this code is: the player, the prize and whether it can be given. */
export async function lookupClaim(text: string): Promise<DeskAnswer> {
  if (!(await teammateOnly())) return said({ error: NOT_TEAM });
  const code = text.trim().slice(0, 64);
  if (!code) return said({ error: "Type or scan the code on the player's prize card." });
  const { data, error } = await (await supabase()).rpc("desk_lookup", { p_code: code });
  if (missing(error)) return said({ error: NEEDS_DESK });
  if (error || !data) return said({ error: "Couldn't look it up. Try again." });
  if ("error" in data) return said({ error: why(data as Refusal) });
  const claim = data as DeskClaim;
  return said({ claim: { ...claim, prize: { ...claim.prize, photo: photoUrl(claim.prize.photo) } } });
}

/**
 * Gives the prize to this person (their name from their ID or badge): once, to a player who's won it,
 * while there's stock. If someone of that name was already given this prize as another player, it
 * isn't given: the desk says so, and gives it only `again` (a different person with the same name).
 */
export async function giveClaim(code: string, person: string, again = false): Promise<DeskAnswer> {
  if (!(await teammateOnly())) return said({ error: NOT_TEAM });
  const name = person.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return said({ error: why({ error: "noperson" }) });
  const sb = await supabase();
  let { data, error } = await sb.rpc("desk_give_to", { p_code: code, p_person: name, p_again: again });
  // Before the desk names update: given as before, without the name
  const unnamed = missing(error);
  if (unnamed) ({ data, error } = await sb.rpc("desk_give", { p_code: code }));
  if (missing(error)) return said({ error: NEEDS_DESK });
  if (error || !data) return said({ error: "Couldn't give it. Try again." });
  if ("error" in data) {
    const r = data as Refusal & { hunter?: string | null; tag?: string | null };
    if (r.error === "repeat" && r.at)
      return said({ repeat: { at: r.at, by: r.by ?? null, to: r.to ?? name, hunter: r.hunter ?? null, tag: r.tag ?? null } });
    return said({ error: why(r) });
  }
  revalidatePath("/", "layout");
  const { left, cost } = data as { left: number | null; cost?: number | null };
  const given = cost ? `Given · ${cost.toLocaleString("en-PH")} points taken` : "Given";
  const ok = left === null ? `${given} (test mode: the stock stays)` : `${given} · ${left.toLocaleString("en-PH")} left`;
  return said({ ok: unnamed ? `${ok} (${NEEDS_NAMES})` : ok });
}

/** Takes a prize back (given by mistake): it can be given again, and its stock goes back up. */
export async function undoClaim(code: string): Promise<DeskAnswer> {
  if (!(await adminOnly())) return said({ error: NOT_ADMIN });
  const { data, error } = await (await supabase()).rpc("desk_undo", { p_code: code });
  if (missing(error)) return said({ error: NEEDS_DESK });
  if (error || !data) return said({ error: "Couldn't take it back. Try again." });
  if ("error" in data) return said({ error: why(data as Refusal) });
  revalidatePath("/", "layout");
  return said({ ok: "Taken back: it can be given again" });
}

// ---------------------------------------------------------------- winners, by their hunter QR

/** A winner's hunter QR, scanned at the desk (…_winner_check.sql): who, their place, their check, the leaderboard prizes. */
export type Winner = {
  hunter: { id: string; name: string; province: string; tag: string };
  test: boolean;
  /** The leaderboard is final (the hunt is over, test mode off) */
  final: boolean;
  me: { rank: number; score: number; codes: number } | null;
  /** The leaderboard prize they were given at the desk already (one each) */
  checked: { prize: string; at: string; by: string | null; to: string | null }[];
  /** The leaderboard prizes: `rank`, the place one is for (null: "the leaderboard decides") */
  prizes: { id: string; name: string; stock: number; to: string | null; rank?: number | null }[];
};
export type WinnerAnswer = { winner?: Winner; ok?: string; error?: string; at: number };

const NEEDS_WINNERS = "Checking winners needs the database update first (20261121000000_winner_check.sql, in the SQL Editor).";
const saidW = (r: Omit<WinnerAnswer, "at">): WinnerAnswer => ({ ...r, at: Date.now() });
type WinnerRefusal = { error: string; prize?: string; at?: string; by?: string | null };
function whyWinner(r: WinnerRefusal) {
  switch (r.error) {
    case "team":
      return NOT_TEAM;
    case "tag":
      return "No player has this hunter QR. Check it's their hunter QR, from the game's Me tab.";
    case "pin":
      return "This hunter QR has expired: it changes every minute. Ask them to open the Me tab and show it again (a screenshot won't work), then scan it again.";
    case "noperson":
      return "Type their name, from their ID or badge.";
    case "noprize":
      return "Choose one of the leaderboard prizes.";
    case "already":
      return `Already checked: they got ${r.prize ?? "a leaderboard prize"}${r.at ? `, ${stamp(r.at)}` : ""}${r.by ? ` (by ${r.by})` : ""}. One each.`;
    case "nostock":
      return "None of this prize left. Choose another.";
    default:
      return "Couldn't do it. Try again.";
  }
}

/** Whose hunter QR this is (scanned: its tag and this minute's PIN), their place on the leaderboard, and the prizes. */
export async function lookupWinner(tag: string, pin: string): Promise<WinnerAnswer> {
  if (!(await teammateOnly())) return saidW({ error: NOT_TEAM });
  const { data, error } = await (await supabase()).rpc("desk_winner", { p_tag: tag.slice(0, 8), p_pin: pin.slice(0, 8) });
  if (missing(error)) return saidW({ error: NEEDS_WINNERS });
  if (error || !data) return saidW({ error: "Couldn't check it. Try again." });
  if ("error" in data) return saidW({ error: whyWinner(data as WinnerRefusal) });
  return saidW({ winner: data as Winner });
}

/** Marks them checked, with the leaderboard prize they get (once each), given to the person named. */
export async function checkWinner(tag: string, pin: string, prize: string, person: string): Promise<WinnerAnswer> {
  if (!(await teammateOnly())) return saidW({ error: NOT_TEAM });
  const name = person.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return saidW({ error: whyWinner({ error: "noperson" }) });
  const { data, error } = await (await supabase()).rpc("desk_check_winner", {
    p_tag: tag.slice(0, 8),
    p_pin: pin.slice(0, 8),
    p_prize: prize,
    p_person: name,
  });
  if (missing(error)) return saidW({ error: NEEDS_WINNERS });
  if (error || !data) return saidW({ error: "Couldn't mark it. Try again." });
  if ("error" in data) return saidW({ error: whyWinner(data as WinnerRefusal) });
  revalidatePath("/", "layout");
  const { left } = data as { left: number | null };
  return saidW({ ok: left === null ? "Checked (test mode: the stock stays)" : `Checked · ${left.toLocaleString("en-PH")} left` });
}
