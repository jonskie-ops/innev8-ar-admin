"use client";

import { useState } from "react";
import { CopyIcon, ExternalIcon, ImageIcon, PrintIcon } from "./icons";

/** The game's link to copy or open, its QR to download, and the poster to print. */
export function PlayerLinkActions({ url, png }: { url: string; png: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // (no clipboard here: the link is selected, to copy by hand)
      const box = document.getElementById("game-link") as HTMLInputElement | null;
      box?.focus();
      box?.select();
    }
  };
  return (
    <>
      <label className="plink__field">
        <span className="sr-only">The game&apos;s link</span>
        <input id="game-link" type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <div className="plink__acts">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void copy()}>
          <CopyIcon />
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn btn--ghost btn--sm" href={url} target="_blank" rel="noreferrer">
          <ExternalIcon />
          Open the game
        </a>
      </div>
      <div className="plink__acts">
        <a className="btn btn--ghost btn--sm" href={png} download="innev8-qr-hunt-link.png">
          <ImageIcon />
          Download the QR
        </a>
        <a className="btn btn--ghost btn--sm" href="/poster" target="_blank" rel="noreferrer">
          <PrintIcon />
          Print the poster
        </a>
      </div>
    </>
  );
}

/** The poster's own Print button (not printed). */
export function PrintButton() {
  return (
    <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
      <PrintIcon />
      Print
    </button>
  );
}
