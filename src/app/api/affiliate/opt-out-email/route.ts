/**
 * One-Click Email Opt-Out Endpoint
 * Allows users to unsubscribe from affiliate emails via link
 * No authentication required - uses signed user_id parameter
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { EmailSequenceService } from '@/lib/services/EmailSequenceService';
import { APP_URL } from '@/lib/config/urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return new Response(
        `
<!DOCTYPE html>
<html>
<head>
  <title>Invalid Request</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 100px auto;
      padding: 40px;
      text-align: center;
    }
    h1 { color: #dc2626; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Invalid Request</h1>
  <p>This unsubscribe link is invalid or has expired.</p>
  <p>If you'd like to manage your email preferences, please log in to your dashboard.</p>
</body>
</html>
        `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Update user to opt out of affiliate emails
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ affiliate_opted_out: true })
      .eq('id', userId);

    if (updateError) {
      console.error('[opt-out-email] Failed to update user:', updateError);
      throw new Error('Failed to update preferences');
    }

    // Cancel any pending affiliate invitation emails
    const cancelledCount = await EmailSequenceService.cancelPendingEmails(userId);

    console.log(
      `[opt-out-email] User ${userId} opted out (cancelled ${cancelledCount} pending emails)`
    );

    // Return success page
    return new Response(
      `
<!DOCTYPE html>
<html>
<head>
  <title>Unsubscribed Successfully</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 100px auto;
      padding: 40px;
      text-align: center;
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #059669;
      margin-bottom: 20px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 15px;
    }
    .checkmark {
      font-size: 64px;
      color: #059669;
      margin-bottom: 20px;
    }
    a {
      display: inline-block;
      margin-top: 30px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
    a:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>You've Been Unsubscribed</h1>
    <p>You will no longer receive affiliate program invitation emails from us.</p>
    <p>You can still access your dashboard and products as normal.</p>
    <p>If you change your mind, you can always join the affiliate program from your dashboard.</p>
    <a href="${APP_URL}/dashboard">
      Go to Dashboard
    </a>
  </div>
</body>
</html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error: any) {
    console.error('[opt-out-email] Error:', error);

    return new Response(
      `
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 100px auto;
      padding: 40px;
      text-align: center;
    }
    h1 { color: #dc2626; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Something Went Wrong</h1>
  <p>We encountered an error processing your request. Please try again later.</p>
  <p>If the problem persists, contact support.</p>
</body>
</html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
