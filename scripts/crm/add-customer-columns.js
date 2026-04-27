#!/usr/bin/env node
/**
 * Add pipeline columns to Customers tab
 * First expands the grid, then adds headers
 */

require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_CRM_SHEET_ID || '1rTuGFZePZPV1PpC9bm7rcLs4nWXdr6zsb931OGH3rr8';

const NEW_COLUMNS = [
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

async function main() {
  console.log('🔧 Adding pipeline columns to Customers tab\n');

  const clientEmail = process.env.GOOGLE_CRM_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CRM_PRIVATE_KEY;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get spreadsheet metadata
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const customersSheet = metadata.data.sheets.find(s => s.properties.title === 'Customers');
  if (!customersSheet) {
    console.error('❌ Customers sheet not found');
    process.exit(1);
  }

  const sheetId = customersSheet.properties.sheetId;
  const currentCols = customersSheet.properties.gridProperties.columnCount;
  const currentRows = customersSheet.properties.gridProperties.rowCount;

  console.log(`📊 Customers sheet: ${currentCols} columns, ${currentRows} rows`);

  // Get current headers
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Customers!1:1',
  });
  const currentHeaders = headersRes.data.values?.[0] || [];
  console.log(`📋 Current headers (${currentHeaders.length}): ${currentHeaders.slice(-3).join(', ')}...`);

  // Check which columns are missing
  const missingColumns = NEW_COLUMNS.filter(col => !currentHeaders.includes(col));

  if (missingColumns.length === 0) {
    console.log('\n✅ All pipeline columns already exist!');
    return;
  }

  console.log(`\n📝 Need to add ${missingColumns.length} columns:`);
  missingColumns.forEach(col => console.log(`   + ${col}`));

  // Calculate how many columns we need
  const totalColumnsNeeded = currentHeaders.length + missingColumns.length;

  if (totalColumnsNeeded > currentCols) {
    const colsToAdd = totalColumnsNeeded - currentCols + 5; // Add 5 extra buffer
    console.log(`\n📐 Expanding grid by ${colsToAdd} columns...`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            length: colsToAdd,
          },
        }],
      },
    });
    console.log('✅ Grid expanded');
  }

  // Now add the headers
  // Calculate column letters
  const getColLetter = (index) => {
    let letter = '';
    let i = index;
    while (i >= 0) {
      letter = String.fromCharCode((i % 26) + 65) + letter;
      i = Math.floor(i / 26) - 1;
    }
    return letter;
  };

  const startCol = getColLetter(currentHeaders.length);
  const endCol = getColLetter(currentHeaders.length + missingColumns.length - 1);

  console.log(`\n📝 Writing headers to ${startCol}1:${endCol}1...`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Customers!${startCol}1:${endCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [missingColumns],
    },
  });

  console.log('\n✅ Pipeline columns added successfully!');
  console.log('\nNew Customers columns:');
  [...currentHeaders, ...missingColumns].forEach((col, i) => {
    const letter = getColLetter(i);
    const isNew = missingColumns.includes(col);
    console.log(`   ${letter}: ${col}${isNew ? ' ← NEW' : ''}`);
  });
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
