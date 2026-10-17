/**
 * /api/admin/brain/graph
 *
 * GET ?types=a,b&edgeTypes=x,y&minWeight=0.2&limit=5000
 *   → { nodes: [{ id, type, label, weight, tier, degree }], edges: [{ src, dst, type, weight }], truncated }
 *
 * Admin only (validateAdminApiRequest); kg_nodes / kg_edges are service-role only and
 * reached here after the check. In development only, a synthetic fixture is served when
 * the tables cannot be read, flagged `fixture: true`. Production returns the error.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { parseGraphQuery } from '@/lib/brain/graph';
import { loadGraph } from '@/lib/brain/graph-data';
import { fixtureAllowed, fixtureGraph } from '@/lib/brain/graph-fixture';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const query = parseGraphQuery(new URL(request.url).searchParams);
  try {
    const graph = await loadGraph(supabaseAdmin, query);
    return NextResponse.json(graph);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[brain graph] load failed:', message);
    if (fixtureAllowed()) return NextResponse.json({ ...fixtureGraph(), error: 'Knowledge graph tables unavailable; showing the dev fixture.' });
    return NextResponse.json({ error: 'Could not load the knowledge graph', nodes: [], edges: [] }, { status: 500 });
  }
}
