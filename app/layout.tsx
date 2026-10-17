import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "QR Hunt Admin", template: "%s · QR Hunt Admin" },
  description: "For the organisers of the INNEV8 QR Code Hunt: QR codes, clues, prizes and the event.",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/img/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#030817",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH">
      <body>{children}</body>
    </html>
  );
}
