import { NextRequest, NextResponse } from 'next/server';
import { updateSheetUnsubscribe } from '@/lib/google-sheets/sheet-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * API route to handle unsubscribe requests
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update Google Sheets to mark as unsubscribed
    await updateSheetUnsubscribe(email);

    console.log(`✅ Unsubscribed: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed',
    });
  } catch (error: any) {
    console.error('❌ Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
