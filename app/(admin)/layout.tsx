import type { Change } from "@/components/Changes";
import type { Findable } from "@/components/Find";
import { Shell } from "@/components/Shell";
import { requireTeammate } from "@/lib/dal";
import { inGame, listCodes, listLocations, listPrizes, listSponsors, listZones, locationOf, placeOn, recentActivity } from "@/lib/data";
import { didWhat } from "@/lib/format";
import { ruleText } from "@/lib/hunt";

/** The pages, and other words someone might look for them by */
const PAGES: [href: string, title: string, sub: string, keys: string][] = [
  ["/", "Overview", "Codes live, prizes, the latest changes", "home dashboard"],
  ["/codes", "QR codes", "Clues, spots and pins on the map", "clues pins map zones"],
  ["/map", "Map", "Each location on a real map, and each code's spot", "google venue directions location leyte academic center"],
  ["/locations", "Locations", "Where the hunt can be played, and their maps", "places venues sites areas zones maps"],
  ["/prizes", "Prizes", "What players win, and the stock", "rewards stock"],
  ["/desk", "Prize desk", "Check a player's prize code and give the prize", "claim claims give winners scan code redeem"],
  ["/sponsors", "Sponsors", "Their logos on the QR codes", "logos brands partners badges"],
  ["/hunters", "Hunters", "The players with a hunter ID", "players participants delete networking meetings"],
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

  const [codes, zones, prizes, { sponsors, ready }, { locations, ready: placesReady }, activity] = await Promise.all([
    listCodes(),
    listZones(),
    listPrizes(),
    listSponsors(),
    listLocations(),
    recentActivity(8),
  ]);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const live = codes.filter(inGame(locations)).length;
  const on = placeOn(locations);
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
        sub: !c.live ? `${where} · off` : on(c) ? where : `${where} · hidden (location off)`,
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
    ...locations.map((l): Findable => {
      const n = codes.filter((c) => locationOf(c) === l.id).length;
      return {
        kind: "place",
        href: placesReady ? `/locations/${l.id}` : "/locations",
        title: l.name,
        sub: `${l.live ? "" : "Off · "}${n} QR code${n === 1 ? "" : "s"}${l.address ? ` · ${l.address}` : ""}`,
        keys: `${l.name} ${l.address} location place venue`.toLowerCase(),
      };
    }),
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
          ...(placesReady ? [page("/locations/new", "Add a location", "Somewhere else to play, with its map", "new location place venue")] : []),
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
