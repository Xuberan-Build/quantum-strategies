/**
 * /api/admin/brain/graph/gaps
 *
 * GET → { rows: [{ kind, node_id, label, detail }], available }
 *
 * Calls kg_gaps() when it exists; `available: false` with no rows when it does not.
 * Admin only; service role after the check. In development, when the graph tables
 * themselves are unreadable, serves the fixture's gaps so the view can be built.
 */
import { NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { graphTablesReachable, loadGaps } from '@/lib/brain/graph-data';
import { fixtureAllowed, fixtureGaps } from '@/lib/brain/graph-fixture';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  try {
    const gaps = await loadGaps(supabaseAdmin);
    if (!gaps.available && fixtureAllowed() && !(await graphTablesReachable(supabaseAdmin))) {
      return NextResponse.json({ rows: fixtureGaps(), available: true, fixture: true });
    }
    return NextResponse.json(gaps);
  } catch (err) {
    console.error('[brain graph] gaps failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ rows: [], available: false });
  }
}
