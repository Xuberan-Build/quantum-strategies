import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import ProductExperience from '@/components/product-experience/ProductExperience';
import { isPlacementsEmpty } from '@/lib/utils/placements';
import { ALL_BETA_PRODUCTS } from '@/lib/beta/constants';

export const dynamic = 'force-dynamic';

export default async function ProductExperiencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Await params (Next.js 15+ requirement)
  const { slug } = await params;

  const supabase = await createServerSupabaseClient();

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirect=/products/${slug}/experience`);
  }

  // Check product access
  const { data: access } = await supabase
    .from('product_access')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('product_slug', slug)
    .eq('access_granted', true)
    .single();

  if (!access) {
    if (ALL_BETA_PRODUCTS.includes(slug as any)) {
      redirect('/products/beta');
    }
    redirect('/dashboard?error=no-access');
  }

  // Get product definition (must be active)
  const { data: product } = await supabase
    .from('product_definitions')
    .select('*')
    .eq('product_slug', slug)
    .eq('is_active', true)
    .single();

  if (!product) {
    redirect('/dashboard?error=product-not-found');
  }

  // Get or create session
  let { data: productSession } = await supabase
    .from('product_sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('product_slug', slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!productSession) {
    // Create new session
    const { data: newSession } = await supabase
      .from('product_sessions')
      .insert({
        user_id: session.user.id,
        product_slug: slug,
        total_steps: product.total_steps,
        current_step: 1,
        placements_confirmed: false,
        placements: null,
        current_section: 1,
      })
      .select()
      .single();

      productSession = newSession;

      // Update access started_at
      await supabase
        .from('product_access')
      .update({ started_at: new Date().toISOString() })
        .eq('id', access.id);
  }

  const sessionPlacementsMissing =
    !productSession?.placements || isPlacementsEmpty(productSession?.placements);

  // Prefer profile placements if available
  if (sessionPlacementsMissing) {
    const { data: profilePlacements, error: profileError } = await supabase
      .from('users')
      .select('placements, placements_confirmed')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('[experience] Failed to fetch profile placements:', profileError);
    }

    if (profilePlacements?.placements && !isPlacementsEmpty(profilePlacements.placements)) {
      const { error: updateError } = await supabase
        .from('product_sessions')
        .update({
          placements: profilePlacements.placements,
          placements_confirmed: !!profilePlacements.placements_confirmed,
          current_step: 1,
          current_section: 1,
        })
        .eq('id', productSession.id);

      if (updateError) {
        console.error('[experience] Error updating session with profile placements:', updateError);
      } else {
        productSession = {
          ...productSession,
          placements: profilePlacements.placements,
          placements_confirmed: !!profilePlacements.placements_confirmed,
          current_step: 1,
          current_section: 1,
        };
      }
    }
  }

  // Auto-copy placements from user's latest confirmed session if missing
  if (!productSession?.placements || isPlacementsEmpty(productSession?.placements)) {
    const { data: placementSource, error: sourceError } = await supabase
      .from('product_sessions')
      .select('placements, product_slug')
      .eq('user_id', session.user.id)
      .eq('placements_confirmed', true)
      .not('placements', 'is', null)
      .neq('id', productSession.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (placementSource?.placements) {
      const { error: updateError } = await supabase
        .from('product_sessions')
        .update({
          placements: placementSource.placements,
          placements_confirmed: false,
          current_step: 1,
          current_section: 1,
        })
        .eq('id', productSession.id);

      if (updateError) {
        console.error('[experience] Error updating session with auto-copied placements:', updateError);
      }

      productSession = {
        ...productSession,
        placements: placementSource.placements,
        placements_confirmed: false,
        current_step: 1,
        current_section: 1,
      };
    }
  }

  // Treat missing/placeholder placements as not confirmed
  const needsConfirmation =
    !productSession.placements_confirmed || isPlacementsEmpty(productSession.placements);

  if (needsConfirmation) {
    // Normalize session on the server so the client can't skip confirmation
    // IMPORTANT: Keep placements even if empty - user needs to see them in confirmation gate
    await supabase
      .from('product_sessions')
      .update({
        current_step: 1,
        placements_confirmed: false,
        current_section: 1,
      })
      .eq('id', productSession.id);

    productSession = {
      ...productSession,
      current_step: 1,
      placements_confirmed: false,
      current_section: 1,
    };
  }

  return (
    <ProductExperience
      product={product}
      session={productSession}
      userId={session.user.id}
    />
  );
}
