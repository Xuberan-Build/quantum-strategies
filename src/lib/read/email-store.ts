/**
 * The Perception Read: persistence for emails, answers, unsubscribe and the
 * lead→account link. Service role only (read_leads and product_events have RLS on
 * with no public policies).
 *
 * Tables (migration owned by the engine/API agent):
 *   read_leads(id, email, consent_marketing, consent_at, utm, source, session_id,
 *              pattern, user_id, unsubscribed_at, created_at)
 *   product_events(id, session_id, lead_id, user_id, product_slug, event, step, props, created_at)
 *
 * Event names written here (free-text `event` column):
 *   read_email_sent           props { email: 'r1'|'day2'|'day7', status: 'claimed'|'sent', mode, transport }
 *   read_email_failed         props { email, error }
 *   read_followups_scheduled  props: FollowupContext
 *   read_unsubscribed         props { via }
 *   day7_pmf / day7_rerating / move_done_day7 / day7_pmf_followup
 *   read_checkout_started / read_purchase / read_lead_linked
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { READ_PRODUCT_SLUG, type PatternId } from './types';

export interface ReadLeadRow {
  id: string;
  email: string;
  consent_marketing: boolean | null;
  session_id: string | null;
  pattern: PatternId | null;
  user_id: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

export type ReadEmailKindId = 'r1' | 'day2' | 'day7';

/** What the follow-ups need, captured at unlock so the cron doesn't rebuild the result. */
export interface FollowupContext {
  pattern: PatternId;
  patternName: string | null;
  move: string | null;
  watch: string | null;
  baseline: number | null;
  resultUrl: string | null;
}

export interface ReadEventInput {
  sessionId?: string | null;
  leadId?: string | null;
  userId?: string | null;
  event: string;
  step?: string | null;
  props?: Record<string, unknown>;
}

const LEAD_COLUMNS = 'id, email, consent_marketing, session_id, pattern, user_id, unsubscribed_at, created_at';

export async function logReadEvent(input: ReadEventInput): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('product_events')
    .insert({
      session_id: input.sessionId ?? null,
      lead_id: input.leadId ?? null,
      user_id: input.userId ?? null,
      product_slug: READ_PRODUCT_SLUG,
      event: input.event,
      step: input.step ?? null,
      props: input.props ?? {},
    })
    .select('id')
    .single();
  if (error) throw new Error(`product_events insert failed: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function getLeadById(leadId: string): Promise<ReadLeadRow | null> {
  const { data, error } = await supabaseAdmin.from('read_leads').select(LEAD_COLUMNS).eq('id', leadId).maybeSingle();
  if (error) throw new Error(`read_leads lookup failed: ${error.message}`);
  return (data as ReadLeadRow | null) ?? null;
}

/** The newest lead captured for a Read session. */
export async function getLeadBySession(sessionId: string): Promise<ReadLeadRow | null> {
  const { data, error } = await supabaseAdmin
    .from('read_leads')
    .select(LEAD_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`read_leads lookup failed: ${error.message}`);
  return ((data as ReadLeadRow[] | null) ?? [])[0] ?? null;
}

/** Leads by email, case-insensitive (ilike with no wildcards; % and _ escaped). */
export async function getLeadsByEmail(email: string): Promise<ReadLeadRow[]> {
  const escaped = email.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabaseAdmin.from('read_leads').select(LEAD_COLUMNS).ilike('email', escaped).limit(50);
  if (error) throw new Error(`read_leads lookup failed: ${error.message}`);
  return (data as ReadLeadRow[] | null) ?? [];
}

// ── Follow-up scheduler store ─────────────────────────────────────────────

/** The cron's view of the database, so the scheduler logic can be tested without Supabase. */
export interface FollowupStore {
  /** Consented, not unsubscribed, with a pattern, created in [from, to). */
  listCandidates(from: Date, to: Date): Promise<ReadLeadRow[]>;
  /** Every lead for these emails (to send only to the newest lead per person). */
  listLeadsByEmails(emails: string[]): Promise<Pick<ReadLeadRow, 'id' | 'email' | 'created_at'>[]>;
  /** `${leadId}:${kind}` for every email already claimed or sent. */
  sentKeys(leadIds: string[]): Promise<Set<string>>;
  contexts(leadIds: string[]): Promise<Map<string, FollowupContext>>;
  /**
   * Claim the right to send `kind` to this lead. Inserts a marker, then checks that
   * this marker is the earliest one for (lead, kind): concurrent runs can't both win.
   * Returns the marker id, or null when someone else holds it.
   */
  claim(lead: ReadLeadRow, kind: ReadEmailKindId): Promise<string | null>;
  markSent(markerId: string, kind: ReadEmailKindId, props: Record<string, unknown>): Promise<void>;
  /** Drop a claim after a failed send so the next run retries. */
  release(markerId: string): Promise<void>;
  logEvent(input: ReadEventInput): Promise<void>;
}

async function markersFor(leadIds: string[], kind?: ReadEmailKindId) {
  if (leadIds.length === 0) return [] as { id: string; lead_id: string; props: any; created_at: string }[];
  let q = supabaseAdmin
    .from('product_events')
    .select('id, lead_id, props, created_at')
    .eq('event', 'read_email_sent')
    .in('lead_id', leadIds);
  if (kind) q = q.eq('props->>email', kind);
  const { data, error } = await q;
  if (error) throw new Error(`product_events lookup failed: ${error.message}`);
  return (data as { id: string; lead_id: string; props: any; created_at: string }[] | null) ?? [];
}

export const supabaseFollowupStore: FollowupStore = {
  async listCandidates(from, to) {
    const { data, error } = await supabaseAdmin
      .from('read_leads')
      .select(LEAD_COLUMNS)
      .eq('consent_marketing', true)
      .is('unsubscribed_at', null)
      .not('pattern', 'is', null)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(`read_leads candidates failed: ${error.message}`);
    return (data as ReadLeadRow[] | null) ?? [];
  },

  async listLeadsByEmails(emails) {
    if (emails.length === 0) return [];
    const { data, error } = await supabaseAdmin.from('read_leads').select('id, email, created_at').in('email', emails);
    if (error) throw new Error(`read_leads by email failed: ${error.message}`);
    return (data as Pick<ReadLeadRow, 'id' | 'email' | 'created_at'>[] | null) ?? [];
  },

  async sentKeys(leadIds) {
    const rows = await markersFor(leadIds);
    return new Set(rows.map((r) => `${r.lead_id}:${r.props?.email}`));
  },

  async contexts(leadIds) {
    const map = new Map<string, FollowupContext>();
    if (leadIds.length === 0) return map;
    const { data, error } = await supabaseAdmin
      .from('product_events')
      .select('lead_id, props, created_at')
      .eq('event', 'read_followups_scheduled')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`followup context lookup failed: ${error.message}`);
    for (const row of (data as { lead_id: string; props: FollowupContext }[] | null) ?? []) {
      map.set(row.lead_id, row.props); // ascending, so the newest wins
    }
    return map;
  },

  async claim(lead, kind) {
    const { data, error } = await supabaseAdmin
      .from('product_events')
      .insert({
        session_id: lead.session_id,
        lead_id: lead.id,
        user_id: lead.user_id,
        product_slug: READ_PRODUCT_SLUG,
        event: 'read_email_sent',
        props: { email: kind, status: 'claimed' },
      })
      .select('id')
      .single();
    if (error) {
      // 23505: a unique index on (lead_id, props->>'email') for this event already holds it.
      if ((error as { code?: string }).code === '23505') return null;
      throw new Error(`claim insert failed: ${error.message}`);
    }
    const mine = (data as { id: string }).id;
    const rows = await markersFor([lead.id], kind);
    rows.sort((a, b) => (a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at)));
    if (rows.length > 0 && rows[0].id !== mine) {
      await supabaseAdmin.from('product_events').delete().eq('id', mine);
      return null;
    }
    return mine;
  },

  async markSent(markerId, kind, props) {
    const { error } = await supabaseAdmin
      .from('product_events')
      .update({ props: { email: kind, status: 'sent', ...props } })
      .eq('id', markerId);
    if (error) console.warn('[read-email] could not mark sent:', error.message);
  },

  async release(markerId) {
    const { error } = await supabaseAdmin.from('product_events').delete().eq('id', markerId);
    if (error) console.warn('[read-email] could not release claim:', error.message);
  },

  async logEvent(input) {
    await logReadEvent(input);
  },
};

// ── Unsubscribe ───────────────────────────────────────────────────────────

/** Unsubscribes every lead with this lead's email. Idempotent. Returns false if the lead is unknown. */
export async function unsubscribeLead(leadId: string, via: string): Promise<boolean> {
  const lead = await getLeadById(leadId);
  if (!lead) return false;
  const siblings = await getLeadsByEmail(lead.email);
  const ids = Array.from(new Set([lead.id, ...siblings.map((l) => l.id)]));
  const { error } = await supabaseAdmin
    .from('read_leads')
    .update({ unsubscribed_at: new Date().toISOString() })
    .in('id', ids)
    .is('unsubscribed_at', null);
  if (error) throw new Error(`unsubscribe failed: ${error.message}`);
  if (!lead.unsubscribed_at) {
    await logReadEvent({ sessionId: lead.session_id, leadId: lead.id, userId: lead.user_id, event: 'read_unsubscribed', props: { via } }).catch(
      (err) => console.warn('[read-email] unsubscribe event not logged:', err?.message),
    );
  }
  return true;
}
