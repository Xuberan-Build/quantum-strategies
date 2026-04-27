#!/usr/bin/env node
/**
 * Add dropdowns to Dinner Parties tab
 */

require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_CRM_SHEET_ID || '1rTuGFZePZPV1PpC9bm7rcLs4nWXdr6zsb931OGH3rr8';

// Dinner Type options
const DINNER_TYPES = [
  'New Moon - Initiation',
  'Full Moon - Harvest',
  'New Moon - Launch',
  'Full Moon - Celebration',
  'Special - Quarterly',
  'Special - Annual',
  'Private - Core Partners',
  'Open - Network Wide',
];

// RSVP Status options
const RSVP_STATUSES = [
  'Not Invited',
  'Invited - Pending',
  'Confirmed',
  'Maybe',
  'Declined',
  'No Response',
  'Waitlisted',
  'Cancelled',
];

// Attended options
const ATTENDED_OPTIONS = [
  'Yes - Full',
  'Yes - Partial',
  'No - Cancelled',
  'No - No Show',
  'No - Rescheduled',
  'Pending',
];

// Follow-Up Action options
const FOLLOWUP_ACTIONS = [
  'None Needed',
  'Send Thank You',
  'Schedule 1:1',
  'Send Bridge Doc',
  'Introduce to Partner',
  'Add to Next Dinner',
  'Check In - 1 Week',
  'Check In - 2 Weeks',
  'Partnership Discussion',
  'Revenue Share Discussion',
];

// Stage at Invite options (simplified from lifecycle)
const STAGE_AT_INVITE = [
  'Pre-Pipeline',
  'Workshop Attendee',
  'Three Rites Client',
  'Strategic Partner - New',
  'Strategic Partner - Active',
  'Dinner Regular',
  'Revenue Share Partner',
  'Equity Partner',
  'Core 10',
  'Guest of Partner',
  'Ecosystem VIP',
];

async function main() {
  console.log('🔧 Adding Dinner Parties Dropdowns\n');

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

  const dinnerSheet = metadata.data.sheets.find(s => s.properties.title === 'Dinner Parties');
  if (!dinnerSheet) {
    console.error('❌ Dinner Parties sheet not found');
    process.exit(1);
  }

  const sheetId = dinnerSheet.properties.sheetId;

  // Get headers
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Dinner Parties'!1:1",
  });
  const headers = headersRes.data.values?.[0] || [];

  console.log('📋 Headers:', headers.join(' | '));

  // Find column indices
  const dinnerTypeCol = headers.indexOf('Dinner Type');
  const rsvpCol = headers.indexOf('RSVP Status');
  const attendedCol = headers.indexOf('Attended');
  const followupCol = headers.indexOf('Follow-Up Action');
  const stageCol = headers.indexOf('Stage at Invite');

  console.log(`\n📊 Found columns:`);
  console.log(`   Dinner Type: ${dinnerTypeCol >= 0 ? `Column ${dinnerTypeCol + 1}` : 'NOT FOUND'}`);
  console.log(`   RSVP Status: ${rsvpCol >= 0 ? `Column ${rsvpCol + 1}` : 'NOT FOUND'}`);
  console.log(`   Attended: ${attendedCol >= 0 ? `Column ${attendedCol + 1}` : 'NOT FOUND'}`);
  console.log(`   Follow-Up Action: ${followupCol >= 0 ? `Column ${followupCol + 1}` : 'NOT FOUND'}`);
  console.log(`   Stage at Invite: ${stageCol >= 0 ? `Column ${stageCol + 1}` : 'NOT FOUND'}`);

  const requests = [];

  // Dinner Type dropdown
  if (dinnerTypeCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: dinnerTypeCol,
          endColumnIndex: dinnerTypeCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: DINNER_TYPES.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`\n✅ Adding Dinner Type dropdown (${DINNER_TYPES.length} options)`);
  }

  // RSVP Status dropdown
  if (rsvpCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: rsvpCol,
          endColumnIndex: rsvpCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: RSVP_STATUSES.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`✅ Adding RSVP Status dropdown (${RSVP_STATUSES.length} options)`);
  }

  // Attended dropdown
  if (attendedCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: attendedCol,
          endColumnIndex: attendedCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: ATTENDED_OPTIONS.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`✅ Adding Attended dropdown (${ATTENDED_OPTIONS.length} options)`);
  }

  // Follow-Up Action dropdown
  if (followupCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: followupCol,
          endColumnIndex: followupCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: FOLLOWUP_ACTIONS.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`✅ Adding Follow-Up Action dropdown (${FOLLOWUP_ACTIONS.length} options)`);
  }

  // Stage at Invite dropdown
  if (stageCol >= 0) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: stageCol,
          endColumnIndex: stageCol + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: STAGE_AT_INVITE.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
    console.log(`✅ Adding Stage at Invite dropdown (${STAGE_AT_INVITE.length} options)`);
  }

  // Apply all
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
    console.log('\n✅ All Dinner Parties dropdowns applied!');
  }

  // Print reference
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 DINNER PARTIES DROPDOWN REFERENCE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('DINNER TYPES:');
  DINNER_TYPES.forEach(d => console.log(`   • ${d}`));

  console.log('\nRSVP STATUSES:');
  RSVP_STATUSES.forEach(r => console.log(`   • ${r}`));

  console.log('\nATTENDED OPTIONS:');
  ATTENDED_OPTIONS.forEach(a => console.log(`   • ${a}`));

  console.log('\nFOLLOW-UP ACTIONS:');
  FOLLOWUP_ACTIONS.forEach(f => console.log(`   • ${f}`));

  console.log('\nSTAGE AT INVITE:');
  STAGE_AT_INVITE.forEach(s => console.log(`   • ${s}`));
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
