#!/usr/bin/env node
/**
 * Refactor CRM Google Sheets
 * 1. Add pipeline columns to Customers tab
 * 2. Refactor Ritual Invites tab to Dinner Parties
 */

require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_CRM_SHEET_ID || '1rTuGFZePZPV1PpC9bm7rcLs4nWXdr6zsb931OGH3rr8';

// New columns to add to Customers tab (after existing columns)
const NEW_CUSTOMER_COLUMNS = [
  'Lifecycle Stage',
  'Stage Entry Date',
  'Stage Status',
  'Execution Score',
  'Enthusiasm Score',
  'Reciprocity Score',
  'Long Term Thinking Score',
  'Last Bridge Sent',
  'Last Bridge Sent Date',
  'Bridge Response Status',
  'Next Action'
];

// New Dinner Parties schema
const DINNER_PARTIES_HEADERS = [
  'Dinner ID',
  'Dinner Date',
  'Dinner Type',
  'Location',
  'Theme',
  'Invitee Email',
  'Invitee Name',
  'Stage at Invite',
  'RSVP Status',
  'Attended',
  'Guest Count',
  'Notes',
  'Follow-Up Action'
];

// Column mapping from old Ritual Invites to new Dinner Parties
const COLUMN_MAPPING = {
  'Name': 'Invitee Name',
  'Email': 'Invitee Email',
  'Attended': 'Attended',
  'Number': 'Guest Count'
};

async function main() {
  console.log('🔧 CRM Sheets Refactor\n');

  // Auth
  const clientEmail = process.env.GOOGLE_CRM_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CRM_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.error('❌ Missing Google credentials');
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // ═══════════════════════════════════════════════════════════════
  // TASK 1: Add pipeline columns to Customers tab
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 TASK 1: Adding pipeline columns to Customers tab');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Get current Customers headers
    const customersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Customers!1:1',
    });

    const currentHeaders = customersRes.data.values?.[0] || [];
    console.log(`📊 Current Customers columns: ${currentHeaders.length}`);
    console.log(`   Last column: ${currentHeaders[currentHeaders.length - 1]}`);

    // Check which new columns are already present
    const missingColumns = NEW_CUSTOMER_COLUMNS.filter(col => !currentHeaders.includes(col));

    if (missingColumns.length === 0) {
      console.log('✅ All pipeline columns already exist!\n');
    } else {
      console.log(`\n📝 Adding ${missingColumns.length} new columns:`);
      missingColumns.forEach(col => console.log(`   + ${col}`));

      // Calculate the column letter for appending
      const startCol = String.fromCharCode(65 + currentHeaders.length); // A=65
      const endCol = String.fromCharCode(65 + currentHeaders.length + missingColumns.length - 1);

      // For columns beyond Z, we need AA, AB, etc.
      const getColLetter = (index) => {
        let letter = '';
        while (index >= 0) {
          letter = String.fromCharCode((index % 26) + 65) + letter;
          index = Math.floor(index / 26) - 1;
        }
        return letter;
      };

      const startColLetter = getColLetter(currentHeaders.length);
      const endColLetter = getColLetter(currentHeaders.length + missingColumns.length - 1);

      // Update header row with new columns
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Customers!${startColLetter}1:${endColLetter}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [missingColumns],
        },
      });

      console.log(`\n✅ Added columns ${startColLetter}-${endColLetter} to Customers tab`);
    }
  } catch (error) {
    console.error('❌ Error updating Customers tab:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK 2: Refactor Ritual Invites to Dinner Parties
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 TASK 2: Refactoring Ritual Invites → Dinner Parties');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Get spreadsheet metadata to find sheet IDs
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });

    const ritualSheet = metadata.data.sheets.find(
      s => s.properties.title === 'Ritual Invites + Beta Tracking'
    );
    const dinnerSheet = metadata.data.sheets.find(
      s => s.properties.title === 'Dinner Parties'
    );

    if (dinnerSheet) {
      console.log('✅ Dinner Parties tab already exists!');
    } else if (!ritualSheet) {
      console.log('⚠️  Ritual Invites + Beta Tracking tab not found');
    } else {
      const sheetId = ritualSheet.properties.sheetId;
      console.log(`📊 Found Ritual Invites tab (sheetId: ${sheetId})`);

      // Read existing data
      const ritualData = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "'Ritual Invites + Beta Tracking'!A:Z",
      });

      const oldRows = ritualData.data.values || [];
      const oldHeaders = oldRows[0] || [];
      const oldData = oldRows.slice(1);

      console.log(`   Current headers: ${oldHeaders.join(', ')}`);
      console.log(`   Data rows: ${oldData.length}`);

      // Build column index map
      const oldColIndex = {};
      oldHeaders.forEach((h, i) => oldColIndex[h] = i);

      // Transform data to new schema
      const newData = oldData.map((row, idx) => {
        const newRow = DINNER_PARTIES_HEADERS.map(newCol => {
          // Check if there's a mapping from old column
          const oldColName = Object.keys(COLUMN_MAPPING).find(k => COLUMN_MAPPING[k] === newCol);
          if (oldColName && oldColIndex[oldColName] !== undefined) {
            return row[oldColIndex[oldColName]] || '';
          }

          // Special handling
          if (newCol === 'Dinner ID') return `DIN-${String(idx + 1).padStart(3, '0')}`;
          if (newCol === 'Dinner Type') {
            // Try to infer from existing data or leave blank
            return '';
          }
          if (newCol === 'RSVP Status') {
            // Map from Attended if available
            const attended = row[oldColIndex['Attended']];
            if (attended === 'Yes') return 'Confirmed';
            if (attended === 'No') return 'Declined';
            return 'Pending';
          }

          return '';
        });
        return newRow;
      });

      // Rename the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                title: 'Dinner Parties',
              },
              fields: 'title',
            },
          }],
        },
      });
      console.log('\n✅ Renamed tab to "Dinner Parties"');

      // Clear and rewrite with new schema
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: "'Dinner Parties'!A:Z",
      });

      // Write new headers + data
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: "'Dinner Parties'!A1",
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [DINNER_PARTIES_HEADERS, ...newData],
        },
      });

      console.log(`✅ Wrote new schema with ${newData.length} migrated rows`);
      console.log('\n📋 New headers:');
      DINNER_PARTIES_HEADERS.forEach(h => console.log(`   • ${h}`));
    }
  } catch (error) {
    console.error('❌ Error refactoring Dinner Parties tab:', error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ REFACTOR COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
