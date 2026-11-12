import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { ASSET_KINDS, isOfferedTarget, makeAsset, MakeError } from '@/lib/content/any-to-any/make';
import type { AssetKind } from '@/lib/content/any-to-any/types';

// Video targets run generate → validate → repair; long scripts take a few minutes.
export const maxDuration = 300;

/**
 * POST /api/admin/content/make
 * { source: AssetRef, target: PieceType, insightId?, extraContext?, scheduledFor? }
 * → 201 { piece, linkId, warnings }
 */
export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const source = body.source as { kind?: unknown; id?: unknown } | undefined;
  if (!source || typeof source.id !== 'string' || !ASSET_KINDS.includes(source.kind as AssetKind)) {
    return NextResponse.json({ error: 'source { kind, id } is required' }, { status: 400 });
  }
  if (!isOfferedTarget(body.target)) {
    return NextResponse.json({ error: `target is not an offered form: ${String(body.target)}` }, { status: 400 });
  }
  const insightId = typeof body.insightId === 'string' && body.insightId ? body.insightId : null;
  const extraContext = typeof body.extraContext === 'string' ? body.extraContext.slice(0, 20000) : undefined;
  const scheduledFor =
    typeof body.scheduledFor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.scheduledFor) ? body.scheduledFor.slice(0, 10) : null;

  try {
    const result = await makeAsset(supabaseAdmin, {
      source: { kind: source.kind as AssetKind, id: source.id },
      target: body.target,
      insightId,
      createdBy: admin.id,
      extraContext,
      scheduledFor,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof MakeError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[content/make] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 502 });
  }
}
