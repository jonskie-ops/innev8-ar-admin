import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Head, pad } from "@/components/bits";
import { AddedToast } from "@/components/form";
import { CheckIcon } from "@/components/icons";
import { PrizeForm } from "@/components/PrizeForm";
import { deletePrize, savePrize } from "@/lib/actions/prizes";
import { requireTeammate } from "@/lib/dal";
import { getPrize, inGame, listCodes, listLocations, locationOf, photoUrl } from "@/lib/data";
import { stamp } from "@/lib/format";
import type { Prize } from "@/lib/hunt";

export const metadata: Metadata = { title: "Prize" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PrizePage({
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
  if (isNew && !canEdit) redirect("/prizes");
  if (!isNew && !UUID.test(id)) notFound();
  const [found, codes, { locations }] = await Promise.all([isNew ? null : getPrize(id), listCodes(), listLocations()]);
  if (!isNew && !found) notFound();
  const prize: Prize = found ?? {
    id: "new",
    name: "",
    description: "",
    photo_path: null,
    rule: "all",
    rule_value: null,
    rule_code: null,
    rule_text: null,
    stock: 1,
    live: true,
    sort: 0,
    updated_at: "",
  };
  const { added } = await searchParams;
  // The codes a prize can be for ("Find a chosen QR code"), location by location
  const choices = locations.flatMap((l) =>
    codes
      .filter((c) => locationOf(c) === l.id)
      .map((c) => ({ id: c.id, label: `#${pad(c.num)} ${c.name}${locations.length > 1 ? ` · ${l.name}` : ""}` })),
  );

  return (
    <>
      <Head
        back={{ href: "/prizes", label: "Prizes" }}
        title={isNew ? "New prize" : prize.name}
        lead={isNew ? "What it is, who wins it, and how many you have." : `Last changed ${stamp(prize.updated_at)}`}
      />
      {added && (
        <p className="banner banner--ok">
          <CheckIcon />
          Added{prize.live ? " and live in the game" : ""}.
        </p>
      )}
      {added === "1" && <AddedToast>Prize added</AddedToast>}
      <PrizeForm
        key={prize.id}
        prize={prize}
        photo={photoUrl(prize.photo_path)}
        total={codes.filter(inGame(locations)).length}
        codes={choices}
        save={savePrize.bind(null, isNew ? null : prize.id)}
        remove={isNew ? undefined : deletePrize.bind(null, prize.id)}
        canEdit={canEdit}
      />
    </>
  );
}
