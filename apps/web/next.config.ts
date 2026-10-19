import path from 'node:path';
import type { NextConfig } from 'next';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const config: NextConfig = {
  reactStrictMode: true,
  // Docker image: a self-contained server traced from the monorepo root.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Linting runs through `pnpm lint` (root flat config), not during the Next build.
  eslint: { ignoreDuringBuilds: true },
  // The browser always calls the same-origin /api. nginx routes it in production; this rewrite
  // does the same job for `pnpm dev`.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }];
  },
};

export default config;
