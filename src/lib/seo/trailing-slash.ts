/**
 * next.config.ts sets `skipTrailingSlashRedirect: true` so Stripe webhook POSTs
 * to /api/* are not answered with a 308. That flag also switches off Next's own
 * `/page -> /page/` redirect, so every page answered 200 on both forms and
 * Google saw duplicates. The middleware calls this to put the redirect back for
 * page navigations only.
 *
 * Returns the trailing-slash pathname to 308 to, or null to leave the request alone.
 */
export function trailingSlashTarget(pathname: string, method: string): string | null {
  if (method !== "GET" && method !== "HEAD") return null;
  if (pathname === "/" || pathname.endsWith("/")) return null;
  if (pathname.startsWith("/api/") || pathname === "/api") return null;
  if (pathname.startsWith("/_next/")) return null;
  if (pathname.startsWith("/.well-known/")) return null;
  // Files (sitemap.xml, robots.txt, llms.txt, images, ...) keep their exact path.
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (last.includes(".")) return null;
  return `${pathname}/`;
}
