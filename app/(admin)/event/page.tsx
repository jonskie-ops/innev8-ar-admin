import type { Metadata } from "next";
import { Head, ReadOnly } from "@/components/bits";
import { EventBanner } from "@/components/EventBanner";
import { EventForm } from "@/components/EventForm";
import { saveEvent } from "@/lib/actions/event";
import { requireTeammate } from "@/lib/dal";
import { getSettings, listLocations } from "@/lib/data";
import { stamp, toLocalInput } from "@/lib/format";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [s, { locations }] = await Promise.all([getSettings(), listLocations()]);
  return (
    <>
      <Head
        eyebrow="Regional ICT Summit 2026"
        title="Event"
        lead={`When the hunt runs, test mode, and the prize desk. Last changed ${stamp(s.updated_at)}.`}
      />
      {!canEdit && <ReadOnly />}
      <div className="stack">
        <EventBanner
          startsAt={s.starts_at}
          endsAt={s.ends_at}
          testMode={s.test_mode}
          place={locations.filter((l) => l.live).map((l) => l.name).join(" · ") || "No location on"}
        />
        <EventForm
          startsAt={toLocalInput(s.starts_at)}
          endsAt={toLocalInput(s.ends_at)}
          testMode={s.test_mode}
          randomSpots={s.random_spots ?? false}
          claimPlace={s.claim_place}
          save={saveEvent}
          canEdit={canEdit}
        />
      </div>
    </>
  );
}
