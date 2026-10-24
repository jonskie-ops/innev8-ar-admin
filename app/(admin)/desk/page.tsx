import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { DeskPanel } from "@/components/DeskPanel";
import { requireTeammate } from "@/lib/dal";
import { getSettings, inGame, listCodes, listGiven, listLocations, listPrizes } from "@/lib/data";

export const metadata: Metadata = { title: "Prize desk" };

/** Where staff give out prizes: anyone on the team, admins and staff. */
export default async function DeskPage() {
  const me = await requireTeammate();
  const settings = await getSettings();
  const [given, prizes, codes, { locations }] = await Promise.all([
    listGiven(settings.test_mode),
    listPrizes(),
    listCodes(),
    listLocations(),
  ]);
  const total = codes.filter(inGame(locations)).length;
  return (
    <>
      <Head
        eyebrow="On the day"
        title="Prize desk"
        lead="Check the code on a player's prize card and give them their prize. Each prize card can be claimed once: the database checks it was won, and that it hasn't been given already."
      />
      {settings.test_mode && (
        <p className="banner">
          Test mode is on: prizes given now don&apos;t change the stock, and stop counting once test mode is off.
        </p>
      )}
      {given ? (
        <DeskPanel
          given={given}
          prizes={prizes.filter((p) => p.live).map((p) => ({ id: p.id, name: p.name, rule: p.rule, rule_value: p.rule_value, rule_text: p.rule_text, photo_fit: p.photo_fit, photo_zoom: p.photo_zoom, stock: p.stock }))}
          total={total}
          isAdmin={me.role === "admin"}
        />
      ) : (
        <p className="banner">The prize desk needs the database update first: run 20261024000000_prize_desk.sql in the SQL Editor.</p>
      )}
    </>
  );
}
