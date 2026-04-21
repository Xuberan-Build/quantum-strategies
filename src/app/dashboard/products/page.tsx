import { redirect } from 'next/navigation';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import styles from '../dashboard.module.css';
import { revalidatePath } from 'next/cache';
import { getProductBySlug } from '@/lib/constants/products';
import ProductTable from '@/components/dashboard/ProductTable';
import Link from 'next/link';
import { ALL_BETA_PRODUCTS } from '@/lib/beta/constants';
import BetaCommitmentModal from '@/components/beta/BetaCommitmentModal';

export const dynamic = 'force-dynamic';

async function createNewVersion(formData: FormData) {
  'use server';

  const productSlug = formData.get('productSlug') as string;
  const parentSessionId = formData.get('parentSessionId') as string;
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return;
  }

  // Call database function to create new version
  const { data: newSessionId, error } = await supabase.rpc(
    'create_session_version',
    {
      p_user_id: session.user.id,
      p_product_slug: productSlug,
      p_parent_session_id: parentSessionId,
    }
  );

  if (error) {
    console.error('Error creating new version:', error);
    return;
  }

  revalidatePath('/dashboard/products');
  redirect(`/products/${productSlug}/experience`);
}

async function getUserSessions(userId: string) {
  try {
    // Get only latest versions of each product
    const { data, error } = await supabaseAdmin
      .from('product_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching sessions:', error?.message || error);
      return [];
    }
    return data || [];
  } catch (e: any) {
    console.error('Error fetching sessions:', e?.message || e);
    return [];
  }
}

function getRiteLabel(productSlug: string) {
  if (productSlug.startsWith('perception-rite-')) {
    return 'Rite I';
  }
  if (productSlug === 'personal-alignment' || productSlug === 'business-alignment' || productSlug === 'brand-alignment' || productSlug === 'orientation-bundle') {
    return 'Rite II';
  }
  if (productSlug.startsWith('declaration-rite-')) {
    return 'Rite III';
  }
  return 'Other';
}

async function getLatestUnpaidBetaCompletion(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_access')
      .select('product_slug, completed_at, amount_paid')
      .eq('user_id', userId)
      .eq('access_granted', true)
      .not('completed_at', 'is', null)
      .in('product_slug', ALL_BETA_PRODUCTS as unknown as string[])
      .or('amount_paid.is.null,amount_paid.eq.0')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching unpaid beta completion:', error?.message || error);
      return null;
    }

    return data || null;
  } catch (e: any) {
    console.error('Error fetching unpaid beta completion:', e?.message || e);
    return null;
  }
}

export default async function ProductsDashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const [
    { data: user },
    { data: betaParticipant },
    { data: allProducts },
    { data: productAccess },
    sessions,
  ] = await Promise.all([
    supabase.from('users').select('id, name, email').eq('id', session.user.id).single(),
    supabase.from('beta_participants').select('id').eq('user_id', session.user.id).maybeSingle(),
    supabase
      .from('product_definitions')
      .select('product_slug, name, description, price, total_steps, estimated_duration, display_order')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('product_access')
      .select('product_slug, access_granted, started_at, completed_at, purchase_date, free_attempts_used, free_attempts_limit')
      .eq('user_id', session.user.id),
    getUserSessions(session.user.id),
  ]);

  const isBetaParticipant = Boolean(betaParticipant?.id);

  const products = (allProducts || []).map((product) => {
    const access = productAccess?.find(
      (a) => a.product_slug === product.product_slug && a.access_granted
    );
    return {
      product: product,
      access: access || null,
      hasAccess: !!access,
    };
  });

  const sessionBySlug = new Map(sessions.map((s) => [s.product_slug, s]));
  const attemptsBySlug = new Map(
    (productAccess || []).map((access) => [
      access.product_slug,
      {
        used: access.free_attempts_used || 0,
        limit: access.free_attempts_limit || 2,
        remaining: (access.free_attempts_limit || 2) - (access.free_attempts_used || 0),
      },
    ])
  );

  const nextActionItem = (() => {
    for (const s of sessions) {
      if (!s.completed_at) {
        return { slug: s.product_slug, label: 'Continue' };
      }
    }
    const unlocked = products.find((p: any) => p.hasAccess);
    if (unlocked) {
      return { slug: unlocked.product.product_slug, label: 'Start' };
    }
    const betaProduct = products.find((p: any) => ALL_BETA_PRODUCTS.includes(p.product.product_slug as any));
    if (betaProduct) {
      return { slug: 'beta', label: 'Join Beta' };
    }
    const first = products[0];
    if (first) {
      return { slug: first.product.product_slug, label: 'View' };
    }
    return null;
  })();

  const unpaidBetaCompletion = isBetaParticipant
    ? await getLatestUnpaidBetaCompletion(session.user.id)
    : null;

  const commitmentProduct = unpaidBetaCompletion
    ? getProductBySlug(unpaidBetaCompletion.product_slug)
    : null;

  return (
    <div className={styles.container}>
      {commitmentProduct && (
        <BetaCommitmentModal
          productSlug={commitmentProduct.slug}
          productName={commitmentProduct.name}
          price={commitmentProduct.price}
          completedAt={unpaidBetaCompletion?.completed_at}
        />
      )}
      <header className={styles.header}>
        <h1>Welcome back, {user?.name || 'there'}!</h1>
        <p className={styles.subtitle}>Manage your products and view your progress</p>
        <div className={styles.tabRow}>
          <Link
            href="/dashboard/products"
            className={`${styles.tabLink} ${styles.tabLinkActive}`}
          >
            Products
          </Link>
          <Link
            href="/dashboard/courses"
            className={styles.tabLink}
          >
            Courses
          </Link>
          <Link href="/dashboard/affiliate" className={styles.tabLink}>
            Affiliate
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <div className={styles.nextActionCard}>
            <div>
              <h2 className={styles.nextActionTitle}>Next Action</h2>
              <p className={styles.nextActionSubtitle}>
                Continue where you left off or start your next product.
              </p>
            </div>
            {nextActionItem ? (
              <Link
                href={nextActionItem.slug === 'beta' ? '/products/beta' : `/products/${nextActionItem.slug}/experience`}
                className={styles.nextActionButton}
              >
                {nextActionItem.label}{' '}
                {nextActionItem.slug === 'beta'
                  ? ''
                  : (getProductBySlug(nextActionItem.slug)?.name || nextActionItem.slug)}
              </Link>
            ) : (
              <span className={styles.nextActionEmpty}>No products available yet.</span>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2>Your Products</h2>
          {products.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No products available yet.</p>
            </div>
          ) : (
            <ProductTable
              rows={products.map((item: any) => {
                const product = item.product;
                const access = item.access;
                const hasAccess = item.hasAccess;
                const sessionRow = sessionBySlug.get(product.product_slug);
                const attempts = attemptsBySlug.get(product.product_slug);
                const completed = !!sessionRow?.completed_at || !!access?.completed_at;
                const started = !!sessionRow || !!access?.started_at;
                const status = !hasAccess
                  ? 'Locked'
                  : completed
                    ? 'Complete'
                    : started
                      ? 'In Progress'
                      : 'Ready';
                const statusClass = !hasAccess
                  ? 'statusLocked'
                  : completed
                    ? 'statusComplete'
                    : started
                      ? 'statusInProgress'
                      : 'statusUnlocked';
                const statusRank = status === 'In Progress'
                  ? 0
                  : status === 'Ready'
                    ? 1
                    : status === 'Locked'
                      ? 2
                      : 3;
                const totalSteps = Number(sessionRow?.total_steps || product.total_steps || 0);
                const currentStep = Number(sessionRow?.current_step || 0);
                const progressValue = completed
                  ? 1
                  : totalSteps
                    ? Math.min(currentStep / totalSteps, 1)
                    : 0;
                const progress = completed
                  ? '100%'
                  : sessionRow && totalSteps
                    ? `Step ${currentStep || 1} / ${totalSteps}`
                    : '0%';
                const lastActivity = sessionRow?.last_activity_at || sessionRow?.updated_at || access?.purchase_date;
                const lastActivityTimestamp = lastActivity
                  ? new Date(lastActivity).getTime()
                  : 0;
                const lastActivityLabel = lastActivity
                  ? new Date(lastActivity).toLocaleDateString()
                  : '—';
                const isBetaProduct = ALL_BETA_PRODUCTS.includes(product.product_slug as any);
                const primaryHref = !hasAccess
                  ? isBetaProduct
                    ? '/products/beta'
                    : `/products/${product.product_slug}#purchase`
                  : completed && sessionRow
                    ? `/dashboard/sessions/${sessionRow.id}`
                    : `/products/${product.product_slug}/experience`;
                const primaryLabel = !hasAccess
                  ? isBetaProduct
                    ? 'Join Beta (Free)'
                    : `Buy Access $${product.price}`
                  : completed
                    ? 'View Report'
                    : started
                      ? 'Continue Scan'
                      : 'Start Scan';

                return {
                  slug: product.product_slug,
                  name: product.name,
                  estimatedDuration: product.estimated_duration || '—',
                  totalSteps: Number(product.total_steps || 0),
                  riteLabel: getRiteLabel(product.product_slug),
                  displayOrder: product.display_order ?? 0,
                  statusLabel: status,
                  statusClass,
                  statusRank,
                  progressLabel: progress,
                  progressValue,
                  lastActivityLabel,
                  lastActivityTimestamp,
                  primaryHref,
                  primaryLabel,
                  primaryVariant: hasAccess ? 'primary' : 'purchase',
                  detailsHref: `/products/${product.product_slug}`,
                  showChat: completed && !!sessionRow,
                  chatHref: sessionRow ? `/dashboard/sessions/${sessionRow.id}` : undefined,
                  sessionId: sessionRow?.id,
                  attemptsRemaining: attempts?.remaining ?? null,
                };
              })}
              createNewVersionAction={createNewVersion}
            />
          )}
        </section>
      </main>
    </div>
  );
}
