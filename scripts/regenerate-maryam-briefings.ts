#!/usr/bin/env tsx
/**
 * Regenerate all Three Rites briefings for maryambayyan@gmail.com
 *
 * Her briefings only contained the actionable nudges section because of a conflicting
 * "begin with X immediately" instruction in the suppressed-input-requirements migration.
 * This script re-runs the fixed final-briefing logic for every affected session.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

const USER_EMAIL = 'maryambayyan@gmail.com';

// Session IDs confirmed as broken (nudges-only) or missing deliverable
const TARGET_SESSIONS = [
  { id: '02cee811-9b23-440b-87af-372e62c4aa22', slug: 'perception-rite-scan-5',          note: 'no deliverable at all' },
  { id: 'b868f4f6-5698-426b-b362-c0cc0bfb588d', slug: 'perception-rite-scan-3',          note: 'nudges-only (3379 chars)' },
  { id: 'f5b4a7e8-d0f2-4a57-bdca-0257268ccc16', slug: 'perception-rite-scan-2',          note: 'nudges-only (3635 chars)' },
  { id: '99ce0f6a-e775-460d-8b76-7b7081fb20ad', slug: 'declaration-rite-business-model', note: 'nudges-only (4932 chars)' },
  { id: '22853839-99d3-4d3c-a75d-9c975ff68d27', slug: 'perception-rite-scan-4',          note: 'nudges-only (1615 chars)' },
  { id: '36d3ac97-586a-4557-b130-05d95dd70da8', slug: 'perception-rite-scan-1',          note: 'nudges-only (1826 chars)' },
];

// Fixed actionableNudgeInstruction (matches the fix applied to route.ts)
const ACTIONABLE_NUDGE_INSTRUCTION = `CRITICAL: Your response must contain TWO parts in this exact order — no preamble, no checklist, no "Input Requirements" section.

PART 1 — OPENING NUDGES (output this first):
Use this exact header on its own line:
**OPENING: Your Actionable Nudges (This Week)**

Review all step insights and list the 5-7 MOST actionable nudges — numbered 1–7, one per line. Each 1–2 sentences: [specific action] — because [specific thing from their responses]. Distill; do not copy verbatim. Criteria: concrete, implementable this week, tied to something the user shared, framed as an action.

PART 2 — FULL DELIVERABLE (output this immediately after Part 1):
Generate the complete deliverable per the instructions above. Include every section in full. Do not skip or abbreviate any section.`;

const SYSTEM_PROMPT_FALLBACK = `You are the Quantum Brand Architect AI (Sage–Magician). You produce premium-grade blueprints worth $700 of clarity.

YOUR ROLE:
- Synthesize astrology, Human Design, and business strategy into actionable guidance
- Reference SPECIFIC details the user shared in their responses
- Create concrete, immediately usable recommendations
- Write in a premium, decisive tone with zero filler

CRITICAL RULES:
⚠️ DO NOT ask for more information or data
⚠️ DO NOT say anything is missing or unknown
⚠️ USE whatever data is provided to create insights
⚠️ If a piece of data is unavailable, work around it creatively or skip it
⚠️ Your job is to DELIVER the blueprint, not request more input`;

async function getSystemPrompt(productSlug: string): Promise<string> {
  const { data } = await supabase
    .from('prompts')
    .select('content')
    .eq('product_slug', productSlug)
    .eq('scope', 'final_briefing')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content || SYSTEM_PROMPT_FALLBACK;
}

function buildPlacementSummary(placements: any): string {
  const astro = placements?.astrology || {};
  const hd = placements?.human_design || {};
  const notes = placements?.notes || '';

  const isKnown = (v: any) => v && v !== 'UNKNOWN';

  const astroFields: string[] = [];
  if (isKnown(astro.sun))     astroFields.push(`Sun: ${astro.sun}`);
  if (isKnown(astro.moon))    astroFields.push(`Moon: ${astro.moon}`);
  if (isKnown(astro.rising))  astroFields.push(`Rising: ${astro.rising}`);
  if (isKnown(astro.mercury)) astroFields.push(`Mercury: ${astro.mercury}`);
  if (isKnown(astro.venus))   astroFields.push(`Venus: ${astro.venus}`);
  if (isKnown(astro.mars))    astroFields.push(`Mars: ${astro.mars}`);
  if (isKnown(astro.jupiter)) astroFields.push(`Jupiter: ${astro.jupiter}`);
  if (isKnown(astro.saturn))  astroFields.push(`Saturn: ${astro.saturn}`);
  if (isKnown(astro.houses))  astroFields.push(`Houses: ${astro.houses}`);

  const hdFields: string[] = [];
  if (isKnown(hd.type))             hdFields.push(`Type: ${hd.type}`);
  if (isKnown(hd.profile))          hdFields.push(`Profile: ${hd.profile}`);
  if (isKnown(hd.authority))        hdFields.push(`Authority: ${hd.authority}`);
  if (isKnown(hd.strategy))         hdFields.push(`Strategy: ${hd.strategy}`);
  if (isKnown(hd.definition))       hdFields.push(`Definition: ${hd.definition}`);
  if (isKnown(hd.not_self_theme))   hdFields.push(`Not-Self Theme: ${hd.not_self_theme}`);
  if (isKnown(hd.incarnation_cross)) hdFields.push(`Incarnation Cross: ${hd.incarnation_cross}`);
  if (isKnown(hd.primary_gift))     hdFields.push(`Primary Gift: Gate ${hd.primary_gift}`);

  let summary = '';
  if (astroFields.length) summary += 'ASTROLOGY:\n' + astroFields.join('\n') + '\n\n';
  if (hdFields.length)    summary += 'HUMAN DESIGN:\n' + hdFields.join('\n') + '\n\n';
  if (notes)              summary += `ADDITIONAL CHART NOTES:\n${notes}\n`;
  return summary.trim();
}

async function regenerateSession(sessionId: string, productSlug: string, note: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Session: ${sessionId}`);
  console.log(`Product: ${productSlug}`);
  console.log(`Issue:   ${note}`);
  console.log('='.repeat(60));

  // 1. Get session
  const { data: session, error: sessionErr } = await supabase
    .from('product_sessions')
    .select('user_id, product_slug, placements, step_data')
    .eq('id', sessionId)
    .single();

  if (sessionErr || !session) {
    console.error('  ❌ Session not found:', sessionErr?.message);
    return;
  }

  // 2. Get conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('step_number, messages, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  // 3. Build user responses
  let userResponses = (conversations || [])
    .flatMap((c: any) =>
      ((c.messages as any[]) || [])
        .filter((m: any) => m.role === 'user')
        .map((m: any) => `Step ${c.step_number}: ${m.content}`)
    )
    .join('\n\n');

  if (!userResponses.trim()) {
    const stepData = (session.step_data as Record<string, any>) || {};
    userResponses = Object.entries(stepData)
      .filter(([k]) => /^step_\d+$/.test(k))
      .sort((a, b) => Number(a[0].split('_')[1]) - Number(b[0].split('_')[1]))
      .map(([k, v]) => {
        const n = k.split('_')[1];
        const ans = typeof (v as any)?.answer === 'string' ? (v as any).answer : '';
        return ans.trim() ? `Step ${n}: ${ans}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  console.log(`  User responses: ${userResponses ? userResponses.length + ' chars' : 'NONE'}`);

  // 4. Build wizard nudges from step_insight messages
  const wizardNudges = (conversations || [])
    .flatMap((c: any) =>
      ((c.messages as any[]) || [])
        .filter((m: any) => m.role === 'assistant' && m.type === 'step_insight')
        .map((m: any) => {
          const content = m.content || '';
          return content ? `Step ${c.step_number} Insight:\n${content}` : null;
        })
        .filter((x: string | null) => x !== null && x.trim().length > 0)
    )
    .join('\n\n---\n\n');

  console.log(`  Wizard nudges: ${wizardNudges ? wizardNudges.length + ' chars' : 'NONE'}`);

  // 5. Build placement summary
  const placementSummary = buildPlacementSummary(session.placements);
  console.log(`  Placements: ${placementSummary ? placementSummary.length + ' chars' : 'NONE'}`);

  // 6. Get product definition
  const { data: product } = await supabase
    .from('product_definitions')
    .select('final_deliverable_prompt, name')
    .eq('product_slug', productSlug)
    .single();

  const instructionMessage = product?.final_deliverable_prompt || `Generate a comprehensive final deliverable based on the user's responses and chart placements. Cover all key insights in full.`;

  // 7. Get system prompt
  const systemPrompt = await getSystemPrompt(productSlug);

  // 8. Build messages (matching fixed route.ts logic)
  const chartDataMessage = `MY CHART DATA:\n\n${placementSummary || 'Limited chart data available — focus on conversation insights.'}`;
  const conversationMessage = `MY COMPLETE RESPONSES ACROSS ALL STEPS:\n\n${userResponses || 'No detailed responses provided.'}${wizardNudges ? `\n\nWIZARD INSIGHTS FROM EACH STEP:\n\n${wizardNudges}` : ''}`;

  const messages: { role: 'user'; content: string }[] = [
    { role: 'user', content: chartDataMessage },
    { role: 'user', content: conversationMessage },
    { role: 'user', content: instructionMessage },
    ...(wizardNudges ? [{ role: 'user' as const, content: ACTIONABLE_NUDGE_INSTRUCTION }] : []),
  ];

  // 9. Call OpenAI
  console.log(`  Calling ${openaiModel}...`);
  const completion = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_completion_tokens: 15000,
  } as any);

  const briefing = completion.choices[0]?.message?.content;
  if (!briefing) {
    console.error('  ❌ OpenAI returned empty content');
    return;
  }

  console.log(`  Generated briefing: ${briefing.length} chars`);
  console.log(`  Preview: ${briefing.slice(0, 120).replace(/\n/g, ' ')}...`);

  // 10. Save back to product_sessions
  const { error: saveErr } = await supabase
    .from('product_sessions')
    .update({
      deliverable_content: briefing,
      completed_at: new Date().toISOString(),
      is_complete: true,
      deliverable_model: openaiModel,
    })
    .eq('id', sessionId);

  if (saveErr) {
    console.error('  ❌ Failed to save:', saveErr.message);
    return;
  }

  // 11. Log to conversations (step 999)
  const { data: existing } = await supabase
    .from('conversations')
    .select('messages')
    .eq('session_id', sessionId)
    .eq('step_number', 999)
    .maybeSingle();

  const existingMsgs = (existing?.messages as any[]) || [];
  await supabase.from('conversations').upsert(
    {
      session_id: sessionId,
      step_number: 999,
      messages: [...existingMsgs, { role: 'assistant', content: briefing, created_at: new Date().toISOString(), type: 'final_briefing' }],
    },
    { onConflict: 'session_id,step_number' }
  );

  console.log(`  ✅ Saved successfully`);
}

async function main() {
  console.log(`\n🔄 Regenerating Three Rites briefings for ${USER_EMAIL}`);
  console.log(`   ${TARGET_SESSIONS.length} sessions to process\n`);

  let success = 0;
  let failed = 0;

  for (const { id, slug, note } of TARGET_SESSIONS) {
    try {
      await regenerateSession(id, slug, note);
      success++;
    } catch (err: any) {
      console.error(`  ❌ Unhandled error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Done — ${success} succeeded, ${failed} failed\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
