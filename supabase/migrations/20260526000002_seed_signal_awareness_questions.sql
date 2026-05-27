-- =====================================================
-- Migration: seed_signal_awareness_questions
-- Date: 2026-05-26
--
-- Seeds the question_pool with 6 anchor questions for
-- the Signal Awareness Scan (perception-rite-scan-1).
--
-- All rows are universal (audience_tracks = {all}).
-- Followup text lives on the anchor row — no separate rows.
-- Uses ON CONFLICT DO UPDATE for idempotency.
--
-- Depends on: 20260526000001_dynamic_question_infra.sql
-- =====================================================


-- Step 1: What people seek you out for
INSERT INTO public.question_pool (
  id,
  product_slug,
  step_index,
  domain,
  rite,
  question_role,
  experience_level,
  audience_tracks,
  prompt_text,
  followup_text,
  prompt_variants,
  unlocks,
  blocks,
  signals_extracted,
  active
) VALUES (
  'sig.aware.step1.anchor',
  'perception-rite-scan-1',
  1,
  'signal',
  'perception',
  'anchor',
  2,
  ARRAY['all'],
  'What do people keep coming to you for help with?',
  'Think about the last few times someone unprompted asked you for something. What were they after?',
  NULL,
  '{}',
  '{}',
  ARRAY['signal:helper', 'signal:expert', 'signal:fixer', 'signal:creator', 'pattern:over_availability'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  product_slug      = EXCLUDED.product_slug,
  step_index        = EXCLUDED.step_index,
  domain            = EXCLUDED.domain,
  rite              = EXCLUDED.rite,
  question_role     = EXCLUDED.question_role,
  experience_level  = EXCLUDED.experience_level,
  audience_tracks   = EXCLUDED.audience_tracks,
  prompt_text       = EXCLUDED.prompt_text,
  followup_text     = EXCLUDED.followup_text,
  prompt_variants   = EXCLUDED.prompt_variants,
  unlocks           = EXCLUDED.unlocks,
  blocks            = EXCLUDED.blocks,
  signals_extracted = EXCLUDED.signals_extracted,
  active            = EXCLUDED.active,
  updated_at        = NOW();


-- Step 2: What keeps showing up
INSERT INTO public.question_pool (
  id,
  product_slug,
  step_index,
  domain,
  rite,
  question_role,
  experience_level,
  audience_tracks,
  prompt_text,
  followup_text,
  prompt_variants,
  unlocks,
  blocks,
  signals_extracted,
  active
) VALUES (
  'sig.aware.step2.anchor',
  'perception-rite-scan-1',
  2,
  'signal',
  'perception',
  'anchor',
  2,
  ARRAY['all'],
  'What kinds of opportunities keep landing in your lap — even ones you didn''t ask for?',
  'Even small ones count. What''s been showing up that you''ve been brushing off?',
  NULL,
  '{}',
  '{}',
  ARRAY['pattern:attractive_frequency', 'signal:scarcity', 'signal:abundance'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  product_slug      = EXCLUDED.product_slug,
  step_index        = EXCLUDED.step_index,
  domain            = EXCLUDED.domain,
  rite              = EXCLUDED.rite,
  question_role     = EXCLUDED.question_role,
  experience_level  = EXCLUDED.experience_level,
  audience_tracks   = EXCLUDED.audience_tracks,
  prompt_text       = EXCLUDED.prompt_text,
  followup_text     = EXCLUDED.followup_text,
  prompt_variants   = EXCLUDED.prompt_variants,
  unlocks           = EXCLUDED.unlocks,
  blocks            = EXCLUDED.blocks,
  signals_extracted = EXCLUDED.signals_extracted,
  active            = EXCLUDED.active,
  updated_at        = NOW();


-- Step 3: The problem that follows you
INSERT INTO public.question_pool (
  id,
  product_slug,
  step_index,
  domain,
  rite,
  question_role,
  experience_level,
  audience_tracks,
  prompt_text,
  followup_text,
  prompt_variants,
  unlocks,
  blocks,
  signals_extracted,
  active
) VALUES (
  'sig.aware.step3.anchor',
  'perception-rite-scan-1',
  3,
  'signal',
  'perception',
  'anchor',
  2,
  ARRAY['all'],
  'What''s a problem that keeps following you — different situation, same complaint?',
  NULL,
  NULL,
  '{}',
  '{}',
  ARRAY['pattern:interference', 'pattern:repeat_complaint'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  product_slug      = EXCLUDED.product_slug,
  step_index        = EXCLUDED.step_index,
  domain            = EXCLUDED.domain,
  rite              = EXCLUDED.rite,
  question_role     = EXCLUDED.question_role,
  experience_level  = EXCLUDED.experience_level,
  audience_tracks   = EXCLUDED.audience_tracks,
  prompt_text       = EXCLUDED.prompt_text,
  followup_text     = EXCLUDED.followup_text,
  prompt_variants   = EXCLUDED.prompt_variants,
  unlocks           = EXCLUDED.unlocks,
  blocks            = EXCLUDED.blocks,
  signals_extracted = EXCLUDED.signals_extracted,
  active            = EXCLUDED.active,
  updated_at        = NOW();


-- Step 4: The shape of your life right now
INSERT INTO public.question_pool (
  id,
  product_slug,
  step_index,
  domain,
  rite,
  question_role,
  experience_level,
  audience_tracks,
  prompt_text,
  followup_text,
  prompt_variants,
  unlocks,
  blocks,
  signals_extracted,
  active
) VALUES (
  'sig.aware.step4.anchor',
  'perception-rite-scan-1',
  4,
  'signal',
  'perception',
  'anchor',
  2,
  ARRAY['all'],
  'If a friend who knows you well had to describe your life right now in one word, what would they say?',
  'Why that word?',
  NULL,
  '{}',
  '{}',
  ARRAY['pattern:life_shape', 'depth:novice', 'depth:advanced'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  product_slug      = EXCLUDED.product_slug,
  step_index        = EXCLUDED.step_index,
  domain            = EXCLUDED.domain,
  rite              = EXCLUDED.rite,
  question_role     = EXCLUDED.question_role,
  experience_level  = EXCLUDED.experience_level,
  audience_tracks   = EXCLUDED.audience_tracks,
  prompt_text       = EXCLUDED.prompt_text,
  followup_text     = EXCLUDED.followup_text,
  prompt_variants   = EXCLUDED.prompt_variants,
  unlocks           = EXCLUDED.unlocks,
  blocks            = EXCLUDED.blocks,
  signals_extracted = EXCLUDED.signals_extracted,
  active            = EXCLUDED.active,
  updated_at        = NOW();


-- Step 5: What you light up about
INSERT INTO public.question_pool (
  id,
  product_slug,
  step_index,
  domain,
  rite,
  question_role,
  experience_level,
  audience_tracks,
  prompt_text,
  followup_text,
  prompt_variants,
  unlocks,
  blocks,
  signals_extracted,
  active
) VALUES (
  'sig.aware.step5.anchor',
  'perception-rite-scan-1',
  5,
  'signal',
  'perception',
  'anchor',
  2,
  ARRAY['all'],
  'What do you start talking about and forget to stop?',
  NULL,
  NULL,
  '{}',
  '{}',
  ARRAY['pattern:authentic_frequency', 'signal:expert'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  product_slug      = EXCLUDED.product_slug,
  step_index        = EXCLUDED.step_index,
  domain            = EXCLUDED.domain,
  rite              = EXCLUDED.rite,
  question_role     = EXCLUDED.question_role,
  experience_level  = EXCLUDED.experience_level,
  audience_tracks   = EXCLUDED.audience_tracks,
  prompt_text       = EXCLUDED.prompt_text,
  followup_text     = EXCLUDED.followup_text,
  prompt_variants   = EXCLUDED.prompt_variants,
  unlocks           = EXCLUDED.unlocks,
  blocks            = EXCLUDED.blocks,
  signals_extracted = EXCLUDED.signals_extracted,
  active            = EXCLUDED.active,
  updated_at        = NOW();


-- Step 6: Who you say you are
INSERT INTO public.question_pool (
  id,
  product_slug,
  step_index,
  domain,
  rite,
  question_role,
  experience_level,
  audience_tracks,
  prompt_text,
  followup_text,
  prompt_variants,
  unlocks,
  blocks,
  signals_extracted,
  active
) VALUES (
  'sig.aware.step6.anchor',
  'perception-rite-scan-1',
  6,
  'signal',
  'perception',
  'anchor',
  2,
  ARRAY['all'],
  'Finish this five times, quickly — don''t overthink: "I''m the kind of person who ______."',
  'Look at your five answers. Which ones would your closest friends nod along with — and which would make them raise an eyebrow?',
  NULL,
  '{}',
  '{}',
  ARRAY['pattern:self_concept', 'gap:stated_vs_revealed', 'pattern:performing_identity'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  product_slug      = EXCLUDED.product_slug,
  step_index        = EXCLUDED.step_index,
  domain            = EXCLUDED.domain,
  rite              = EXCLUDED.rite,
  question_role     = EXCLUDED.question_role,
  experience_level  = EXCLUDED.experience_level,
  audience_tracks   = EXCLUDED.audience_tracks,
  prompt_text       = EXCLUDED.prompt_text,
  followup_text     = EXCLUDED.followup_text,
  prompt_variants   = EXCLUDED.prompt_variants,
  unlocks           = EXCLUDED.unlocks,
  blocks            = EXCLUDED.blocks,
  signals_extracted = EXCLUDED.signals_extracted,
  active            = EXCLUDED.active,
  updated_at        = NOW();
