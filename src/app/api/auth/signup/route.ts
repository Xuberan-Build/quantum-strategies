import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedName = name ? String(name).trim() : '';
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: 'Account already exists. Please sign in.' }, { status: 409 });
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
      console.error('[signup] auth create failed:', error);
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      requiresLogin: true,
    });
  } catch (error: any) {
    console.error('[signup] unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unexpected error.' },
      { status: 500 }
    );
  }
}
