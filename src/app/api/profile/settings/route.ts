import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parsePhoneInput } from '@/lib/profile/phone';

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, company_name, ig_handle, phone } = body;

    // Update users table fields
    const updates: Record<string, string | null> = {};
    if (name !== undefined) updates.name = name || null;
    if (company_name !== undefined) updates.company_name = company_name || null;
    if (ig_handle !== undefined) updates.ig_handle = ig_handle || null;
    if (phone !== undefined) {
      const parsed = parsePhoneInput(phone);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      updates.phone = parsed.value;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile settings:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }
    }

    // Email update goes through Supabase auth (triggers confirmation email)
    if (email && email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        return NextResponse.json({ error: emailError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, emailPending: true });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Profile settings PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
