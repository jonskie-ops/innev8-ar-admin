import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { PlayerLinkActions } from "@/components/PlayerLink";
import { requireTeammate } from "@/lib/dal";
import { GAME_URL } from "@/lib/hunt";
import { GAME_LINK, gameQr } from "@/lib/qr";

export const metadata: Metadata = { title: "Player link" };

/**
 * How players get into the game: its link (to copy, or open as a player sees it), a QR of it (to
 * download for slides and screens), and a poster to print for the venue. Anyone on the team.
 */
export default async function PlayerLinkPage() {
  await requireTeammate();
  const { svg, png } = await gameQr();
  return (
    <>
      <Head
        eyebrow="Players"
        title="Player link"
        lead="How players get into the game: share the link, show the QR on a screen, or print the poster for the venue."
      />
      <div className="plink">
        <section className="panel plink__card">
          {/* (made on the server from our own link) */}
          <div className="plink__qr" role="img" aria-label={`QR code: ${GAME_LINK}`} dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="plink__url">{GAME_LINK}</p>
        </section>
        <section className="panel">
          <h2 className="panel__title">Share the game</h2>
          <PlayerLinkActions url={GAME_URL} png={png} />
          <div className="plink__tips">
            <p>
              <b>On the poster</b> (and worth saying when you share the link):
            </p>
            <ol>
              <li>Scan the QR with your phone&apos;s camera.</li>
              <li>Open it in Safari or Chrome, not inside Messenger or Facebook.</li>
              <li>Allow the camera and your location.</li>
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}
