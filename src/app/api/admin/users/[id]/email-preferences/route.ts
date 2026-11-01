/** Admin: change a user's email preferences (recorded as updated_via = 'admin'). */
import { NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { parsePreferenceChanges } from '@/lib/progress-emails/topics';
import { setEmailPreference } from '@/lib/progress-emails/preferences';
import { errorMessage } from '@/lib/errors';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;
  const changes = parsePreferenceChanges(await req.json().catch(() => ({})));
  if (!changes) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  try {
    return NextResponse.json({ preferences: await setEmailPreference(id, changes, 'admin') });
  } catch (err) {
    console.error('[email-prefs] admin save failed:', errorMessage(err));
    return NextResponse.json({ error: 'Could not save email settings' }, { status: 500 });
  }
}
