/** Signed-in user's email preferences (dashboard settings). */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parsePreferenceChanges } from '@/lib/progress-emails/topics';
import { setEmailPreference } from '@/lib/progress-emails/preferences';
import { errorMessage } from '@/lib/errors';

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const changes = parsePreferenceChanges(await req.json().catch(() => ({})));
  if (!changes) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  try {
    const preferences = await setEmailPreference(user.id, changes, 'dashboard');
    return NextResponse.json({ preferences });
  } catch (err) {
    console.error('[email-prefs] dashboard save failed:', errorMessage(err));
    return NextResponse.json({ error: 'Could not save your email settings' }, { status: 500 });
  }
}
