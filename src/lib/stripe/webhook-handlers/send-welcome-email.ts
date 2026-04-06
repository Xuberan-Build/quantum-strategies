/**
 * Webhook Handler: Send Welcome Email
 *
 * Sends the post-purchase welcome email to the customer.
 * Branding (name, colors) comes from BUSINESS config.
 * Product details (name, included items for bundles) come from product_definitions.
 */

import { google } from 'googleapis';
import { BUSINESS } from '../../../../config/business.config';
import { APP_URL } from '@/lib/config/urls';
import { supabaseAdmin } from '@/lib/supabase/server';

function getGmailCredentials() {
  const client_email = process.env.GOOGLE_GMAIL_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_GMAIL_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (private_key?.includes('\\n')) {
    private_key = private_key.replace(/\\n/g, '\n');
  }
  return { client_email, private_key };
}

/**
 * Fetch bundle product names for display in welcome email.
 * Reads product_definitions for each slug in bundle_products JSONB.
 */
async function getBundleProductNames(bundleSlugs: string[]): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('product_definitions')
    .select('name')
    .in('slug', bundleSlugs);
  return (data || []).map(d => d.name);
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  productName: string;
  productSlug: string;
  productsGranted: string[];
}): Promise<void> {
  const { to, name, productName, productSlug, productsGranted } = params;
  const isBundle = productsGranted.length > 1;

  const credentials = getGmailCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: BUSINESS.sender.email,
  });
  const gmail = google.gmail({ version: 'v1', auth });

  const baseUrl = APP_URL;
  const signupUrl = `${baseUrl}/signup`;
  const redirectPath = isBundle ? '/dashboard' : `/products/${productSlug}/experience`;
  const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;

  // Fetch bundle item names from DB if this is a bundle
  let bundleItemsHtml = '';
  let bundleItemsText = '';
  if (isBundle) {
    const itemNames = await getBundleProductNames(productsGranted);
    bundleItemsHtml = itemNames.map(n => `<li style="margin-bottom:8px;"><strong>${n}</strong></li>`).join('');
    bundleItemsText = itemNames.map(n => `• ${n}`).join('\n');
  }

  const primaryColor = BUSINESS.brand.primary;
  const accentColor = BUSINESS.brand.accent;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%); color: #fff; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .content p { margin: 0 0 16px 0; }
    .button { display: inline-block; background: ${accentColor}; color: white !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .instructions { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #4caf50; }
    .instructions h3 { margin: 0 0 12px 0; color: #2e7d32; font-size: 18px; }
    .instructions ol { margin: 0; padding-left: 20px; }
    .instructions li { margin-bottom: 8px; }
    .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
    .footer a { color: ${accentColor}; text-decoration: none; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${productName}!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p><strong>Thank you for your purchase!</strong> Your personalized product experience is ready.</p>

      ${isBundle ? `
      <div style="background:#f0f7ff;padding:20px;border-radius:8px;margin:24px 0;border-left:4px solid #2196f3;">
        <h3 style="margin:0 0 12px 0;color:#1976d2;font-size:18px;">Your Bundle Includes:</h3>
        <ul style="margin:0;padding-left:20px;">${bundleItemsHtml}</ul>
        <p style="margin:12px 0 0 0;color:#1565c0;">All products are now available in your dashboard!</p>
      </div>
      ` : ''}

      <div class="instructions">
        <h3>Getting Started (3 Steps):</h3>
        <ol>
          <li><strong>Create your account</strong> — use the same email you purchased with</li>
          <li><strong>Log in to begin</strong> — use the link below</li>
          <li><strong>Start your experience</strong> — ${isBundle ? 'all products are' : `"${productName}" is`} ready in your dashboard</li>
        </ol>
      </div>

      <div style="text-align:center;">
        <a href="${signupUrl}" class="button">Create Your Account</a>
      </div>
      <p style="text-align:center;margin-top:8px;">
        Already have an account? <a href="${loginUrl}" style="color:${accentColor};">Log in here</a>
      </p>

      <p><strong>What to Expect:</strong></p>
      <ul>
        <li>Step-by-step guided questionnaire</li>
        <li>AI-powered insights based on your responses</li>
        <li>Personalized deliverable generated at the end</li>
        <li>Full progress tracking — pause and resume anytime</li>
      </ul>

      <hr>
      <p><strong>Need Help?</strong></p>
      <ul>
        <li><strong>First time?</strong> Create your account using: ${to}</li>
        <li><strong>Questions?</strong> Email us at ${BUSINESS.sender.email}</li>
      </ul>
    </div>
    <div class="footer">
      <p><strong>${BUSINESS.name}</strong></p>
      <p><a href="${BUSINESS.domain}">${BUSINESS.domain.replace(/^https?:\/\//, '')}</a></p>
      <p style="margin-top:16px;font-size:12px;color:#999;">
        This email was sent because you purchased ${productName}.<br>
        If you have questions, reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  const emailText = `
Welcome to ${productName}!

Hi ${name},

Thank you for your purchase! Your personalized product experience is ready.

${isBundle ? `YOUR BUNDLE INCLUDES:\n${bundleItemsText}\n\nAll products are now available in your dashboard!\n` : ''}
GETTING STARTED:
1. Create your account — visit: ${signupUrl}
2. Log in to begin: ${loginUrl}
3. Start your experience in your dashboard

WHAT TO EXPECT:
- Step-by-step guided questionnaire
- AI-powered insights based on your responses
- Personalized deliverable generated at the end
- Full progress tracking

NEED HELP?
- First time? Create your account using: ${to}
- Questions? Email: ${BUSINESS.sender.email}

— ${BUSINESS.name}
${BUSINESS.domain}
`.trim();

  const raw = [
    `From: "${BUSINESS.sender.name}" <${BUSINESS.sender.email}>`,
    `To: ${to}`,
    `Subject: Your ${productName} is Ready!`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary123"',
    '',
    '--boundary123',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    emailText,
    '',
    '--boundary123',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    emailHtml,
    '',
    '--boundary123--',
  ].join('\n');

  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  console.log('✅ Welcome email sent to:', to);
}

export async function sendAdminNotification(params: {
  customerEmail: string;
  customerName: string;
  productName: string;
  amount: number;
  sessionId: string;
}): Promise<void> {
  const adminEmails = BUSINESS.adminEmails;
  if (!adminEmails.length) return;

  const credentials = getGmailCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: BUSINESS.sender.email,
  });
  const gmail = google.gmail({ version: 'v1', auth });

  const subject = `New Purchase: ${params.productName} — $${params.amount.toFixed(2)}`;
  const text = `
NEW PURCHASE NOTIFICATION

Product: ${params.productName}
Amount: $${params.amount.toFixed(2)}
Customer: ${params.customerName}
Email: ${params.customerEmail}
Session: ${params.sessionId}

View in Stripe Dashboard:
https://dashboard.stripe.com/payments
`.trim();

  for (const adminEmail of adminEmails) {
    const raw = [
      `From: "${BUSINESS.sender.name}" <${BUSINESS.sender.email}>`,
      `To: ${adminEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      text,
    ].join('\n');

    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  }
  console.log('✅ Admin notification sent to:', adminEmails.join(', '));
}
