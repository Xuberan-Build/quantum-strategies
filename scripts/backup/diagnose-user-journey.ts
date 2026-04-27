#!/usr/bin/env tsx
/**
 * Diagnose user journey - check sessions, feedback, and deliverables
 * Usage: npx tsx scripts/backup/diagnose-user-journey.ts "user name or email"
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnoseUser(searchTerm: string) {
  console.log(`\n🔍 Searching for user: "${searchTerm}"\n`);

  // Find user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);

  if (userError || !users?.length) {
    console.error('❌ User not found:', userError?.message || 'No matches');
    return;
  }

  for (const user of users) {
    console.log('========================================');
    console.log(`USER: ${user.name || 'No name'}`);
    console.log(`Email: ${user.email}`);
    console.log(`ID: ${user.id}`);
    console.log('========================================\n');

    // Get all sessions
    const { data: sessions } = await supabase
      .from('product_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    console.log(`📋 PRODUCT SESSIONS (${sessions?.length || 0}):\n`);

    if (sessions?.length) {
      for (const session of sessions) {
        const status = session.is_complete ? '✅ COMPLETE' : '🔄 IN PROGRESS';
        const hasDeliverable = session.deliverable_content ? '📄 Has deliverable' : '❌ NO DELIVERABLE';

        console.log(`  ${session.product_slug}`);
        console.log(`    Status: ${status}`);
        console.log(`    Progress: Step ${session.current_step}/${session.total_steps}`);
        console.log(`    Deliverable: ${hasDeliverable}`);
        console.log(`    Session ID: ${session.id}`);
        console.log(`    Started: ${session.started_at || session.created_at}`);
        if (session.completed_at) {
          console.log(`    Completed: ${session.completed_at}`);
        }
        console.log('');
      }
    }

    // Get product access
    const { data: access } = await supabase
      .from('product_access')
      .select('*')
      .eq('user_id', user.id);

    console.log(`🔑 PRODUCT ACCESS (${access?.length || 0}):\n`);
    if (access?.length) {
      for (const a of access) {
        console.log(`  ${a.product_slug}: ${a.access_granted ? '✅ Granted' : '❌ Not granted'}`);
      }
      console.log('');
    }

    // Check beta participation
    const { data: beta } = await supabase
      .from('beta_participants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (beta) {
      console.log('🧪 BETA PARTICIPANT:');
      console.log(`  Cohort: ${beta.cohort_name}`);
      console.log(`  Status: ${beta.status}`);
      console.log(`  Current Rite: ${beta.current_rite}`);
      console.log(`  Perception completed: ${beta.perception_completed_count}`);
      console.log(`  Orientation completed: ${beta.orientation_completed_count}`);
      console.log(`  Declaration completed: ${beta.declaration_completed_count}`);
      console.log('');
    }

    // Check feedback submitted
    const feedbackTables = [
      'scan_feedback',
      'blueprint_feedback',
      'declaration_feedback',
      'rite_one_consolidation',
      'rite_two_consolidation',
      'complete_journey_feedback'
    ];

    console.log('📝 FEEDBACK SUBMITTED:\n');
    for (const table of feedbackTables) {
      const { data: feedback, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', user.id);

      if (feedback?.length) {
        console.log(`  ${table}: ${feedback.length} entries`);
        for (const f of feedback) {
          if (f.product_slug) {
            console.log(`    - ${f.product_slug} (submitted: ${f.submitted_at})`);
          }
        }
      }
    }
    console.log('');
  }
}

// Also show summary of all users with feedback
async function showFeedbackSummary() {
  console.log('\n========================================');
  console.log('  ALL FEEDBACK WITH USER NAMES');
  console.log('========================================\n');

  // Get complete journey feedback with user names
  const { data: journeyFeedback } = await supabase
    .from('complete_journey_feedback')
    .select(`
      *,
      users!complete_journey_feedback_user_id_fkey(name, email)
    `);

  if (journeyFeedback?.length) {
    console.log('📊 COMPLETE JOURNEY FEEDBACK:\n');
    for (const f of journeyFeedback) {
      const userName = (f.users as any)?.name || (f.users as any)?.email || 'Unknown';
      console.log(`  ${userName}:`);
      console.log(`    Transformation score: ${f.transformation_score}/10`);
      console.log(`    NPS: ${f.nps_score}`);
      console.log(`    Most valuable rite: ${f.most_valuable_rite}`);
      if (f.testimonial_text) {
        console.log(`    Testimonial: "${f.testimonial_text.substring(0, 100)}..."`);
      }
      console.log('');
    }
  } else {
    console.log('No complete journey feedback found.\n');
  }

  // Get scan feedback with user names
  const { data: scanFeedback } = await supabase
    .from('scan_feedback')
    .select(`
      *,
      users!scan_feedback_user_id_fkey(name, email)
    `);

  if (scanFeedback?.length) {
    console.log('📊 SCAN FEEDBACK (Perception Rite):\n');
    for (const f of scanFeedback) {
      const userName = (f.users as any)?.name || (f.users as any)?.email || 'Unknown';
      console.log(`  ${userName} - ${f.product_slug}:`);
      console.log(`    Clarity: ${f.clarity_score}/5, Relevance: ${f.relevance_score}/5, Actionability: ${f.actionability_score}/5`);
      if (f.biggest_aha) {
        console.log(`    Biggest aha: "${f.biggest_aha.substring(0, 80)}..."`);
      }
      console.log('');
    }
  }
}

const searchTerm = process.argv[2];

if (searchTerm) {
  diagnoseUser(searchTerm).catch(console.error);
} else {
  // If no search term, show feedback summary
  showFeedbackSummary().catch(console.error);
}
