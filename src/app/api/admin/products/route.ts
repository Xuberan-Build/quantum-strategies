import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';
import { productSchema, productListQuerySchema } from '@/lib/admin/schemas/product';

/**
 * GET /api/admin/products
 * List all products with stats
 */
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();

  if (!admin) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queryResult = productListQuerySchema.safeParse({
    search: searchParams.get('search'),
    is_active: searchParams.get('is_active'),
    product_group: searchParams.get('product_group'),
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { search, is_active, product_group, limit, offset } = queryResult.data;

  // Build query
  let query = supabaseAdmin
    .from('product_definitions')
    .select('*', { count: 'exact' })
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,product_slug.ilike.%${search}%`);
  }

  if (is_active !== 'all') {
    query = query.eq('is_active', is_active === 'true');
  }

  if (product_group) {
    query = query.eq('product_group', product_group);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: products, error: dbError, count } = await query;

  if (dbError) {
    console.error('[Admin API] Products fetch error:', dbError);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }

  // Get session stats for each product
  const productSlugs = products?.map((p) => p.product_slug) || [];

  const { data: sessionStats } = await supabaseAdmin
    .from('product_sessions')
    .select('product_slug, is_complete')
    .in('product_slug', productSlugs);

  // Calculate stats per product
  const statsMap: Record<string, { total: number; completed: number }> = {};
  sessionStats?.forEach((session) => {
    if (!statsMap[session.product_slug]) {
      statsMap[session.product_slug] = { total: 0, completed: 0 };
    }
    statsMap[session.product_slug].total++;
    if (session.is_complete) {
      statsMap[session.product_slug].completed++;
    }
  });

  // Enrich products with stats
  const enrichedProducts = products?.map((product) => ({
    ...product,
    stats: {
      totalSessions: statsMap[product.product_slug]?.total || 0,
      completedSessions: statsMap[product.product_slug]?.completed || 0,
      completionRate:
        statsMap[product.product_slug]?.total > 0
          ? Math.round(
              (statsMap[product.product_slug].completed /
                statsMap[product.product_slug].total) *
                100
            )
          : 0,
    },
  }));

  return NextResponse.json({
    products: enrichedProducts,
    total: count,
    limit,
    offset,
  });
}

/**
 * POST /api/admin/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();

  if (!admin) {
    return NextResponse.json({ error }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = productSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const productData = result.data;

  // Check if slug already exists
  const { data: existing } = await supabaseAdmin
    .from('product_definitions')
    .select('id')
    .eq('product_slug', productData.product_slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'A product with this slug already exists' },
      { status: 409 }
    );
  }

  // Insert product
  const { data: product, error: insertError } = await supabaseAdmin
    .from('product_definitions')
    .insert({
      ...productData,
      total_steps: productData.steps.length,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Admin API] Product create error:', insertError);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }

  // Log admin action
  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'product_create',
    targetType: 'product',
    targetId: product.id,
    targetName: product.name,
    newValue: { product_slug: product.product_slug, name: product.name },
  });

  return NextResponse.json({ product }, { status: 201 });
}
