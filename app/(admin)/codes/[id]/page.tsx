import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Head, pad, ReadOnly } from "@/components/bits";
import { CodeForm } from "@/components/CodeForm";
import { CheckIcon } from "@/components/icons";
import { deleteCode, saveCode } from "@/lib/actions/codes";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listZones } from "@/lib/data";
import { stamp } from "@/lib/format";
import type { Code } from "@/lib/hunt";

export const metadata: Metadata = { title: "QR code" };

export default async function CodePage({
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
  if (isNew && !canEdit) redirect("/codes");
  const [codes, zones] = await Promise.all([listCodes(), listZones()]);
  const found = codes.find((c) => c.id === id);
  if (!isNew && !found) notFound();
  const code: Code = found ?? {
    id: "new",
    code: "",
    num: Math.max(0, ...codes.map((c) => c.num)) + 1,
    name: "",
    zone_id: zones[0]?.id ?? "",
    spot: "",
    rarity: "common",
    points: 100,
    clue: "",
    blurb: "",
    x: 160,
    y: 128,
    live: true,
    updated_at: "",
  };
  const { added } = await searchParams;

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
      {!canEdit && <ReadOnly />}
      <CodeForm
        key={code.id}
        code={code}
        zones={zones}
        others={codes.filter((c) => c.id !== code.id)}
        save={saveCode.bind(null, isNew ? null : code.id)}
        remove={isNew ? undefined : deleteCode.bind(null, code.id)}
        canEdit={canEdit}
      />
    </>
  );
}
