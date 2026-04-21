/**
 * Admin Utilities
 * Helper functions for admin operations
 *
 * Note: Page auth is handled by middleware.ts at project root
 * API routes use validateAdminApiRequest() below
 */

import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import { BUSINESS } from '../../../config/business.config';

// Admin emails — sourced from ADMIN_EMAILS env var via business config (must match middleware.ts)
const ADMIN_EMAILS = BUSINESS.adminEmails;

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Validate admin API request
 * Use this in API routes under /api/admin/*
 */
export async function validateAdminApiRequest(): Promise<{
  admin: AdminUser | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { admin: null, error: 'Not authenticated' };
    }

    const email = session.user.email?.toLowerCase() || '';
    if (!ADMIN_EMAILS.includes(email)) {
      return { admin: null, error: 'Not authorized' };
    }

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', session.user.id)
      .single();

    return {
      admin: user ? { id: user.id, email: user.email, name: user.name } : null,
      error: user ? null : 'User not found',
    };
  } catch (err) {
    console.error('[Admin API] Validation error:', err);
    return { admin: null, error: 'Internal error' };
  }
}

/**
 * Log admin action to audit log
 */
export async function logAdminAction(params: {
  adminUserId: string;
  adminEmail: string;
  actionType: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_user_id: params.adminUserId,
      admin_email: params.adminEmail,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId || null,
      target_name: params.targetName || null,
      previous_value: params.previousValue || null,
      new_value: params.newValue || null,
    });
  } catch (error) {
    console.error('[Admin] Failed to log action:', error);
  }
}
