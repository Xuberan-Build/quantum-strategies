/**
 * Stripe Connect Integration for Affiliate System
 * Handles Express account creation, onboarding, and payouts
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { APP_URL } from '@/lib/config/urls';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

// Helper function to create Supabase client (avoids module-level initialization)
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const BASE_URL = APP_URL;

export interface ConnectAccountInfo {
  accountId: string;
  onboardingUrl?: string;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/**
 * Create Stripe Connect Express account for affiliate
 */
export async function createConnectAccount(
  userId: string,
  email: string
): Promise<ConnectAccountInfo> {
  const supabase = getSupabaseClient();

  try {
    // Check if account already exists
    const { data: existing } = await supabase
      .from('referral_hierarchy')
      .select('stripe_connect_account_id')
      .eq('affiliate_id', userId)
      .single();

    if (existing?.stripe_connect_account_id) {
      // Return existing account info
      return await getAccountStatus(existing.stripe_connect_account_id);
    }

    // Create new Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        user_id: userId,
        platform: 'quantum_strategies',
      },
    });

    // Store account ID in database
    const { error: updateError } = await supabase
      .from('referral_hierarchy')
      .update({
        stripe_connect_account_id: account.id,
      })
      .eq('affiliate_id', userId);

    if (updateError) {
      console.error('Error updating referral_hierarchy:', updateError);
      throw new Error('Failed to store Connect account ID');
    }

    // Create onboarding record
    const { error: onboardingError } = await supabase
      .from('stripe_connect_onboarding')
      .insert({
        affiliate_id: userId,
        stripe_account_id: account.id,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
      });

    if (onboardingError) {
      console.error('Error creating onboarding record:', onboardingError);
    }

    return {
      accountId: account.id,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  } catch (error) {
    console.error('Error creating Connect account:', error);
    throw error;
  }
}

/**
 * Create account link for Stripe Connect onboarding
 */
export async function createAccountLink(
  accountId: string,
  userId: string
): Promise<string> {
  const supabase = getSupabaseClient();

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${BASE_URL}/dashboard/affiliate/onboarding?refresh=true&user_id=${userId}`,
      return_url: `${BASE_URL}/dashboard/affiliate/onboarding/complete?user_id=${userId}`,
      type: 'account_onboarding',
    });

    // Update database with link
    const { error } = await supabase
      .from('stripe_connect_onboarding')
      .update({
        onboarding_url: accountLink.url,
        onboarding_expires_at: new Date(accountLink.expires_at * 1000).toISOString(),
      })
      .eq('stripe_account_id', accountId);

    if (error) {
      console.error('Error updating onboarding URL:', error);
    }

    return accountLink.url;
  } catch (error) {
    console.error('Error creating account link:', error);
    throw error;
  }
}

/**
 * Get Stripe Connect account status
 */
export async function getAccountStatus(
  accountId: string
): Promise<ConnectAccountInfo> {
  const supabase = getSupabaseClient();

  try {
    const account = await stripe.accounts.retrieve(accountId);

    const status: ConnectAccountInfo = {
      accountId: account.id,
      onboardingComplete: account.details_submitted ?? false,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
    };

    // Update database
    await supabase
      .from('referral_hierarchy')
      .update({
        stripe_connect_onboarding_complete: status.onboardingComplete,
        stripe_connect_charges_enabled: status.chargesEnabled,
        stripe_connect_payouts_enabled: status.payoutsEnabled,
      })
      .eq('stripe_connect_account_id', accountId);

    await supabase
      .from('stripe_connect_onboarding')
      .update({
        details_submitted: status.onboardingComplete,
        charges_enabled: status.chargesEnabled,
        payouts_enabled: status.payoutsEnabled,
        requirements: account.requirements,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', accountId);

    return status;
  } catch (error) {
    console.error('Error getting account status:', error);
    throw error;
  }
}

/**
 * Create transfer to affiliate's Connect account
 */
export async function createTransfer(
  accountId: string,
  amountCents: number,
  description: string,
  transferGroup?: string
): Promise<string> {
  try {
    // Check account is ready for payouts
    const account = await stripe.accounts.retrieve(accountId);

    if (!account.payouts_enabled) {
      throw new Error('Account is not ready to receive payouts. Onboarding incomplete.');
    }

    // Create transfer
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: accountId,
      description,
      transfer_group: transferGroup,
      metadata: {
        platform: 'quantum_strategies',
      },
    });

    return transfer.id;
  } catch (error) {
    console.error('Error creating transfer:', error);
    throw error;
  }
}

/**
 * Get account by user ID
 */
export async function getAccountByUserId(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  try {
    const { data} = await supabase
      .from('referral_hierarchy')
      .select('stripe_connect_account_id')
      .eq('affiliate_id', userId)
      .single();

    return data?.stripe_connect_account_id || null;
  } catch (error) {
    console.error('Error getting account by user ID:', error);
    return null;
  }
}

/**
 * Check if user can receive payouts
 */
export async function canReceivePayouts(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { data } = await supabase
      .from('referral_hierarchy')
      .select('stripe_connect_payouts_enabled')
      .eq('affiliate_id', userId)
      .single();

    return data?.stripe_connect_payouts_enabled ?? false;
  } catch (error) {
    console.error('Error checking payout eligibility:', error);
    return false;
  }
}

/**
 * Retry failed transfer
 */
export async function retryTransfer(
  accountId: string,
  amountCents: number,
  description: string,
  transferGroup?: string
): Promise<string | null> {
  try {
    // Check account status first
    const status = await getAccountStatus(accountId);

    if (!status.payoutsEnabled) {
      console.log('Account not ready for payouts, skipping retry');
      return null;
    }

    // Retry transfer
    return await createTransfer(accountId, amountCents, description, transferGroup);
  } catch (error) {
    console.error('Error retrying transfer:', error);
    return null;
  }
}
