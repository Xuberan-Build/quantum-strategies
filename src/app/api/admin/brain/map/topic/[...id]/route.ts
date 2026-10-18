/**
 * /api/admin/brain/map/topic/topic:<slug>
 *
 * GET → TopicScorecard { topic, breadcrumb, children, queries, problems (share + top
 *   quotes), claims (strength, similarity, evidence passages), evidence, assets,
 *   competitors (context), products (status, fit), queue { position, size } }.
 *
 * Catch-all segment so slugs holding slashes survive. Admin only, checked first.
 * Dev-only fixture fallback, as in the map route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { getTopic } from '@/lib/brain/topical-map';
import { fixtureAllowed, fixtureTopic } from '@/lib/brain/topical-map-fixture';
import { isTopicId } from '@/lib/brain/topical-map-view';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string[] }> };

function decodeId(parts: string[]): string | null {
  try {
    return parts.map((p) => decodeURIComponent(p)).join('/');
  } catch {
    return null;
  }
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id: parts } = await params;
  const id = decodeId(Array.isArray(parts) ? parts : [String(parts)]);
  if (!isTopicId(id)) return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 });

  try {
    const topic = await getTopic(id);
    if (topic) return NextResponse.json(topic);
    const fx = fixtureAllowed() ? fixtureTopic(id) : null;
    if (fx) return NextResponse.json(fx);
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  } catch (err) {
    console.error('[brain map] topic load failed:', err instanceof Error ? err.message : String(err));
    const fx = fixtureAllowed() ? fixtureTopic(id) : null;
    if (fx) return NextResponse.json(fx);
    return NextResponse.json({ error: 'Could not load the topic' }, { status: 500 });
  }
}
