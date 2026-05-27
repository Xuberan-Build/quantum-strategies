import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { SECTION_NAMES, type PortraitSection } from '@/lib/portraits/schema';

interface UserPortraitRow {
  user_id: string;
  sections: Record<string, PortraitSection | undefined> | null;
  opt_out: boolean;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  products_completed: string[] | null;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  portrait_opt_out: boolean | null;
}

interface PortraitListRow {
  user_id: string;
  email: string;
  created_at: string;
  has_portrait: boolean;
  opt_out: boolean;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  sections_with_current: number;
  products_completed_count: number;
}

/**
 * GET /api/admin/portraits
 *
 * Query params:
 *   opt_out         = 'yes' | 'no' | 'all'   (default 'all')
 *   has_portrait    = 'yes' | 'no' | 'all'   (default 'all')
 *   recent_days     = '7' | '30' | '90'      (filter by last_extracted_at)
 *   email           = substring search on users.email
 *
 * Returns:
 *   { success: true, portraits: PortraitListRow[] }
 */
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const optOutParam = (searchParams.get('opt_out') ?? 'all').toLowerCase();
  const hasPortraitParam = (searchParams.get('has_portrait') ?? 'all').toLowerCase();
  const recentDaysParam = searchParams.get('recent_days');
  const emailQuery = searchParams.get('email')?.trim() ?? '';

  let usersQuery = supabaseAdmin
    .from('users')
    .select('id, email, created_at, portrait_opt_out')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (emailQuery) {
    usersQuery = usersQuery.ilike('email', `%${emailQuery}%`);
  }

  const [{ data: portraits, error: portraitsError }, { data: users, error: usersError }] =
    await Promise.all([
      supabaseAdmin
        .from('user_portraits')
        .select('user_id, sections, opt_out, last_extracted_at, last_reviewed_at, products_completed')
        .order('last_extracted_at', { ascending: false, nullsFirst: false })
        .limit(2000),
      usersQuery,
    ]);

  if (portraitsError) {
    console.error('[Admin API] user_portraits fetch error:', portraitsError);
    return NextResponse.json({ error: 'Failed to fetch portraits' }, { status: 500 });
  }
  if (usersError) {
    console.error('[Admin API] users fetch error:', usersError);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  const portraitsByUserId = new Map<string, UserPortraitRow>();
  (portraits ?? []).forEach((p) => {
    portraitsByUserId.set(p.user_id, p as UserPortraitRow);
  });

  const now = Date.now();
  const recentDays = recentDaysParam ? Number(recentDaysParam) : null;

  const rows: PortraitListRow[] = ((users ?? []) as UserRow[])
    .map((u) => {
      const portrait = portraitsByUserId.get(u.id);
      let sectionsWithCurrent = 0;
      if (portrait?.sections) {
        for (const name of SECTION_NAMES) {
          if (portrait.sections[name]?.current) sectionsWithCurrent += 1;
        }
      }
      return {
        user_id: u.id,
        email: u.email,
        created_at: u.created_at,
        has_portrait: !!portrait,
        opt_out: !!(portrait?.opt_out ?? u.portrait_opt_out),
        last_extracted_at: portrait?.last_extracted_at ?? null,
        last_reviewed_at: portrait?.last_reviewed_at ?? null,
        sections_with_current: sectionsWithCurrent,
        products_completed_count: portrait?.products_completed?.length ?? 0,
      };
    })
    .filter((r) => {
      if (optOutParam === 'yes' && !r.opt_out) return false;
      if (optOutParam === 'no' && r.opt_out) return false;
      if (hasPortraitParam === 'yes' && !r.has_portrait) return false;
      if (hasPortraitParam === 'no' && r.has_portrait) return false;
      if (recentDays && Number.isFinite(recentDays)) {
        if (!r.last_extracted_at) return false;
        const age = now - new Date(r.last_extracted_at).getTime();
        if (age > recentDays * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });

  rows.sort((a, b) => {
    if (a.has_portrait && !b.has_portrait) return -1;
    if (!a.has_portrait && b.has_portrait) return 1;
    const aT = a.last_extracted_at ? new Date(a.last_extracted_at).getTime() : 0;
    const bT = b.last_extracted_at ? new Date(b.last_extracted_at).getTime() : 0;
    return bT - aT;
  });

  return NextResponse.json({ success: true, portraits: rows });
}
