import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Local testing only: lets the browser call a local Apps Script emulator.
// Never set this on Vercel.
const extraConnect = process.env.EXTRA_CONNECT_SRC || '';

// The browser may only talk to this site and to Google Apps Script, which
// serves the ledger and the sign-up forms. script.google.com answers with a
// redirect to script.googleusercontent.com, so both are listed.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  `connect-src 'self' https://script.google.com https://script.googleusercontent.com ${extraConnect}`.trim(),
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(extraConnect ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  trailingSlash: false,
  // Without this, Next can pick a parent folder as the workspace root.
  turbopack: { root },

  async redirects() {
    return [
      // www is the main address, as it was on Squarespace.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'uchipokerclub.com' }],
        destination: 'https://www.uchipokerclub.com/:path*',
        permanent: true,
      },
      // The old Squarespace sitemap listed the home page as /home.
      { source: '/home', destination: '/', permanent: true },
    ];
  },

  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ];
    // The dev server needs eval for hot reload, so the CSP applies to production builds only.
    if (process.env.NODE_ENV === 'production') {
      security.push({ key: 'Content-Security-Policy', value: csp });
    }
    return [
      { source: '/:path*', headers: security },
      // The board tool is never indexed.
      { source: '/ledger/record', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
