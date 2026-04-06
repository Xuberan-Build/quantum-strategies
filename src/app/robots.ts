import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/dashboard/",
          "/ledger/",
          "/onboarding/",
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/products/*/experience",
          "/products/*/interact",
        ],
      },
    ],
    sitemap: "https://quantumstrategies.online/sitemap.xml",
  };
}
