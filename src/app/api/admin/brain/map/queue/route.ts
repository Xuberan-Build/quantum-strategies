/**
 * /api/admin/brain/map/queue?limit=20
 *
 * GET → { items: [{ id, label, pillarCode, priority, demand, proof, coverage, status, topQueries }] }
 *   The ordered "make next" list (topical_map_queue()). limit is clamped to 1..100.
 *
 * Admin only, checked first. Dev-only fixture fallback, as in the map route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getTopicalQueue } from '@/lib/brain/topical-map';
import { fixtureAllowed, fixtureQueue } from '@/lib/brain/topical-map-fixture';
import { parseQueueLimit } from '@/lib/brain/topical-map-view';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const limit = parseQueueLimit(new URL(request.url).searchParams.get('limit'));
  try {
    return NextResponse.json({ items: await getTopicalQueue(limit) });
  } catch (err) {
    console.error('[brain map] queue load failed:', err instanceof Error ? err.message : String(err));
    if (fixtureAllowed()) return NextResponse.json({ items: fixtureQueue(limit), fixture: true });
    return NextResponse.json({ error: 'Could not load the queue', items: [] }, { status: 500 });
  }
}
