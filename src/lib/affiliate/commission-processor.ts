/**
 * Commission Processor - Core affiliate commission logic
 * Handles referral chain tracking, commission calculation, and payout execution
 */

import { createClient } from '@supabase/supabase-js';
import { createTransfer, canReceivePayouts } from '../stripe/connect';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface ReferralPurchaseData {
  purchaserId: string;
  purchaserEmail: string;
  referralCode?: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  productSlug: string;
}

interface ReferralChain {
  directReferrer: {
    id: string;
    track: string;
    accountId: string | null;
  } | null;
  overrideReferrer: {
    id: string;
    track: string;
    accountId: string | null;
  } | null;
}

interface CommissionSplits {
  directCommissionCents: number;
  overrideCommissionCents: number;
  dinnerPartyContributionCents: number;
  platformFeeCents: number;
  directTrack: string | null;
  overrideTrack: string | null;
}

/**
 * Main entry point: Process referral commission for a purchase
 */
export async function processReferralCommission(
  data: ReferralPurchaseData
): Promise<void> {
  try {
    console.log('Processing referral commission for:', data);

    // 1. Get referral chain (direct + override referrers)
    const chain = await getReferralChain(data.referralCode);

    if (!chain.directReferrer) {
      console.log('No referral code or invalid code, skipping commission processing');
      return;
    }

    // 2. Calculate commission splits based on track
    const splits = calculateCommissionSplits(
      data.amountCents,
      chain.directReferrer.track,
      !!chain.overrideReferrer
    );

    // 3. Create transaction record
    const transactionId = await recordAffiliateTransaction({
      purchaserId: data.purchaserId,
      productSlug: data.productSlug,
      sessionId: data.sessionId,
      paymentIntentId: data.paymentIntentId,
      amountCents: data.amountCents,
      directReferrerId: chain.directReferrer.id,
      overrideReferrerId: chain.overrideReferrer?.id || null,
      splits,
    });

    // 4. Execute Stripe transfers
    const transferIds = await executeStripeTransfers(
      chain,
      splits,
      data.sessionId,
      transactionId
    );

    // 5. Update transaction with transfer IDs
    await updateTransactionWithTransfers(transactionId, transferIds);

    // 6. Increment earnings in user records
    await incrementEarnings(chain, splits);

    // 7. Add dinner party contribution
    if (splits.dinnerPartyContributionCents > 0 && chain.directReferrer) {
      await contributeToDinnerParty(
        chain.directReferrer.id,
        transactionId,
        splits.dinnerPartyContributionCents
      );
    }

    // 8. Increment referral counts
    await incrementReferralCount(chain.directReferrer.id);

    console.log('Commission processing complete:', {
      transactionId,
      directCommission: splits.directCommissionCents,
      overrideCommission: splits.overrideCommissionCents,
      dinnerParty: splits.dinnerPartyContributionCents,
    });
  } catch (error) {
    console.error('Error processing referral commission:', error);
    // Don't throw - we don't want to fail the purchase if commission processing fails
    // Log the error and continue
  }
}

/**
 * Get referral chain from referral code
 */
async function getReferralChain(referralCode?: string): Promise<ReferralChain> {
  if (!referralCode) {
    return { directReferrer: null, overrideReferrer: null };
  }

  try {
    // Get direct referrer
    const { data: directReferrer } = await supabase
      .from('referral_hierarchy')
      .select('affiliate_id, current_track, stripe_connect_account_id, referred_by_id')
      .eq('referral_code', referralCode)
      .not('opted_in_at', 'is', null)
      .single();

    if (!directReferrer) {
      return { directReferrer: null, overrideReferrer: null };
    }

    const chain: ReferralChain = {
      directReferrer: {
        id: directReferrer.affiliate_id,
        track: directReferrer.current_track,
        accountId: directReferrer.stripe_connect_account_id,
      },
      overrideReferrer: null,
    };

    // Get override referrer (if direct referrer was referred by someone)
    if (directReferrer.referred_by_id) {
      const { data: overrideReferrer } = await supabase
        .from('referral_hierarchy')
        .select('affiliate_id, current_track, stripe_connect_account_id')
        .eq('affiliate_id', directReferrer.referred_by_id)
        .single();

      if (overrideReferrer) {
        chain.overrideReferrer = {
          id: overrideReferrer.affiliate_id,
          track: overrideReferrer.current_track,
          accountId: overrideReferrer.stripe_connect_account_id,
        };
      }
    }

    return chain;
  } catch (error) {
    console.error('Error getting referral chain:', error);
    return { directReferrer: null, overrideReferrer: null };
  }
}

/**
 * Calculate commission splits based on track
 */
function calculateCommissionSplits(
  amountCents: number,
  directTrack: string,
  hasOverride: boolean
): CommissionSplits {
  const OVERRIDE_COMMISSION_CENTS = 70; // Always $0.70 (10% of $7)

  let directCommissionCents = 0;
  let dinnerPartyContributionCents = 0;
  let platformFeeCents = 140; // Base 20%

  // Calculate direct commission and dinner party contribution based on track
  switch (directTrack) {
    case 'community_builder':
      directCommissionCents = 210; // 30% of $7
      dinnerPartyContributionCents = 280; // 40% of $7
      break;

    case 'high_performer':
      directCommissionCents = 280; // 40% of $7
      dinnerPartyContributionCents = 210; // 30% of $7
      break;

    case 'independent':
      directCommissionCents = 420; // 60% of $7
      dinnerPartyContributionCents = 0; // 0%
      platformFeeCents = 210; // 30% instead of 20%
      break;

    default:
      console.error('Unknown track:', directTrack);
      break;
  }

  return {
    directCommissionCents,
    overrideCommissionCents: hasOverride ? OVERRIDE_COMMISSION_CENTS : 0,
    dinnerPartyContributionCents,
    platformFeeCents,
    directTrack,
    overrideTrack: hasOverride ? 'override' : null,
  };
}

/**
 * Record transaction in database
 */
async function recordAffiliateTransaction(params: {
  purchaserId: string;
  productSlug: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  directReferrerId: string;
  overrideReferrerId: string | null;
  splits: CommissionSplits;
}): Promise<string> {
  const { data, error } = await supabase
    .from('affiliate_transactions')
    .insert({
      purchaser_id: params.purchaserId,
      product_slug: params.productSlug,
      stripe_session_id: params.sessionId,
      stripe_payment_intent_id: params.paymentIntentId,
      amount_cents: params.amountCents,
      direct_referrer_id: params.directReferrerId,
      override_referrer_id: params.overrideReferrerId,
      direct_commission_cents: params.splits.directCommissionCents,
      override_commission_cents: params.splits.overrideCommissionCents,
      direct_track: params.splits.directTrack,
      override_track: params.splits.overrideTrack,
      dinner_party_contribution_cents: params.splits.dinnerPartyContributionCents,
      commission_status: 'processing',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error recording affiliate transaction:', error);
    throw error;
  }

  return data.id;
}

/**
 * Execute Stripe transfers to affiliates
 */
async function executeStripeTransfers(
  chain: ReferralChain,
  splits: CommissionSplits,
  transferGroup: string,
  transactionId: string
): Promise<{ directTransferId?: string; overrideTransferId?: string }> {
  const transferIds: { directTransferId?: string; overrideTransferId?: string } = {};

  // Transfer to direct referrer
  if (
    chain.directReferrer &&
    chain.directReferrer.accountId &&
    splits.directCommissionCents > 0
  ) {
    try {
      const canReceive = await canReceivePayouts(chain.directReferrer.id);

      if (canReceive) {
        transferIds.directTransferId = await createTransfer(
          chain.directReferrer.accountId,
          splits.directCommissionCents,
          `Direct referral commission - Transaction ${transactionId.slice(0, 8)}`,
          transferGroup
        );
        console.log('Direct transfer created:', transferIds.directTransferId);
      } else {
        console.log('Direct referrer cannot receive payouts yet (onboarding incomplete)');
        // Commission will be held until onboarding completes
      }
    } catch (error) {
      console.error('Error creating direct transfer:', error);
      // Continue even if transfer fails - we'll retry later
    }
  }

  // Transfer to override referrer
  if (
    chain.overrideReferrer &&
    chain.overrideReferrer.accountId &&
    splits.overrideCommissionCents > 0
  ) {
    try {
      const canReceive = await canReceivePayouts(chain.overrideReferrer.id);

      if (canReceive) {
        transferIds.overrideTransferId = await createTransfer(
          chain.overrideReferrer.accountId,
          splits.overrideCommissionCents,
          `Override commission - Transaction ${transactionId.slice(0, 8)}`,
          transferGroup
        );
        console.log('Override transfer created:', transferIds.overrideTransferId);
      } else {
        console.log('Override referrer cannot receive payouts yet (onboarding incomplete)');
      }
    } catch (error) {
      console.error('Error creating override transfer:', error);
    }
  }

  return transferIds;
}

/**
 * Update transaction with Stripe transfer IDs
 */
async function updateTransactionWithTransfers(
  transactionId: string,
  transferIds: { directTransferId?: string; overrideTransferId?: string }
): Promise<void> {
  const { error } = await supabase
    .from('affiliate_transactions')
    .update({
      direct_transfer_id: transferIds.directTransferId || null,
      override_transfer_id: transferIds.overrideTransferId || null,
      commission_status: 'paid',
      processed_at: new Date().toISOString(),
    })
    .eq('id', transactionId);

  if (error) {
    console.error('Error updating transaction with transfers:', error);
  }
}

/**
 * Increment earnings for affiliates
 */
async function incrementEarnings(
  chain: ReferralChain,
  splits: CommissionSplits
): Promise<void> {
  // Increment direct referrer earnings
  if (chain.directReferrer && splits.directCommissionCents > 0) {
    const { error } = await supabase.rpc('increment_affiliate_earnings', {
      p_affiliate_id: chain.directReferrer.id,
      p_amount_cents: splits.directCommissionCents,
    });

    if (error) {
      console.error('Error incrementing direct referrer earnings:', error);
    }
  }

  // Increment override referrer earnings
  if (chain.overrideReferrer && splits.overrideCommissionCents > 0) {
    const { error } = await supabase.rpc('increment_affiliate_earnings', {
      p_affiliate_id: chain.overrideReferrer.id,
      p_amount_cents: splits.overrideCommissionCents,
    });

    if (error) {
      console.error('Error incrementing override referrer earnings:', error);
    }
  }
}

/**
 * Add dinner party contribution
 */
async function contributeToDinnerParty(
  contributorId: string,
  transactionId: string,
  amountCents: number
): Promise<void> {
  const { error } = await supabase.rpc('add_dinner_party_contribution', {
    p_contributor_id: contributorId,
    p_transaction_id: transactionId,
    p_amount_cents: amountCents,
  });

  if (error) {
    console.error('Error adding dinner party contribution:', error);
  }
}

/**
 * Increment referral count for direct referrer
 */
async function incrementReferralCount(referrerId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_referral_count', {
    p_referrer_id: referrerId,
  });

  if (error) {
    console.error('Error incrementing referral count:', error);
  }
}

/**
 * Link purchaser to referrer (set referred_by_id)
 */
export async function linkPurchaserToReferrer(
  purchaserId: string,
  referralCode: string
): Promise<void> {
  try {
    // Get referrer ID from code
    const { data: referrer } = await supabase
      .from('referral_hierarchy')
      .select('affiliate_id')
      .eq('referral_code', referralCode)
      .not('opted_in_at', 'is', null)
      .single();

    if (!referrer) {
      console.log('Referral code not found, skipping linking');
      return;
    }

    // Update purchaser's referred_by_id in their referral_hierarchy record
    const { error } = await supabase
      .from('referral_hierarchy')
      .update({ referred_by_id: referrer.affiliate_id })
      .eq('affiliate_id', purchaserId);

    if (error) {
      console.error('Error linking purchaser to referrer:', error);
    } else {
      console.log(`Linked purchaser ${purchaserId} to referrer ${referrer.affiliate_id}`);
    }
  } catch (error) {
    console.error('Error in linkPurchaserToReferrer:', error);
  }
}
