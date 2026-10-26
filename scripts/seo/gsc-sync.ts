/**
 * Google Search Console -> Supabase (gsc_search_analytics, gsc_url_inspection, topic maps).
 *
 * Usage (app repo root; needs GSC_SITE_URL, service account env (see src/lib/seo/gsc.ts),
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
 *   npx tsx scripts/seo/gsc-sync.ts                      daily: last 5 complete days + 100 URL inspections
 *   npx tsx scripts/seo/gsc-sync.ts --backfill           16 months (Google's retention)
 *   npx tsx scripts/seo/gsc-sync.ts --backfill --months 3
 *   npx tsx scripts/seo/gsc-sync.ts --days 7 --inspect 0 --dry-run    fetch and count, write nothing
 *   npx tsx scripts/seo/gsc-sync.ts --sites              list the properties the service account can see
 *   npx tsx scripts/seo/gsc-sync.ts --country --device   split query rows by country and device too
 *
 * The daily run also happens on Vercel at /api/cron/gsc-sync (vercel.json).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createGscApi, gscConfigFromEnv, GSC_SCOPE } from '../../src/lib/seo/gsc';
import { runGscSync } from '../../src/lib/seo/gsc-sync';

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

async function listSites(clientEmail: string, privateKey: string) {
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: [GSC_SCOPE] });
  const res = await google.searchconsole({ version: 'v1', auth }).sites.list();
  const sites = res.data.siteEntry ?? [];
  if (!sites.length) console.log(`No properties visible to ${clientEmail}. Add it in Search Console > Settings > Users and permissions.`);
  for (const s of sites) console.log(`${s.siteUrl}  (${s.permissionLevel})`);
}

async function main() {
  const cfg = gscConfigFromEnv(process.env, (p) => readFileSync(p, 'utf8'));
  if (!cfg.credentials) throw new Error('No Search Console credentials: set GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY (or GSC_SERVICE_ACCOUNT_FILE).');
  console.error(`service account: ${cfg.credentials.clientEmail} (from ${cfg.credentialSource})`);
  if (has('--sites')) return listSites(cfg.credentials.clientEmail, cfg.credentials.privateKey);
  if (!cfg.siteUrl) throw new Error('GSC_SITE_URL is missing or invalid (e.g. "sc-domain:quantumstrategies.online" or "https://quantumstrategies.online/").');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const extra = [has('--country') ? 'country' : null, has('--device') ? 'device' : null].filter(Boolean) as ('country' | 'device')[];
  const result = await runGscSync({
    client,
    api: await createGscApi(cfg.credentials),
    siteUrl: cfg.siteUrl,
    mode: has('--backfill') ? 'backfill' : 'daily',
    days: val('--days') ? Number(val('--days')) : undefined,
    months: val('--months') ? Number(val('--months')) : undefined,
    inspectBudget: val('--inspect') !== undefined ? Number(val('--inspect')) : undefined,
    extraDimensions: extra,
    dryRun: has('--dry-run'),
    log: (m) => console.error(m),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
