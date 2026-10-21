"use client";

import { useState } from "react";
import type { Location, Zone } from "@/lib/hunt";
import { PlaceTabs } from "./PlaceTabs";
import { VenueMap, type Pin } from "./VenueMap";

/**
 * Every location's map with its QR codes' pins (pins link to their code): one at a time, with tabs to
 * switch when there's more than one (the first with codes to start with).
 */
export function PlaceMaps({
  places,
  pins,
  zones,
}: {
  places: Pick<Location, "id" | "name" | "lat" | "lng" | "width" | "outlines" | "live">[];
  pins: (Pin & { location: string })[];
  zones: Zone[];
}) {
  const [at, setAt] = useState(() => (places.find((p) => pins.some((x) => x.location === p.id)) ?? places[0]).id);
  const place = places.find((p) => p.id === at) ?? places[0];
  return (
    <>
      <PlaceTabs
        places={places.map((p) => ({ id: p.id, name: p.name, live: p.live, codes: pins.filter((x) => x.location === p.id).length }))}
        current={place.id}
        onPick={setAt}
      />
      <VenueMap
        key={place.id}
        place={place}
        pins={pins.filter((x) => x.location === place.id)}
        zones={zones.filter((z) => (z.location_id ?? "lac") === place.id)}
        label={`Map of ${place.name}`}
      />
    </>
  );
}
