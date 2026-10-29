import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AreasPanel } from "@/components/AreasPanel";
import { Head } from "@/components/bits";
import { AddedToast } from "@/components/form";
import { CheckIcon } from "@/components/icons";
import { LocationForm } from "@/components/LocationForm";
import { deleteLocation, redrawMap, saveLocation } from "@/lib/actions/locations";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listLocations, listZones, locationOf } from "@/lib/data";
import { stamp } from "@/lib/format";
import type { Location } from "@/lib/hunt";

export const metadata: Metadata = { title: "Location" };

export default async function LocationPage({
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
  if (isNew && !canEdit) redirect("/locations");
  if (!isNew && !/^[a-z0-9-]{1,24}$/.test(id)) notFound();
  const [{ locations, ready }, codes, zones, { added }] = await Promise.all([listLocations(), listCodes(), listZones(), searchParams]);
  // Before the locations update there's nothing to change: the list says what to run
  if (!ready) redirect("/locations");
  const found = locations.find((l) => l.id === id);
  if (!isNew && !found) notFound();
  const location: Location = found ?? {
    id: "new",
    name: "",
    address: "",
    lat: 0,
    lng: 0,
    width: 300,
    outlines: null,
    // Off to start with while another location is on (on once its codes are ready); on if none is
    live: !locations.some((l) => l.live),
    sort: 0,
    updated_at: "",
  };
  const here = codes
    .filter((c) => locationOf(c) === location.id)
    .map(({ id, num, name, rarity, x, y, live }) => ({ id, num, name, rarity, x, y, live }));

  return (
    <>
      <Head
        back={{ href: "/locations", label: "Locations" }}
        title={found ? found.name : "New location"}
        lead={found ? `Last changed ${stamp(found.updated_at)}` : "Where it is, and how wide its map is. Its map for the game is drawn from OpenStreetMap."}
      />
      {added && (
        <p className="banner banner--ok">
          <CheckIcon />
          Added. Its map for the game is drawn from OpenStreetMap in a moment. Now add its QR codes (Add a QR code here), or move
          codes here on their pages.
        </p>
      )}
      {added === "1" && <AddedToast>Location added</AddedToast>}
      <LocationForm
        key={location.id}
        location={location}
        codes={here}
        othersOn={locations.filter((l) => l.live && l.id !== location.id).map((l) => l.name)}
        save={saveLocation.bind(null, found ? found.id : null)}
        remove={found ? deleteLocation.bind(null, found.id) : undefined}
        last={locations.length === 1}
        redraw={found ? redrawMap.bind(null, found.id) : undefined}
        canEdit={canEdit}
        side={
          found && (
            <AreasPanel
              locationId={found.id}
              areas={zones
                .filter((z) => (z.location_id ?? "lac") === found.id)
                .map((z) => ({ id: z.id, name: z.name, codes: codes.filter((c) => c.zone_id === z.id).length }))}
              canEdit={canEdit}
            />
          )
        }
      />
    </>
  );
}
