import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    console.error('[auth/callback] Missing code parameter');
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Validate next param to prevent open redirect
  const safePaths = ['/dashboard', '/onboarding', '/billing'];
  const safeNext = safePaths.some(p => next.startsWith(p)) ? next : '/dashboard';

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] Code exchange failed:', error.message, error.code);
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'link_expired');
      return NextResponse.redirect(loginUrl.toString());
    }

    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
