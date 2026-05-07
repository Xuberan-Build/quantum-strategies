import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookieOptions: {
      // Keep auth cookies alive for 1 year so sessions persist across browser restarts.
      // Actual session validity is governed by Supabase token settings (JWT + refresh token TTL).
      maxAge: 60 * 60 * 24 * 365,
    },
  }
);
