import Link from "next/link";
import { PlacesIcon } from "./icons";

export type PlaceTab = { id: string; name: string; live: boolean; codes: number };

/**
 * The locations as tabs, when there's more than one: each with how many QR codes it has (and "off"
 * when it's hidden from the game). Links (`href`), or buttons (`onPick`) for a switch on the page.
 */
export function PlaceTabs({
  places,
  current,
  href,
  onPick,
}: {
  places: PlaceTab[];
  current: string;
  href?: (id: string) => string;
  onPick?: (id: string) => void;
}) {
  if (places.length < 2) return null;
  return (
    <nav className="placetabs" aria-label="Locations">
      {places.map((p) => {
        const body = (
          <>
            <PlacesIcon />
            <span className="placetabs__name">{p.name}</span>
            <small>{p.live ? p.codes : "Off"}</small>
          </>
        );
        const cls = p.live ? "placetabs__tab" : "placetabs__tab is-off";
        return href ? (
          <Link key={p.id} href={href(p.id)} className={cls} aria-current={p.id === current ? "page" : undefined}>
            {body}
          </Link>
        ) : (
          <button key={p.id} type="button" className={cls} aria-pressed={p.id === current} onClick={() => onPick?.(p.id)}>
            {body}
          </button>
        );
      })}
    </nav>
  );
}
