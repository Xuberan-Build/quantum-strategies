/**
 * Live SEO audit: fetches a sitemap and every URL in it, then reports
 * status, redirect target, canonical, robots meta, <h1> count and word count.
 * Also checks that the non-trailing-slash form of each URL 308s to the
 * trailing-slash form, and spot-checks extra URLs (e.g. /contact/).
 *
 * Usage:
 *   npx tsx scripts/seo/audit-live.ts
 *   npx tsx scripts/seo/audit-live.ts --base http://localhost:3999
 *   npx tsx scripts/seo/audit-live.ts --base http://localhost:3999 --json out.json
 *
 * --base rewrites the sitemap's origin (https://quantumstrategies.online) to the
 * given origin, so the production sitemap shape can be audited against a local
 * `next start`. Exit code is 1 when any problem is found.
 */
import fs from "fs";

const PROD_ORIGIN = "https://quantumstrategies.online";

type Row = {
  url: string;
  status: number;
  location: string | null;
  canonical: string | null;
  robots: string | null;
  h1: number;
  words: number;
  description: boolean;
  slashlessStatus: number | null;
  slashlessLocation: string | null;
  problems: string[];
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const base = (arg("--base") ?? PROD_ORIGIN).replace(/\/+$/, "");
const jsonOut = arg("--json");
const extra = (arg("--extra") ?? "/contact/,/articles/_pillar/,/products/[slug]/")
  .split(",")
  .filter(Boolean);

function toBase(url: string): string {
  return url.startsWith(PROD_ORIGIN) ? base + url.slice(PROD_ORIGIN.length) : url;
}

async function get(url: string): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "qs-seo-audit/1.0" } });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function findMeta(html: string, key: string, keyAttr: "name" | "rel"): string | null {
  const tagName = keyAttr === "rel" ? "link" : "meta";
  const valueAttr = keyAttr === "rel" ? "href" : "content";
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
  for (const t of tags) {
    if ((attr(t, keyAttr) ?? "").toLowerCase() === key) return attr(t, valueAttr);
  }
  return null;
}

function wordCount(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

async function auditUrl(sitemapUrl: string, inSitemap: boolean): Promise<Row> {
  const url = toBase(sitemapUrl);
  const problems: string[] = [];
  const r = await get(url);
  const html = r.body;
  const canonical = html ? findMeta(html, "canonical", "rel") : null;
  const robots = html ? findMeta(html, "robots", "name") : null;
  const description = html ? !!findMeta(html, "description", "name") : false;
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  const words = html ? wordCount(html) : 0;

  let slashlessStatus: number | null = null;
  let slashlessLocation: string | null = null;
  const path = new URL(url).pathname;
  if (path !== "/" && path.endsWith("/")) {
    const s = await get(url.replace(/\/$/, ""));
    slashlessStatus = s.status;
    slashlessLocation = s.location;
  }

  if (inSitemap) {
    if (r.status !== 200) problems.push(`status ${r.status}`);
    if (sitemapUrl.includes("[")) problems.push("placeholder in URL");
    if (/\/_/.test(new URL(sitemapUrl).pathname)) problems.push("underscore path");
    if (!sitemapUrl.endsWith("/")) problems.push("no trailing slash");
    if (r.status === 200) {
      if (canonical !== sitemapUrl) problems.push(`canonical mismatch (${canonical ?? "none"})`);
      if (robots && /noindex/i.test(robots)) problems.push("noindex in sitemap");
      if (h1 !== 1) problems.push(`${h1} h1`);
      if (!description) problems.push("no meta description");
    }
    if (slashlessStatus !== null) {
      const expected = new URL(url).pathname;
      const loc = slashlessLocation ? new URL(slashlessLocation, url).pathname : null;
      if (slashlessStatus !== 308 || loc !== expected) {
        problems.push(`slashless form -> ${slashlessStatus}${slashlessLocation ? ` ${slashlessLocation}` : ""}`);
      }
    }
  }

  return {
    url: sitemapUrl,
    status: r.status,
    location: r.location,
    canonical,
    robots,
    h1,
    words,
    description,
    slashlessStatus,
    slashlessLocation,
    problems,
  };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function main() {
  const sitemapRes = await fetch(`${base}/sitemap.xml`);
  if (!sitemapRes.ok) throw new Error(`sitemap ${sitemapRes.status}`);
  const xml = await sitemapRes.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  const distinctLastmod = new Set(lastmods).size;

  console.log(`Sitemap: ${base}/sitemap.xml`);
  console.log(`URLs: ${urls.length}, lastmod entries: ${lastmods.length} (${distinctLastmod} distinct)\n`);

  const rows = await pool(urls, 6, (u) => auditUrl(u, true));
  const extraRows = await pool(extra, 3, (p) => auditUrl(`${PROD_ORIGIN}${p}`, false));

  const short = (u: string) => u.replace(PROD_ORIGIN, "") || "/";
  console.log("status  h1  words  robots              slashless  url");
  for (const r of rows) {
    console.log(
      `${String(r.status).padEnd(6)}  ${String(r.h1).padEnd(2)}  ${String(r.words).padEnd(5)}  ${(r.robots ?? "-").padEnd(18).slice(0, 18)}  ${String(r.slashlessStatus ?? "-").padEnd(9)}  ${short(r.url)}${r.problems.length ? `  !! ${r.problems.join("; ")}` : ""}`,
    );
  }

  console.log("\nExtra URLs (not expected in sitemap):");
  for (const r of extraRows) {
    console.log(`${String(r.status).padEnd(6)}  robots=${r.robots ?? "-"}  ${short(r.url)}${r.location ? ` -> ${r.location}` : ""}`);
  }

  const bad = rows.filter((r) => r.problems.length);
  const sitemapLevel: string[] = [];
  if (lastmods.length > 1 && distinctLastmod === 1) sitemapLevel.push("every <lastmod> is identical");
  console.log(`\nSummary: ${rows.length} URLs, ${bad.length} with problems${sitemapLevel.length ? `; ${sitemapLevel.join("; ")}` : ""}`);
  const counts: Record<string, number> = {};
  for (const r of bad) for (const p of r.problems) {
    const k = p.replace(/\(.*\)|-> .*/, "").trim();
    counts[k] = (counts[k] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(counts)) console.log(`  ${v} x ${k}`);

  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ base, rows, extraRows }, null, 2));
  process.exit(bad.length || sitemapLevel.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
