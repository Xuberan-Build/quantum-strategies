import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import ProfileEditor from '@/components/profile/ProfileEditor';
import ProfileSettings from '@/components/profile/ProfileSettings';
import { isPlacementsEmpty } from '@/lib/utils/placements';
import styles from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

type ProfilePageProps = {
  searchParams?: { onboarding?: string };
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch user's profile fields
  const { data: userData, error } = await supabase
    .from('users')
    .select('name, email, company_name, ig_handle, placements, placements_confirmed, placements_updated_at')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
  }

  const needsPlacements =
    !userData?.placements_confirmed || isPlacementsEmpty(userData?.placements || null);
  const showOnboarding = searchParams?.onboarding === 'beta' || needsPlacements;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Your Chart Data</h1>
        <p className={styles.subtitle}>
          Manage your astrology and Human Design placements in one place
        </p>
      </div>
      <div className={styles.main}>
        <ProfileSettings
          initialName={userData?.name || null}
          initialEmail={userData?.email || session.user.email || ''}
          initialCompanyName={userData?.company_name || null}
          initialIgHandle={userData?.ig_handle || null}
        />
        {showOnboarding && (
          <div className={styles.onboardingCard}>
            <div>
              <h2 className={styles.onboardingTitle}>Step 1: Verify your charts</h2>
              <p className={styles.onboardingText}>
                Upload your astrology + Human Design charts so we can extract placements and
                personalize every beta product. Review and confirm before you continue.
              </p>
              <div className={styles.onboardingSteps}>
                <span>1) Upload charts</span>
                <span>2) Review placements</span>
                <span>3) Confirm accuracy</span>
              </div>
            </div>
            <div className={styles.onboardingBadge}>Beta Onboarding</div>
          </div>
        )}
        <ProfileEditor
          initialPlacements={userData?.placements || null}
          placementsConfirmed={userData?.placements_confirmed || false}
          placementsUpdatedAt={userData?.placements_updated_at || null}
          userId={session.user.id}
        />
      </div>
    </div>
  );
}
