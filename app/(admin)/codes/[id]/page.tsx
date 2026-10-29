import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Head, pad } from "@/components/bits";
import { CodeForm } from "@/components/CodeForm";
import { AddedToast } from "@/components/form";
import { CheckIcon } from "@/components/icons";
import { deleteCode, saveCode } from "@/lib/actions/codes";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listLocations, listSponsors, listZones, locationOf } from "@/lib/data";
import { stamp } from "@/lib/format";
import type { Code } from "@/lib/hunt";
import { DEFAULT_LOCATION, planOf } from "@/lib/venue";

export const metadata: Metadata = { title: "QR code" };

export default async function CodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string; at?: string }>;
}) {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const { id } = await params;
  const isNew = id === "new";
  if (isNew && !canEdit) redirect("/codes");
  const [codes, zones, { sponsors, ready }, { locations }, { added, at }] = await Promise.all([
    listCodes(),
    listZones(),
    listSponsors(),
    listLocations(),
    searchParams,
  ]);
  const found = codes.find((c) => c.id === id);
  if (!isNew && !found) notFound();
  // A code needs a location to be at
  if (isNew && !locations.length) redirect("/locations");
  // A new code: at the location asked for (?at=, from its Locations page), in the middle of its map,
  // with the number after its location's last (each location's start at 1)
  const where = locations.find((l) => l.id === at) ?? locations[0];
  const next = Math.max(0, ...codes.filter((c) => locationOf(c) === where.id).map((c) => c.num)) + 1;
  const plan = planOf(where);
  const middle = { x: (plan.pinArea.x0 + plan.pinArea.x1) / 2, y: (plan.pinArea.y0 + plan.pinArea.y1) / 2 };
  const code: Code = found ?? {
    id: "new",
    code: "",
    num: next,
    name: "",
    zone_id: zones.find((z) => (z.location_id ?? DEFAULT_LOCATION) === where.id)?.id ?? "",
    spot: "",
    rarity: "common",
    points: 100,
    clue: "",
    blurb: "",
    x: plan.hand ? 160 : middle.x,
    y: plan.hand ? 128 : middle.y,
    location_id: where.id,
    live: true,
    task: "none",
    // The next sponsor in turn, to start with
    sponsor: sponsors.length ? sponsors[(next - 1) % sponsors.length].id : "none",
    updated_at: "",
  };

  return (
    <>
      <Head
        back={{ href: isNew ? "/codes" : `/codes?code=${code.id}`, label: "QR codes" }}
        title={isNew ? "New QR code" : `#${pad(code.num)} ${code.name}`}
        lead={isNew ? "Where it hides, the clue that leads to it, and what it's worth." : `Last changed ${stamp(code.updated_at)}`}
      />
      {added && (
        <p className="banner banner--ok">
          <CheckIcon />
          Added{code.live ? " and live in the game" : ""}.
        </p>
      )}
      {added === "1" && <AddedToast>QR code added</AddedToast>}
      <CodeForm
        key={code.id}
        code={code}
        zones={zones}
        locations={locations.map(({ id, name, lat, lng, width, outlines }) => ({ id, name, lat, lng, width, outlines }))}
        sponsors={sponsors.map(({ id, name, badge }) => ({ id, name, badge }))}
        canAddSponsor={ready && canEdit}
        others={codes.filter((c) => c.id !== code.id)}
        save={saveCode.bind(null, isNew ? null : code.id)}
        remove={isNew ? undefined : deleteCode.bind(null, code.id)}
        canEdit={canEdit}
      />
    </>
  );
}
