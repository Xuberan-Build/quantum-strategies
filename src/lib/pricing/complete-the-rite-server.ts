/**
 * Server-only: load a user's product_access rows and compute Complete the Rite offers.
 * Uses the service role client, so never call this with a user id taken from the client.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import {
  getCompleteRiteOffers,
  type AccessRowInput,
  type CompleteRiteOffer,
} from './complete-the-rite';

export async function getUserAccessRows(userId: string): Promise<AccessRowInput[]> {
  const { data, error } = await supabaseAdmin
    .from('product_access')
    .select('product_slug, access_granted, amount_paid, stripe_session_id, purchase_source, bundle_slug')
    .eq('user_id', userId)
    .eq('access_granted', true);

  if (error) throw error;
  return (data ?? []) as AccessRowInput[];
}

export async function getUserCompleteRiteOffers(userId: string): Promise<CompleteRiteOffer[]> {
  return getCompleteRiteOffers(await getUserAccessRows(userId));
}
