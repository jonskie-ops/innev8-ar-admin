"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRightIcon, GiftIcon, QrIcon, SearchIcon } from "./icons";
import { startNavigation } from "./Progress";

/** `keys`: more to match on besides the title (lower case), e.g. a code's zone and spot. */
export type Findable = { kind: "code" | "prize" | "page"; href: string; title: string; sub: string; keys: string };

const ICON = { code: QrIcon, prize: GiftIcon, page: ArrowRightIcon };

/** Best first: the name starts with it, then a word in the name does, the name has it, then the rest has it. */
function find(items: Findable[], term: string) {
  const rank = (i: Findable) => {
    const title = i.title.toLowerCase();
    if (title.startsWith(term) || title.replace(/^#\d+ /, "").startsWith(term)) return 0;
    if (title.split(/[\s#·-]+/).some((w) => w.startsWith(term))) return 1;
    if (title.includes(term)) return 2;
    return i.keys.includes(term) ? 3 : -1;
  };
  return items
    .map((i, n) => ({ i, n, r: rank(i) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.n - b.n)
    .slice(0, 7)
    .map((x) => x.i);
}

/**
 * The search in the top bar: a QR code (by number, name, zone or spot), a prize, or a page, as you
 * type. Arrow keys and Enter work, and "/" anywhere jumps here.
 */
export function Find({ items }: { items: Findable[] }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const term = q.trim().toLowerCase();
  const hits = term ? find(items, term) : [];
  const showing = open && term.length > 0;
  const current = Math.min(active, Math.max(hits.length - 1, 0));

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (hit: Findable) => {
    setQ("");
    setOpen(false);
    input.current?.blur();
    if (hit.href !== location.pathname) startNavigation();
    router.push(hit.href);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (hits.length) setActive((current + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
    } else if (e.key === "Enter" && showing && hits[current]) {
      e.preventDefault();
      go(hits[current]);
    } else if (e.key === "Escape") {
      if (q) setQ("");
      else input.current?.blur();
      setOpen(false);
    }
  };

  return (
    <div className="find" role="search">
      <SearchIcon />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Find a QR code, prize or page"
        aria-expanded={showing}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showing && hits.length ? `${id}-${current}` : undefined}
        placeholder="Search"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <kbd className="find__key" aria-hidden="true">
        /
      </kbd>
      {showing && (
        <ul id={`${id}-list`} className="find__list" role="listbox" aria-label="Results">
          {hits.length ? (
            hits.map((h, i) => {
              const Icon = ICON[h.kind];
              return (
                <li
                  key={h.href}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  className="find__hit"
                  // Before the field's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className={`find__ico find__ico--${h.kind}`}>
                    <Icon />
                  </span>
                  <span className="find__text">
                    <b>{h.title}</b>
                    <small>{h.sub}</small>
                  </span>
                </li>
              );
            })
          ) : (
            <li className="find__none" role="presentation">
              Nothing matches &ldquo;{q.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
