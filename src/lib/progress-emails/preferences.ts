/**
 * Email preferences: one read and one write path for the dashboard and one-click opt-out.
 * Service role. Callers authenticate first (session or signed token).
 * No row means every topic is on.
 */
import { supabaseAdmin } from '@/lib/supabase/server';
import { DEFAULT_PREFERENCES, type EmailPreferences } from './topics';

export type PreferenceSource = 'dashboard' | 'one_click' | 'admin';

export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const { data, error } = await supabaseAdmin.from('email_preferences').select('progress, newsletter').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`email preferences: load failed: ${error.message}`);
  return data ?? DEFAULT_PREFERENCES;
}

export async function setEmailPreference(userId: string, changes: Partial<EmailPreferences>, via: PreferenceSource): Promise<EmailPreferences> {
  const next = { ...(await getEmailPreferences(userId)), ...changes };
  const { error } = await supabaseAdmin
    .from('email_preferences')
    .upsert({ user_id: userId, ...next, updated_via: via, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(`email preferences: save failed: ${error.message}`);
  return next;
}
