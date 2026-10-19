/**
 * Submit URLs to IndexNow (Bing, Yandex, Seznam, Naver and the other IndexNow engines; not Google).
 *
 * Usage (app repo root; INDEXNOW_KEY set, the key file live at https://quantumstrategies.online/<key>.txt):
 *   npx tsx scripts/seo/indexnow-submit.ts --sitemap              every sitemap URL that changed since its last
 *                                                                 accepted submission (all of them the first time)
 *   npx tsx scripts/seo/indexnow-submit.ts --urls https://quantumstrategies.online/articles/x/ [more ...]
 *   add --dry-run to print what would go out, --force to resubmit unchanged URLs (the 10-minute guard still holds)
 *
 * Logs each URL to indexnow_submissions when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 * Generate a key once with: openssl rand -hex 16
 */
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { INDEXNOW_HOST, indexNowKey, keyLocation, lastAcceptedSubmissions, sameHostUrls, selectChanged, submitToIndexNow, type ChangedCandidate } from '../../src/lib/seo/indexnow';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // fallback

const argv = process.argv.slice(2);

/** Every <url> in the live sitemap, with its <lastmod> when there is one. */
async function sitemapUrls(): Promise<ChangedCandidate[]> {
  const res = await fetch(`https://${INDEXNOW_HOST}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap(([, block]) => {
    const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];
    return loc ? [{ url: loc, lastModified: block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1] ?? null }] : [];
  });
}
const has = (f: string) => argv.includes(f);

async function main() {
  const key = indexNowKey();
  if (!key) throw new Error('INDEXNOW_KEY is missing or invalid (8-128 of a-z A-Z 0-9 -). Generate one: openssl rand -hex 16');

  let candidates: ChangedCandidate[];
  if (has('--sitemap')) candidates = await sitemapUrls();
  else if (has('--urls')) candidates = argv.slice(argv.indexOf('--urls') + 1).filter((a) => !a.startsWith('--')).map((url) => ({ url, lastModified: new Date() }));
  else throw new Error('Pass --sitemap or --urls <url ...>');

  const urls = sameHostUrls(candidates.map((c) => c.url));
  const byUrl = new Map(candidates.map((c) => [c.url, c]));
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = sbUrl && sbKey ? createClient(sbUrl, sbKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  if (!client) console.error('No Supabase env: submissions will not be logged and nothing is filtered by history.');

  const last = client
    ? await lastAcceptedSubmissions(client, urls).catch((err) => {
        console.error(`Submission history unavailable (${err instanceof Error ? err.message : err}); treating every URL as new.`);
        return new Map<string, string>();
      })
    : new Map<string, string>();
  const fresh = selectChanged(urls.map((u) => byUrl.get(u) ?? { url: u }), last, { force: has('--force') });
  console.error(`${urls.length} URLs, ${fresh.length} changed since their last accepted submission. Key file: ${keyLocation(key)}`);
  if (!fresh.length) return;
  if (has('--dry-run')) {
    for (const u of fresh) console.log(u);
    return;
  }

  // the key file must be live, or every engine rejects the batch (403)
  const probe = await fetch(keyLocation(key)).catch(() => null);
  const body = probe?.ok ? (await probe.text()).trim() : null;
  if (body !== key) throw new Error(`${keyLocation(key)} does not serve the key yet (HTTP ${probe?.status ?? 'error'}). Deploy with INDEXNOW_KEY set first.`);

  const res = await submitToIndexNow(fresh, { key, client, trigger: 'script' });
  console.log(JSON.stringify(res, null, 2));
  if (res.batches.some((b) => !b.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
