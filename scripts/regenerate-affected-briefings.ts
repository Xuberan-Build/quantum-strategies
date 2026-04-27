#!/usr/bin/env tsx
/**
 * Find all Three Rites sessions with nudge-only deliverables, regenerate them,
 * and send a Discord DM to each affected user (excluding the admin account).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

// Skip DM to admin/owner
const SKIP_DM_EMAILS = new Set(['santos.93.aus@gmail.com']);

const RITE_SLUGS = [
  'perception-rite-scan-1', 'perception-rite-scan-2', 'perception-rite-scan-3',
  'perception-rite-scan-4', 'perception-rite-scan-5',
  'declaration-rite-life-vision', 'declaration-rite-business-model', 'declaration-rite-strategic-path',
];

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

const ACTIONABLE_NUDGE_INSTRUCTION = `CRITICAL: Your response must contain TWO parts in this exact order — no preamble, no checklist, no "Input Requirements" section.

PART 1 — OPENING NUDGES (output this first):
Use this exact header on its own line:
**OPENING: Your Actionable Nudges (This Week)**

Review all step insights and list the 5-7 MOST actionable nudges — numbered 1–7, one per line. Each 1–2 sentences: [specific action] — because [specific thing from their responses]. Distill; do not copy verbatim. Criteria: concrete, implementable this week, tied to something the user shared, framed as an action.

PART 2 — FULL DELIVERABLE (output this immediately after Part 1):
Generate the complete deliverable per the instructions above. Include every section in full. Do not skip or abbreviate any section.`;

function isNudgesOnly(content: string): boolean {
  const trimmed = content.trim();
  const startsWithNudges = /^(\*\*OPENING:|#+ ?YOUR? ACTIONABLE NUDGES)/i.test(trimmed);
  return startsWithNudges && content.length < 6000;
}

function buildPlacementSummary(placements: any): string {
  const astro = placements?.astrology || {};
  const hd = placements?.human_design || {};
  const notes = placements?.notes || '';
  const ok = (v: any) => v && v !== 'UNKNOWN';

  const af: string[] = [];
  if (ok(astro.sun))     af.push(`Sun: ${astro.sun}`);
  if (ok(astro.moon))    af.push(`Moon: ${astro.moon}`);
  if (ok(astro.rising))  af.push(`Rising: ${astro.rising}`);
  if (ok(astro.mercury)) af.push(`Mercury: ${astro.mercury}`);
  if (ok(astro.venus))   af.push(`Venus: ${astro.venus}`);
  if (ok(astro.mars))    af.push(`Mars: ${astro.mars}`);
  if (ok(astro.jupiter)) af.push(`Jupiter: ${astro.jupiter}`);
  if (ok(astro.saturn))  af.push(`Saturn: ${astro.saturn}`);
  if (ok(astro.houses))  af.push(`Houses: ${astro.houses}`);

  const hf: string[] = [];
  if (ok(hd.type))              hf.push(`Type: ${hd.type}`);
  if (ok(hd.profile))           hf.push(`Profile: ${hd.profile}`);
  if (ok(hd.authority))         hf.push(`Authority: ${hd.authority}`);
  if (ok(hd.strategy))          hf.push(`Strategy: ${hd.strategy}`);
  if (ok(hd.definition))        hf.push(`Definition: ${hd.definition}`);
  if (ok(hd.not_self_theme))    hf.push(`Not-Self Theme: ${hd.not_self_theme}`);
  if (ok(hd.incarnation_cross)) hf.push(`Incarnation Cross: ${hd.incarnation_cross}`);
  if (ok(hd.primary_gift))      hf.push(`Primary Gift: Gate ${hd.primary_gift}`);

  let s = '';
  if (af.length) s += 'ASTROLOGY:\n' + af.join('\n') + '\n\n';
  if (hf.length) s += 'HUMAN DESIGN:\n' + hf.join('\n') + '\n\n';
  if (notes)     s += `ADDITIONAL CHART NOTES:\n${notes}\n`;
  return s.trim();
}

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

async function regenerateSession(sessionId: string, productSlug: string): Promise<string> {
  const { data: session } = await supabase
    .from('product_sessions')
    .select('user_id, placements, step_data')
    .eq('id', sessionId)
    .single();

  const { data: conversations } = await supabase
    .from('conversations')
    .select('step_number, messages, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  let userResponses = (conversations || [])
    .flatMap((c: any) =>
      ((c.messages as any[]) || [])
        .filter((m: any) => m.role === 'user')
        .map((m: any) => `Step ${c.step_number}: ${m.content}`)
    )
    .join('\n\n');

  if (!userResponses.trim()) {
    const stepData = (session?.step_data as Record<string, any>) || {};
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

  const placementSummary = buildPlacementSummary(session?.placements);

  const { data: product } = await supabase
    .from('product_definitions')
    .select('final_deliverable_prompt')
    .eq('product_slug', productSlug)
    .single();

  const instructionMessage = product?.final_deliverable_prompt
    || 'Generate a comprehensive final deliverable based on the user\'s responses and chart placements. Cover all key insights in full.';

  const systemPrompt = await getSystemPrompt(productSlug);

  const messages: { role: 'user'; content: string }[] = [
    { role: 'user', content: `MY CHART DATA:\n\n${placementSummary || 'Limited chart data — focus on conversation insights.'}` },
    { role: 'user', content: `MY COMPLETE RESPONSES ACROSS ALL STEPS:\n\n${userResponses || 'No detailed responses provided.'}${wizardNudges ? `\n\nWIZARD INSIGHTS FROM EACH STEP:\n\n${wizardNudges}` : ''}` },
    { role: 'user', content: instructionMessage },
    ...(wizardNudges ? [{ role: 'user' as const, content: ACTIONABLE_NUDGE_INSTRUCTION }] : []),
  ];

  const completion = await openai.chat.completions.create({
    model: openaiModel,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_completion_tokens: 15000,
  } as any);

  const briefing = completion.choices[0]?.message?.content;
  if (!briefing) throw new Error('OpenAI returned empty content');

  await supabase
    .from('product_sessions')
    .update({
      deliverable_content: briefing,
      completed_at: new Date().toISOString(),
      is_complete: true,
      deliverable_model: openaiModel,
    })
    .eq('id', sessionId);

  const { data: existing } = await supabase
    .from('conversations')
    .select('messages')
    .eq('session_id', sessionId)
    .eq('step_number', 999)
    .maybeSingle();

  await supabase.from('conversations').upsert(
    {
      session_id: sessionId,
      step_number: 999,
      messages: [
        ...((existing?.messages as any[]) || []),
        { role: 'assistant', content: briefing, created_at: new Date().toISOString(), type: 'final_briefing' },
      ],
    },
    { onConflict: 'session_id,step_number' }
  );

  return briefing;
}

async function sendDiscordDM(discordId: string, name: string): Promise<void> {
  const BASE = 'https://discord.com/api/v10';
  const headers = { Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json' };

  const firstName = name.split(' ')[0];
  const message = `Hey ${firstName} 👋

We noticed that one of your Three Rites briefings wasn't showing your full report — it was only displaying the opening nudges section instead of the complete deliverable.

We caught the issue, fixed it on our end, and have already regenerated your briefing with the full content. Everything is restored and ready for you now.

You can view your complete report here: https://www.quantumstrategies.online/dashboard/products

Sorry for the confusion — let us know if you have any questions! 🙏`;

  const dmRes = await fetch(`${BASE}/users/@me/channels`, {
    method: 'POST', headers, body: JSON.stringify({ recipient_id: discordId }),
  });
  const dm = await dmRes.json() as any;
  if (!dmRes.ok) throw new Error(`Failed to open DM channel: ${JSON.stringify(dm)}`);

  const msgRes = await fetch(`${BASE}/channels/${dm.id}/messages`, {
    method: 'POST', headers, body: JSON.stringify({ content: message }),
  });
  const msg = await msgRes.json() as any;
  if (!msgRes.ok) throw new Error(`Failed to send message: ${JSON.stringify(msg)}`);

  console.log(`  ✅ DM sent (message ID: ${msg.id})`);
}

async function main() {
  // 1. Find all affected sessions
  const { data: sessions } = await supabase
    .from('product_sessions')
    .select('id, product_slug, deliverable_content, user_id')
    .in('product_slug', RITE_SLUGS)
    .not('deliverable_content', 'is', null)
    .neq('deliverable_content', '');

  const affected = (sessions || []).filter(s => isNudgesOnly(s.deliverable_content as string));

  if (affected.length === 0) {
    console.log('✅ No affected sessions found.');
    return;
  }

  // Group by user
  const byUser: Record<string, typeof affected> = {};
  for (const s of affected) {
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push(s);
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, discord_id')
    .in('id', Object.keys(byUser));

  console.log(`\n🔍 Found ${affected.length} affected sessions across ${Object.keys(byUser).length} users\n`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const user of (users || [])) {
    const sessions = byUser[user.id] || [];
    const skipDM = SKIP_DM_EMAILS.has(user.email);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`User: ${user.name} (${user.email})${skipDM ? ' — skipping DM (admin)' : ''}`);
    console.log(`Sessions: ${sessions.length}`);

    for (const s of sessions) {
      console.log(`\n  Session: ${s.id} — ${s.product_slug} (${(s.deliverable_content as string).length} chars)`);
      try {
        const briefing = await regenerateSession(s.id, s.product_slug);
        console.log(`  Regenerated: ${briefing.length} chars`);
        totalSuccess++;
      } catch (err: any) {
        console.error(`  ❌ Regeneration failed: ${err.message}`);
        totalFailed++;
      }
    }

    if (!skipDM && user.discord_id) {
      console.log(`\n  Sending Discord DM to ${user.name} (${user.discord_id})...`);
      try {
        await sendDiscordDM(user.discord_id, user.name);
      } catch (err: any) {
        console.error(`  ❌ DM failed: ${err.message}`);
      }
    } else if (!skipDM && !user.discord_id) {
      console.log(`  ⚠️  No Discord ID — cannot send DM`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Done — ${totalSuccess} regenerated, ${totalFailed} failed\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
