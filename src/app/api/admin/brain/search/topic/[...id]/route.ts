/**
 * /api/admin/brain/search/topic/topic:<slug>
 *
 * GET -> TopicSearchPerformance { period, headTerm { text, volume, position, clicks, impressions },
 *   clicks, impressions, position, topQueries } for the last 28 days with Search Console data.
 * Used by the topical map's topic panel. Admin only. 204 when Search Console has no data or tables yet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { isTopicId } from '@/lib/brain/topical-map-types';
import { loadTopicSearchPerformance } from '@/lib/seo/search-report';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string[] }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id: parts } = await params;
  let id: string | null = null;
  try {
    id = (Array.isArray(parts) ? parts : [String(parts)]).map((p) => decodeURIComponent(p)).join('/');
  } catch {
    id = null;
  }
  if (!isTopicId(id)) return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 });

  try {
    const perf = await loadTopicSearchPerformance(id);
    if (!perf.period) return new NextResponse(null, { status: 204 });
    return NextResponse.json(perf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // tables not migrated yet: nothing to show, not an error for the panel
    if (/does not exist|schema cache|Could not find the function/i.test(message)) return new NextResponse(null, { status: 204 });
    console.error('[brain search] topic load failed:', message);
    return NextResponse.json({ error: 'Could not load search performance' }, { status: 500 });
  }
}
