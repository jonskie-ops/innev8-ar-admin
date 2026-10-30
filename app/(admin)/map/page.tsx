import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { MapBoard } from "@/components/MapBoard";
import { PlaceTabs } from "@/components/PlaceTabs";
import type { Spot } from "@/components/SatelliteMap";
import { requireTeammate } from "@/lib/dal";
import { firstPlace, listCodes, listLocations, listZones, locationOf } from "@/lib/data";
import { RADIUS } from "@/lib/hunt";
import { planOf, spotOf } from "@/lib/venue";

export const metadata: Metadata = { title: "Map" };

/**
 * A location on a real map, where each of its QR codes is on the ground. With more than one location,
 * tabs switch between them (?at=, else the code asked for's, else the first that's on and has codes).
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ code?: string | string[]; at?: string | string[] }> }) {
  await requireTeammate();
  const [codes, zones, { locations }, { code, at }] = await Promise.all([listCodes(), listZones(), listLocations(), searchParams]);
  const asked = codes.find((c) => c.id === code);
  const place = firstPlace(locations, codes, typeof at === "string" ? at : asked && locationOf(asked));
  if (!place)
    return (
      <>
        <Head eyebrow="Where they are" title="Map" />
        <section className="empty-text">
          <h2>No locations yet</h2>
          <p>Add where the hunt is played on the Locations page: its map shows here, with its QR codes.</p>
        </section>
      </>
    );
  const plan = planOf(place);
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
        lead={`${place.name}${place.address ? `, ${place.address}` : ""}. Where each QR code is on the ground, and how close players must be to see it.`}
      />
      <PlaceTabs
        places={locations.map((l) => ({ id: l.id, name: l.name, live: l.live, codes: codes.filter((c) => locationOf(c) === l.id).length }))}
        current={place.id}
        href={(id) => `/map?at=${id}`}
      />
      <MapBoard
        key={place.id}
        spots={spots}
        place={{ id: place.id, name: place.name, address: place.address, lat: place.lat, lng: place.lng, width: place.width, outlines: plan.hand ? null : "osm" }}
        initial={typeof code === "string" ? code : null}
      />
    </>
  );
}
