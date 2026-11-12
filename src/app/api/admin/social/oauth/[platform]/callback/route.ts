import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { upsertConnectedAccounts } from '@/lib/social/accounts';
import { jsonError, parsePlatform, requireAdmin, safeReturnTo, siteUrl } from '@/lib/social/api';
import { getAdapter, redirectUriFor } from '@/lib/social/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MS = 15 * 60 * 1000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const platform = parsePlatform((await params).platform);
  if (!platform) return jsonError('Unknown platform', 404);

  const sp = req.nextUrl.searchParams;
  const state = sp.get('state');
  const code = sp.get('code');

  // Look up (and consume) the state first so we know where to send the admin back to.
  let returnTo = '/admin/social/accounts';
  let verifier: string | null = null;
  let stateOk = false;
  if (state) {
    const { data } = await supabaseAdmin.from('social_oauth_states').select('*').eq('state', state).maybeSingle();
    if (data) {
      await supabaseAdmin.from('social_oauth_states').delete().eq('state', state);
      returnTo = safeReturnTo(data.return_to);
      verifier = data.code_verifier ?? null;
      stateOk = data.platform === platform && Date.now() - new Date(data.created_at).getTime() < STATE_TTL_MS;
    }
  }
  const fail = (message: string) => NextResponse.redirect(siteUrl(req, returnTo, { error: message.slice(0, 120) }));

  if (!stateOk) return fail('Connection expired or invalid. Try again');
  const providerError = sp.get('error');
  if (providerError) return fail(sp.get('error_description') || providerError);
  if (!code) return fail('No authorisation code returned');

  try {
    const inputs = await getAdapter(platform).exchangeCode({ code, redirectUri: redirectUriFor(platform), codeVerifier: verifier ?? undefined });
    if (inputs.length === 0) return fail('No accounts were returned for this login');
    await upsertConnectedAccounts(supabaseAdmin, inputs);
    return NextResponse.redirect(siteUrl(req, returnTo, { connected: platform }));
  } catch (err) {
    console.error('[social] oauth callback:', platform, err instanceof Error ? err.message : err);
    return fail('Could not complete the connection');
  }
}
