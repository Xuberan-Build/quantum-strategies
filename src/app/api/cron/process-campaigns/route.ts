import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendEmailViaResend } from '@/lib/email/resend-sender';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { processed: 0, sent: 0, completed: 0, errors: 0 };

  // Fetch all active enrollments due to send
  const { data: dueEnrollments, error: fetchError } = await supabaseAdmin
    .from('campaign_enrollments')
    .select(`
      id, campaign_id, user_id, current_step, next_send_at,
      campaigns(id, name, from_name, from_email, status),
      users(id, name, email)
    `)
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(100);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  for (const enrollment of dueEnrollments || []) {
    results.processed++;

    const campaign = enrollment.campaigns as any;
    const user = enrollment.users as any;

    // Skip if campaign is not active
    if (!campaign || campaign.status !== 'active') continue;
    if (!user?.email) continue;

    try {
      // Get the current step
      const { data: step } = await supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('campaign_id', enrollment.campaign_id)
        .eq('step_number', enrollment.current_step)
        .single();

      if (!step) {
        // No step found — mark complete
        await supabaseAdmin
          .from('campaign_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        results.completed++;
        continue;
      }

      // Personalize content
      const firstName = (user.name || '').split(' ')[0] || 'there';
      const subject = step.subject.replace(/\{\{name\}\}/g, firstName);
      const htmlBody = step.html_body.replace(/\{\{name\}\}/g, firstName);
      const textBody = (step.text_body || '').replace(/\{\{name\}\}/g, firstName);

      // Send via Resend
      const resendId = await sendEmailViaResend({
        to: user.email,
        subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]+>/g, ' ').trim(),
        fromName: campaign.from_name,
        fromEmail: campaign.from_email,
      });

      // Log the send
      await supabaseAdmin.from('campaign_sends').insert({
        enrollment_id: enrollment.id,
        campaign_id: enrollment.campaign_id,
        user_id: enrollment.user_id,
        step_number: enrollment.current_step,
        resend_id: resendId,
        status: 'sent',
      });

      // Find next step
      const { data: nextStep } = await supabaseAdmin
        .from('campaign_steps')
        .select('step_number, delay_hours')
        .eq('campaign_id', enrollment.campaign_id)
        .eq('step_number', enrollment.current_step + 1)
        .maybeSingle();

      if (nextStep) {
        const nextSendAt = new Date(Date.now() + nextStep.delay_hours * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('campaign_enrollments')
          .update({ current_step: nextStep.step_number, next_send_at: nextSendAt })
          .eq('id', enrollment.id);
      } else {
        // Last step sent — mark complete
        await supabaseAdmin
          .from('campaign_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        results.completed++;
      }

      results.sent++;
    } catch (err: any) {
      results.errors++;

      // Log the failed send
      await supabaseAdmin.from('campaign_sends').insert({
        enrollment_id: enrollment.id,
        campaign_id: enrollment.campaign_id,
        user_id: enrollment.user_id,
        step_number: enrollment.current_step,
        status: 'failed',
        error_message: err.message,
      });

      // Mark enrollment as failed after too many errors — for now just log
      console.error(`Campaign send failed for enrollment ${enrollment.id}:`, err.message);
    }
  }

  return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
}

export const dynamic = 'force-dynamic';
