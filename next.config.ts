import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "i.ibb.co" }],
  },
  trailingSlash: true,
  pageExtensions: ["js","jsx","ts","tsx"],
  typedRoutes: false,

  // Skip trailing slash redirects for API routes (fixes Stripe webhook 308 errors)
  skipTrailingSlashRedirect: true,

  // IndexNow key file: /<INDEXNOW_KEY>.txt answers with the key (src/app/api/indexnow-key/route.ts).
  // Read at build time; Vercel has the env var during the build. Nothing is added when it is unset.
  async rewrites() {
    const key = process.env.INDEXNOW_KEY?.trim();
    if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) return [];
    return [{ source: `/${key}.txt`, destination: "/api/indexnow-key" }];
  },

  async redirects() {
    return [
      // www → non-www canonical redirect
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.quantumstrategies.online' }],
        destination: 'https://quantumstrategies.online/:path*',
        permanent: true,
      },
      // Redirects for renamed product slugs
      {
        source: '/products/quantum-initiation/:path*',
        destination: '/products/business-alignment/:path*',
        permanent: true,
      },
    ];
  },
};

export default config;
