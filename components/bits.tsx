import Link from "next/link";
import type { ReactNode } from "react";
import type { SponsorView } from "@/lib/hunt";
import { ArrowLeftIcon } from "./icons";

/** A page's title block, with its main button on the right. */
export function Head({
  eyebrow,
  title,
  lead,
  back,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="head">
      <div className="head__text">
        {back && (
          <Link href={back.href} className="back">
            <ArrowLeftIcon />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lead && <p className="head__lead">{lead}</p>}
      </div>
      {children && <div className="head__acts">{children}</div>}
    </header>
  );
}

/** For staff: looking is fine, changing is for admins. */
export const pad = (n: number) => String(n).padStart(2, "0");

/** Someone's initial in a coloured badge: one of four colours, always the same for a name. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  let h = 0;
  for (const ch of name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`avatar avatar--t${h % 4}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** A QR code's sponsor: their logo in a circle on the code's top-right corner (as in the game). */
export function SponsorBadge({ sponsor }: { sponsor: SponsorView | null }) {
  if (!sponsor) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a small, fixed-size badge
  return <img className="qr-sponsor" src={sponsor.badge} alt="" title={`Sponsored by ${sponsor.name}`} />;
}
