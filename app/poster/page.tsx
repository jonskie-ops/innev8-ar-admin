import type { Metadata } from "next";
import { PrintButton } from "@/components/PlayerLink";
import { requireTeammate } from "@/lib/dal";
import { getSettings } from "@/lib/data";
import { GAME_LINK, gameQr } from "@/lib/qr";

export const metadata: Metadata = { title: "Poster" };

/** An A4 poster for the venue: the game's QR and link, and how to start. Print it from here. */
export default async function PosterPage() {
  await requireTeammate();
  const [{ svg }, settings] = await Promise.all([gameQr(), getSettings()]);
  return (
    <main className="poster-page">
      <div className="poster-page__bar">
        <a className="btn btn--ghost btn--sm" href="/link">
          Back
        </a>
        <PrintButton />
      </div>
      <article className="poster">
        <p className="poster__eyebrow">Regional ICT Summit 2026</p>
        <h1 className="poster__title">INNEV8 QR Code Hunt</h1>
        <p className="poster__lead">Find the hidden QR codes around the venue, collect points and win prizes!</p>
        {/* (made on the server from our own link) */}
        <div className="poster__qr" role="img" aria-label={`QR code: ${GAME_LINK}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="poster__url">{GAME_LINK}</p>
        <ol className="poster__steps">
          <li>
            <b>Scan</b> the QR with your phone&apos;s camera.
          </li>
          <li>
            <b>Open it in Safari or Chrome</b>, not inside Messenger or Facebook.
          </li>
          <li>
            <b>Allow</b> the camera and your location.
          </li>
        </ol>
        <p className="poster__foot">Claim your prizes at the {settings.claim_place}.</p>
      </article>
    </main>
  );
}
