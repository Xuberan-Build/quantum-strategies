/**
 * Affiliate Program Enrollment API
 * Enrolls user in affiliate program with referral code and Stripe Connect account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createConnectAccount } from '@/lib/stripe/connect';
import { MARKETING_URL } from '@/lib/config/urls';
import { supabaseAdmin } from '@/lib/supabase/server';
import { startTimer, logAffiliate, logApiError, logSuccess } from '@/lib/logging/audit-logger';

export async function POST(req: NextRequest) {
  const startTime = startTimer();
  let userId: string | undefined;
  let userEmail: string | undefined;

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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      await logApiError({
        req,
        action: 'affiliate_enroll',
        error: new Error('Unauthorized - no session'),
        responseStatus: 401,
        startTime,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    userId = session.user.id;
    userEmail = session.user.email!;

    // Check if already enrolled
    const { data: existingHierarchy } = await supabaseAdmin
      .from('referral_hierarchy')
      .select('id, referral_code')
      .eq('affiliate_id', userId)
      .single();

    if (existingHierarchy) {
      await logAffiliate({
        userId,
        userEmail,
        action: 'affiliate_enroll',
        status: 'error',
        errorMessage: 'Already enrolled',
        metadata: { referralCode: existingHierarchy.referral_code },
      });

      return NextResponse.json(
        { error: 'Already enrolled in affiliate program' },
        { status: 400 }
      );
    }

    // Check if user has opted out
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('affiliate_opted_out')
      .eq('id', userId)
      .single();

    if (user?.affiliate_opted_out) {
      // User previously opted out - clear opt-out flag to allow re-enrollment
      await supabaseAdmin
        .from('users')
        .update({ affiliate_opted_out: false })
        .eq('id', userId);
    }

    // Get referred_by_id from referral cookie if exists
    const referralCode = cookieStore.get('referral_code')?.value;
    let referredById = null;

    if (referralCode) {
      const { data: referrer } = await supabaseAdmin
        .from('referral_hierarchy')
        .select('affiliate_id')
        .eq('referral_code', referralCode)
        .single();

      if (referrer) {
        referredById = referrer.affiliate_id;
      }
    }

    // Generate unique referral code using database function
    const { data: codeResult, error: codeError } = await supabaseAdmin
      .rpc('generate_referral_code');

    if (codeError || !codeResult) {
      console.error('Error generating referral code:', codeError);

      await logAffiliate({
        userId,
        userEmail,
        action: 'affiliate_enroll',
        status: 'error',
        errorMessage: 'Failed to generate referral code',
        metadata: { error: codeError },
      });

      throw new Error('Failed to generate referral code');
    }

    const newReferralCode = codeResult as string;
    const referralLink = `${MARKETING_URL}?ref=${newReferralCode}`;

    // Create referral_hierarchy record
    const { error: hierarchyError } = await supabaseAdmin
      .from('referral_hierarchy')
      .insert({
        affiliate_id: userId,
        referred_by_id: referredById,
        referral_code: newReferralCode,
        referral_link: referralLink,
        current_track: 'community_builder',
        enrolled_at: new Date().toISOString(),
      });

    if (hierarchyError) {
      console.error('Error creating referral hierarchy:', hierarchyError);

      await logAffiliate({
        userId,
        userEmail,
        action: 'affiliate_enroll',
        status: 'error',
        errorMessage: 'Failed to create referral hierarchy record',
        metadata: {
          error: hierarchyError,
          referralCode: newReferralCode,
        },
      });

      throw new Error('Failed to create affiliate record');
    }

    // Update users table
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({
        is_affiliate: true,
        affiliate_enrolled_at: new Date().toISOString(),
        affiliate_opted_out: false,
      })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error updating user:', userUpdateError);

      await logAffiliate({
        userId,
        userEmail,
        action: 'affiliate_enroll',
        status: 'error',
        errorMessage: 'Failed to update user affiliate status',
        metadata: { error: userUpdateError },
      });

      throw new Error('Failed to update user status');
    }

    // Try to create Stripe Connect account (non-blocking)
    // If this fails, user can set up Stripe later from dashboard
    let stripeAccountId = null;
    let stripeError = null;

    try {
      const accountInfo = await createConnectAccount(userId, userEmail);
      stripeAccountId = accountInfo.accountId;
      console.log('Stripe Connect account created:', stripeAccountId);

      await logAffiliate({
        userId,
        userEmail,
        action: 'stripe_connect_create',
        status: 'success',
        metadata: {
          stripeAccountId,
          referralCode: newReferralCode,
        },
      });
    } catch (error: any) {
      console.error('Stripe Connect account creation failed (non-critical):', error);
      stripeError = error.message;

      await logAffiliate({
        userId,
        userEmail,
        action: 'stripe_connect_create',
        status: 'error',
        errorMessage: error.message,
        metadata: {
          errorStack: error.stack,
          referralCode: newReferralCode,
        },
      });

      // Continue anyway - user can set up Stripe later
    }

    // Log successful enrollment
    await logAffiliate({
      userId,
      userEmail,
      action: 'affiliate_enroll',
      status: 'success',
      metadata: {
        referralCode: newReferralCode,
        referralLink,
        currentTrack: 'community_builder',
        stripeAccountId,
        stripeError,
      },
    });

    await logSuccess({
      req,
      userId,
      userEmail,
      action: 'affiliate_enroll',
      metadata: { referralCode: newReferralCode },
      startTime,
    });

    return NextResponse.json({
      success: true,
      referralCode: newReferralCode,
      referralLink,
      stripeAccountId,
      stripeError: stripeError || undefined,
    });

  } catch (error: any) {
    console.error('Enrollment API error:', error);

    await logApiError({
      req,
      userId,
      userEmail,
      action: 'affiliate_enroll',
      error,
      responseStatus: 500,
      startTime,
    });

    return NextResponse.json(
      { error: error.message || 'Failed to enroll in affiliate program' },
      { status: 500 }
    );
  }
}
