import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    console.error('[auth/callback] Missing code parameter');
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Validate next param to prevent open redirect
  const safePaths = ['/dashboard', '/onboarding', '/billing', '/reset-password'];
  const safeNext = safePaths.some(p => next.startsWith(p)) ? next : '/dashboard';

  // Create the redirect response first so we can attach session cookies directly to it.
  // Using createServerSupabaseClient() here would write cookies to a separate internal
  // response, which gets discarded when we return NextResponse.redirect — leaving the
  // browser with no session and bouncing back to /login.
  const redirectResponse = NextResponse.redirect(`${origin}${safeNext}`);

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] Code exchange failed:', error.message, error.code);
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'link_expired');
      return NextResponse.redirect(loginUrl.toString());
    }

    return redirectResponse;
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
