#!/usr/bin/env tsx
/**
 * Fix conversations table schema
 * Removes incorrect 'role' column that was added during database recreation
 */

import 'dotenv/config';
import pg from 'pg';

async function fix() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env');
    console.log('Add your Supabase database URL to .env:');
    console.log('DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current columns
    const { rows: columns } = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'conversations' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    console.log('\nCurrent conversations columns:');
    columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));

    // Check if role column exists
    const hasRole = columns.some(c => c.column_name === 'role');

    if (hasRole) {
      console.log('\nDropping incorrect "role" column...');
      await client.query('ALTER TABLE public.conversations DROP COLUMN role');
      console.log('Done!');
    } else {
      console.log('\nNo "role" column found - schema may already be correct');
    }

    // Verify final state
    const { rows: afterColumns } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    console.log('\nFinal columns:', afterColumns.map(c => c.column_name).join(', '));

    // Test insert
    console.log('\nTesting insert...');
    const { rows: testInsert } = await client.query(`
      INSERT INTO conversations (session_id, step_number, messages)
      VALUES ('7765a323-4190-4457-ade4-18bafc52b6f3', 998, '[]'::jsonb)
      RETURNING id
    `);
    console.log('Test insert successful, id:', testInsert[0].id);

    // Clean up test
    await client.query('DELETE FROM conversations WHERE step_number = 998');
    console.log('Cleaned up test record');

    console.log('\n✅ Conversations table is now fixed!');

  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fix();
