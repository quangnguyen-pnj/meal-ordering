import path from 'node:path';
import type { NextConfig } from 'next';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const config: NextConfig = {
  allowedDevOrigins: ['10.3.1.137'],
  reactStrictMode: true,
  // Docker image only (NEXT_OUTPUT=standalone): a self-contained server traced from the monorepo
  // root. Off by default because tracing creates symlinks, which plain Windows accounts cannot.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Linting runs through `pnpm lint` (root flat config), not during the Next build.
  eslint: { ignoreDuringBuilds: true },
  // The browser always calls the same-origin /api. nginx routes it in production; this rewrite
  // does the same job for `pnpm dev`.
  // Security review 2026-10-24: no framing of the sign-in page (clickjacking), no MIME sniffing,
  // and no full URL sent to other sites.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }];
  },
};

export default config;
