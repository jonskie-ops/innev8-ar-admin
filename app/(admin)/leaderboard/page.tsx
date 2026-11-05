import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { requireTeammate } from "@/lib/dal";
import { listBoard } from "@/lib/data";

export const metadata: Metadata = { title: "Leaderboard" };

/**
 * The top hunters, as the game ranks them, the way a big screen would show them: to follow the hunt
 * (admins and staff alike), or to put on a projector (with the browser's full screen).
 */
export default async function LeaderboardPage() {
  await requireTeammate();
  const board = await listBoard();
  return board ? (
    <LeaderboardPanel entries={board.entries} final={board.final} testMode={board.testMode} started={board.started} />
  ) : (
    <>
      <Head eyebrow="Players" title="Leaderboard" />
      <p className="banner">The leaderboard needs the prize desk update first: run 20261024000000_prize_desk.sql in the SQL Editor.</p>
    </>
  );
}
