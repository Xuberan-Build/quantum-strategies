/**
 * Webhook Handler: Grant Product Access
 *
 * Creates/finds the user record and inserts product_access rows.
 * Bundles expand to their member products. The bundles are sold from code
 * (src/lib/constants/products.ts) and have no product_definitions row, so their
 * contents live in BUNDLE_CONTENTS below. A bundle_products JSONB column on
 * product_definitions, if one is ever added, takes precedence.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { BUNDLE_CONTENTS } from '@/lib/constants/bundles';

export { BUNDLE_CONTENTS };

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
export async function resolveProductSlugs(productSlug: string): Promise<string[]> {
  const known = BUNDLE_CONTENTS[productSlug];
  if (known) {
    console.log(`🎁 Bundle ${productSlug} → ${known.length} products`);
    return known;
  }

  // Optional DB-driven bundles. The column may not exist; any error falls
  // through to treating the slug as a single product.
  const { data: definition, error } = await supabaseAdmin
    .from('product_definitions')
    .select('bundle_products')
    .eq('product_slug', productSlug)
    .maybeSingle();

  const bundle = !error && (definition as { bundle_products?: unknown } | null)?.bundle_products;
  if (Array.isArray(bundle) && bundle.length > 0) {
    console.log(`🎁 Bundle ${productSlug} → granting ${bundle.length} products`);
    return bundle as string[];
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
  authUserId?: string;
  /** "Complete the Rite" upgrade: grant only these bundle components (the ones that were missing). */
  upgradeSlugs?: string[];
}): Promise<GrantAccessResult> {
  const { customerEmail, customerName, productSlug, sessionId, amountPaid, purchaseDate, authUserId, upgradeSlugs } = params;

  // Resolve which products to grant (handles bundles via DB lookup)
  const bundleSlugs = await resolveProductSlugs(productSlug);
  const isUpgrade = !!upgradeSlugs?.length;
  // An upgrade only grants the missing components, never the whole bundle.
  const productsToGrant = isUpgrade ? bundleSlugs.filter((s) => upgradeSlugs!.includes(s)) : bundleSlugs;
  const isBundle = bundleSlugs.length > 1;

  // Find or create user.
  // Prefer authUserId (the Supabase auth UUID) when available — it's the authoritative ID
  // that matches what the experience page uses for access checks. Falls back to email lookup
  // for sessions that didn't set client_reference_id (e.g. legacy payment links).
  let userId: string;

  if (authUserId) {
    const { data: authUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();

    if (authUser?.id) {
      userId = authUser.id;
      console.log('Found user by auth ID:', userId);
    } else {
      // User exists in auth but not yet in public.users (trigger may not have fired yet)
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({ id: authUserId, email: customerEmail, name: customerName })
        .select('id')
        .single();

      if (createError) throw createError;
      userId = newUser.id;
      console.log('Created user with auth ID:', userId);
    }
  } else {
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (existingUser?.id) {
      userId = existingUser.id;
      console.log('Found existing user by email:', userId);
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
      purchase_source: isUpgrade ? 'upgrade' : isBundle ? 'bundle' : 'single',
      bundle_slug: isBundle ? productSlug : null,
    };

    const { data: accessData, error: accessError } = await supabaseAdmin
      .from('product_access')
      .insert(accessRecord)
      .select('id');

    if (accessError) {
      if (accessError.code === '23505') {
        // User already has a row for this product.
        const { data: existingAccess } = await supabaseAdmin
          .from('product_access')
          .select('id, access_granted')
          .eq('user_id', userId)
          .eq('product_slug', slug)
          .single();

        if (existingAccess?.access_granted) {
          // Already owned (earlier purchase, beta, or a "complete the Rite" upgrade).
          // Keep the row as is so the original purchase data survives.
          console.log(`⚠️ ${slug} already owned — keeping existing record`);
        } else {
          console.log(`⚠️ Duplicate access for ${slug} — updating existing record`);
          await supabaseAdmin
            .from('product_access')
            .update(accessRecord)
            .eq('user_id', userId)
            .eq('product_slug', slug);
        }

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
