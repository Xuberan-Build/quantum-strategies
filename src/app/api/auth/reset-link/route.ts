import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/config/urls';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const redirectTo = `${APP_URL}/reset-password`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      if (error) {
        console.error('Reset link generation failed:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
      }
      return NextResponse.json(
        { error: error?.message || 'Failed to generate reset link' },
        { status: 500 }
      );
    }

    return NextResponse.json({ link: data.properties.action_link });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
