import { supabaseAdmin } from '@/lib/supabase/server';

// Call this after creating a new user account.
// Integration point: src/app/api/auth/signup/route.ts — after createUser succeeds
export async function enrollInSignupCampaigns(userId: string): Promise<void> {
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, campaign_steps(step_number, delay_hours)')
    .eq('trigger_type', 'on_signup')
    .eq('status', 'active');

  if (!campaigns?.length) return;

  for (const campaign of campaigns) {
    const steps = ((campaign.campaign_steps as any[]) || []).sort(
      (a, b) => a.step_number - b.step_number
    );
    const firstStep = steps[0];
    const delayHours = firstStep?.delay_hours ?? 0;
    const nextSendAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from('campaign_enrollments').upsert(
      {
        campaign_id: campaign.id,
        user_id: userId,
        status: 'active',
        current_step: 1,
        next_send_at: nextSendAt,
      },
      { onConflict: 'campaign_id,user_id', ignoreDuplicates: true }
    );
  }
}
