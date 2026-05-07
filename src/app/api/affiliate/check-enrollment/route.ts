/**
 * Affiliate Enrollment Check API
 * Checks if user is enrolled, opted out, or needs to see welcome page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authUser.id;

    // Get user status
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('is_affiliate, affiliate_opted_out, first_affiliate_visit')
      .eq('id', userId)
      .single();

    // Check if referral_hierarchy record exists
    const { data: hierarchy } = await supabaseAdmin
      .from('referral_hierarchy')
      .select('id')
      .eq('affiliate_id', userId)
      .single();

    // Record first visit if not already recorded
    if (!user?.first_affiliate_visit) {
      await supabaseAdmin
        .from('users')
        .update({ first_affiliate_visit: new Date().toISOString() })
        .eq('id', userId);
    }

    return NextResponse.json({
      isEnrolled: !!hierarchy,
      hasOptedOut: user?.affiliate_opted_out || false,
      isAffiliate: user?.is_affiliate || false,
    });

  } catch (error: any) {
    console.error('Check enrollment API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check enrollment status' },
      { status: 500 }
    );
  }
}
