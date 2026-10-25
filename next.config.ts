import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Builds Content Security Policy directives tailored for Next.js 16, Cloudinary,
 * Google OAuth, and CRM previews.
 *
 * In production (NODE_ENV === "production"), 'unsafe-eval' is excluded to eliminate
 * unnecessary DOM-XSS evaluation vectors.
 * In development (NODE_ENV !== "production"), 'unsafe-eval' is retained for
 * Turbopack / Webpack Fast Refresh, HMR, and source-map evaluation tooling.
 */
export function buildCspDirectives(isProd = process.env.NODE_ENV === "production"): string {
  const scriptSrcDirectives = ["'self'", "'unsafe-inline'"];
  if (!isProd) {
    scriptSrcDirectives.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrcDirectives.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join("; ");
}

export const cspDirectives = buildCspDirectives(isProduction);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const isEnforced = process.env.ENFORCE_CSP === "true";
    const activeDirectives = buildCspDirectives(isProd);

    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: isEnforced
          ? "Content-Security-Policy"
          : "Content-Security-Policy-Report-Only",
        value: activeDirectives,
      },
    ];

    // HSTS is strictly configured with max-age=31536000 only in production
    // includeSubDomains and preload are intentionally omitted until all subdomains are verified HTTPS-ready
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

