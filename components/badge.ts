/**
 * A sponsor's round badge from the logo an organiser chooses, made in the browser the way the game's
 * scripts/sponsors.mjs made the first ones: the logo's plain background taken out (when there is
 * one), its empty edges trimmed, and set as big as fits on a white circle, 256 px across. What the
 * game shows on the QR code's top-right corner; the admin stores only this, never the file itself.
 */

/** What can be chosen: pictures the browser can draw. */
export const LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";

const SIZE = 256; // the badge, in pixels
const FIT = 0.84; // the logo's diagonal, as a share of the circle's width: an even margin all round
const MAX_IN = 1024; // a bigger logo is scaled down first (and a drawing drawn this big)

/**
 * The logo's background, from its top-left corner: "none" (see-through already), "light" (white or
 * near it, which comes out by default) or "colour" (which may be part of the logo, so it stays by
 * default).
 */
export type Background = "none" | "light" | "colour";

/** `cut`: take out the plain background (undefined: only a light one). The badge as a data address. */
export async function makeBadge(file: File, cut?: boolean): Promise<{ badge: string; background: Background; cut: boolean }> {
  const img = await open(file);
  const vector = file.type === "image/svg+xml";
  const w0 = img.naturalWidth || 512;
  const h0 = img.naturalHeight || 512;
  const k = vector ? MAX_IN / Math.max(w0, h0) : Math.min(1, MAX_IN / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const g = src.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const pic = g.getImageData(0, 0, w, h);
  const data = pic.data;

  const bg = [data[0], data[1], data[2]];
  const background: Background = data[3] <= 200 ? "none" : Math.min(...bg) >= 215 ? "light" : "colour";
  const cutting = background !== "none" && (cut ?? background === "light");
  if (cutting) {
    // Every pixel near the corner's colour, the holes in letters too (an "O", a "D"). On white the
    // badge looks the same either way (the circle is white); on a colour, that's what was asked for.
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] > 0 && Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) < 40) data[i + 3] = 0;
    g.putImageData(pic, 0, 0);
  }

  // Trimmed to what's left
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0)
    throw new Error(
      cutting
        ? "Nothing's left of the logo without its background. Untick “Take out the background”."
        : "That picture is empty. Choose another.",
    );
  const lw0 = x1 - x0 + 1;
  const lh0 = y1 - y0 + 1;

  // As big as fits in the circle: its diagonal FIT of the way across
  const s = (FIT * SIZE) / Math.hypot(lw0, lh0);
  const lw = lw0 * s;
  const lh = lh0 * s;
  const out = document.createElement("canvas");
  out.width = out.height = SIZE;
  const o = out.getContext("2d")!;
  o.fillStyle = "#fff";
  o.beginPath();
  o.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  o.fill();
  o.imageSmoothingQuality = "high";
  o.drawImage(src, x0, y0, lw0, lh0, (SIZE - lw) / 2, (SIZE - lh) / 2, lw, lh);
  // WebP, as the first badges are; a PNG where the browser can't make WebP
  const webp = out.toDataURL("image/webp", 0.9);
  const badge = webp.startsWith("data:image/webp") ? webp : out.toDataURL("image/png");
  return { badge, background, cut: cutting };
}

/** The chosen file as a picture, or what's wrong with it. */
async function open(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error("That file is over 20 MB. Choose a smaller logo.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("That file isn't a picture this browser can open. Use a PNG, JPG, WebP or SVG.");
  } finally {
    // (drawn straight away, so the address can go once it's decoded)
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
