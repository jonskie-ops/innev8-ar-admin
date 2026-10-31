/* eslint-disable @next/next/no-img-element -- the sponsors' badges: small, already sized */
import type { Metadata } from "next";
import Link from "next/link";
import { Head, pad } from "@/components/bits";
import { ConfirmButton } from "@/components/form";
import { SponsorCoins } from "@/components/SponsorCoins";
import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { deleteSponsor } from "@/lib/actions/sponsors";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listSponsors } from "@/lib/data";
import { firstSponsor } from "@/lib/hunt";

export const metadata: Metadata = { title: "Sponsors" };

export default async function SponsorsPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [{ sponsors, ready }, codes] = await Promise.all([listSponsors(), listCodes()]);
  const onCodes = (id: string) => codes.filter((c) => (c.sponsor ?? firstSponsor(c.num)) === id).map((c) => `#${pad(c.num)}`);

  return (
    <>
      <Head
        eyebrow="The hunt"
        title="Sponsors"
        lead="Their logos go on the QR codes: in a circle on the code's top-right corner, in the game. Each code's sponsor is chosen on its page."
      >
        {canEdit && ready && (
          // (on a phone: a round plus, beside the title)
          <Link href="/sponsors/new" className="btn btn--primary btn--sm head__add" aria-label="Add sponsor">
            <PlusIcon />
            <span className="head__add-text">Add sponsor</span>
          </Link>
        )}
      </Head>
      {!ready && (
        <p className="banner">
          <AlertIcon />
          <span>
            These are the sponsors that came with the game. To add more and change their logos, run{" "}
            <code>supabase/migrations/20261021000000_sponsor_logos.sql</code> in Supabase&apos;s SQL Editor first.
          </span>
        </p>
      )}

      {sponsors.length ? (
        <SponsorCoins>
          {sponsors.map((s) => {
            const on = onCodes(s.id);
            const body = (
              <>
                {/* A coin: the logo on both faces, turning while the card is hovered (SponsorCoins) */}
                <span className="spcard__coin">
                  <span className="spcard__spin">
                    <span className="spcard__ring">
                      <img src={s.badge} alt="" width={84} height={84} className="spcard__badge" />
                    </span>
                    <span className="spcard__ring spcard__ring--back">
                      <img src={s.badge} alt="" width={84} height={84} className="spcard__badge" />
                    </span>
                  </span>
                </span>
                <b>{s.name}</b>
              </>
            );
            // In use (on a QR code): a green check beside the bin. Not in use: nothing
            const inUse = on.length > 0 && (
              <span className="spcard__used" role="img" aria-label={`In use: on ${on.join(", ")}`} title={`On ${on.join(", ")}`}>
                <CheckIcon />
              </span>
            );
            return (
              <li key={s.id} className="spcard">
                {ready ? (
                  <Link href={`/sponsors/${s.id}`} className="spcard__main">
                    {body}
                  </Link>
                ) : (
                  <span className="spcard__main">{body}</span>
                )}
                {((canEdit && ready) || inUse) && (
                  <span className="spcard__foot">
                    {inUse}
                    {canEdit && ready && (
                      <ConfirmButton
                        action={deleteSponsor.bind(null, s.id)}
                        question={on.length ? `Take ${s.name} off? ${on.join(", ")} will have no sponsor.` : `Take ${s.name} off?`}
                        className="icon-btn icon-btn--danger"
                        label={`Delete ${s.name}`}
                      >
                        <TrashIcon />
                      </ConfirmButton>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </SponsorCoins>
      ) : (
        <section className="empty-text">
          <h2>No sponsors yet</h2>
          <p>
            {canEdit
              ? "Add one with Add sponsor: their name and logo. Then choose which QR codes they're on."
              : "The sponsors show here once an admin adds them."}
          </p>
        </section>
      )}
    </>
  );
}
