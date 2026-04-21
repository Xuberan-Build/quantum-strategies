import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

/**
 * POST /api/admin/products/[slug]/toggle
 * Toggle product is_active status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();

  if (!admin) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { slug } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { is_active } = body;

  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
  }

  // Get current product state for audit log
  const { data: currentProduct, error: fetchError } = await supabaseAdmin
    .from('product_definitions')
    .select('id, name, is_active')
    .eq('product_slug', slug)
    .single();

  if (fetchError || !currentProduct) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Update product
  const { error: updateError } = await supabaseAdmin
    .from('product_definitions')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('product_slug', slug);

  if (updateError) {
    console.error('[Admin API] Product toggle error:', updateError);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }

  // Log admin action
  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'product_update',
    targetType: 'product',
    targetId: currentProduct.id,
    targetName: currentProduct.name,
    previousValue: { is_active: currentProduct.is_active },
    newValue: { is_active },
  });

  return NextResponse.json({
    success: true,
    product_slug: slug,
    is_active,
  });
}
