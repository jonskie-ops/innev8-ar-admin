import "server-only";
import QRCode from "qrcode";
import { GAME_URL } from "./hunt";

/** The game's link as players see it: "innev8-ar-js.vercel.app" */
export const GAME_LINK = GAME_URL.replace(/^https?:\/\//, "");

/**
 * The game's link as a QR code: an SVG to show (dark on white, with its quiet zone) and a large PNG
 * to download (slides, screens, tarpaulins). Made from our own link only.
 */
export async function gameQr() {
  const look = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#030817", light: "#ffffff" } };
  const [svg, png] = await Promise.all([
    QRCode.toString(GAME_URL, { ...look, type: "svg" }),
    QRCode.toDataURL(GAME_URL, { ...look, width: 1200 }),
  ]);
  return { svg, png };
}
