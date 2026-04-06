/**
 * Webhook Handler: Process Affiliate Commission
 *
 * Links purchaser to referrer and calculates commission splits.
 * Only runs when FEATURE_AFFILIATES=true.
 */

import { FEATURES } from '../../../../config/features.config';
import { processReferralCommission, linkPurchaserToReferrer } from '@/lib/affiliate/commission-processor';
import { createConnectAccount } from '@/lib/stripe/connect';

export async function processAffiliate(params: {
  userId: string;
  customerEmail: string;
  referralCode: string | null | undefined;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  productSlug: string;
}): Promise<void> {
  if (!FEATURES.affiliates) {
    console.log('[Affiliate] Skipped — FEATURE_AFFILIATES is disabled');
    return;
  }

  const { userId, customerEmail, referralCode, sessionId, paymentIntentId, amountCents, productSlug } = params;

  // Create Stripe Connect account so this user can become an affiliate
  try {
    await createConnectAccount(userId, customerEmail);
    console.log('✅ Stripe Connect account created/ensured for:', customerEmail);
  } catch (err: any) {
    console.error('⚠️ Failed to create Connect account (non-fatal):', err.message);
  }

  // Process referral commission if a referral code was captured
  if (referralCode) {
    try {
      await linkPurchaserToReferrer(userId, referralCode);
      await processReferralCommission({
        purchaserId: userId,
        purchaserEmail: customerEmail,
        referralCode,
        sessionId,
        paymentIntentId,
        amountCents,
        productSlug,
      });
      console.log('✅ Referral commission processed for code:', referralCode);
    } catch (err: any) {
      console.error('⚠️ Failed to process referral commission (non-fatal):', err.message);
    }
  } else {
    console.log('[Affiliate] No referral code — skipping commission');
  }
}
