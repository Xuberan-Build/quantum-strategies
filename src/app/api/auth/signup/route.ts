import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rate-limit';

// Burst guard only: the store is per instance. The real limit is a Vercel WAF rule on this path.
const SIGNUP_LIMIT = { maxRequests: 5, windowMs: 10 * 60 * 1000 };

// Same message whether or not the email already has an account, so this endpoint
// can't be used to check who is a customer.
const CANNOT_CREATE =
  "We couldn't create an account with that email. If you already have one, sign in instead.";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    const ipCheck = checkRateLimit(`signup:ip:${clientIp(req)}`, SIGNUP_LIMIT);
    if (!ipCheck.allowed) {
      const retry = Math.max(1, Math.ceil((ipCheck.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(retry) } }
      );
    }

    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedName = name ? String(name).trim() : '';
    if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Password must be 8 to 128 characters.' }, { status: 400 });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: CANNOT_CREATE }, { status: 400 });
    }

    const createPayload = {
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: trimmedName || normalizedEmail.split('@')[0],
      },
    };

    const { data, error } = await supabaseAdmin.auth.admin.createUser(createPayload as any);
    if (error || !data?.user) {
      // An existing auth user without a public.users row lands here too; keep the reply generic.
      const status = (error as { status?: number } | null)?.status;
      if (status === 422 || /already.*(registered|exists)/i.test(error?.message ?? '')) {
        return NextResponse.json({ error: CANNOT_CREATE }, { status: 400 });
      }
      console.error('[signup] auth create failed:', error?.message);
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      requiresLogin: true,
    });
  } catch (error: any) {
    console.error('[signup] unexpected error:', error?.message);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
