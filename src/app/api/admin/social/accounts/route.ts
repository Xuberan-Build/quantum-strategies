import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PUBLIC_ACCOUNT_COLUMNS, toPublicAccount } from '@/lib/social/accounts';
import { requireAdmin, serverError } from '@/lib/social/api';
import { ADAPTERS, isConfigured } from '@/lib/social/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  try {
    const { data, error } = await supabaseAdmin
      .from('social_accounts')
      .select(PUBLIC_ACCOUNT_COLUMNS)
      .order('connected_at', { ascending: true });
    if (error) throw new Error(error.message);
    const platforms = Object.values(ADAPTERS).map((a) => ({
      platform: a!.platform,
      label: a!.label,
      formats: a!.formats,
      configured: isConfigured(a!.platform),
      requiredEnv: a!.requiredEnv,
    }));
    return NextResponse.json({ accounts: (data ?? []).map((r) => toPublicAccount(r as Record<string, any>)), platforms });
  } catch (err) {
    return serverError('list accounts', err);
  }
}
