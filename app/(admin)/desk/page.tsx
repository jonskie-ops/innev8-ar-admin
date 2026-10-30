import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { DeskPanel } from "@/components/DeskPanel";
import { requireTeammate } from "@/lib/dal";
import { getSettings, listGiven } from "@/lib/data";

export const metadata: Metadata = { title: "Prize desk" };

/**
 * Where staff give out prizes: anyone on the team, admins and staff. Checking a card is a pop-up on
 * every page (the frame's), opened here by a USB scanner or typing too.
 */
export default async function DeskPage() {
  const me = await requireTeammate();
  const settings = await getSettings();
  const given = await listGiven(settings.test_mode);
  return (
    <>
      <Head
        eyebrow="On the day"
        title="Prize desk"
        lead="Check the code on a player's prize card and give them their prize. Each prize card can be claimed once: the database checks it was won, and that it hasn't been given already."
      />
      {given ? (
        <DeskPanel given={given} isAdmin={me.role === "admin"} />
      ) : (
        <p className="banner">The prize desk needs the database update first: run 20261024000000_prize_desk.sql in the SQL Editor.</p>
      )}
    </>
  );
}
