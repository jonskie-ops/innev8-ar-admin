import type { Metadata } from "next";
import { Head } from "@/components/bits";
import { HuntersPanel } from "@/components/HuntersPanel";
import { requireTeammate } from "@/lib/dal";
import { listHunters } from "@/lib/data";

export const metadata: Metadata = { title: "Hunters" };

export default async function HuntersPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const hunters = await listHunters();
  return (
    <>
      <Head
        eyebrow="Players"
        title="Hunters"
        lead={`Each player gets a hunter ID when they sign up in the game: their hunter QR, for meeting other hunters.${canEdit ? " Delete a test player or a duplicate: the codes they found stay on their phone." : ""}`}
      />
      {hunters?.length === 0 ? (
        <section className="empty-text">
          <h2>No hunters yet</h2>
          <p>Each player gets a hunter ID, and a hunter QR, when they sign up in the game: they show here.</p>
        </section>
      ) : hunters ? (
        <HuntersPanel hunters={hunters} canEdit={canEdit} />
      ) : (
        <p className="banner">Hunters come with the networking update: run 20261019000000_networking.sql in the SQL Editor.</p>
      )}
    </>
  );
}
