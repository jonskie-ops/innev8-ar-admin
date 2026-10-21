import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { DirectionsIcon, ExternalIcon } from "@/components/icons";
import { MapBoard } from "@/components/MapBoard";
import { PlaceTabs } from "@/components/PlaceTabs";
import type { Spot } from "@/components/SatelliteMap";
import { requireTeammate } from "@/lib/dal";
import { firstPlace, listCodes, listLocations, listZones, locationOf } from "@/lib/data";
import { RADIUS } from "@/lib/hunt";
import { mapsLinks, planOf, spotOf } from "@/lib/venue";

export const metadata: Metadata = { title: "Map" };

/**
 * A location on a real map, where each of its QR codes is on the ground, and (for admins) moving
 * them. With more than one location, tabs switch between them (?at=, else the code asked for's, else the first
 * that's on and has codes).
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ code?: string | string[]; at?: string | string[] }> }) {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [codes, zones, { locations }, { code, at }] = await Promise.all([listCodes(), listZones(), listLocations(), searchParams]);
  const asked = codes.find((c) => c.id === code);
  const place = firstPlace(locations, codes, typeof at === "string" ? at : asked && locationOf(asked));
  const plan = planOf(place);
  const links = mapsLinks(place);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const spots: Spot[] = codes
    .filter((c) => locationOf(c) === place.id)
    .map((c) => ({
      id: c.id,
      num: c.num,
      name: c.name,
      rarity: c.rarity,
      where: [zoneName[c.zone_id] ?? c.zone_id, c.spot].filter(Boolean).join(" · "),
      live: c.live && place.live, // (a location that's off hides its codes)
      ...spotOf(c, plan),
      radius: c.radius ?? RADIUS.default,
    }));

  return (
    <>
      <Head
        eyebrow="Where they are"
        title="Map"
        lead={`${place.name}${place.address ? `, ${place.address}` : ""}. Where each QR code is on the ground, and how close players must be to see it${canEdit ? ": drag a pin to move it" : ""}.`}
      >
        <a href={links.link} target="_blank" rel="noopener" className="btn btn--ghost btn--sm">
          <ExternalIcon />
          <span className="wide-only">Open in</span> Google Maps
        </a>
        <a href={links.directions} target="_blank" rel="noopener" className="btn btn--primary btn--sm">
          <DirectionsIcon />
          Directions
        </a>
      </Head>
      <PlaceTabs
        places={locations.map((l) => ({ id: l.id, name: l.name, live: l.live, codes: codes.filter((c) => locationOf(c) === l.id).length }))}
        current={place.id}
        href={(id) => `/map?at=${id}`}
      />
      <MapBoard
        key={place.id}
        spots={spots}
        place={{ id: place.id, name: place.name, address: place.address, lat: place.lat, lng: place.lng, width: place.width }}
        canEdit={canEdit}
        initial={typeof code === "string" ? code : null}
      />
    </>
  );
}
