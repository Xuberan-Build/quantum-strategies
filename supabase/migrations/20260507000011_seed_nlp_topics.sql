-- Seed NLP/Neurolinguistic Programming content topics and angles
-- Pillar: Self as Signal
-- 12 topics × 4 angles = 48 angles total
-- Idempotent: uses NOT EXISTS checks; no UNIQUE constraint on title

-- Fix stale format/tone constraints inherited when content_pillars was renamed to content_angles
ALTER TABLE public.content_angles DROP CONSTRAINT IF EXISTS content_pillars_format_check;
ALTER TABLE public.content_angles DROP CONSTRAINT IF EXISTS content_pillars_tone_check;
ALTER TABLE public.content_angles DROP CONSTRAINT IF EXISTS content_angles_format_check;
ALTER TABLE public.content_angles ALTER COLUMN format DROP NOT NULL;
ALTER TABLE public.content_angles ADD CONSTRAINT content_angles_format_check CHECK (
  format IS NULL OR format IN (
    'blog_post','thread','video_script','long_form_essay','deep_dive',
    'comparison','how_to_guide','email_sequence','gpt_product',
    'ebook','webinar','ecourse','whitepaper'
  )
);

DO $$
DECLARE
  v_pillar_id UUID;
  v_topic_id  UUID;
BEGIN
  SELECT id INTO v_pillar_id FROM content_pillars WHERE slug = 'the-self-as-signal';
  IF v_pillar_id IS NULL THEN
    INSERT INTO content_pillars (title, slug, description, tradition_affinity)
    VALUES ('The Self as Signal', 'the-self-as-signal',
      'Who you are determines what you build. Consciousness, identity, waveform intelligence, perception, NLP. The self is the signal your market receives before the product does.',
      ARRAY['sufism', 'kabbalah', 'hinduism', 'science'])
    RETURNING id INTO v_pillar_id;
  END IF;

  -- ── T1. Submodality Encoding and Identity Perception ─────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Submodality Encoding and Identity Perception') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Submodality Encoding and Identity Perception',
      'How the structural qualities of internal images, sounds, and feelings determine the felt weight of identity beliefs.',
      ARRAY['nlp', 'submodalities', 'identity', 'perception', 'internal-experience'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Submodality Encoding and Identity Perception';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Why Some Beliefs Feel Unshakeable While Others Dissolve in a Week') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Why Some Beliefs Feel Unshakeable While Others Dissolve in a Week',
      'NLP practitioners and coaches',
      'Understand how submodality structure determines belief durability',
      'The difference between a "core" belief and a "surface" belief is entirely a matter of submodality encoding — not content',
      'long_form_essay', 'draft', 'submodality coding internal representation identity belief strength');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Submodality Inventory That Predicts Client Resistance Before You Start') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Submodality Inventory That Predicts Client Resistance Before You Start',
      'NLP trainers, coaches',
      'Pre-session diagnostic tool for resistance prediction',
      'Mapping client submodalities in the first session reveals which interventions will and won''t work',
      'how_to_guide', 'draft', 'submodality coding internal representation identity belief strength');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Swapping the Frame: How Submodality Shifts Rewrite the Story Your Body Tells') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Swapping the Frame: How Submodality Shifts Rewrite the Story Your Body Tells',
      'Self-development practitioners',
      'Connect submodality work to somatic experience',
      'The body doesn''t respond to events — it responds to the internal representation of events',
      'blog_post', 'draft', 'submodality coding internal representation identity belief strength');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'From Bright to Dim: The Engineer''s Guide to Belief Architecture') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'From Bright to Dim: The Engineer''s Guide to Belief Architecture',
      'Systems-minded practitioners, developers',
      'Frame NLP submodalities in technical/systems language',
      'Internal representations have computable properties — brightness, size, distance, motion — that can be deliberately engineered',
      'deep_dive', 'draft', 'submodality coding internal representation identity belief strength');
  END IF;

  -- ── T2. Meta-Programs as Identity Filters ────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Meta-Programs as Identity Filters') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Meta-Programs as Identity Filters',
      'How habitual perceptual sorting patterns — toward/away, big chunk/small chunk, proactive/reactive — create persistent identity themes.',
      ARRAY['nlp', 'meta-programs', 'cognitive-filters', 'identity', 'sorting'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Meta-Programs as Identity Filters';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'You Don''t Have Personality Traits — You Have Meta-Programs Running on Autopilot') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'You Don''t Have Personality Traits — You Have Meta-Programs Running on Autopilot',
      'NLP practitioners, psychologists',
      'Reframe fixed traits as changeable filters',
      'What Myers-Briggs calls "introversion" NLP calls a meta-program — and meta-programs can be temporarily overridden',
      'blog_post', 'draft', 'meta-programs perceptual filters identity motivation direction sorting patterns');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Away-From Trap: Why Avoiding Pain Makes You Worse at Finding Direction') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Away-From Trap: Why Avoiding Pain Makes You Worse at Finding Direction',
      'Coaches, high-performers',
      'Diagnose away-from motivation patterns and their cost',
      'Away-from motivation produces urgency but not navigation — you need a toward signal to actually arrive anywhere',
      'long_form_essay', 'draft', 'meta-programs perceptual filters identity motivation direction sorting patterns');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Matching Meta-Programs: The Persuasion Skill Nobody Teaches in Sales Training') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Matching Meta-Programs: The Persuasion Skill Nobody Teaches in Sales Training',
      'Sales professionals, negotiators',
      'Use meta-program matching to increase communication effectiveness',
      'Mismatched meta-programs kill rapport faster than wrong content',
      'how_to_guide', 'draft', 'meta-programs perceptual filters identity motivation direction sorting patterns');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Big Chunk / Small Chunk: How Your Default Level of Abstraction Shapes Your Strategy') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Big Chunk / Small Chunk: How Your Default Level of Abstraction Shapes Your Strategy',
      'Entrepreneurs, strategists',
      'Surface how abstraction preference creates blind spots',
      'Most strategic failures are meta-program mismatches — visionaries using small-chunk language, implementers stuck in big-chunk vision',
      'deep_dive', 'draft', 'meta-programs perceptual filters identity motivation direction sorting patterns');
  END IF;

  -- ── T3. Representational Systems and Reality Construction ────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Representational Systems and Reality Construction') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Representational Systems and Reality Construction',
      'How the dominance of visual, auditory, kinesthetic, or digital processing shapes how a person constructs their experienced reality.',
      ARRAY['nlp', 'representational-systems', 'VAK', 'sensory-modalities', 'reality-construction'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Representational Systems and Reality Construction';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Why You Process the World Differently Than the Person Next to You') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Why You Process the World Differently Than the Person Next to You',
      'General NLP-aware audience',
      'Introduce rep systems as identity architecture',
      'You aren''t seeing the same world as others — you''re running a different sensory processing program',
      'blog_post', 'draft', 'representational systems visual auditory kinesthetic digital internal processing modalities');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Digital Processor: Why Some People Live in Their Heads and Can''t Feel Anything') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Digital Processor: Why Some People Live in Their Heads and Can''t Feel Anything',
      'Coaches, therapists',
      'Understand digital/auditory digital processing and its emotional disconnection pattern',
      'The most intellectually sophisticated clients are often the hardest to reach because they''ve abstracted themselves out of felt experience',
      'long_form_essay', 'draft', 'representational systems visual auditory kinesthetic digital internal processing modalities');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Predicate Matching: The Language Pattern That Makes Clients Feel Truly Heard') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Predicate Matching: The Language Pattern That Makes Clients Feel Truly Heard',
      'Therapists, coaches, communicators',
      'Apply rep system matching in session language',
      'The fastest way to build rapport isn''t tone — it''s speaking in the same sensory modality as your client',
      'how_to_guide', 'draft', 'representational systems visual auditory kinesthetic digital internal processing modalities');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Crossover Rep Systems: When You''re Kinesthetic in Learning and Visual in Planning') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Crossover Rep Systems: When You''re Kinesthetic in Learning and Visual in Planning',
      'Learning designers, trainers',
      'Show complexity of rep system profiles',
      'Most people have different primary systems for different contexts — and this explains why universal teaching methods fail',
      'deep_dive', 'draft', 'representational systems visual auditory kinesthetic digital internal processing modalities');
  END IF;

  -- ── T4. Anchoring and State Management ───────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Anchoring and State Management') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Anchoring and State Management',
      'How conditioned stimulus-response pairs get installed and accessed, and why state management is the foundation of consistent performance.',
      ARRAY['nlp', 'anchoring', 'state-management', 'conditioned-response', 'performance'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Anchoring and State Management';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Moment Your Brain Decided ''This Is Dangerous'' — And Why It''s Still Running') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Moment Your Brain Decided ''This Is Dangerous'' — And Why It''s Still Running',
      'Anxiety-aware practitioners, coaches',
      'Explain how negative anchors form and persist',
      'Most of what you call personality is really a collection of anchors that fired at critical developmental moments',
      'blog_post', 'draft', 'anchoring conditioned stimulus state management resource states NLP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Installing Resource States: The Anchor Protocol Professional Athletes Actually Use') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Installing Resource States: The Anchor Protocol Professional Athletes Actually Use',
      'Performance coaches, sports psychology practitioners',
      'Teach systematic anchor installation for peak state access',
      'Elite performance isn''t about motivation — it''s about reliable state access under pressure',
      'how_to_guide', 'draft', 'anchoring conditioned stimulus state management resource states NLP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Stacked Anchors and Collapse: When Simple Conditioning Isn''t Enough') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Stacked Anchors and Collapse: When Simple Conditioning Isn''t Enough',
      'Advanced NLP practitioners',
      'Show advanced anchoring techniques for complex state work',
      'Single anchors work for simple states — complex patterns require stacking and collapse techniques',
      'deep_dive', 'draft', 'anchoring conditioned stimulus state management resource states NLP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Why Your Workspace Is Anchoring You to Distraction (And What to Do About It)') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Why Your Workspace Is Anchoring You to Distraction (And What to Do About It)',
      'Knowledge workers, productivity-focused professionals',
      'Apply anchoring principles to environment design',
      'Your environment is a constant anchor — every surface that''s been associated with distraction is actively triggering it',
      'blog_post', 'draft', 'anchoring conditioned stimulus state management resource states NLP');
  END IF;

  -- ── T5. Language Patterns and Self-Narrative ─────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Language Patterns and Self-Narrative') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Language Patterns and Self-Narrative',
      'How the specific linguistic structures a person uses to talk to themselves create and maintain their identity narrative.',
      ARRAY['nlp', 'language-patterns', 'self-talk', 'narrative', 'meta-model'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Language Patterns and Self-Narrative';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Meta-Model Violation Hiding in Your Self-Talk Right Now') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Meta-Model Violation Hiding in Your Self-Talk Right Now',
      'NLP-trained coaches and practitioners',
      'Surface how internal dialogue generalizes, deletes, distorts',
      'The most damaging meta-model violations aren''t what your clients say to you — they''re what they say to themselves',
      'blog_post', 'draft', 'language patterns self-narrative meta-model internal dialogue NLP linguistics');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Nominalizations and Identity Traps: Why ''I Am'' Statements Are Category Errors') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Nominalizations and Identity Traps: Why ''I Am'' Statements Are Category Errors',
      'Therapists, coaches, philosophers of language',
      'Dissolve fixed identity through nominalization awareness',
      '"I am anxious" is a nominalization — it converts a process into a thing, and things feel permanent',
      'long_form_essay', 'draft', 'language patterns self-narrative meta-model internal dialogue NLP linguistics');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Lost Performative: Whose Rules Are You Actually Following?') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Lost Performative: Whose Rules Are You Actually Following?',
      'Entrepreneurs, creatives, anyone questioning authority',
      'Identify externally installed values masquerading as personal rules',
      'Most "shoulds" are lost performatives — commands without a speaker, following rules whose author has never been identified',
      'deep_dive', 'draft', 'language patterns self-narrative meta-model internal dialogue NLP linguistics');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Rewriting the Story Without Lying to Yourself: The Ethics of Narrative Reframe') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Rewriting the Story Without Lying to Yourself: The Ethics of Narrative Reframe',
      'Coaches, therapists, integrity-conscious practitioners',
      'Balance reframe with honesty',
      'A reframe that requires you to deny facts will fail — effective narrative shifts work within the facts while changing their meaning',
      'how_to_guide', 'draft', 'language patterns self-narrative meta-model internal dialogue NLP linguistics');
  END IF;

  -- ── T6. Parts Integration and Inner Conflict ─────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Parts Integration and Inner Conflict') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Parts Integration and Inner Conflict',
      'How the NLP parts model explains internal conflict as competing programs, and how integration creates coherent action.',
      ARRAY['nlp', 'parts-integration', 'inner-conflict', 'ifs', 'internal-family-systems'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Parts Integration and Inner Conflict';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Why You Keep Doing the Thing You Said You''d Stop: A Parts Model Diagnosis') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Why You Keep Doing the Thing You Said You''d Stop: A Parts Model Diagnosis',
      'Anyone struggling with behavioral change',
      'Explain self-sabotage through competing parts logic',
      'Self-sabotage isn''t weakness — it''s a part running a protection program that predates your current goals',
      'blog_post', 'draft', 'parts integration inner conflict NLP parts model competing programs resolution');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Six-Step Reframe: Separating Behavior from Intention in Stuck Clients') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Six-Step Reframe: Separating Behavior from Intention in Stuck Clients',
      'NLP practitioners, coaches',
      'Teach six-step reframe protocol',
      'Every unwanted behavior has a positive intention — finding it is the key to change without resistance',
      'how_to_guide', 'draft', 'parts integration inner conflict NLP parts model competing programs resolution');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Parts vs. IFS: What NLP Gets Right That Internal Family Systems Misses') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Parts vs. IFS: What NLP Gets Right That Internal Family Systems Misses',
      'Therapists familiar with IFS, NLP trainers',
      'Differentiate approaches and clarify NLP''s structural advantage',
      'IFS metaphorizes parts — NLP treats them as functional programs, which changes what interventions are possible',
      'comparison', 'draft', 'parts integration inner conflict NLP parts model competing programs resolution');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Squash Integration: When Your Ambition and Your Safety Need to Shake Hands') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Squash Integration: When Your Ambition and Your Safety Need to Shake Hands',
      'High-performers, entrepreneurs',
      'Apply parts work to achievement conflict',
      'The executive who can''t rest and the protector who needs safety are running on a collision course — and it''s costing both of them',
      'deep_dive', 'draft', 'parts integration inner conflict NLP parts model competing programs resolution');
  END IF;

  -- ── T7. Eye Accessing Cues and Internal Process Detection ────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Eye Accessing Cues and Internal Process Detection') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Eye Accessing Cues and Internal Process Detection',
      'How lateral eye movements reflect underlying representational system access, and what this reveals about a person''s internal processing sequence.',
      ARRAY['nlp', 'eye-accessing', 'VAKO', 'internal-processing', 'nonverbal'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Eye Accessing Cues and Internal Process Detection';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Reading Eye Movements: What NLP Practitioners Know That Poker Players Don''t') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Reading Eye Movements: What NLP Practitioners Know That Poker Players Don''t',
      'Negotiators, practitioners, game theory enthusiasts',
      'Introduce eye accessing as competitive advantage',
      'Eye movements reveal which representational system someone is currently accessing — giving you real-time insight into their internal process',
      'blog_post', 'draft', 'eye accessing cues representational systems lateral eye movements internal process');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Eye Access Model Under Scientific Scrutiny: What Held Up and What Didn''t') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Eye Access Model Under Scientific Scrutiny: What Held Up and What Didn''t',
      'Evidence-conscious practitioners, skeptics',
      'Address validity concerns honestly',
      'Most of the attacks on eye accessing attacked a straw man — the actual functional claims are more modest and better supported',
      'deep_dive', 'draft', 'eye accessing cues representational systems lateral eye movements internal process');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Strategy Elicitation Using Eye Patterns: A Step-by-Step Protocol') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Strategy Elicitation Using Eye Patterns: A Step-by-Step Protocol',
      'Advanced NLP practitioners',
      'Teach strategy elicitation using eye access sequences',
      'You can map someone''s decision-making strategy by tracking the sequence of their eye movements while they recall a past decision',
      'how_to_guide', 'draft', 'eye accessing cues representational systems lateral eye movements internal process');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'When the Map Breaks Down: Eye Access Calibration for Individual Differences') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'When the Map Breaks Down: Eye Access Calibration for Individual Differences',
      'NLP trainers and experienced practitioners',
      'Teach calibration-first approach over templates',
      'The standard eye access diagram is a population average — calibrate to the individual before you interpret anything',
      'long_form_essay', 'draft', 'eye accessing cues representational systems lateral eye movements internal process');
  END IF;

  -- ── T8. Timeline Therapy and Temporal Coding ─────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Timeline Therapy and Temporal Coding') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Timeline Therapy and Temporal Coding',
      'How people represent time spatially, and how this affects their relationship to past events, future planning, and present-moment access.',
      ARRAY['nlp', 'timeline-therapy', 'temporal-coding', 'time-representation', 'tad'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Timeline Therapy and Temporal Coding';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'In Time vs. Through Time: Why Some People Can''t Plan and Others Can''t Be Present') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'In Time vs. Through Time: Why Some People Can''t Plan and Others Can''t Be Present',
      'Coaches, therapists, productivity researchers',
      'Explain functional consequences of time orientation',
      'Your time orientation isn''t just a learning style — it determines whether you''re more likely to procrastinate or to miss what''s happening now',
      'blog_post', 'draft', 'timeline therapy temporal coding time line NLP past future present');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Root Cause Resolution: Working with Early Memory Chains in Timeline Therapy') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Root Cause Resolution: Working with Early Memory Chains in Timeline Therapy',
      'Advanced NLP practitioners, clinical coaches',
      'Teach early memory chain resolution protocol',
      'Most presenting problems have a root memory — not the one the client remembers most, but the first time the pattern was installed',
      'how_to_guide', 'draft', 'timeline therapy temporal coding time line NLP past future present');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Spatial Metaphor of Time: How Your Timeline Is a Map, Not a Truth') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Spatial Metaphor of Time: How Your Timeline Is a Map, Not a Truth',
      'Philosophical practitioners, cognitive scientists',
      'Examine the constructed nature of temporal experience',
      'Time is not flowing past you — you are holding a spatial representation of temporal events, and that representation can be redesigned',
      'deep_dive', 'draft', 'timeline therapy temporal coding time line NLP past future present');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Future Pacing Without Bypassing: Building Timelines That Survive Contact With Reality') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Future Pacing Without Bypassing: Building Timelines That Survive Contact With Reality',
      'Goal-setting coaches, performance practitioners',
      'Make future pacing ecologically valid',
      'Most future-paced timelines fail because they don''t account for obstacle — you need to pace through failure, not around it',
      'long_form_essay', 'draft', 'timeline therapy temporal coding time line NLP past future present');
  END IF;

  -- ── T9. Milton Model and Embedded Influence in Self-Talk ─────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Milton Model and Embedded Influence in Self-Talk') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Milton Model and Embedded Influence in Self-Talk',
      'How the Milton Model''s indirect language patterns work not just interpersonally, but in the structure of a person''s internal dialogue.',
      ARRAY['nlp', 'milton-model', 'indirect-suggestion', 'hypnotic-language', 'self-talk'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Milton Model and Embedded Influence in Self-Talk';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'You''re Already Hypnotizing Yourself — The Question Is Whether You''re Good at It') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'You''re Already Hypnotizing Yourself — The Question Is Whether You''re Good at It',
      'NLP practitioners, mindset-focused practitioners',
      'Reframe self-talk as continuous self-hypnosis',
      'Every internal statement you make is an indirect suggestion — the difference between empowerment and limitation is the structure of the language',
      'blog_post', 'draft', 'Milton model embedded commands hypnotic language indirect suggestion self-talk');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Embedded Commands in Personal Narrative: How to Speak to Your Unconscious Mind') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Embedded Commands in Personal Narrative: How to Speak to Your Unconscious Mind',
      'Advanced NLP practitioners, self-coaches',
      'Teach embedded command structure for internal use',
      'The unconscious mind doesn''t process negation — and it responds to command structure regardless of which person the sentence is grammatically directed at',
      'how_to_guide', 'draft', 'Milton model embedded commands hypnotic language indirect suggestion self-talk');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Artfully Vague: When Precision in Self-Talk Blocks Change') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Artfully Vague: When Precision in Self-Talk Blocks Change',
      'Analytical practitioners who over-specify',
      'Show how vagueness enables unconscious processing',
      'Specificity in language activates critical evaluation — vagueness bypasses it and allows deeper neural processes to supply meaning',
      'deep_dive', 'draft', 'Milton model embedded commands hypnotic language indirect suggestion self-talk');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Conversational Postulate and Why ''Can You Close the Door?'' Is More Powerful Than ''Close the Door''') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Conversational Postulate and Why ''Can You Close the Door?'' Is More Powerful Than ''Close the Door''',
      'Linguists, practitioners, communicators',
      'Explain conversational postulates and their self-directed application',
      'Conversational postulates work because they invite choice — internal directives that preserve agency are followed more reliably than commands',
      'long_form_essay', 'draft', 'Milton model embedded commands hypnotic language indirect suggestion self-talk');
  END IF;

  -- ── T10. Perceptual Positions and Perspective Architecture ───────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Perceptual Positions and Perspective Architecture') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Perceptual Positions and Perspective Architecture',
      'How deliberately shifting between first, second, and third position generates new information and resolves interpersonal stuckness.',
      ARRAY['nlp', 'perceptual-positions', 'perspective-taking', 'meta-position', 'empathy'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Perceptual Positions and Perspective Architecture';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Perceptual Position You Never Enter (And Why It''s Costing You in Every Relationship)') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Perceptual Position You Never Enter (And Why It''s Costing You in Every Relationship)',
      'Coaches, leaders, interpersonally-stuck professionals',
      'Surface third-position deficit and its consequences',
      'Most conflict resolution failures happen because one or both parties cannot access second position — they can only hear their own experience',
      'blog_post', 'draft', 'perceptual positions first second third position perspective NLP empathy');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Walking in Their Shoes vs. Merging With Them: The Empathy Paradox in Second Position') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Walking in Their Shoes vs. Merging With Them: The Empathy Paradox in Second Position',
      'Therapists, coaches, empathy researchers',
      'Distinguish healthy second position from merged empathy',
      'Second position requires full dissociation from first position — the practitioner who maintains their own feelings while accessing second position is not in second position',
      'long_form_essay', 'draft', 'perceptual positions first second third position perspective NLP empathy');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Triple Description Protocol: Resolving Conflict Without the Other Person in the Room') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Triple Description Protocol: Resolving Conflict Without the Other Person in the Room',
      'Executive coaches, mediators',
      'Teach triple description as conflict resolution tool',
      'You don''t need the other person present to resolve the pattern — running triple description alone generates 80% of the insight a dialogue would',
      'how_to_guide', 'draft', 'perceptual positions first second third position perspective NLP empathy');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Meta-Position: The Witness State That Changes the System Without Entering It') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Meta-Position: The Witness State That Changes the System Without Entering It',
      'Systems thinkers, organizational coaches',
      'Distinguish meta from third position and its systemic applications',
      'Third position is still part of the system — meta position observes the system from outside it, which is the only view that can see patterns the participants cannot',
      'deep_dive', 'draft', 'perceptual positions first second third position perspective NLP empathy');
  END IF;

  -- ── T11. The Swish Pattern and Behavioral Substitution ───────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'The Swish Pattern and Behavioral Substitution') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'The Swish Pattern and Behavioral Substitution',
      'How the swish pattern uses submodality momentum to interrupt habitual behavioral sequences and install alternative response pathways.',
      ARRAY['nlp', 'swish-pattern', 'behavioral-change', 'habit-disruption', 'future-self'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'The Swish Pattern and Behavioral Substitution';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Swish Pattern: Why Visualization Without Momentum Fails') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Swish Pattern: Why Visualization Without Momentum Fails',
      'Self-development practitioners',
      'Explain why swish works where affirmations don''t',
      'Affirmations tell you where you want to go — the swish pattern moves you there at the speed of submodality momentum',
      'blog_post', 'draft', 'swish pattern behavioral change habit NLP submodality momentum interruption');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Installing the Swish: A Precise Protocol for Behavioral Interruption') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Installing the Swish: A Precise Protocol for Behavioral Interruption',
      'NLP practitioners, habit coaches',
      'Teach correct swish installation',
      'The swish is one of the most misapplied NLP techniques — most failures are timing errors, not content errors',
      'how_to_guide', 'draft', 'swish pattern behavioral change habit NLP submodality momentum interruption');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Why Your Self-Image Determines What Habits Are Even Possible') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Why Your Self-Image Determines What Habits Are Even Possible',
      'Behavior change researchers, coaches',
      'Connect swish target (desired self-image) to behavioral range',
      'The swish target isn''t a goal — it''s a self-image. If the self-image isn''t compelling, no behavior will attach to it',
      'deep_dive', 'draft', 'swish pattern behavioral change habit NLP submodality momentum interruption');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Swish vs. Thought Stop vs. Pattern Interrupt: Choosing the Right Disruption Tool') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Swish vs. Thought Stop vs. Pattern Interrupt: Choosing the Right Disruption Tool',
      'Coaches, therapists',
      'Differentiate behavioral change tools by mechanism and use case',
      'Three interruption tools, three mechanisms — swish for habit loops, thought stop for intrusive thinking, pattern interrupt for relational dynamics',
      'comparison', 'draft', 'swish pattern behavioral change habit NLP submodality momentum interruption');
  END IF;

  -- ── T12. Beliefs and Belief Change Techniques ────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Beliefs and Belief Change Techniques') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (gen_random_uuid(), v_pillar_id,
      'Beliefs and Belief Change Techniques',
      'How limiting beliefs are structured, why some are easier to change than others, and what distinguishes effective belief change work from surface reframing.',
      ARRAY['nlp', 'beliefs', 'limiting-beliefs', 'belief-change', 'neuro-logical-levels'])
    RETURNING id INTO v_topic_id;
  ELSE
    SELECT id INTO v_topic_id FROM content_topics WHERE title = 'Beliefs and Belief Change Techniques';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Belief That Isn''t Yours: How Installed Convictions Masquerade as Personal Truth') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Belief That Isn''t Yours: How Installed Convictions Masquerade as Personal Truth',
      'Anyone in personal development',
      'Surface how beliefs are installed rather than chosen',
      'Most of your strongest beliefs were installed before age seven by people who were running their own installed beliefs',
      'blog_post', 'draft', 'limiting beliefs belief change NLP logical levels conviction identity');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Logical Levels and Why Your Belief Change Work Keeps Failing') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Logical Levels and Why Your Belief Change Work Keeps Failing',
      'Coaches, NLP practitioners',
      'Diagnose belief change failures using logical levels',
      'If you''re changing a belief at identity level but intervening at behavior level, you will always fail — intervention must meet the level where the belief lives',
      'long_form_essay', 'draft', 'limiting beliefs belief change NLP logical levels conviction identity');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'The Museum of Old Beliefs: A Reframing Protocol That Preserves Learning') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'The Museum of Old Beliefs: A Reframing Protocol That Preserves Learning',
      'Coaches, therapists',
      'Teach belief revision that retains positive intent',
      'The goal isn''t to destroy the old belief — it''s to graduate it. The belief served a function; the intervention relocates it to a context where it''s no longer running',
      'how_to_guide', 'draft', 'limiting beliefs belief change NLP logical levels conviction identity');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM content_angles WHERE title = 'Conviction vs. Preference: The Two-Tier Belief Architecture That Explains Personal Identity') THEN
    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES (gen_random_uuid(), v_topic_id,
      'Conviction vs. Preference: The Two-Tier Belief Architecture That Explains Personal Identity',
      'Philosophers, advanced practitioners',
      'Distinguish structural types of belief by strength and function',
      'Preferences can change — convictions cannot, until you change the identity that holds them. This is why most coaching works at the wrong tier',
      'deep_dive', 'draft', 'limiting beliefs belief change NLP logical levels conviction identity');
  END IF;

END $$;
