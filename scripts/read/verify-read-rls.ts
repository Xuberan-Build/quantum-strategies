/**
 * RLS check, run after migration 20261018100000_perception_read.sql is applied:
 * with the public anon key, the Read's private data must be unreadable and unwritable.
 * Writes nothing unless a check fails (the anon insert attempts must be refused).
 *
 *   npx tsx scripts/read/verify-read-rls.ts
 *
 * Exit 1 if anything is exposed. Prints counts and error codes only, never row contents.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase URL, anon key and service role key are required');
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const anon = createClient(url, anonKey, opts);
  const admin = createClient(url, serviceKey, opts);
  let failed = false;
  // PGRST205 (no such table) / PGRST202 (no such function) mean the migration isn't applied yet.
  const missing = (e: { code?: string } | null) => e?.code === 'PGRST205' || e?.code === 'PGRST202';
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`);
    if (!ok) failed = true;
  };

  for (const table of ['read_leads', 'product_events']) {
    const { data, error } = await anon.from(table).select('id').limit(1);
    check(`anon cannot read ${table}`, !missing(error) && (!!error || (data ?? []).length === 0), error ? `error ${error.code ?? ''} ${error.message}` : `${data?.length ?? 0} rows`);
    const ins = await anon.from(table).insert(table === 'read_leads' ? { email: 'rls-check@example.com' } : { product_slug: 'x', event: 'x' });
    check(`anon cannot insert ${table}`, !!ins.error && !missing(ins.error), ins.error ? `error ${ins.error.code ?? ''}` : 'insert succeeded');
  }

  const anonSessions = await anon.from('product_sessions').select('id').is('user_id', null).limit(5);
  check(
    'anon sees no anonymous product_sessions',
    !!anonSessions.error || (anonSessions.data ?? []).length === 0,
    anonSessions.error ? `error ${anonSessions.error.code ?? ''}` : `${anonSessions.data?.length ?? 0} rows`
  );
  const anyAnon = await anon.from('product_sessions').select('id').limit(5);
  check('anon sees no product_sessions at all', !!anyAnon.error || (anyAnon.data ?? []).length === 0, `${anyAnon.data?.length ?? 0} rows`);

  const rpc = await anon.rpc('read_save_answer', {
    p_session_id: '00000000-0000-4000-8000-000000000000',
    p_question_id: 'q1',
    p_answer: {},
    p_step: 1,
  });
  check('anon cannot call read_save_answer', !!rpc.error && !missing(rpc.error), rpc.error ? `error ${rpc.error.code ?? ''}` : 'call succeeded');

  const flags = await anon.from('product_definitions').select('product_slug, is_free, requires_auth, requires_chart, experience_kind').limit(1);
  check('anon can read the non-sensitive flag columns', !flags.error, flags.error ? flags.error.message : 'ok');

  const { count } = await admin.from('product_sessions').select('id', { count: 'exact', head: true }).is('user_id', null);
  console.log(`info  anonymous product_sessions in DB (service role count): ${count ?? 0}`);

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
