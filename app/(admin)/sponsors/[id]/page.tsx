import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Head } from "@/components/bits";
import { CheckIcon } from "@/components/icons";
import { SponsorForm } from "@/components/SponsorForm";
import { deleteSponsor, saveSponsor } from "@/lib/actions/sponsors";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listSponsors } from "@/lib/data";
import { stamp } from "@/lib/format";

export const metadata: Metadata = { title: "Sponsor" };

export default async function SponsorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const { id } = await params;
  const isNew = id === "new";
  if (isNew && !canEdit) redirect("/sponsors");
  if (!isNew && !/^[a-z0-9-]{1,32}$/.test(id)) notFound();
  const [{ sponsors, ready }, codes] = await Promise.all([listSponsors(), listCodes()]);
  // Before the sponsor logos update there's nothing to change: the list says what to run
  if (!ready) redirect("/sponsors");
  const found = sponsors.find((s) => s.id === id);
  if (!isNew && !found) notFound();
  const { added } = await searchParams;

  return (
    <>
      <Head
        back={{ href: "/sponsors", label: "Sponsors" }}
        title={found ? found.name : "New sponsor"}
        lead={found ? `Last changed ${stamp(found.updated_at)}` : "Their name and logo. Then choose the QR codes they're on, on each code's page."}
      />
      {added && (
        <p className="banner banner--ok">
          <CheckIcon />
          Added. Choose the QR codes they&apos;re on, on each code&apos;s page.
        </p>
      )}
      <SponsorForm
        key={found?.id ?? "new"}
        sponsor={found ? { id: found.id, name: found.name, badge: found.badge } : { id: "new", name: "", badge: null }}
        codes={found ? codes.filter((c) => c.sponsor === found.id).map(({ id, num, name, rarity, live }) => ({ id, num, name, rarity, live })) : []}
        save={saveSponsor.bind(null, found ? found.id : null)}
        remove={found ? deleteSponsor.bind(null, found.id) : undefined}
        canEdit={canEdit}
      />
    </>
  );
}
