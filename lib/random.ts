import "server-only";
import { randomInt } from "node:crypto";

/** No 0/O or 1/I/L: easy to read out loud and type in. */
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MIXED = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export const pick = (n: number, from = UPPER) => Array.from({ length: n }, () => from[randomInt(from.length)]).join("");

/** A temporary password to pass on to a teammate, like "Kq7m-x9Tp-4hRw" (about 69 bits). */
export function tempPassword() {
  for (;;) {
    const p = [pick(4, MIXED), pick(4, MIXED), pick(4, MIXED)].join("-");
    if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p)) return p;
  }
}
