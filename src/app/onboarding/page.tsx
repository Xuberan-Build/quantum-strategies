import { redirect } from 'next/navigation';
import { requireAuth, hasCompletedOnboarding } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/rite-iv/OnboardingForm';
import styles from './onboarding.module.css';
import type { OnboardingData } from '@/lib/types/rite-iv';

function getStepAnswer(stepData: Record<string, any> | null, stepNumber: number): string {
  if (!stepData) return '';
  const step = stepData[`step_${stepNumber}`];
  if (!step) return '';
  return (typeof step.answer === 'string' ? step.answer : '') ||
         (typeof step === 'string' ? step : '');
}

async function prefetchRiteData(userId: string): Promise<Partial<OnboardingData>> {
  const supabase = await createServerSupabaseClient();

  // Fetch user profile for name
  const { data: userRecord } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single();

  // Fetch most recent completed sessions for key products
  const { data: sessions } = await supabase
    .from('product_sessions')
    .select('product_slug, step_data, deliverable_content, is_complete')
    .eq('user_id', userId)
    .eq('is_latest_version', true)
    .in('product_slug', ['personal-alignment', 'business-alignment', 'brand-alignment'])
    .order('created_at', { ascending: false });

  const bySlug: Record<string, any> = {};
  for (const s of sessions || []) {
    if (!bySlug[s.product_slug]) bySlug[s.product_slug] = s;
  }

  const businessSession = bySlug['business-alignment'];
  const personalSession = bySlug['personal-alignment'];

  // business-alignment step 2: "Describe your business... what do you do and who do you serve?"
  const bizStep2 = getStepAnswer(businessSession?.step_data, 2);
  // business-alignment step 5: "What does success look like... what do you want to build?"
  const bizStep5 = getStepAnswer(businessSession?.step_data, 5);
  // personal-alignment step 2: life satisfaction & core values (what lights them up)
  const personalStep2 = getStepAnswer(personalSession?.step_data, 2);

  const prefill: Partial<OnboardingData> = {
    canonical_identity: [
      userRecord?.name || '',  // Who you are
      bizStep2 || personalStep2 || '',  // What you do
      '',                              // Who you serve
      '',                              // What you don't do
    ],
    current_offer: bizStep2 || bizStep5 || '',
    current_price: 0,
    current_channel: '',
    current_target: bizStep2 || '',
  };

  return prefill;
}

export default async function OnboardingPage() {
  const session = await requireAuth();

  const completed = await hasCompletedOnboarding(session.user.id);
  if (completed) {
    redirect('/dashboard');
  }

  const prefill = await prefetchRiteData(session.user.id);

  return (
    <div className={styles.page}>
      {/* Background */}
      <div className={styles.background}>
        <div className={styles.gridOverlay} />
        <div className={styles.radialGlow} />
      </div>

      {/* Content */}
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.badge}>RITE IV — EXECUTION</div>
          <h1 className={styles.title}>Set Up Your Execution System</h1>
          <p className={styles.subtitle}>
            Lock in your canonical configuration from Rites I–III to activate your accountability infrastructure.
          </p>
        </div>

        <OnboardingForm userId={session.user.id} initialData={prefill} styles={styles} />
      </div>
    </div>
  );
}
