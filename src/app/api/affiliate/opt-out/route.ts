/**
 * Affiliate Program Opt-Out API
 * Marks user as opted out of affiliate program
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    // Mark user as opted out and record first visit
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        affiliate_opted_out: true,
        first_affiliate_visit: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating opt-out status:', error);
      throw new Error('Failed to update opt-out status');
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Opt-out API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to opt out' },
      { status: 500 }
    );
  }
}
