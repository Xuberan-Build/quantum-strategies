/**
 * The Perception Read: persistence (service role only, server only).
 *
 * One product_sessions row per attempt (product_slug 'perception-read', user_id NULL),
 * held by an anonymous token: the browser keeps the raw token in the httpOnly cookie
 * `qs_read_token`, the row keeps only its sha256 (anon_token_hash).
 *
 *   step_data     { [questionId]: ReadAnswer }            (merged atomically by read_save_answer())
 *   session_data  ReadSessionData (variant, safety, scores, mirror, preview, result, feedback)
 *   utm           ReadUtm (incl. variant)
 *   lead_id       read_leads.id once the email gate is passed
 *
 * Signed result links (?t=) are HMAC-SHA256 over the session id and an expiry, keyed by
 * READ_LINK_SECRET (or, if unset, a key derived from SUPABASE_SERVICE_ROLE_KEY).
 *
 * Never log answer text or emails from here.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { READ_QUESTIONS } from './questions';
import {
  READ_PRODUCT_SLUG,
  type PatternId,
  type PatternScores,
  type ReadAnswer,
  type ReadAnswers,
  type ReadEvent,
  type ReadLeadInput,
  type ReadPreview,
  type ReadResult,
  type ReadUtm,
  type SafetyResult,
  type WeekMirror,
} from './types';

export const READ_TOKEN_COOKIE = 'qs_read_token';
/** Cookie lifetime: 90 days. */
export const READ_TOKEN_MAX_AGE_S = 60 * 60 * 24 * 90;
/** Signed result link lifetime: 180 days (covers the day-2/day-7 follow-ups with room to spare). */
export const READ_LINK_TTL_S = 60 * 60 * 24 * 180;

const SESSION_COLUMNS =
  'id, product_slug, user_id, lead_id, anon_token_hash, utm, step_data, session_data, completed_at, created_at';

export interface ReadFeedback {
  accuracy?: number;
  hardestPart?: string;
  hardestPartSafetyTier?: SafetyResult['tier'];
  moveCommitted?: boolean;
  updatedAt?: string;
}

export interface ReadSessionData {
  variant?: string | null;
  /** Worst safety tier seen so far (answers screened on save, re-screened on complete). */
  safety?: SafetyResult;
  scores?: PatternScores | null;
  mirror?: WeekMirror | null;
  preview?: ReadPreview;
  result?: ReadResult;
  unlockedAt?: string;
  feedback?: ReadFeedback;
}

export interface ReadSessionRow {
  id: string;
  product_slug: string;
  user_id: string | null;
  lead_id: string | null;
  anon_token_hash: string | null;
  utm: ReadUtm | null;
  step_data: ReadAnswers | null;
  session_data: ReadSessionData | null;
  completed_at: string | null;
  created_at: string;
}

/** What the email layer receives about a lead (src/lib/read/notify.ts). */
export interface ReadLeadRecord {
  id: string;
  email: string;
  consentMarketing: boolean;
  consentAt: string | null;
  unsubscribedAt: string | null;
  utm: ReadUtm | null;
  sessionId: string | null;
  pattern: PatternId | null;
  userId: string | null;
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

export function generateReadToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashReadToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createReadSession(
  utm?: ReadUtm | null,
  variant?: string | null
): Promise<{ sessionId: string; token: string }> {
  const token = generateReadToken();
  const v = variant ?? utm?.variant ?? null;
  const { data, error } = await supabaseAdmin
    .from('product_sessions')
    .insert({
      product_slug: READ_PRODUCT_SLUG,
      user_id: null,
      anon_token_hash: hashReadToken(token),
      utm: utm || v ? { ...(utm ?? {}), ...(v ? { variant: v } : {}) } : null,
      total_steps: READ_QUESTIONS.length,
      current_step: 1,
      current_section: 1,
      placements_confirmed: false,
      followup_counts: {},
      step_data: {},
      session_data: { variant: v } satisfies ReadSessionData,
      status: 'in_progress',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createReadSession failed: ${error?.message ?? 'no row'}`);
  return { sessionId: data.id as string, token };
}

export async function getReadSession(sessionId: string): Promise<ReadSessionRow | null> {
  if (!isUuid(sessionId)) return null;
  const { data, error } = await supabaseAdmin
    .from('product_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .eq('product_slug', READ_PRODUCT_SLUG)
    .maybeSingle();
  if (error) throw new Error(`getReadSession failed: ${error.message}`);
  return (data as ReadSessionRow | null) ?? null;
}

/** Returns the session when `token` is the one issued for it, else null. */
export async function verifyReadToken(
  sessionId: string,
  token: string | null | undefined
): Promise<ReadSessionRow | null> {
  if (!token || token.length > 200 || !isUuid(sessionId)) return null;
  const row = await getReadSession(sessionId);
  if (!row?.anon_token_hash) return null;
  return safeEqualHex(row.anon_token_hash, hashReadToken(token)) ? row : null;
}

/**
 * Merge one answer into step_data. Atomic (SQL function), refuses completed sessions.
 * Returns false when the session is missing or already complete.
 */
export async function saveAnswer(sessionId: string, answer: ReadAnswer, step?: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('read_save_answer', {
    p_session_id: sessionId,
    p_question_id: answer.questionId,
    p_answer: answer,
    p_step: step ?? null,
  });
  if (error) throw new Error(`saveAnswer failed: ${error.message}`);
  return data === true;
}

export async function loadAnswers(sessionId: string): Promise<ReadAnswers> {
  const row = await getReadSession(sessionId);
  return (row?.step_data as ReadAnswers) ?? {};
}

/** Shallow-merge into session_data. Read-modify-write; only used on low-concurrency steps. */
export async function updateSessionData(sessionId: string, patch: Partial<ReadSessionData>): Promise<ReadSessionData> {
  const row = await getReadSession(sessionId);
  if (!row) throw new Error('updateSessionData: session not found');
  const next: ReadSessionData = { ...(row.session_data ?? {}), ...patch };
  const { error } = await supabaseAdmin
    .from('product_sessions')
    .update({ session_data: next, last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('product_slug', READ_PRODUCT_SLUG);
  if (error) throw new Error(`updateSessionData failed: ${error.message}`);
  return next;
}

export async function markComplete(
  sessionId: string,
  data: Pick<ReadSessionData, 'safety' | 'scores' | 'mirror' | 'preview'>
): Promise<void> {
  const row = await getReadSession(sessionId);
  if (!row) throw new Error('markComplete: session not found');
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('product_sessions')
    .update({
      session_data: { ...(row.session_data ?? {}), ...data },
      completed_at: row.completed_at ?? now,
      is_complete: true,
      status: 'completed',
      last_activity_at: now,
    })
    .eq('id', sessionId)
    .eq('product_slug', READ_PRODUCT_SLUG);
  if (error) throw new Error(`markComplete failed: ${error.message}`);
}

// ─── Leads ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

interface LeadRow {
  id: string;
  email: string;
  consent_marketing: boolean;
  consent_at: string | null;
  unsubscribed_at: string | null;
  utm: ReadUtm | null;
  session_id: string | null;
  pattern: string | null;
  user_id: string | null;
}
const LEAD_COLUMNS = 'id, email, consent_marketing, consent_at, unsubscribed_at, utm, session_id, pattern, user_id';

function toLeadRecord(r: LeadRow): ReadLeadRecord {
  return {
    id: r.id,
    email: r.email,
    consentMarketing: r.consent_marketing,
    consentAt: r.consent_at,
    unsubscribedAt: r.unsubscribed_at,
    utm: r.utm,
    sessionId: r.session_id,
    pattern: (r.pattern as PatternId | null) ?? null,
    userId: r.user_id,
  };
}

/**
 * Create or refresh the lead for this email (one row per normalised email).
 * Marketing consent is only ever granted here (an unticked box never withdraws an earlier
 * yes; withdrawal is the unsubscribe path). consent_at records when it was given.
 */
export async function createLead(
  input: ReadLeadInput & { sessionId: string; pattern: PatternId | null; source?: string }
): Promise<ReadLeadRecord> {
  const email = normaliseEmail(input.email);
  if (!email) throw new Error('createLead: invalid email');
  const now = new Date().toISOString();

  const findExisting = async () => {
    const { data, error } = await supabaseAdmin.from('read_leads').select(LEAD_COLUMNS).eq('email', email).maybeSingle();
    if (error) throw new Error(`createLead lookup failed: ${error.message}`);
    return data as LeadRow | null;
  };

  const updateExisting = async (existing: LeadRow) => {
    const patch: Record<string, unknown> = {
      session_id: input.sessionId,
      pattern: input.pattern,
      updated_at: now,
    };
    if (!existing.utm && input.utm) patch.utm = input.utm;
    if (input.consentMarketing && (!existing.consent_marketing || existing.unsubscribed_at)) {
      patch.consent_marketing = true;
      patch.consent_at = now;
      patch.unsubscribed_at = null;
    }
    const { data, error } = await supabaseAdmin
      .from('read_leads')
      .update(patch)
      .eq('id', existing.id)
      .select(LEAD_COLUMNS)
      .single();
    if (error || !data) throw new Error(`createLead update failed: ${error?.message ?? 'no row'}`);
    return toLeadRecord(data as LeadRow);
  };

  const existing = await findExisting();
  if (existing) return updateExisting(existing);

  const { data, error } = await supabaseAdmin
    .from('read_leads')
    .insert({
      email,
      consent_marketing: input.consentMarketing,
      consent_at: input.consentMarketing ? now : null,
      utm: input.utm ?? null,
      source: input.source ?? 'perception-read',
      session_id: input.sessionId,
      pattern: input.pattern,
    })
    .select(LEAD_COLUMNS)
    .single();

  if (error?.code === '23505') {
    // Lost a race with a parallel submit for the same email.
    const raced = await findExisting();
    if (raced) return updateExisting(raced);
  }
  if (error || !data) throw new Error(`createLead insert failed: ${error?.message ?? 'no row'}`);
  return toLeadRecord(data as LeadRow);
}

export async function linkLeadToSession(sessionId: string, leadId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('product_sessions')
    .update({ lead_id: leadId })
    .eq('id', sessionId)
    .eq('product_slug', READ_PRODUCT_SLUG);
  if (error) throw new Error(`linkLeadToSession failed: ${error.message}`);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface RecordEventInput {
  event: ReadEvent | (string & {});
  sessionId?: string | null;
  leadId?: string | null;
  userId?: string | null;
  step?: string | number | null;
  /** Tags, counts and ids only. Never answer text, never email. */
  props?: Record<string, unknown>;
  productSlug?: string;
}

/** Best effort: an analytics failure never fails the request. */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('product_events').insert({
      session_id: input.sessionId ?? null,
      lead_id: input.leadId ?? null,
      user_id: input.userId ?? null,
      product_slug: input.productSlug ?? READ_PRODUCT_SLUG,
      event: input.event,
      step: input.step === undefined || input.step === null ? null : String(input.step),
      props: input.props ?? {},
    });
    if (error) console.error(`[read] recordEvent ${input.event} failed: ${error.message}`);
  } catch (e) {
    console.error(`[read] recordEvent ${input.event} threw: ${(e as Error).message}`);
  }
}

/** The fields every Read event carries (spec v3 §11): pattern, segment, utm, lead. */
export function eventContext(row: ReadSessionRow | null): { leadId: string | null; props: Record<string, unknown> } {
  if (!row) return { leadId: null, props: {} };
  const sd = row.session_data ?? {};
  const segTag = row.step_data?.q1?.choice?.[0] ?? null;
  return {
    leadId: row.lead_id,
    props: {
      pattern: sd.safety?.tier === 'crisis' ? null : sd.scores?.pattern ?? null,
      segment: segTag,
      utm: row.utm ?? null,
    },
  };
}

// ─── Signed result links ─────────────────────────────────────────────────────

function readLinkSecret(): Buffer {
  const explicit = process.env.READ_LINK_SECRET;
  if (explicit && explicit.length >= 32) return Buffer.from(explicit, 'utf8');
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('READ_LINK_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  // Domain-separated key derived from an existing server secret.
  return createHmac('sha256', base).update('qs-read-result-link-v1').digest();
}

function linkSignature(sessionId: string, exp: number): string {
  return createHmac('sha256', readLinkSecret()).update(`read-result:${sessionId}:${exp}`).digest('base64url');
}

export function signResultToken(sessionId: string, ttlSeconds = READ_LINK_TTL_S, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  return `${exp}.${linkSignature(sessionId, exp)}`;
}

export function verifyResultToken(sessionId: string, t: string | null | undefined, nowMs = Date.now()): boolean {
  if (!t || t.length > 200 || !isUuid(sessionId)) return false;
  const [expStr, sig, extra] = t.split('.');
  if (!expStr || !sig || extra !== undefined || !/^\d{1,12}$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (exp * 1000 < nowMs) return false;
  const expected = Buffer.from(linkSignature(sessionId, exp), 'utf8');
  const given = Buffer.from(sig, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function readBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://www.quantumstrategies.online'
  ).replace(/\/+$/, '');
}

export function resultUrl(sessionId: string): string {
  return `${readBaseUrl()}/read/result/${sessionId}/?t=${encodeURIComponent(signResultToken(sessionId))}`;
}
