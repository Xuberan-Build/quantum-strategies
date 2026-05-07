/**
 * Stripe Connect onboarding API
 * Create account and generate onboarding links
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createConnectAccount, createAccountLink, getAccountStatus } from '@/lib/stripe/connect';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userEmail = user.email!;

    // Check if user already has a Connect account
    const { data: hierarchy } = await supabase
      .from('referral_hierarchy')
      .select('stripe_connect_account_id')
      .eq('affiliate_id', userId)
      .single();

    let accountId = hierarchy?.stripe_connect_account_id;

    // Create account if doesn't exist
    if (!accountId) {
      const accountInfo = await createConnectAccount(userId, userEmail);
      accountId = accountInfo.accountId;
    }

    // Generate onboarding link
    const onboardingUrl = await createAccountLink(accountId, userId);

    return NextResponse.json({
      onboardingUrl,
      accountId,
    });

  } catch (error: any) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create onboarding link' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Get account ID
    const { data: hierarchy } = await supabase
      .from('referral_hierarchy')
      .select('stripe_connect_account_id')
      .eq('affiliate_id', userId)
      .single();

    if (!hierarchy?.stripe_connect_account_id) {
      return NextResponse.json({
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // Check account status
    const status = await getAccountStatus(hierarchy.stripe_connect_account_id);

    return NextResponse.json(status);

  } catch (error: any) {
    console.error('Onboarding status API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check onboarding status' },
      { status: 500 }
    );
  }
}
