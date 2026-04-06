/**
 * Webhook Handler: Sync CRM
 *
 * Logs purchase data to Google Sheets.
 * Only runs when FEATURE_SHEETS_CRM=true.
 */

import { google } from 'googleapis';
import { BUSINESS } from '../../../../config/business.config';
import { FEATURES } from '../../../../config/features.config';

function getGoogleCredentials() {
  const client_email = process.env.GOOGLE_GMAIL_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_GMAIL_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (private_key?.includes('\\n')) {
    private_key = private_key.replace(/\\n/g, '\n');
  }
  return { client_email, private_key };
}

export interface CRMSyncData {
  timestamp: string;
  email: string;
  name: string;
  product: string;
  amount: number;
  sessionId: string;
  emailSent: string;
  status: string;
  productSlugs: string[];
  userId?: string;
  productAccessIds: string[];
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
}

export async function syncToCRM(data: CRMSyncData): Promise<void> {
  if (!FEATURES.googleSheetsCRM) {
    console.log('[CRM] Skipped — FEATURE_SHEETS_CRM is disabled');
    return;
  }

  const sheetId = BUSINESS.googleSheetId;
  if (!sheetId) {
    console.warn('[CRM] Skipped — GOOGLE_SHEET_ID not configured');
    return;
  }

  const credentials = getGoogleCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const headers = [
    'Timestamp', 'Email', 'Name', 'Product', 'Amount', 'Stripe Session ID',
    'Email Sent', 'Status',
    'Day 1 Email Sent', 'Day 3 Email Sent', 'Day 7 Email Sent',
    'Last Email Sent', 'Sequence Status',
    'Product Slugs', 'User ID', 'Product Access IDs',
    'Purchase Date', 'Amount Paid',
    'Stripe Payment Intent ID', 'Stripe Customer ID',
  ];

  // Ensure header row is correct
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Purchases!A1:T1',
  });
  const existingHeaders = (headerResponse.data.values || [])[0] || [];
  const headersMatch = headers.every((h, i) => existingHeaders[i] === h);
  if (!headersMatch) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Purchases!A1:T1',
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Purchases!A:T',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        data.timestamp,
        data.email,
        data.name,
        data.product,
        `$${data.amount}`,
        data.sessionId,
        data.emailSent,
        data.status,
        '', '', '', '', '', // Day 1/3/7 email sent, last sent, sequence status
        data.productSlugs.join(', '),
        data.userId || '',
        data.productAccessIds.join(', '),
        data.timestamp,
        data.amount,
        data.stripePaymentIntentId || '',
        data.stripeCustomerId || '',
      ]],
    },
  });

  console.log('✅ CRM sync complete');
}
