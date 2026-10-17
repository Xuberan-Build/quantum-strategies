/**
 * /api/admin/brain/graph/node/<type>:<slug>
 *
 * GET → { node, outgoing, incoming, evidence, quotes, docHref }
 *   node: full row minus embedding; outgoing/incoming: edges with neighbour label/type
 *   (backlinks); evidence: corpus chunk excerpts (≤400 chars) behind evidences edges;
 *   quotes: top quotes by weight for problem nodes; docHref: the published brain doc.
 *
 * Catch-all segment so slugs holding slashes survive. Admin only; service role after
 * the check. Dev-only fixture fallback, as in the graph route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { isNodeId } from '@/lib/brain/graph';
import { loadNodeDetail } from '@/lib/brain/graph-data';
import { fixtureAllowed, fixtureNodeDetail } from '@/lib/brain/graph-fixture';
import { listBrainDocs } from '@/lib/brain/load';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string[] }> };

function decodeId(parts: string[]): string | null {
  try {
    return parts.map((p) => decodeURIComponent(p)).join('/');
  } catch {
    return null;
  }
}

async function docSlugForPath(path: string): Promise<string | null> {
  const { docs } = await listBrainDocs();
  const clean = path.replace(/^\/+/, '').replace(/^brain\//, '');
  return docs.find((d) => d.path === clean || d.path === path)?.slug ?? null;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id: parts } = await params;
  const id = decodeId(Array.isArray(parts) ? parts : [String(parts)]);
  if (!isNodeId(id)) return NextResponse.json({ error: 'Invalid node id' }, { status: 400 });

  try {
    const detail = await loadNodeDetail(supabaseAdmin, id, { docSlugForPath });
    if (!detail) {
      const fx = fixtureAllowed() ? fixtureNodeDetail(id) : null;
      if (fx) return NextResponse.json(fx);
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    console.error('[brain graph] node load failed:', err instanceof Error ? err.message : String(err));
    const fx = fixtureAllowed() ? fixtureNodeDetail(id) : null;
    if (fx) return NextResponse.json(fx);
    return NextResponse.json({ error: 'Could not load the node' }, { status: 500 });
  }
}
