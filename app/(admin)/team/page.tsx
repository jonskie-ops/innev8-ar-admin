import type { Metadata } from "next";
import { Head, ReadOnly } from "@/components/bits";
import { TeamPanel } from "@/components/TeamPanel";
import { requireTeammate } from "@/lib/dal";
import { listTeam } from "@/lib/data";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const members = await listTeam();
  return (
    <>
      <Head
        eyebrow="Access"
        title="Team"
        lead={`${members.length} organiser${members.length === 1 ? "" : "s"} can sign in, and nobody else can.${canEdit ? " Add someone, change a role, or give a new temporary password." : ""}`}
      />
      {!canEdit && <ReadOnly />}
      <TeamPanel members={members} me={me.id} canEdit={canEdit} />
    </>
  );
}
