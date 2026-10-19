import type { Metadata } from "next";
import Link from "next/link";
import { Head, ReadOnly } from "@/components/bits";
import { CodeBrowser, type CodeItem } from "@/components/CodeBrowser";
import { PlusIcon, QrIcon } from "@/components/icons";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listZones } from "@/lib/data";
import { ago, stamp } from "@/lib/format";

export const metadata: Metadata = { title: "QR codes" };

export default async function CodesPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [codes, zones, { code }] = await Promise.all([listCodes(), listZones(), searchParams]);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const live = codes.filter((c) => c.live).length;
  const items: CodeItem[] = codes.map((c) => ({
    id: c.id,
    num: c.num,
    name: c.name,
    code: c.code,
    rarity: c.rarity,
    points: c.points,
    live: c.live,
    zone: zoneName[c.zone_id] ?? c.zone_id,
    spot: c.spot,
    clue: c.clue,
    blurb: c.blurb,
    task: c.task ?? "none",
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
        lead={`${live} of ${codes.length} live. Tap a number to see that code.`}
      >
        {canEdit && (
          <Link href="/codes/new" className="btn btn--primary btn--sm">
            <PlusIcon />
            Add QR code
          </Link>
        )}
      </Head>
      {!canEdit && <ReadOnly />}

      {items.length ? (
        <CodeBrowser codes={items} zones={zones} initial={typeof code === "string" ? code : null} canEdit={canEdit} />
      ) : (
        <section className="panel empty-state">
          <span className="empty-state__icon">
            <QrIcon />
          </span>
          <h2>No QR codes yet</h2>
          <p>Add the first one: where it hides, the clue that leads to it, and what it&apos;s worth.</p>
          {canEdit && (
            <Link href="/codes/new" className="btn btn--primary btn--sm">
              <PlusIcon />
              Add the first QR code
            </Link>
          )}
        </section>
      )}
    </>
  );
}
