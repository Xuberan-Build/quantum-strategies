import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { pkcePair, randomState } from '@/lib/social/crypto';
import { jsonError, parsePlatform, requireAdmin, safeReturnTo, serverError, siteUrl } from '@/lib/social/api';
import { getAdapter, isConfigured, redirectUriFor } from '@/lib/social/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const platform = parsePlatform((await params).platform);
  if (!platform) return jsonError('Unknown platform', 404);
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('return_to'));

  if (!isConfigured(platform)) {
    return NextResponse.redirect(siteUrl(req, returnTo, { error: 'not_configured' }));
  }

  try {
    const adapter = getAdapter(platform);
    const state = randomState();
    const pkce = adapter.usesPkce ? pkcePair() : null;
    const { error } = await supabaseAdmin.from('social_oauth_states').insert({
      state,
      platform,
      code_verifier: pkce?.verifier ?? null,
      return_to: returnTo,
    });
    if (error) throw new Error(error.message);
    const url = adapter.getAuthUrl({ state, redirectUri: redirectUriFor(platform), codeChallenge: pkce?.challenge });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('[social] oauth start:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(siteUrl(req, returnTo, { error: 'Could not start the connection' }));
  }
}
