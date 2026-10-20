import type { Change } from "@/components/Changes";
import type { Findable } from "@/components/Find";
import { Shell } from "@/components/Shell";
import { requireTeammate } from "@/lib/dal";
import { listCodes, listPrizes, listSponsors, listZones, recentActivity } from "@/lib/data";
import { didWhat } from "@/lib/format";
import { ruleText } from "@/lib/hunt";

/** The pages, and other words someone might look for them by */
const PAGES: [href: string, title: string, sub: string, keys: string][] = [
  ["/", "Overview", "Codes live, prizes, the latest changes", "home dashboard"],
  ["/codes", "QR codes", "Clues, spots and pins on the map", "clues pins map zones"],
  ["/map", "Map", "The venue on Google Maps, and each code's spot", "google venue directions location leyte academic center"],
  ["/prizes", "Prizes", "What players win, and the stock", "rewards stock"],
  ["/sponsors", "Sponsors", "Their logos on the QR codes", "logos brands partners badges"],
  ["/event", "Event", "Dates, test mode, the prize desk", "dates schedule summit test mode prize desk claim"],
  ["/team", "Team", "Who can sign in", "people organisers staff admins sign-ins"],
  ["/account", "Your account", "Your password", "password profile me"],
];

/** Every admin page: the frame, its search and the latest changes. (Each page checks access itself, too.) */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeammate({ settingPassword: true });
  const who = { name: me.name, email: me.email, role: me.role, locked: me.mustChangePassword };
  // A temporary password still to change: only the Account page, so nothing else to look up
  if (who.locked)
    return (
      <Shell me={who} find={[]} changes={[]}>
        {children}
      </Shell>
    );

  const [codes, zones, prizes, { sponsors, ready }, activity] = await Promise.all([
    listCodes(),
    listZones(),
    listPrizes(),
    listSponsors(),
    recentActivity(8),
  ]);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const live = codes.filter((c) => c.live).length;
  const page = (href: string, title: string, sub: string, keys: string): Findable => ({
    kind: "page",
    href,
    title,
    sub,
    keys,
  });
  const find: Findable[] = [
    ...codes.map((c): Findable => {
      const num = String(c.num).padStart(2, "0");
      const where = [zoneName[c.zone_id] ?? c.zone_id, c.spot].filter(Boolean).join(" · ");
      return {
        kind: "code",
        href: `/codes?code=${c.id}`,
        title: `#${num} ${c.name}`,
        sub: c.live ? where : `${where} · off`,
        keys: `#${c.num} #${num} ${c.name} ${c.code} ${where} ${c.rarity}`.toLowerCase(),
      };
    }),
    ...prizes.map(
      (p): Findable => ({
        kind: "prize",
        href: `/prizes/${p.id}`,
        title: p.name,
        sub: ruleText(p, live),
        keys: `${p.name} prize`.toLowerCase(),
      }),
    ),
    ...sponsors.map((s): Findable => {
      const on = codes.filter((c) => c.sponsor === s.id).map((c) => `#${String(c.num).padStart(2, "0")}`);
      return {
        kind: "sponsor",
        href: ready ? `/sponsors/${s.id}` : "/sponsors",
        title: s.name,
        sub: on.length ? `Sponsor on ${on.join(", ")}` : "Sponsor, on no QR code",
        keys: `${s.name} ${s.id} sponsor logo`.toLowerCase(),
      };
    }),
    ...PAGES.map(([href, title, sub, keys]) => page(href, title, sub, keys)),
    ...(me.role === "admin"
      ? [
          page("/codes/new", "Add a QR code", "A new code, its clue and its pin", "new qr code"),
          page("/prizes/new", "Add a prize", "A new prize and who wins it", "new prize"),
          ...(ready ? [page("/sponsors/new", "Add a sponsor", "Their name and logo", "new sponsor logo")] : []),
        ]
      : []),
  ];
  const changes: Change[] = activity.map((a) => ({
    id: a.id,
    who: a.who,
    did: didWhat(a),
    label: a.label,
    at: a.at,
    action: a.action,
  }));

  return (
    <Shell me={who} find={find} changes={changes}>
      {children}
    </Shell>
  );
}
