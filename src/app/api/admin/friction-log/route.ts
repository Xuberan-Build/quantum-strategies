/**
 * GET /api/admin/friction-log
 *
 * Admin list endpoint for step_friction_log. Returns rows ordered by
 * created_at DESC with optional filters and pagination.
 *
 * Manual verification:
 *
 * # All defaults (status=new,triaged, limit=100, offset=0)
 * curl "http://localhost:3000/api/admin/friction-log" \
 *   -H "Cookie: <admin-auth-cookie>"
 *
 * # Filter by status and product
 * curl "http://localhost:3000/api/admin/friction-log?status=new&product_slug=quantum-initiation&limit=25&offset=0" \
 *   -H "Cookie: <admin-auth-cookie>"
 *
 * # Multiple statuses (comma-separated)
 * curl "http://localhost:3000/api/admin/friction-log?status=new,triaged,resolved" \
 *   -H "Cookie: <admin-auth-cookie>"
 *
 * Expected 200: { "rows": [...], "total": <count> }
 * Expected 401: { "error": "Not authenticated" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const VALID_STATUSES = ['new', 'triaged', 'resolved', 'wont_fix'] as const;
const DEFAULT_STATUSES = ['new', 'triaged'];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(request.url);

  // Parse status filter (comma-separated, default 'new,triaged')
  const statusParam = searchParams.get('status');
  const requestedStatuses = statusParam
    ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_STATUSES;

  // Reject any unrecognised status values
  const invalidStatuses = requestedStatuses.filter(
    (s) => !(VALID_STATUSES as readonly string[]).includes(s)
  );
  if (invalidStatuses.length > 0) {
    return NextResponse.json(
      { error: `Invalid status value(s): ${invalidStatuses.join(', ')}. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  // Parse product_slug filter
  const productSlug = searchParams.get('product_slug') ?? null;

  // Parse pagination
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);

  const limit = isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  // Build query
  let query = supabaseAdmin
    .from('step_friction_log')
    .select('*', { count: 'exact' })
    .in('status', requestedStatuses)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (productSlug) {
    query = query.eq('product_slug', productSlug);
  }

  const { data, error: fetchError, count } = await query;

  if (fetchError) {
    console.error('[step-friction] Admin list error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch friction log' }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [], total: count ?? 0 });
}
