/**
 * /api/admin/brain/deck-reads
 *
 * GET  [?deck_id=<id>]                                   → { rows }   (the signed-in admin's read receipts)
 * POST { deck_id, last_slide?, read?, content_hash? }    → { row }    (upsert on (user, deck))
 *   - read: true  marks the deck read at the given content_hash
 *   - read: false marks it unread (keeps last_slide)
 *   - last_slide alone records progress for resume
 *
 * Admin only (validateAdminApiRequest). brain_deck_reads has RLS on and no policies, so it
 * is reached only here and from the admin pages, with the service role, after the admin
 * check. Read receipts never go to brain_feedback, so pull-feedback.ts never sees them.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { SAFE_ID } from '@/lib/brain/archive';
import { DeckReadInputSchema, listDeckReads, upsertDeckRead } from '@/lib/brain/deck-reads';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const deckId = new URL(request.url).searchParams.get('deck_id') ?? undefined;
  if (deckId !== undefined && !SAFE_ID.test(deckId)) return NextResponse.json({ error: 'invalid deck_id' }, { status: 400 });

  const { data, error: fetchError } = await listDeckReads(supabaseAdmin, admin.id, deckId);
  if (fetchError) {
    console.error('[brain deck reads] list failed:', fetchError.message);
    return NextResponse.json({ error: 'Could not load read status' }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = DeckReadInputSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data, error: upsertError } = await upsertDeckRead(supabaseAdmin, parsed.data, admin.id);
  if (upsertError || !data) {
    console.error('[brain deck reads] upsert failed:', upsertError?.message);
    return NextResponse.json({ error: 'Could not save read status' }, { status: 500 });
  }
  return NextResponse.json({ row: data });
}
