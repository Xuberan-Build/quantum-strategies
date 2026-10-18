/**
 * The Perception Read: lead → account link, checkout and purchase events. Server-only.
 *
 * The account is created at checkout (spec v3 §8.2). When someone signs in or signs
 * up through the checkout bridge, every read_leads row with their email gets their
 * user_id, and the Read session is attached to the account if (and only if) its lead
 * has the same email. The Stripe webhook calls recordReadPurchase for any buyer who
 * has a lead.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { getLeadBySession, getLeadsByEmail, logReadEvent, type ReadLeadRow } from './email-store';
import { isUuid } from './email-links';

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export interface LinkResult {
  linkedLeadIds: string[];
  sessionAttached: boolean;
  /** The lead for the bridge's session, when there is one. */
  sessionLead: ReadLeadRow | null;
}

/** Idempotent. Never touches a lead already linked to a different user. */
export async function linkReadLeadsToUser(input: { userId: string; email: string; sessionId?: string | null }): Promise<LinkResult> {
  const out: LinkResult = { linkedLeadIds: [], sessionAttached: false, sessionLead: null };
  if (!input.userId || !input.email) return out;

  const leads = await getLeadsByEmail(input.email);
  const toLink = leads.filter((l) => !l.user_id && sameEmail(l.email, input.email)).map((l) => l.id);
  if (toLink.length > 0) {
    const { error } = await supabaseAdmin.from('read_leads').update({ user_id: input.userId }).in('id', toLink).is('user_id', null);
    if (error) throw new Error(`read_leads link failed: ${error.message}`);
    out.linkedLeadIds = toLink;
  }

  if (input.sessionId && isUuid(input.sessionId)) {
    const lead = await getLeadBySession(input.sessionId);
    out.sessionLead = lead;
    if (lead && sameEmail(lead.email, input.email)) {
      const { data, error } = await supabaseAdmin
        .from('product_sessions')
        .update({ user_id: input.userId })
        .eq('id', input.sessionId)
        .is('user_id', null)
        .select('id');
      if (error) console.warn('[read-link] session attach failed:', error.message);
      out.sessionAttached = Boolean(data && (data as unknown[]).length > 0);
    }
  }

  if (out.linkedLeadIds.length > 0 || out.sessionAttached) {
    const lead = out.sessionLead ?? leads[0] ?? null;
    await logReadEvent({
      sessionId: lead?.session_id ?? input.sessionId ?? null,
      leadId: lead?.id ?? null,
      userId: input.userId,
      event: 'read_lead_linked',
      props: { leads: out.linkedLeadIds.length, session_attached: out.sessionAttached },
    }).catch((err) => console.warn('[read-link] link event not logged:', err?.message));
  }
  return out;
}

/** read_checkout_started, from the bridge, just before /api/checkout. */
export async function recordReadCheckoutStarted(input: { userId: string; email: string | null; sessionId: string }): Promise<void> {
  const lead = await getLeadBySession(input.sessionId);
  await logReadEvent({
    sessionId: input.sessionId,
    leadId: lead?.id ?? null,
    userId: input.userId,
    event: 'read_checkout_started',
    props: {
      product_slug: 'perception-rite-bundle',
      pattern: lead?.pattern ?? null,
      same_email: lead ? sameEmail(lead.email, input.email) : null,
    },
  });
}

export interface ReadPurchaseInput {
  email: string;
  userId?: string | null;
  productSlug: string;
  stripeSessionId: string;
  amount: number;
  /** checkout metadata.read_session_id, when the purchase came through the bridge. */
  readSessionId?: string | null;
}

/**
 * Records read_purchase when the buyer has a Read lead (by email, or by the bridge's
 * session id). Links the leads to the buyer. Idempotent per Stripe session (webhook
 * retries). Returns whether an event was written.
 */
export async function recordReadPurchase(input: ReadPurchaseInput): Promise<boolean> {
  const byEmail = await getLeadsByEmail(input.email);
  const bridgeSession = input.readSessionId && isUuid(input.readSessionId) ? input.readSessionId : null;
  const bridgeLead = bridgeSession ? await getLeadBySession(bridgeSession) : null;
  const leads = byEmail.filter((l) => sameEmail(l.email, input.email));
  if (leads.length === 0 && !bridgeLead) return false;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('product_events')
    .select('id')
    .eq('event', 'read_purchase')
    .eq('props->>stripe_session_id', input.stripeSessionId)
    .limit(1);
  if (existingError) throw new Error(`read_purchase lookup failed: ${existingError.message}`);
  if (existing && (existing as unknown[]).length > 0) return false;

  // Attribute to the bridge's lead when we have it, else the newest lead for the email.
  const lead = bridgeLead ?? [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  if (input.userId) {
    await linkReadLeadsToUser({ userId: input.userId, email: input.email, sessionId: bridgeSession }).catch((err) =>
      console.warn('[read-link] link on purchase failed:', err?.message),
    );
  }

  await logReadEvent({
    sessionId: lead.session_id,
    leadId: lead.id,
    userId: input.userId ?? null,
    event: 'read_purchase',
    props: {
      product_slug: input.productSlug,
      amount: input.amount,
      stripe_session_id: input.stripeSessionId,
      pattern: lead.pattern,
      via_bridge: Boolean(bridgeLead),
      days_since_lead: Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000),
    },
  });
  return true;
}
