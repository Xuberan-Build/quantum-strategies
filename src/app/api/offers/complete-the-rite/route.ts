/**
 * GET /api/offers/complete-the-rite
 *
 * Returns the signed-in user's "Complete the Rite" offers. Informational only:
 * the checkout route recomputes the price on the server and never trusts this response.
 * Signed-out visitors get an empty list so public sales pages can call it quietly.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserCompleteRiteOffers } from '@/lib/pricing/complete-the-rite-server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ offers: [] }, { headers: NO_STORE });
    }

    const offers = await getUserCompleteRiteOffers(user.id);
    return NextResponse.json({ offers }, { headers: NO_STORE });
  } catch (error) {
    console.error('Complete the Rite offers error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Could not load offers' } },
      { status: 500, headers: NO_STORE },
    );
  }
}
