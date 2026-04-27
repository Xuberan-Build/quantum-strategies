import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "i.ibb.co" }],
  },
  trailingSlash: true,
  pageExtensions: ["js","jsx","ts","tsx","md","mdx"],
  typedRoutes: false,

  // Skip trailing slash redirects for API routes (fixes Stripe webhook 308 errors)
  skipTrailingSlashRedirect: true,

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
