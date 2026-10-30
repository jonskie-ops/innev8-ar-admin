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
import { deleteQuestion, turnOnQuestion } from "@/lib/format";

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
        lead="Where the hunt can be played. Each QR code is at one location, and one location is on in the game at a time: players see its codes."
      >
        {canEdit && ready && (
          // (on a phone: a round plus, beside the title)
          <Link href="/locations/new" className="btn btn--primary btn--sm head__add" aria-label="Add location">
            <PlusIcon />
            <span className="head__add-text">Add location</span>
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

      {ready && !locations.length && (
        <section className="empty-text">
          <h2>No locations yet</h2>
          <p>
            {canEdit
              ? "Add where the hunt is played with Add location: where it is and its map for the game. Then its QR codes."
              : "Where the hunt is played shows here once an admin adds it."}
          </p>
        </section>
      )}
      {locations.length > 0 && (
        <ul className="lcards" role="list">
          {locations.map((l) => {
            const here = codes.filter((c) => locationOf(c) === l.id);
            const areas = zones.filter((z) => (z.location_id ?? "lac") === l.id);
            // Switching it on turns the one that's on off: asked first
            const onNow = locations.filter((o) => o.live && o.id !== l.id).map((o) => o.name);
            const map = (
              <div className="lcard__map">
                <VenueMap place={l} pins={here} zones={areas} label={`Map of ${l.name}`} still />
              </div>
            );
            const body = (
              <>
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
                {/* Its map (opens it too), with its on/off switch on the map's corner */}
                <div className="lcard__top">
                  {ready ? (
                    <Link href={`/locations/${l.id}`} className="lcard__maplink" tabIndex={-1} aria-hidden="true">
                      {map}
                    </Link>
                  ) : (
                    map
                  )}
                  {ready && (
                    <span className="lcard__live">
                      <LiveSwitch
                        kind="locations"
                        id={l.id}
                        live={l.live}
                        label={`${l.name} in the game`}
                        disabled={!canEdit}
                        ask={onNow.length ? turnOnQuestion(l.name, onNow) : undefined}
                      />
                    </span>
                  )}
                </div>
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
                      {/* Delete, right here: with its areas and its codes */}
                      {canEdit && (
                        <ConfirmButton
                          action={deleteLocation.bind(null, l.id)}
                          question={deleteQuestion(l.name, here.length, l.id === "lac" && l.outlines == null, locations.length === 1)}
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
      )}
    </>
  );
}
