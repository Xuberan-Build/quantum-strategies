/**
 * Progress emails: all database I/O. Service role (email_sends is locked to it).
 *
 * The claim is an insert into email_sends; the unique (user_id, dedupe_key)
 * constraint means two concurrent runs can't both send the same email.
 */
import { supabaseAdmin } from '@/lib/supabase/server';
import { ALL_BETA_PRODUCTS } from '@/lib/beta/constants';
import { buildSnapshot, latestSessionUpdate, withSessionCompletions, type AccessRow, type ProgressSnapshot, type SessionRow } from './progress';
import type { SentRecord } from './schedule';

export interface Candidate {
  snapshot: ProgressSnapshot;
  history: SentRecord[];
}

export interface ProgressEmailStore {
  loadCandidates(now: Date): Promise<Candidate[]>;
  /** True when this run won the right to send; false when it's already claimed. */
  claim(userId: string, key: string, kind: string, mode: string): Promise<boolean>;
  markSent(userId: string, key: string): Promise<void>;
  /** Drops a claim after a failed send, so the next run can try again. */
  release(userId: string, key: string, reason: string): Promise<void>;
}

const UNIQUE_VIOLATION = '23505';

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    out.set(k, [...(out.get(k) ?? []), r]);
  }
  return out;
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`progress-emails: loading ${what} failed: ${error.message}`);
  return data ?? [];
}

/**
 * Candidates are customers: team accounts (any admin role, or an address in
 * `teamEmails`) never get progress emails and never show up in the founder digest.
 */
export function createSupabaseProgressStore(opts: { teamEmails?: string[] } = {}): ProgressEmailStore {
  const team = new Set((opts.teamEmails ?? []).map((e) => e.toLowerCase()));
  const isCustomer = (u: { email: string; role: string | null }) => (!u.role || u.role === 'user') && !team.has(u.email.toLowerCase());

  return {
    async loadCandidates(now) {
      const [users, access, sessions, prefs, sends] = await Promise.all([
        rows<{
          id: string;
          email: string;
          name: string | null;
          discord_username: string | null;
          phone: string | null;
          role: string | null;
          created_at: string;
        }>(supabaseAdmin.from('users').select('id, email, name, discord_username, phone, role, created_at'), 'users'),
        rows<AccessRow & { user_id: string }>(
          supabaseAdmin
            .from('product_access')
            .select('user_id, product_slug, completed_at')
            .in('product_slug', [...ALL_BETA_PRODUCTS]),
          'product_access',
        ),
        rows<SessionRow & { user_id: string }>(
          supabaseAdmin.from('product_sessions').select('user_id, product_slug, updated_at, completed_at'),
          'product_sessions',
        ),
        rows<{ user_id: string; progress: boolean; newsletter: boolean }>(
          supabaseAdmin.from('email_preferences').select('user_id, progress, newsletter'),
          'email_preferences',
        ),
        rows<{ user_id: string; dedupe_key: string; created_at: string }>(
          supabaseAdmin.from('email_sends').select('user_id, dedupe_key, created_at'),
          'email_sends',
        ),
      ]);

      const accessBy = groupBy(access, (r) => r.user_id);
      const sessionsBy = groupBy(sessions, (r) => r.user_id);
      const sendsBy = groupBy(sends, (r) => r.user_id);
      const prefsBy = new Map(prefs.map((p) => [p.user_id, p]));

      return users
        .filter((u) => u.email && isCustomer(u))
        .map((u) => ({
          snapshot: buildSnapshot(
            {
              user: {
                id: u.id,
                email: u.email,
                name: u.name,
                discordUsername: u.discord_username,
                phone: u.phone,
                createdAt: u.created_at,
              },
              access: withSessionCompletions(accessBy.get(u.id) ?? [], sessionsBy.get(u.id) ?? []),
              lastSessionAt: latestSessionUpdate(sessionsBy.get(u.id) ?? []),
              prefs: {
                progress: prefsBy.get(u.id)?.progress ?? true,
                newsletter: prefsBy.get(u.id)?.newsletter ?? true,
              },
            },
            now,
          ),
          history: (sendsBy.get(u.id) ?? []).map((s) => ({
            key: s.dedupe_key,
            at: s.created_at,
          })),
        }))
        .filter((c) => c.snapshot.eligible);
    },

    async claim(userId, key, kind, mode) {
      const { error } = await supabaseAdmin.from('email_sends').insert({ user_id: userId, dedupe_key: key, kind, mode });
      if (!error) return true;
      if (error.code === UNIQUE_VIOLATION) return false;
      throw new Error(`progress-emails: claim failed: ${error.message}`);
    },

    async markSent(userId, key) {
      const { error } = await supabaseAdmin
        .from('email_sends')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('dedupe_key', key);
      if (error) throw new Error(`progress-emails: markSent failed: ${error.message}`);
    },

    async release(userId, key, reason) {
      console.warn(`[progress-emails] releasing ${key} for ${userId}: ${reason}`);
      const { error } = await supabaseAdmin
        .from('email_sends')
        .delete()
        .eq('user_id', userId)
        .eq('dedupe_key', key)
        .eq('status', 'claimed');
      if (error) throw new Error(`progress-emails: release failed: ${error.message}`);
    },
  };
}
