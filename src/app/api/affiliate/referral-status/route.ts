/**
 * Referral Status API
 * Checks if user was referred by someone else
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

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ wasReferred: false });
    }

    // Check if user was referred (has referred_by_id in referral_hierarchy)
    const { data: hierarchy } = await supabaseAdmin
      .from('referral_hierarchy')
      .select('referred_by_id')
      .eq('affiliate_id', user.id)
      .single();

    // Also check referral cookie as fallback
    const referralCode = cookieStore.get('referral_code')?.value;

    return NextResponse.json({
      wasReferred: !!hierarchy?.referred_by_id || !!referralCode,
    });

  } catch (error) {
    // Return false on error (non-critical)
    return NextResponse.json({ wasReferred: false });
  }
}
