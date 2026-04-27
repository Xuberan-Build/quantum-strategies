#!/usr/bin/env node
/**
 * Add Lifecycle Stage dropdowns to Customers tab
 * Based on the progressive vision revelation pipeline
 */

require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_CRM_SHEET_ID || '1rTuGFZePZPV1PpC9bm7rcLs4nWXdr6zsb931OGH3rr8';

// Lifecycle Stages - Granular tracking through the pipeline
const LIFECYCLE_STAGES = [
  // Stage 0: Pre-Pipeline
  '0.0 - Cold Lead',
  '0.1 - Network Contact',
  '0.2 - Discord Member',
  '0.3 - Email Subscriber',

  // Stage 1: Discord/Network → VCAP Workshop
  '1.0 - Workshop Interested',
  '1.1 - Workshop Registered',
  '1.2 - Workshop Attended',
  '1.3 - Workshop Completed',
  '1.4 - Workshop Follow-Up Sent',
  '1.5 - Workshop Engaged (Replied)',

  // Stage 2: VCAP Workshop → Three Rites Client
  '2.0 - Three Rites Interested',
  '2.1 - Perception Rite Started',
  '2.2 - Perception Rite Completed',
  '2.3 - Orientation Rite Started',
  '2.4 - Orientation Rite Completed',
  '2.5 - Declaration Rite Started',
  '2.6 - Declaration Rite Completed',
  '2.7 - All Three Rites Completed',
  '2.8 - Diagnostic Delivered',
  '2.9 - Diagnostic Follow-Up',

  // Stage 3: Three Rites → Strategic Partner
  '3.0 - Partnership Interested',
  '3.1 - Strategy Call Scheduled',
  '3.2 - Strategy Call Completed',
  '3.3 - Proposal Sent',
  '3.4 - Negotiating Terms',
  '3.5 - Contract Signed',
  '3.6 - Onboarding (Month 1)',
  '3.7 - Foundation Building (Month 2)',
  '3.8 - Traffic & Conversion (Month 3-4)',
  '3.9 - Scale & Systems (Month 5-6)',

  // Stage 4: Strategic Partner → Dinner Party Member
  '4.0 - Partner Active (6+ months)',
  '4.1 - Dinner Invite Sent',
  '4.2 - First Dinner Attended',
  '4.3 - Dinner Regular (2-3 attended)',
  '4.4 - Dinner Active (4+ attended)',
  '4.5 - Network Contributor',
  '4.6 - Partnership Facilitator',

  // Stage 5: Dinner Party → Revenue Share Partner
  '5.0 - Revenue Share Discussed',
  '5.1 - Revenue Share Proposed',
  '5.2 - Revenue Share Active',
  '5.3 - Equity Discussion Started',
  '5.4 - Equity Partner',
  '5.5 - Joint Venture Partner',
  '5.6 - Core 10 Partner',

  // Stage 6: Full Vision / Civilizational
  '6.0 - Level 0 Vision Revealed',
  '6.1 - OZ Community Investor',
  '6.2 - Anchor Tenant',
  '6.3 - Governance Participant',

  // Special Statuses
  'Churned - Workshop Only',
  'Churned - Three Rites Only',
  'Churned - Partnership Ended',
  'Paused - Temporary Hold',
  'Referred Out - Not a Fit',
];

// Stage Status options
const STAGE_STATUSES = [
  'Active',
  'Engaged',
  'Responsive',
  'Slow Response',
  'Stalled',
  'Needs Nurture',
  'Ready to Advance',
  'Advancing',
  'At Risk',
  'Churned',
  'Paused',
  'VIP',
];

// Bridge Response Status options
const BRIDGE_RESPONSE_STATUSES = [
  'Not Sent',
  'Sent - Awaiting Response',
  'Opened - No Reply',
  'Replied - Positive',
  'Replied - Questions',
  'Replied - Not Now',
  'Replied - Not Interested',
  'Scheduled Call',
  'Converted',
];

async function main() {
  console.log('🔧 Adding Lifecycle Stage Dropdowns\n');

  const clientEmail = process.env.GOOGLE_CRM_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CRM_PRIVATE_KEY;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get sheet metadata
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const customersSheet = metadata.data.sheets.find(s => s.properties.title === 'Customers');
  if (!customersSheet) {
    console.error('❌ Customers sheet not found');
    process.exit(1);
  }

  const sheetId = customersSheet.properties.sheetId;

  // Get headers to find column indices
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Customers!1:1',
  });
  const headers = headersRes.data.values?.[0] || [];

  const lifecycleCol = headers.indexOf('Lifecycle Stage');
  const stageStatusCol = headers.indexOf('Stage Status');
  const bridgeResponseCol = headers.indexOf('Bridge Response Status');

  console.log(`📊 Found columns:`);
  console.log(`   Lifecycle Stage: Column ${lifecycleCol + 1} (${String.fromCharCode(65 + lifecycleCol)})`);
  console.log(`   Stage Status: Column ${stageStatusCol + 1} (${String.fromCharCode(65 + stageStatusCol)})`);
  console.log(`   Bridge Response Status: Column ${bridgeResponseCol + 1}`);

  // Build data validation requests
  const requests = [];

  // Lifecycle Stage dropdown (column U = index 20)
  if (lifecycleCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1, // Skip header
          endRowIndex: 1000,
          startColumnIndex: lifecycleCol,
          endColumnIndex: lifecycleCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: LIFECYCLE_STAGES.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false, // Allow other values too
        },
      },
    });
    console.log(`\n✅ Adding Lifecycle Stage dropdown (${LIFECYCLE_STAGES.length} options)`);
  }

  // Stage Status dropdown
  if (stageStatusCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: stageStatusCol,
          endColumnIndex: stageStatusCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: STAGE_STATUSES.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`✅ Adding Stage Status dropdown (${STAGE_STATUSES.length} options)`);
  }

  // Bridge Response Status dropdown
  if (bridgeResponseCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: bridgeResponseCol,
          endColumnIndex: bridgeResponseCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: BRIDGE_RESPONSE_STATUSES.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`✅ Adding Bridge Response Status dropdown (${BRIDGE_RESPONSE_STATUSES.length} options)`);
  }

  // Apply all data validations
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
    console.log('\n✅ All dropdowns applied!');
  }

  // Print the lifecycle stages for reference
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 LIFECYCLE STAGES REFERENCE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('STAGE 0: Pre-Pipeline');
  LIFECYCLE_STAGES.filter(s => s.startsWith('0.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSTAGE 1: Discord/Network → VCAP Workshop');
  LIFECYCLE_STAGES.filter(s => s.startsWith('1.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSTAGE 2: VCAP Workshop → Three Rites Client');
  LIFECYCLE_STAGES.filter(s => s.startsWith('2.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSTAGE 3: Three Rites → Strategic Partner');
  LIFECYCLE_STAGES.filter(s => s.startsWith('3.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSTAGE 4: Strategic Partner → Dinner Party');
  LIFECYCLE_STAGES.filter(s => s.startsWith('4.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSTAGE 5: Dinner Party → Revenue Share');
  LIFECYCLE_STAGES.filter(s => s.startsWith('5.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSTAGE 6: Full Vision / Civilizational');
  LIFECYCLE_STAGES.filter(s => s.startsWith('6.')).forEach(s => console.log(`   ${s}`));

  console.log('\nSPECIAL STATUSES:');
  LIFECYCLE_STAGES.filter(s => !s.match(/^\d/)).forEach(s => console.log(`   ${s}`));

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
