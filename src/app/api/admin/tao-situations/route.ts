import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

/**
 * GET /api/admin/tao-situations
 * List tao_situations rows with optional filters.
 *
 * Query params:
 *   - domain_id:  exact match
 *   - tier:       1 | 2 | 3
 *   - core_state: one of the CORE_STATES
 *   - active:     'true' | 'false' | 'all'
 */
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get('domain_id');
  const tierRaw = searchParams.get('tier');
  const coreState = searchParams.get('core_state');
  const activeParam = searchParams.get('active');

  let query = supabaseAdmin
    .from('tao_situations')
    .select('*')
    .order('domain_id', { ascending: true })
    .order('id', { ascending: true });

  if (domainId) {
    query = query.eq('domain_id', domainId);
  }
  if (tierRaw) {
    const tier = Number(tierRaw);
    if (!Number.isNaN(tier) && [1, 2, 3].includes(tier)) {
      query = query.eq('tier', tier);
    }
  }
  if (coreState) {
    query = query.eq('core_state', coreState);
  }
  if (activeParam === 'true') {
    query = query.eq('active', true);
  } else if (activeParam === 'false') {
    query = query.eq('active', false);
  }

  const { data, error: fetchError } = await query;
  if (fetchError) {
    console.error('[Admin API] tao_situations fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch tao situations' }, { status: 500 });
  }

  return NextResponse.json({ success: true, situations: data ?? [] });
}
