import { createServerSupabaseClient } from '@/lib/supabase/server';
import AdminNav from '@/components/admin/AdminNav';
import styles from './admin-layout.module.css';

export const metadata = {
  title: 'Admin CMS - Quantum Strategies',
  description: 'Manage products, prompts, and content',
};

// Auth is handled by middleware.ts - this layout just renders
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  // Session is guaranteed by middleware, but TypeScript doesn't know that
  const email = session?.user?.email || '';

  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', session?.user?.id || '')
    .single();

  return (
    <div className={styles.adminContainer}>
      <AdminNav
        userName={user?.name || ''}
        userEmail={email}
        userRole="admin"
      />
      <main className={styles.adminMain}>{children}</main>
    </div>
  );
}
