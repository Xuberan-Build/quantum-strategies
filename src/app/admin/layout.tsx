import { createServerSupabaseClient } from '@/lib/supabase/server';
import AdminNav from '@/components/admin/AdminNav';
import styles from './admin-layout.module.css';
import { redirect } from 'next/navigation';
import { BUSINESS } from '@/config/business.config';

export const metadata = {
  title: 'Admin CMS - Quantum Strategies',
  description: 'Manage products, prompts, and content',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // Defense-in-depth: re-check auth independently of middleware
  if (!authUser || !(BUSINESS.adminEmails as readonly string[]).includes(authUser.email?.toLowerCase() ?? '')) {
    redirect('/login');
  }

  const email = authUser.email || '';

  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', authUser.id)
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
