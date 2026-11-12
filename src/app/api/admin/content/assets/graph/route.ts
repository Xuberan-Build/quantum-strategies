import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, requireAdmin, serverError } from '@/lib/social/api';
import { assetGraph, GraphValidationError } from '@/lib/content/any-to-any/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET ?kind=&id= → AssetGraph { asset, parents, children, insight } */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const sp = req.nextUrl.searchParams;
  try {
    const graph = await assetGraph(supabaseAdmin, { kind: sp.get('kind') as never, id: sp.get('id') ?? '' });
    return NextResponse.json(graph);
  } catch (err) {
    if (err instanceof GraphValidationError) return jsonError(err.message, 400);
    return serverError('asset graph', err);
  }
}
