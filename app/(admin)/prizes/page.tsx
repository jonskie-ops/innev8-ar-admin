/* eslint-disable @next/next/no-img-element -- prize photos come from Supabase storage, already sized */
import type { Metadata } from "next";
import Link from "next/link";
import { Head, ReadOnly } from "@/components/bits";
import { ConfirmButton } from "@/components/form";
import { GiftIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { LiveSwitch } from "@/components/LiveSwitch";
import { deletePrize } from "@/lib/actions/prizes";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listPrizes, photoUrl } from "@/lib/data";
import { ruleText } from "@/lib/hunt";

export const metadata: Metadata = { title: "Prizes" };

export default async function PrizesPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [prizes, codes] = await Promise.all([listPrizes(), listCodes()]);
  const total = codes.filter((c) => c.live).length;

  return (
    <>
      <Head eyebrow="The hunt" title="Prizes" lead="What players can win, who wins it, and how many you have.">
        {canEdit && (
          <Link href="/prizes/new" className="btn btn--primary btn--sm">
            <PlusIcon />
            Add prize
          </Link>
        )}
      </Head>
      {!canEdit && <ReadOnly />}

      {prizes.length ? (
        <ul className="prizes" role="list">
          {prizes.map((p) => {
            const src = photoUrl(p.photo_path);
            return (
              <li key={p.id} className={p.live ? "prize" : "prize is-off"}>
                <Link href={`/prizes/${p.id}`} className="prize__main">
                  <span className="prize__photo">{src ? <img src={src} alt="" loading="lazy" /> : <GiftIcon />}</span>
                  <span className="prize__body">
                    <b>{p.name}</b>
                    <small>{ruleText(p, total)}</small>
                  </span>
                </Link>
                <span className="prize__foot">
                  <span className={p.stock ? "stock" : "stock stock--out"}>
                    {p.stock ? `${p.stock.toLocaleString("en-PH")} in stock` : "Out of stock"}
                  </span>
                  <LiveSwitch kind="prizes" id={p.id} live={p.live} label={`${p.name} in the game`} disabled={!canEdit} />
                  {canEdit && (
                    <ConfirmButton
                      action={deletePrize.bind(null, p.id)}
                      question={`Delete ${p.name}? It's gone from the game for everyone. (Turning it off can be undone.)`}
                      className="icon-btn icon-btn--danger"
                      label={`Delete ${p.name}`}
                    >
                      <TrashIcon />
                    </ConfirmButton>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="empty-text">
          <h2>No prizes yet</h2>
          <p>
            {canEdit
              ? "Add what players can win with Add prize: a name and photo, who wins it, and how many you have."
              : "What players can win shows here once an admin adds it."}
          </p>
        </section>
      )}
    </>
  );
}
