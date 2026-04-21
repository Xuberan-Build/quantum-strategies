/**
 * Affiliate Email Sequence Cron Job
 * Runs every 5 minutes via Vercel Cron
 * Processes and sends automated affiliate invitation emails
 */

import { NextResponse } from 'next/server';
import { EmailSequenceService } from '@/lib/services/EmailSequenceService';
import { EmailTemplateService } from '@/lib/services/EmailTemplateService';
import { sendEmail } from '@/lib/email/gmail-sender';
import { sendEmailViaResend } from '@/lib/email/resend-sender';
import type { EmailSequence } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    // Verify cron secret (Vercel Cron sends this header)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[send-affiliate-emails] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[send-affiliate-emails] Starting email processing job');

    // Fetch up to 50 emails ready to send
    const emailsToSend = await EmailSequenceService.getEmailsToSend(50);

    if (emailsToSend.length === 0) {
      console.log('[send-affiliate-emails] No emails to send');
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        cancelled: 0,
        failed: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[send-affiliate-emails] Found ${emailsToSend.length} emails to process`);

    let sentCount = 0;
    let cancelledCount = 0;
    let failedCount = 0;

    // Process each email
    for (const email of emailsToSend) {
      try {
        // Blueprint follow-ups always send; affiliate check only applies to the invitation
        const isBlueprintEmail = email.sequence_type.startsWith('blueprint_');
        if (!isBlueprintEmail) {
          const isValid = await EmailSequenceService.isEmailStillValid(email.user_id);
          if (!isValid) {
            await EmailSequenceService.markAsCancelled(email.id);
            cancelledCount++;
            console.log(`[send-affiliate-emails] Cancelled email ${email.id} (user enrolled/opted out)`);
            continue;
          }
        }

        // Generate email template based on sequence type
        let emailTemplate;
        let fromEmail: string;
        let fromName: string;

        switch (email.sequence_type) {
          case 'affiliate_invitation':
            emailTemplate = EmailTemplateService.generateAffiliateInvitation(
              email.email_content,
              email.user_id
            );
            fromEmail = process.env.GMAIL_FROM_EMAIL || 'hello@quantumstrategies.online';
            fromName = process.env.GMAIL_FROM_NAME || 'Quantum Strategies';
            break;
          case 'blueprint_day1':
            emailTemplate = EmailTemplateService.generateBlueprintDay1(email.email_content);
            fromEmail = process.env.GMAIL_AUSTIN_EMAIL || 'austin@quantumstrategies.online';
            fromName = 'Austin';
            break;
          case 'blueprint_day3':
            emailTemplate = EmailTemplateService.generateBlueprintDay3(email.email_content);
            fromEmail = process.env.GMAIL_AUSTIN_EMAIL || 'austin@quantumstrategies.online';
            fromName = 'Austin';
            break;
          case 'blueprint_day7':
            emailTemplate = EmailTemplateService.generateBlueprintDay7(email.email_content);
            fromEmail = process.env.GMAIL_AUSTIN_EMAIL || 'austin@quantumstrategies.online';
            fromName = 'Austin';
            break;
          default:
            throw new Error(`Unknown sequence type: ${email.sequence_type}`);
        }

        const sendParams = {
          to: email.email_content.user_email,
          subject: emailTemplate.subject,
          html: emailTemplate.htmlContent,
          text: emailTemplate.textContent,
          fromEmail,
          fromName,
        };

        // Blueprint emails use Resend; affiliate emails use Gmail API
        const messageId = isBlueprintEmail
          ? await sendEmailViaResend(sendParams)
          : await sendEmail(sendParams);

        // Mark as sent
        await EmailSequenceService.markAsSent(email.id);
        sentCount++;

        console.log(
          `[send-affiliate-emails] Sent ${email.sequence_type} to ${email.email_content.user_email} (messageId: ${messageId})`
        );
      } catch (error: any) {
        // Mark as failed
        const failureReason = error?.message || 'Unknown error';
        await EmailSequenceService.markAsFailed(email.id, failureReason, true);
        failedCount++;

        console.error(`[send-affiliate-emails] Failed to send email ${email.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[send-affiliate-emails] Completed: ${sentCount} sent, ${cancelledCount} cancelled, ${failedCount} failed (${duration}ms)`
    );

    return NextResponse.json({
      success: true,
      processed: emailsToSend.length,
      sent: sentCount,
      cancelled: cancelledCount,
      failed: failedCount,
      duration,
    });
  } catch (error: any) {
    console.error('[send-affiliate-emails] Cron job error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to process emails',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
