import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origin of the NANDA Index API the browser talks to (baked in at build). */
function apiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_NANDA_INDEX_API_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

// Google Analytics 4 via @next/third-parties: gtag.js comes from
// googletagmanager.com and beacons go to the regional GA collectors.
const GA_SCRIPT = "https://www.googletagmanager.com";
const GA_COLLECT = ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"];

function contentSecurityPolicy(): string {
  const api = apiOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline': Next streams its RSC payload and the GA bootstrap as
    // inline <script>s. A nonce would avoid this but forces every page to be
    // rendered per request (no static pages), which isn't worth it for a site
    // that renders no user HTML. 'unsafe-eval' is only needed by dev's HMR.
    "script-src": ["'self'", "'unsafe-inline'", GA_SCRIPT, ...(isDev ? ["'unsafe-eval'"] : [])],
    // React and Next set inline style attributes; fonts are self-hosted by next/font.
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:", ...GA_COLLECT],
    // The Resolve page and the dashboard walk registrant-owned URLs from the
    // browser (registry → agent card → runtime), so any https origin must be
    // reachable; those requests are still subject to CORS. Plain http is
    // blocked as mixed content on the https site anyway.
    "connect-src": ["'self'", ...(api ? [api] : []), "https:", ...GA_COLLECT, ...(isDev ? ["ws:"] : [])],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

// Scoped to the Next app only: Caddy routes /demo/* to the separate concierge
// service before it reaches Next, so these never apply to the demo page.
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  // Legacy equivalent of frame-ancestors 'none' for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
