import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Let other devices on the LAN load dev scripts (http://192.168.1.88:3400)
  allowedDevOrigins: ["192.168.1.88"],
  experimental: {
    // Prize photos: up to 5 MB, plus the form around them
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Never inside another site's frame (no click-jacking), never in search results
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          // Location and the camera for the admin's own pages only: setting a code's spot from the
          // phone's GPS, the Map page's "Show me", and reading prize cards' QRs at the prize desk
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
