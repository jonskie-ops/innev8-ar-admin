import type { Metadata } from "next";
import Link from "next/link";
import { Head } from "@/components/bits";
import { ConfirmButton } from "@/components/form";
import { AlertIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { LiveSwitch } from "@/components/LiveSwitch";
import { VenueMap } from "@/components/VenueMap";
import { deleteLocation } from "@/lib/actions/locations";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listLocations, listZones, locationOf } from "@/lib/data";
import { deleteQuestion } from "@/lib/format";

export const metadata: Metadata = { title: "Locations" };

/** Where the hunt can be played: each location with its map, its QR codes and its switch. */
export default async function LocationsPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [{ locations, ready }, codes, zones] = await Promise.all([listLocations(), listCodes(), listZones()]);

  return (
    <>
      <Head
        eyebrow="Where they are"
        title="Locations"
        lead="Where the hunt can be played. Each QR code is at one location, and players see the codes of every location that's on."
      >
        {canEdit && ready && (
          <Link href="/locations/new" className="btn btn--primary btn--sm">
            <PlusIcon />
            Add location
          </Link>
        )}
      </Head>
      {!ready && (
        <p className="banner">
          <AlertIcon />
          <span>
            For now there&apos;s only Leyte Academic Center. To add more locations, run{" "}
            <code>supabase/migrations/20261022000000_locations.sql</code> in Supabase&apos;s SQL Editor first.
          </span>
        </p>
      )}

      <ul className="lcards" role="list">
        {locations.map((l) => {
          const here = codes.filter((c) => locationOf(c) === l.id);
          const areas = zones.filter((z) => (z.location_id ?? "lac") === l.id);
          const body = (
            <>
              <div className="lcard__map">
                <VenueMap place={l} pins={here} zones={areas} label={`Map of ${l.name}`} still />
              </div>
              <div className="lcard__body">
                <b>
                  {l.name}
                  {l.id === "lac" && <span className="tag">First</span>}
                </b>
                <small>{l.address || "No address"}</small>
                <small>
                  {here.length} QR code{here.length === 1 ? "" : "s"} · {areas.length} area{areas.length === 1 ? "" : "s"}
                </small>
              </div>
            </>
          );
          return (
            <li key={l.id} className={l.live ? "lcard" : "lcard is-off"}>
              {ready ? (
                <Link href={`/locations/${l.id}`} className="lcard__main">
                  {body}
                </Link>
              ) : (
                <span className="lcard__main">{body}</span>
              )}
              {ready && (
                <span className="lcard__foot">
                  <span className="lcard__state">{l.live ? "On in the game" : "Hidden from the game"}</span>
                  <span className="lcard__acts">
                    <LiveSwitch kind="locations" id={l.id} live={l.live} label={`${l.name} in the game`} disabled={!canEdit} />
                    {/* Delete, right here (not the first location): with its areas and its codes */}
                    {canEdit && l.id !== "lac" && (
                      <ConfirmButton
                        action={deleteLocation.bind(null, l.id)}
                        question={deleteQuestion(l.name, here.length)}
                        className="icon-btn icon-btn--danger"
                        label={`Delete ${l.name}`}
                      >
                        <TrashIcon />
                      </ConfirmButton>
                    )}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
