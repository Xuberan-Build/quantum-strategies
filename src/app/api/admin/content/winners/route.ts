import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin, serverError } from '@/lib/social/api';
import { findWinners } from '@/lib/content/any-to-any/winners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/content/winners?days=7&baseline=90 → { winners, thinGroups, medians, sinceDays, baselineDays, multiple } */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const sp = req.nextUrl.searchParams;
  const days = clamp(Number(sp.get('days') ?? 7), 1, 90, 7);
  const baseline = clamp(Number(sp.get('baseline') ?? 90), days, 365, 90);
  try {
    return NextResponse.json(await findWinners(supabaseAdmin, { sinceDays: days, baselineDays: baseline }));
  } catch (err) {
    return serverError('winners', err);
  }
}

function clamp(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
