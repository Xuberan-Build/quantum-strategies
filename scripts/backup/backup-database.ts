#!/usr/bin/env tsx
/**
 * Database Backup Script
 * Exports all critical tables to CSV files in a timestamped backup folder
 *
 * Usage: npm run backup
 *
 * IMPORTANT: Run this before ANY database migration or schema changes!
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables to backup, organized by category
const BACKUP_TABLES = {
  // Critical user data
  users: {
    table: 'users',
    critical: true,
  },
  product_sessions: {
    table: 'product_sessions',
    critical: true,
  },
  conversations: {
    table: 'conversations',
    critical: true,
  },
  product_access: {
    table: 'product_access',
    critical: true,
  },
  uploaded_documents: {
    table: 'uploaded_documents',
    critical: true,
  },

  // Product definitions
  product_definitions: {
    table: 'product_definitions',
    critical: true,
  },
  product_steps: {
    table: 'product_steps',
    critical: false,
  },
  prompts: {
    table: 'prompts',
    critical: true,
  },

  // Beta program
  beta_participants: {
    table: 'beta_participants',
    critical: true,
  },
  beta_conversion_results: {
    table: 'beta_conversion_results',
    critical: true,
  },
  scan_feedback: {
    table: 'scan_feedback',
    critical: true,
  },
  blueprint_feedback: {
    table: 'blueprint_feedback',
    critical: true,
  },
  declaration_feedback: {
    table: 'declaration_feedback',
    critical: true,
  },
  rite_one_consolidation: {
    table: 'rite_one_consolidation',
    critical: true,
  },
  rite_two_consolidation: {
    table: 'rite_two_consolidation',
    critical: true,
  },
  complete_journey_feedback: {
    table: 'complete_journey_feedback',
    critical: true,
  },

  // Affiliate system
  affiliate_transactions: {
    table: 'affiliate_transactions',
    critical: true,
  },
  referral_hierarchy: {
    table: 'referral_hierarchy',
    critical: true,
  },

  // Courses
  course_definitions: {
    table: 'course_definitions',
    critical: false,
  },
  course_enrollments: {
    table: 'course_enrollments',
    critical: true,
  },
  course_modules: {
    table: 'course_modules',
    critical: false,
  },
  course_submodules: {
    table: 'course_submodules',
    critical: false,
  },
  course_progress: {
    table: 'course_progress',
    critical: true,
  },
};

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str: string;
  if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const headerRow = headers.map(escapeCSVField).join(',');

  const rows = data.map(row =>
    headers.map(header => escapeCSVField(row[header])).join(',')
  );

  return [headerRow, ...rows].join('\n');
}

async function backupTable(
  tableName: string,
  backupDir: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Fetch all data from table
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    if (!data || data.length === 0) {
      // Create empty file to indicate table was checked
      const filePath = path.join(backupDir, `${tableName}.csv`);
      fs.writeFileSync(filePath, '(empty table)');
      return { success: true, count: 0 };
    }

    const csv = convertToCSV(data);
    const filePath = path.join(backupDir, `${tableName}.csv`);
    fs.writeFileSync(filePath, csv);

    return { success: true, count: data.length };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  DATABASE BACKUP SCRIPT');
  console.log('========================================\n');

  // Create timestamped backup directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(process.cwd(), 'backups', timestamp);

  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Backup directory: ${backupDir}\n`);

  // Track results
  const results: { table: string; success: boolean; count: number; critical: boolean; error?: string }[] = [];
  let totalRows = 0;
  let failedTables = 0;

  // Backup each table
  const tableEntries = Object.entries(BACKUP_TABLES);

  for (let i = 0; i < tableEntries.length; i++) {
    const [name, config] = tableEntries[i];
    const progress = `[${i + 1}/${tableEntries.length}]`;

    process.stdout.write(`${progress} Backing up ${name}... `);

    const result = await backupTable(config.table, backupDir);

    results.push({
      table: name,
      success: result.success,
      count: result.count,
      critical: config.critical,
      error: result.error,
    });

    if (result.success) {
      console.log(`${result.count} rows`);
      totalRows += result.count;
    } else {
      console.log(`FAILED: ${result.error}`);
      failedTables++;
    }
  }

  // Write summary
  console.log('\n========================================');
  console.log('  BACKUP SUMMARY');
  console.log('========================================\n');

  console.log(`Total rows backed up: ${totalRows}`);
  console.log(`Tables backed up: ${results.filter(r => r.success).length}/${results.length}`);
  console.log(`Backup location: ${backupDir}\n`);

  // Show any failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('FAILED TABLES:');
    failures.forEach(f => {
      const marker = f.critical ? '  [CRITICAL]' : '';
      console.log(`  - ${f.table}${marker}: ${f.error}`);
    });
    console.log('');
  }

  // Create manifest file
  const manifest = {
    timestamp: new Date().toISOString(),
    supabase_url: supabaseUrl,
    tables: results.map(r => ({
      name: r.table,
      rows: r.count,
      success: r.success,
      critical: r.critical,
      error: r.error,
    })),
    total_rows: totalRows,
    failed_tables: failedTables,
  };

  fs.writeFileSync(
    path.join(backupDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Final status
  if (failedTables > 0) {
    const criticalFailures = failures.filter(f => f.critical);
    if (criticalFailures.length > 0) {
      console.log('WARNING: Some CRITICAL tables failed to backup!');
      console.log('Do NOT proceed with database changes until these are resolved.\n');
      process.exit(1);
    } else {
      console.log('Some non-critical tables failed. Review before proceeding.\n');
    }
  } else {
    console.log('All tables backed up successfully.\n');
  }

  console.log(`Backup complete: ${backupDir}\n`);
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
