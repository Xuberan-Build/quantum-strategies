/** Admin: set a user's phone number (for follow-up calls). */
import { NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { parsePhoneInput } from '@/lib/profile/phone';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = parsePhoneInput(body?.phone);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { error } = await supabaseAdmin.from('users').update({ phone: parsed.value }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save the phone number' }, { status: 500 });
  return NextResponse.json({ phone: parsed.value });
}
