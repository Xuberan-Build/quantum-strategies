import { requireActiveSubscription } from '@/lib/auth/session';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getISOWeekMonday } from '@/lib/utils/date-helpers';
import { redirect } from 'next/navigation';
import { NewCheckinForm } from '@/components/rite-iv/NewCheckinForm';

async function checkThisWeekSubmitted(userId: string): Promise<boolean> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const thisWeekMonday = getISOWeekMonday();
  const { data } = await supabase
    .from('alignment_ledger')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', thisWeekMonday)
    .single();

  return !!data;
}

export default async function NewCheckinPage() {
  const { session } = await requireActiveSubscription();

  const alreadySubmitted = await checkThisWeekSubmitted(session.user.id);

  if (alreadySubmitted) {
    redirect('/ledger?error=already_submitted');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Weekly Check-in</h1>
          <p className="text-gray-600 mt-2">
            Report on this week's decisions, actions, signal, and drift
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <NewCheckinForm userId={session.user.id} />
        </div>
      </div>
    </div>
  );
}
