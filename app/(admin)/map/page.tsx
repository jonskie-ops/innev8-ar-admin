import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { DirectionsIcon, ExternalIcon } from "@/components/icons";
import { MapBoard } from "@/components/MapBoard";
import type { Spot } from "@/components/SatelliteMap";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listZones } from "@/lib/data";
import { RADIUS } from "@/lib/hunt";
import { PLACE, spotOf } from "@/lib/venue";

export const metadata: Metadata = { title: "Map" };

/** The venue on a real map, where each QR code is on the ground, and (for admins) moving them. */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [codes, zones, { code }] = await Promise.all([listCodes(), listZones(), searchParams]);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const spots: Spot[] = codes.map((c) => ({
    id: c.id,
    num: c.num,
    name: c.name,
    rarity: c.rarity,
    where: [zoneName[c.zone_id] ?? c.zone_id, c.spot].filter(Boolean).join(" · "),
    live: c.live,
    ...spotOf(c),
    radius: c.radius ?? RADIUS.default,
  }));

  return (
    <>
      <Head
        eyebrow="The venue"
        title="Map"
        lead={`${PLACE.name}, ${PLACE.address}. Where each QR code is on the ground, and how close players must be to see it${canEdit ? ": drag a pin to move it" : ""}.`}
      >
        <a href={PLACE.link} target="_blank" rel="noopener" className="btn btn--ghost btn--sm">
          <ExternalIcon />
          <span className="wide-only">Open in</span> Google Maps
        </a>
        <a href={PLACE.directions} target="_blank" rel="noopener" className="btn btn--primary btn--sm">
          <DirectionsIcon />
          Directions
        </a>
      </Head>
      <MapBoard spots={spots} canEdit={canEdit} initial={typeof code === "string" ? code : null} />
    </>
  );
}
