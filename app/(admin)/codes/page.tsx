import type { Metadata } from "next";
import Link from "next/link";
import { Head, HuntLocked } from "@/components/bits";
import { CodeBrowser, type CodeItem } from "@/components/CodeBrowser";
import { PlusIcon } from "@/components/icons";
import { huntLock, requireTeammate } from "@/lib/dal";
import { codeWorth, inGame, listCodes, listLocations, listSponsors, listZones, locationOf, placeOn } from "@/lib/data";
import { ago, stamp } from "@/lib/format";
import { firstSponsor, sponsorIn } from "@/lib/hunt";

export const metadata: Metadata = { title: "QR codes" };

export default async function CodesPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const me = await requireTeammate();
  // While the hunt is on, QR codes, prizes and locations are only looked at (lib/dal.ts huntLock)
  const lock = await huntLock();
  const canEdit = me.role === "admin" && !lock;
  const [codes, zones, { sponsors }, { locations }, { code }, worth] = await Promise.all([
    listCodes(),
    listZones(),
    listSponsors(),
    listLocations(),
    searchParams,
    codeWorth(),
  ]);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const live = codes.filter(inGame(locations)).length;
  const on = placeOn(locations);
  const items: CodeItem[] = codes.map((c) => ({
    id: c.id,
    num: c.num,
    name: c.name,
    code: c.code,
    rarity: c.rarity,
    points: c.points,
    finders: worth[c.id]?.finders,
    worth: worth[c.id]?.worth,
    live: c.live,
    zone: zoneName[c.zone_id] ?? c.zone_id,
    spot: c.spot,
    clue: c.clue,
    blurb: c.blurb,
    task: c.task ?? "none",
    sponsor: sponsorIn(sponsors, c.sponsor ?? firstSponsor(c.num)),
    location: locationOf(c),
    placeLive: on(c),
    x: c.x,
    y: c.y,
    ago: ago(c.updated_at),
    stamp: stamp(c.updated_at),
  }));

  return (
    <>
      <Head
        eyebrow="The hunt"
        title="QR codes"
        lead={
          codes.length
            ? `${live} of ${codes.length} in the game. Tap a number to see that code.`
            : "Where each QR code hides, the clue that leads to it, and what it's worth."
        }
      >
        {canEdit && (
          // (on a phone: a round plus, beside the title)
          <Link href="/codes/new" className="btn btn--primary btn--sm head__add" aria-label="Add QR code">
            <PlusIcon />
            <span className="head__add-text">Add QR code</span>
          </Link>
        )}
      </Head>
      {me.role === "admin" && lock && <HuntLocked until={lock.until} />}

      {items.length ? (
        <CodeBrowser
          codes={items}
          zones={zones}
          locations={locations.map(({ id, name, lat, lng, width, outlines, live }) => ({ id, name, lat, lng, width, outlines, live }))}
          initial={typeof code === "string" ? code : null} canEdit={canEdit} />
      ) : (
        <section className="empty-text">
          <h2>No QR codes yet</h2>
          <p>
            {!locations.length
              ? "Each QR code is at a location, and there's none yet: add one first on the Locations page."
              : canEdit
                ? "Add the hunt's codes with Add QR code: where each hides, the clue that leads to it, and what it's worth."
                : "The QR codes show here once an admin adds them."}
          </p>
        </section>
      )}
    </>
  );
}
