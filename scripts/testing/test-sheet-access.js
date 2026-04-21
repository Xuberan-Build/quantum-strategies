#!/usr/bin/env node
/**
 * Test Google Sheets API Access
 * Verifies we can read/write to the CRM sheet
 */

require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID =
  process.env.GOOGLE_CRM_SHEET_ID ||
  process.env.GOOGLE_SHEET_ID ||
  '1rTuGFZePZPV1PpC9bm7rcLs4nWXdr6zsb931OGH3rr8';
const READ_ONLY = process.argv.includes('--read-only');
const SHOW_ALL = process.argv.includes('--all');

async function testSheetAccess() {
  console.log('🔍 Testing Google Sheets API Access...\n');

  // Check environment variables
  console.log('1️⃣ Checking environment variables...');
  const clientEmailEnv = process.env.GOOGLE_CRM_CLIENT_EMAIL
    ? 'GOOGLE_CRM_CLIENT_EMAIL'
    : 'GOOGLE_DRIVE_CLIENT_EMAIL';
  const privateKeyEnv = process.env.GOOGLE_CRM_PRIVATE_KEY
    ? 'GOOGLE_CRM_PRIVATE_KEY'
    : 'GOOGLE_DRIVE_PRIVATE_KEY';
  const clientEmail = process.env[clientEmailEnv];
  const privateKey = process.env[privateKeyEnv];

  if (!clientEmail || !privateKey) {
    console.error('❌ Missing credentials:');
    console.error('   GOOGLE_DRIVE_CLIENT_EMAIL:', clientEmail ? '✅ Set' : '❌ Missing');
    console.error('   GOOGLE_DRIVE_PRIVATE_KEY:', privateKey ? '✅ Set' : '❌ Missing');
    process.exit(1);
  }

  console.log(`   ✅ ${clientEmailEnv}:`, clientEmail);
  console.log(`   ✅ ${privateKeyEnv}: [REDACTED]`);
  console.log('');

  // Create auth client
  console.log('2️⃣ Creating authentication client...');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  console.log('   ✅ Auth client created');
  console.log('');

  const sheets = google.sheets({ version: 'v4', auth });

  // If --all flag, show all tabs and all data
  if (SHOW_ALL) {
    console.log('3️⃣ Fetching ALL sheet data...\n');

    try {
      // Get spreadsheet metadata to find all tabs
      const metadata = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
      });

      const sheetTabs = metadata.data.sheets || [];
      console.log(`📑 Found ${sheetTabs.length} tab(s):\n`);

      for (const sheet of sheetTabs) {
        const tabName = sheet.properties.title;
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`📋 TAB: "${tabName}"`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: `'${tabName}'!A:Z`,
          });

          const rows = response.data.values || [];

          if (rows.length === 0) {
            console.log('   (empty)\n');
            continue;
          }

          const headers = rows[0] || [];
          console.log(`\n📊 ${rows.length} rows (1 header + ${rows.length - 1} data)\n`);
          console.log('HEADERS:', headers.join(' | '));
          console.log('─'.repeat(70));

          // Print all data rows
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            console.log(`Row ${i}:`);
            for (let j = 0; j < headers.length; j++) {
              const value = row[j] || '(empty)';
              console.log(`   ${headers[j]}: ${value}`);
            }
            console.log('');
          }
        } catch (err) {
          console.log(`   ❌ Error reading tab: ${err.message}\n`);
        }
      }

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✅ ALL DATA DISPLAYED');
      console.log('═══════════════════════════════════════════════════════════════');
      return;
    } catch (error) {
      console.error('❌ Failed to fetch sheet data:', error.message);
      process.exit(1);
    }
  }

  // Test read access
  console.log('3️⃣ Testing READ access to Purchases sheet...');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Purchases!A1:I10',
    });

    const rows = response.data.values || [];
    console.log(`   ✅ Successfully read ${rows.length} rows`);

    if (rows.length > 0) {
      console.log('   📋 Headers:', rows[0]);
      console.log(`   📊 Data rows: ${rows.length - 1}`);
    }
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed to read sheet:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  }

  // Test write access (append a test row)
  if (READ_ONLY) {
    console.log('4️⃣ Skipping WRITE access (read-only mode)');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ READ-ONLY CHECK COMPLETE');
    console.log('═══════════════════════════════════════════════');
    return;
  }

  console.log('4️⃣ Testing WRITE access (appending test row)...');

  const testRow = [
    new Date().toISOString(), // Timestamp
    'test@example.com',       // Email
    'Test User',              // Name
    'Test Product',           // Product
    '$0.00',                  // Amount
    'test_session_123',       // Session ID
    '',                       // GPT Link (empty)
    '✅ Test',                // Email Sent
    'Test Entry',             // Status
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Purchases!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [testRow],
      },
    });

    console.log('   ✅ Successfully wrote test row');
    console.log('   📝 Test data:', testRow);
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed to write to sheet:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  }

  // Verify the write
  console.log('5️⃣ Verifying the test row was written...');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Purchases!A:I',
    });

    const rows = response.data.values || [];
    const lastRow = rows[rows.length - 1];

    if (lastRow && lastRow[1] === 'test@example.com') {
      console.log('   ✅ Test row verified in sheet');
      console.log('   📋 Last row:', lastRow);
    } else {
      console.log('   ⚠️  Could not verify test row');
    }
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed to verify:', error.message);
  }

  console.log('═══════════════════════════════════════════════');
  console.log('✅ ALL TESTS PASSED');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('Next steps:');
  console.log('1. Check the sheet to see the test row');
  console.log('2. Delete the test row if needed');
  console.log('3. Proceed with building the CRM automations');
  console.log('');
}

testSheetAccess().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
