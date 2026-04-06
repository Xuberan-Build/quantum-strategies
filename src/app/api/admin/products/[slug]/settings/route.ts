import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

/**
 * GET /api/admin/products/[slug]/settings
 * Retrieve current product settings
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();

  if (!admin) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { slug } = await params;

  const { data: product, error: fetchError } = await supabaseAdmin
    .from('product_definitions')
    .select('id, product_slug, name, description, price, estimated_duration, is_active, is_purchasable, model, steps, system_prompt, final_deliverable_prompt, total_steps, updated_at')
    .eq('product_slug', slug)
    .single();

  if (fetchError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    product,
  });
}

/**
 * PUT /api/admin/products/[slug]/settings
 * Update product settings including steps configuration
 */
export async function PUT(
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

  const { is_active, is_purchasable, model, steps, system_prompt, final_deliverable_prompt, name, description, price, estimated_duration } = body;

  // Get current product state for audit log
  const { data: currentProduct, error: fetchError } = await supabaseAdmin
    .from('product_definitions')
    .select('id, name, is_active, is_purchasable, model, steps')
    .eq('product_slug', slug)
    .single();

  if (fetchError || !currentProduct) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof is_active === 'boolean') {
    updateData.is_active = is_active;
  }

  if (typeof is_purchasable === 'boolean') {
    updateData.is_purchasable = is_purchasable;
  }

  if (typeof model === 'string') {
    updateData.model = model;
  }

  if (Array.isArray(steps)) {
    updateData.steps = steps;
    updateData.total_steps = steps.length;
  }

  if (typeof system_prompt === 'string') {
    updateData.system_prompt = system_prompt;
  }

  if (typeof final_deliverable_prompt === 'string') {
    updateData.final_deliverable_prompt = final_deliverable_prompt;
  }

  if (typeof name === 'string' && name.trim()) {
    updateData.name = name.trim();
  }

  if (typeof description === 'string') {
    updateData.description = description.trim() || null;
  }

  if (typeof price === 'number' || price === null) {
    updateData.price = price;
  }

  if (typeof estimated_duration === 'string') {
    updateData.estimated_duration = estimated_duration.trim() || null;
  }

  // Update product
  const { error: updateError } = await supabaseAdmin
    .from('product_definitions')
    .update(updateData)
    .eq('product_slug', slug);

  if (updateError) {
    console.error('[Admin API] Product settings update error:', updateError);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }

  // Log admin action with changes
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (typeof is_active === 'boolean' && is_active !== currentProduct.is_active) {
    changes.is_active = { from: currentProduct.is_active, to: is_active };
  }
  if (typeof is_purchasable === 'boolean' && is_purchasable !== currentProduct.is_purchasable) {
    changes.is_purchasable = { from: currentProduct.is_purchasable, to: is_purchasable };
  }
  if (typeof model === 'string' && model !== currentProduct.model) {
    changes.model = { from: currentProduct.model, to: model };
  }
  if (Array.isArray(steps)) {
    changes.steps = { from: 'previous', to: 'updated' }; // Don't log full steps (too large)
  }
  if (typeof system_prompt === 'string') {
    changes.system_prompt = { from: 'previous', to: 'updated' };
  }
  if (typeof final_deliverable_prompt === 'string') {
    changes.final_deliverable_prompt = { from: 'previous', to: 'updated' };
  }

  if (Object.keys(changes).length > 0) {
    await logAdminAction({
      adminUserId: admin.id,
      adminEmail: admin.email,
      actionType: 'product_update',
      targetType: 'product',
      targetId: currentProduct.id,
      targetName: currentProduct.name,
      previousValue: {
        is_active: currentProduct.is_active,
        is_purchasable: currentProduct.is_purchasable,
        model: currentProduct.model,
      },
      newValue: changes,
    });
  }

  return NextResponse.json({
    success: true,
    product_slug: slug,
    updated: Object.keys(updateData),
  });
}
