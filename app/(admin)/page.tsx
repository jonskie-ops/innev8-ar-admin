/* eslint-disable @next/next/no-img-element -- Qufoo is a small, already sized sprite */
import type { CSSProperties } from "react";
import Link from "next/link";
import { Avatar, pad } from "@/components/bits";
import { CardRail } from "@/components/CardRail";
import { ChangeList } from "@/components/Changes";
import { ArrowRightIcon, ChevronRightIcon, ExternalIcon, GiftIcon, PlusIcon, QrIcon, TeamIcon } from "@/components/icons";
import { PrizeCarousel } from "@/components/PrizeCarousel";
import { QrGlyph } from "@/components/QrGlyph";
import { VenueMap } from "@/components/VenueMap";
import { requireTeammate } from "@/lib/dal";
import { getSettings, hunterStats, listCodes, listPrizes, listTeam, listZones, photoUrl, recentActivity } from "@/lib/data";
import { ago, dateSpan, day, didWhat, summitPhase, time } from "@/lib/format";
import { GAME_URL, POINTS, prizeNeeds, RARITIES, RARITY_LABEL } from "@/lib/hunt";

const RING = 2 * Math.PI * 22;
const BADGE = {
  test: { cls: "badge badge--test", text: "Test mode" },
  soon: { cls: "badge", text: "Coming up" },
  live: { cls: "badge badge--live", text: "On now" },
  ended: { cls: "badge badge--ended", text: "Ended" },
};

export default async function OverviewPage() {
  const me = await requireTeammate();
  const canEdit = me.role === "admin";
  const [codes, zones, prizes, settings, activity, team, stats] = await Promise.all([
    listCodes(),
    listZones(),
    listPrizes(),
    getSettings(),
    recentActivity(8),
    listTeam(),
    hunterStats(),
  ]);
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  const live = codes.filter((c) => c.live);
  const points = live.reduce((n, c) => n + c.points, 0);

  const hour = Number(
    new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // The summit: coming up, on now, or over (and test mode lets anyone play before it starts)
  const { phase, days } = summitPhase(settings.starts_at, settings.ends_at);
  const badge = BADGE[settings.test_mode ? "test" : phase];

  const rarities = RARITIES.map((r) => {
    const of = live.filter((c) => c.rarity === r);
    const pts = [...new Set(of.map((c) => c.points))].sort((a, b) => a - b);
    const each = pts.length > 1 ? `${pts[0]}–${pts[pts.length - 1]} pts` : `${pts[0] ?? POINTS[r]} pts each`;
    return { r, n: of.length, each };
  });

  const slides = prizes.map((p) => ({
    id: p.id,
    name: p.name,
    photo: photoUrl(p.photo_path),
    ...prizeNeeds(p, live.length, points),
    stock: p.stock,
    live: p.live,
    updated: ago(p.updated_at),
  }));

  const changes = activity.slice(0, 4).map((a) => ({
    id: a.id,
    who: a.who,
    did: didWhat(a),
    label: a.label,
    at: a.at,
    action: a.action,
  }));

  const admins = team.filter((t) => t.role === "admin").length;
  const others = team.length - 1;
  const share = codes.length ? live.length / codes.length : 0;

  return (
    <div className="dash">
      <div className="dash__main">
        {/* The summit, with Qufoo stepping out of it */}
        <section className="hero" aria-labelledby="hero-title">
          <span className="hero__bg" aria-hidden="true" />
          <img className="hero__qufoo" src="/assets/img/mascot/idle.webp" alt="" width="320" height="340" />
          <div className="hero__top">
            <span className={badge.cls}>{badge.text}</span>
            <span className="hero__hello">
              {greeting}, {me.name.split(" ")[0]}
            </span>
          </div>
          <h1 id="hero-title">QR Code Hunt</h1>
          <p className="hero__sub">Regional ICT Summit 2026</p>
          <p className="hero__when">
            {phase === "soon" ? (
              <b>
                {days}
                <small> {days === 1 ? "day" : "days"} to go</small>
              </b>
            ) : phase === "live" ? (
              <b>
                On now<small> until {time(settings.ends_at)}, {day(settings.ends_at)}</small>
              </b>
            ) : (
              <b>Over</b>
            )}
            <span className="chip">{dateSpan(settings.starts_at, settings.ends_at)}</span>
          </p>
          <div className="duo">
            <a href={GAME_URL} target="_blank" rel="noopener">
              Open the game
              <ExternalIcon />
            </a>
            <Link href="/event" className="duo__main">
              Event settings
            </Link>
          </div>
        </section>

        {/* Each QR code, as the game shows it */}
        <section aria-labelledby="codes-title">
          <div className="shead">
            <h2 id="codes-title">
              <Link href="/codes">
                QR codes
                <ChevronRightIcon />
              </Link>
            </h2>
            <Link href="/codes" className="more">
              {live.length} of {codes.length} live
              <ArrowRightIcon />
            </Link>
          </div>
          {codes.length ? (
            <CardRail label="QR codes">
              {codes.map((c, i) => (
                <li key={c.id}>
                  <Link href={`/codes?code=${c.id}`} className={`ccard ccard--${c.rarity}${c.live ? "" : " is-off"}`}>
                    <span className="ccard__cover">
                      <span className="ccard__num">#{pad(c.num)}</span>
                      <span className="ccard__state">{c.live ? "Live" : "Off"}</span>
                      <span className="ccard__floor" aria-hidden="true" />
                      <span className="ccard__qr" style={{ "--i": i } as CSSProperties} aria-hidden="true">
                        <QrGlyph seed={c.id} />
                        <span className="ccard__beam" />
                      </span>
                      <span className="ccard__zone">
                        {zoneName[c.zone_id] ?? c.zone_id}
                        {c.spot && ` · ${c.spot}`}
                      </span>
                    </span>
                    <span className="ccard__name">{c.name}</span>
                    <span className="ccard__meta">
                      <b>{c.points} pts</b>
                      <span className={`rbadge rbadge--${c.rarity}`}>{RARITY_LABEL[c.rarity]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </CardRail>
          ) : canEdit ? (
            <Link href="/codes/new" className="panel dash__empty">
              <PlusIcon />
              No QR codes yet: add the first one
            </Link>
          ) : (
            <p className="panel dash__empty">No QR codes yet.</p>
          )}
        </section>

        <div className="dash__row">
          <section aria-labelledby="map-title">
            <div className="shead">
              <h2 id="map-title">Where they are</h2>
              <Link href="/codes" className="more">
                Move pins
                <ArrowRightIcon />
              </Link>
            </div>
            <div className="panel dash__map">
              <VenueMap pins={codes} zones={zones} />
            </div>
          </section>

          <section aria-labelledby="rarity-title">
            <div className="shead">
              <h2 id="rarity-title">By rarity</h2>
              <span className="more">{points.toLocaleString("en-PH")} pts to find</span>
            </div>
            <ul className="panel shelf" role="list">
              {rarities.map(({ r, n, each }, i) => (
                <li key={r} className={`shelf__item shelf__item--${r}`}>
                  <span className="shelf__qr" style={{ "--i": i * 3 } as CSSProperties} aria-hidden="true">
                    <QrGlyph seed={`rarity-${r}`} />
                    <span className="ccard__beam" />
                  </span>
                  <span className="shelf__floor" aria-hidden="true" />
                  <b>{RARITY_LABEL[r]}</b>
                  <small>
                    <span>{n} live</span>
                    <span>{each}</span>
                  </small>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <aside className="dash__side" aria-label="Prizes, changes and the team">
        <section className="panel" aria-labelledby="prizes-title">
          <div className="shead">
            <h2 id="prizes-title">Prizes</h2>
            <Link href="/prizes" className="more">
              All prizes
              <ArrowRightIcon />
            </Link>
          </div>
          {slides.length ? (
            <PrizeCarousel prizes={slides} />
          ) : (
            <div className="pempty">
              <span className="pc__ph pempty__ph" aria-hidden="true">
                <GiftIcon />
              </span>
              <p>
                <b>No prizes yet</b>
                What players can win, who wins it, and how many there are.
              </p>
              {canEdit && (
                <Link href="/prizes/new" className="btn btn--primary btn--sm">
                  <PlusIcon />
                  Add the first prize
                </Link>
              )}
            </div>
          )}
        </section>

        <div className="dash__stack">
          <section className="panel" aria-labelledby="changes-title">
            <div className="shead">
              <h2 id="changes-title">Recent changes</h2>
            </div>
            {changes.length ? (
              <ChangeList changes={changes} />
            ) : (
              <p className="empty">No changes yet. Each change made here shows up with who made it.</p>
            )}
          </section>

          <section className="panel teamcard" aria-labelledby="team-title">
            <div className="shead">
              <h2 id="team-title">Team</h2>
              <Link href="/team" className="more">
                Everyone
                <ArrowRightIcon />
              </Link>
            </div>
            <p>
              {team[0]?.name ?? "Nobody yet"}
              {others > 0 && ` + ${others} other${others === 1 ? "" : "s"}`}
              <small>
                {admins} admin{admins === 1 ? "" : "s"} · {team.length - admins} staff
              </small>
            </p>
            <span className="stackav" aria-hidden="true">
              {team.slice(0, 4).map((t) => (
                <Avatar key={t.user_id} name={t.name || t.email} />
              ))}
              {team.length > 4 && <span className="avatar stackav__more">+{team.length - 4}</span>}
            </span>
          </section>

          <Link href="/codes" className="pill">
            <span className="pill__ico">
              <QrIcon />
            </span>
            <span className="pill__text">
              <b>QR codes live</b>
              <small>
                {live.length} of {codes.length} in the game
              </small>
            </span>
            <span className="ring" role="img" aria-label={`${Math.round(share * 100)}% live`}>
              <svg viewBox="0 0 52 52" aria-hidden="true">
                <circle className="ring__track" cx="26" cy="26" r="22" />
                <circle className="ring__fill" cx="26" cy="26" r="22" strokeDasharray={`${share * RING} ${RING}`} />
              </svg>
              <span>{Math.round(share * 100)}%</span>
            </span>
          </Link>

          {/* Networking: players who have a hunter QR, and how many times two of them have met */}
          {stats && (
            <div className="pill pill--plain">
              <span className="pill__ico pill__ico--turq">
                <TeamIcon />
              </span>
              <span className="pill__text">
                <b>
                  {stats.hunters.toLocaleString("en-PH")} hunter{stats.hunters === 1 ? "" : "s"}
                </b>
                <small>
                  {stats.meetings.toLocaleString("en-PH")} meeting{stats.meetings === 1 ? "" : "s"} so far
                </small>
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
