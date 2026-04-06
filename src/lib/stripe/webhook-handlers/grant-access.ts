/**
 * Webhook Handler: Grant Product Access
 *
 * Creates/finds the user record and inserts product_access rows.
 * Bundle expansion is driven by product_definitions.bundle_products JSONB,
 * so no slugs are hardcoded here.
 */

import { supabaseAdmin } from '@/lib/supabase/server';

export interface GrantAccessResult {
  userId: string;
  productsGranted: string[];
  productAccessIds: string[];
}

/**
 * Resolve which product slugs to grant access for.
 * For bundles: reads bundle_products JSONB from product_definitions.
 * For single products: returns [productSlug].
 */
async function resolveProductSlugs(productSlug: string): Promise<string[]> {
  const { data: definition } = await supabaseAdmin
    .from('product_definitions')
    .select('bundle_products')
    .eq('slug', productSlug)
    .single();

  if (definition?.bundle_products && Array.isArray(definition.bundle_products) && definition.bundle_products.length > 0) {
    console.log(`🎁 Bundle ${productSlug} → granting ${definition.bundle_products.length} products`);
    return definition.bundle_products as string[];
  }

  return [productSlug];
}

export async function grantProductAccess(params: {
  customerEmail: string;
  customerName: string;
  productSlug: string;
  sessionId: string;
  amountPaid: number;
  purchaseDate: string;
}): Promise<GrantAccessResult> {
  const { customerEmail, customerName, productSlug, sessionId, amountPaid, purchaseDate } = params;

  // Resolve which products to grant (handles bundles via DB lookup)
  const productsToGrant = await resolveProductSlugs(productSlug);
  const isBundle = productsToGrant.length > 1;

  // Find or create user
  let userId: string;

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (existingUser?.id) {
    userId = existingUser.id;
    console.log('Found existing user:', userId);
  } else {
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({ email: customerEmail, name: customerName })
      .select('id')
      .single();

    if (createError) throw createError;
    userId = newUser.id;
    console.log('Created new user:', userId);
  }

  // Grant access for each product
  const productAccessIds: string[] = [];

  for (const slug of productsToGrant) {
    const accessRecord = {
      user_id: userId,
      product_slug: slug,
      stripe_session_id: sessionId,
      amount_paid: amountPaid,
      access_granted: true,
      purchase_date: purchaseDate,
      purchase_source: isBundle ? 'bundle' : 'single',
      bundle_slug: isBundle ? productSlug : null,
    };

    const { data: accessData, error: accessError } = await supabaseAdmin
      .from('product_access')
      .insert(accessRecord)
      .select('id');

    if (accessError) {
      if (accessError.code === '23505') {
        // User already has access — update the existing record
        console.log(`⚠️ Duplicate access for ${slug} — updating existing record`);

        await supabaseAdmin
          .from('product_access')
          .update(accessRecord)
          .eq('user_id', userId)
          .eq('product_slug', slug);

        const { data: existingAccess } = await supabaseAdmin
          .from('product_access')
          .select('id')
          .eq('user_id', userId)
          .eq('product_slug', slug)
          .single();

        if (existingAccess?.id) productAccessIds.push(existingAccess.id);
      } else {
        console.error(`❌ Failed to grant access for ${slug}:`, accessError);
        throw accessError;
      }
    } else {
      console.log(`✅ Access granted for ${slug}`);
      const insertedId = accessData?.[0]?.id;
      if (insertedId) productAccessIds.push(insertedId);
    }
  }

  return { userId, productsGranted: productsToGrant, productAccessIds };
}
