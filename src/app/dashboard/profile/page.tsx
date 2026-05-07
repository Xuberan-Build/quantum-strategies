import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ProfileEditor from '@/components/profile/ProfileEditor'
import ProfileSettings from '@/components/profile/ProfileSettings'
import GoalsList from '@/components/profile/goals/GoalsList'
import JourneyProgress from '@/components/profile/goals/JourneyProgress'
import { isPlacementsEmpty } from '@/lib/utils/placements'
import { computeRiteJourney } from '@/lib/profile/rite-journey'
import styles from '../dashboard.module.css'

export const dynamic = 'force-dynamic'

type Tab = 'settings' | 'goals' | 'chart'

type Props = {
  searchParams?: Promise<{ tab?: string; onboarding?: string }>
}

export default async function ProfilePage({ searchParams }: Props) {
  const supabase = await createServerSupabaseClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const tab: Tab = (sp?.tab as Tab) || 'settings'
  const showOnboarding = sp?.onboarding === 'beta'

  const [{ data: userData }, { data: accessRows }, { data: goalsData }] = await Promise.all([
    supabase
      .from('users')
      .select('name, email, company_name, ig_handle, placements, placements_confirmed, placements_updated_at')
      .eq('id', session.user.id)
      .single(),
    supabase
      .from('product_access')
      .select('product_slug, completed_at')
      .eq('user_id', session.user.id),
    supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true }),
  ])

  const journey = computeRiteJourney(accessRows ?? [])
  const needsPlacements =
    !userData?.placements_confirmed || isPlacementsEmpty(userData?.placements || null)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'goals', label: 'Goals' },
    { key: 'chart', label: 'Chart Data' },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Profile</h1>
        <p className={styles.subtitle}>Your identity, journey, and goals in one place</p>
      </div>

      <nav className={styles.tabRow}>
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/dashboard/profile?tab=${key}`}
            className={`${styles.tabLink} ${tab === key ? styles.tabLinkActive : ''}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className={styles.main}>
        {tab === 'settings' && (
          <ProfileSettings
            initialName={userData?.name || null}
            initialEmail={userData?.email || session.user.email || ''}
            initialCompanyName={userData?.company_name || null}
            initialIgHandle={userData?.ig_handle || null}
          />
        )}

        {tab === 'goals' && (
          <>
            <JourneyProgress journey={journey} />
            <GoalsList
              initialGoals={goalsData ?? []}
              journey={journey}
            />
          </>
        )}

        {tab === 'chart' && (
          <>
            {(showOnboarding || needsPlacements) && (
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
          </>
        )}
      </div>
    </div>
  )
}
