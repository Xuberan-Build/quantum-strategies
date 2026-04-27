import { requireActiveSubscription } from '@/lib/auth/session';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { LedgerList } from '@/components/rite-iv/LedgerList';
import type { AlignmentLedgerEntry } from '@/lib/types/rite-iv';
import Link from 'next/link';

async function getLedgerEntries(userId: string): Promise<AlignmentLedgerEntry[]> {
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

  const { data, error } = await supabase
    .from('alignment_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false });

  if (error) {
    console.error('Error fetching ledger:', error);
    return [];
  }

  return data as AlignmentLedgerEntry[];
}

export default async function LedgerPage() {
  const { session } = await requireActiveSubscription();
  const entries = await getLedgerEntries(session.user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alignment Ledger</h1>
            <p className="text-gray-600 mt-2">Your weekly accountability history</p>
          </div>
          <Link
            href="/ledger/new"
            className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700"
          >
            New Check-in
          </Link>
        </div>

        <LedgerList entries={entries} />
      </div>
    </div>
  );
}
