-- Seed Social Engineering / Influence Science content topics and angles
-- Pillar: Strategy as Alignment
-- 10 topics × 4 angles = 40 angles total

DO $$
DECLARE
  v_pillar_id  UUID;
  v_topic_1    UUID;
  v_topic_2    UUID;
  v_topic_3    UUID;
  v_topic_4    UUID;
  v_topic_5    UUID;
  v_topic_6    UUID;
  v_topic_7    UUID;
  v_topic_8    UUID;
  v_topic_9    UUID;
  v_topic_10   UUID;
BEGIN
  SELECT id INTO v_pillar_id FROM content_pillars WHERE title = 'Strategy as Alignment';
  IF v_pillar_id IS NULL THEN
    INSERT INTO content_pillars (title, slug, description, tradition_affinity)
    VALUES ('Strategy as Alignment', 'strategy-as-alignment',
      'Coherent systems outperform hustle every time. Quantum Business Framework, Three Rites diagnostics, offer design, funnel architecture, PLG strategy, positioning.',
      ARRAY['rosicrucianism', 'kabbalah', 'taoism'])
    RETURNING id INTO v_pillar_id;
  END IF;

  -- ── T1: Pre-Suasion and Attentional Priming ───────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Pre-Suasion and Attentional Priming') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Pre-Suasion and Attentional Priming',
      'How the moment before the message determines how the message is received, and what attentional channeling reveals about the architecture of persuasion.',
      ARRAY['influence', 'pre-suasion', 'priming', 'attention', 'Cialdini', 'persuasion']
    ) RETURNING id INTO v_topic_1;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_1,
       'The Moment Before the Message: Why Context Determines Everything in Persuasion',
       'Sales professionals, marketers, communicators',
       'Introduce pre-suasion as the master frame for influence (Authority)',
       'What you say matters less than what the listener is attending to when you say it — the privileged moment controls interpretation',
       'blog_post', 'draft',
       'pre-suasion attentional priming Cialdini privileged moment persuasion'),
      (gen_random_uuid(), v_topic_1,
       'Attentional Channeling: The Science of Making One Idea Feel Most Important',
       'Marketers, negotiators, content strategists',
       'Teach attentional channeling as a practical tool (Authority)',
       'What is focal appears causal — the persuader who controls what the listener is attending to controls what conclusion they reach',
       'long_form_essay', 'draft',
       'pre-suasion attentional priming Cialdini privileged moment persuasion'),
      (gen_random_uuid(), v_topic_1,
       'Environmental Pre-Suasion: What the Room Is Telling Your Client Before You Speak',
       'Consultants, coaches, practitioners who control their environment',
       'Apply pre-suasion to environmental design (Ego)',
       'The artwork on your wall, the scent in your office, the weight of your business card — each primes a different evaluation framework',
       'deep_dive', 'draft',
       'pre-suasion attentional priming Cialdini privileged moment persuasion'),
      (gen_random_uuid(), v_topic_1,
       'Pre-Suasion in Writing: The Opening That Sets the Frame for Everything That Follows',
       'Writers, content marketers, thought leaders',
       'Apply pre-suasion principles to written communication (Authority)',
       'The first sentence of any document is not an introduction — it''s an attentional directive that determines which mental frame the reader applies to everything that follows',
       'how_to_guide', 'draft',
       'pre-suasion attentional priming Cialdini privileged moment persuasion');
  ELSE
    SELECT id INTO v_topic_1 FROM content_topics WHERE title = 'Pre-Suasion and Attentional Priming';
  END IF;

  -- ── T2: Social Proof and Conformity Dynamics ──────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Social Proof and Conformity Dynamics') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Social Proof and Conformity Dynamics',
      'How people use others'' behavior as information, when social proof is most powerful, and how to ethically work with conformity dynamics in positioning and persuasion.',
      ARRAY['influence', 'social-proof', 'conformity', 'normative-influence', 'informational-influence']
    ) RETURNING id INTO v_topic_2;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_2,
       'Why Social Proof Works Harder on Smart People Than on Everyone Else',
       'Knowledge workers, intellectuals, high-performers',
       'Show how intelligence increases susceptibility to social proof in specific domains (Ego/Fear)',
       'Informational social proof — using others as evidence of correct behavior — is most powerful when the stakes are high and expertise is absent. Intelligent people encounter this combination constantly.',
       'blog_post', 'draft',
       'social proof conformity normative influence informational influence behavior'),
      (gen_random_uuid(), v_topic_2,
       'The Pluralistic Ignorance Problem: When Everyone Is Wrong and Nobody Knows It',
       'Organizational leaders, culture researchers, coaches',
       'Apply pluralistic ignorance to organizational culture change (Fear/Trust)',
       'Most toxic organizational cultures are maintained by pluralistic ignorance — everyone privately disagrees with the norm, but publicly conforms because they think everyone else agrees',
       'long_form_essay', 'draft',
       'social proof conformity normative influence informational influence behavior'),
      (gen_random_uuid(), v_topic_2,
       'Specificity in Social Proof: Why ''9 out of 10 dentists'' Is Weaker Than You Think',
       'Marketers, copywriters, product managers',
       'Teach high-specificity social proof construction (Authority)',
       'The more specific the social proof — same industry, same role, same challenge, same size — the stronger the informational signal and the more powerful the normative effect',
       'how_to_guide', 'draft',
       'social proof conformity normative influence informational influence behavior'),
      (gen_random_uuid(), v_topic_2,
       'Descriptive vs. Injunctive Norms: The Type of Social Proof That Changes Behavior vs. Attitudes',
       'Behavioral designers, policy makers, researchers',
       'Distinguish norm types and their behavioral effects (Authority/Ego)',
       'Descriptive norms (what people do) and injunctive norms (what people approve of) activate different mechanisms — most social proof mistakes come from using the wrong type for the desired outcome',
       'deep_dive', 'draft',
       'social proof conformity normative influence informational influence behavior');
  ELSE
    SELECT id INTO v_topic_2 FROM content_topics WHERE title = 'Social Proof and Conformity Dynamics';
  END IF;

  -- ── T3: Authority Signals and Credibility Architecture ───────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Authority Signals and Credibility Architecture') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Authority Signals and Credibility Architecture',
      'How authority is signaled, detected, and processed, and how to construct credibility without compromising authenticity.',
      ARRAY['influence', 'authority', 'credibility', 'expertise', 'trust-signals', 'perceived-authority']
    ) RETURNING id INTO v_topic_3;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_3,
       'The Credibility Gap: Why Experts Are Trusted Last in the Fields They Know Best',
       'Experts, practitioners, academics crossing into public communication',
       'Surface the paradox where deep expertise reduces perceived credibility in public contexts (Ego/Fear)',
       'The signals that indicate expertise within a field (precision, qualification, acknowledgment of uncertainty) are exactly the signals that reduce perceived authority for general audiences',
       'blog_post', 'draft',
       'authority signals credibility expertise trust persuasion heuristics'),
      (gen_random_uuid(), v_topic_3,
       'Building Credibility Architecture: The 7 Signals That Create Perceived Authority',
       'Consultants, coaches, thought leaders',
       'Teach systematic credibility construction (Authority)',
       'Credibility isn''t a single trait — it''s a stack of signals that must be present simultaneously: title, track record, association, similarity, certainty, specificity, and delivery',
       'long_form_essay', 'draft',
       'authority signals credibility expertise trust persuasion heuristics'),
      (gen_random_uuid(), v_topic_3,
       'Authority Heuristics and When to Violate Them: The Strategic Countermove',
       'Negotiators, strategists, advanced communicators',
       'Show when violating authority conventions increases credibility (Ego)',
       'Confident disagreement with authority in the listener''s domain of expertise — when you''re clearly right — produces a stronger credibility signal than agreement',
       'deep_dive', 'draft',
       'authority signals credibility expertise trust persuasion heuristics'),
      (gen_random_uuid(), v_topic_3,
       'The Titles Trap: When Credentials Signal Incompetence Instead of Expertise',
       'Professionals navigating credential culture',
       'Identify when leading with credentials backfires (Trust/Fear)',
       'In high-sophistication contexts, leading with institutional credentials signals you don''t have better signals — and that becomes a credibility penalty',
       'how_to_guide', 'draft',
       'authority signals credibility expertise trust persuasion heuristics');
  ELSE
    SELECT id INTO v_topic_3 FROM content_topics WHERE title = 'Authority Signals and Credibility Architecture';
  END IF;

  -- ── T4: Reciprocity and Obligation Dynamics ───────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Reciprocity and Obligation Dynamics') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Reciprocity and Obligation Dynamics',
      'How giving creates obligation, how reciprocity norms operate across cultures, and how to work with reciprocity ethically and strategically.',
      ARRAY['influence', 'reciprocity', 'obligation', 'gift-giving', 'social-exchange']
    ) RETURNING id INTO v_topic_4;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_4,
       'Why Giving First Always Wins: The Evolutionary Logic of Reciprocity',
       'Sales professionals, marketers, relationship strategists',
       'Build foundational understanding of reciprocity as a universal mechanism (Authority)',
       'Reciprocity isn''t a cultural preference — it''s a cross-species, cross-cultural mechanism that evolved because societies where it was absent collapsed',
       'blog_post', 'draft',
       'reciprocity obligation gift giving social exchange norm compliance'),
      (gen_random_uuid(), v_topic_4,
       'The Uninvited Gift: Why Receiving Something You Didn''t Ask For Creates the Strongest Obligation',
       'Negotiators, sales strategists, influence practitioners',
       'Explain why unsolicited gifts trigger stronger reciprocity than requested favors (Ego)',
       'When you ask for help, you''ve invited the helper to evaluate whether to comply — but an unsolicited gift bypasses evaluation and installs obligation directly',
       'long_form_essay', 'draft',
       'reciprocity obligation gift giving social exchange norm compliance'),
      (gen_random_uuid(), v_topic_4,
       'Reciprocity in Negotiation: The Concession Sequence That Moves the Deal',
       'Negotiators, deal-makers, business developers',
       'Apply reciprocity to concession strategy in negotiation (Authority)',
       'The most effective concession sequence is: large first offer, substantial concession, smaller concession, minimal final concession — each step signals reciprocal movement while anchoring the range',
       'how_to_guide', 'draft',
       'reciprocity obligation gift giving social exchange norm compliance'),
      (gen_random_uuid(), v_topic_4,
       'Debt Aversion and Reciprocity Avoidance: When People Refuse Gifts to Preserve Autonomy',
       'Organizational leaders, researchers, gift economy thinkers',
       'Understand reciprocity''s limits and failure modes (Trust)',
       'Some people refuse gifts not because they distrust the giver but because they distrust themselves to repay — they''re managing obligation anxiety, not rejecting generosity',
       'deep_dive', 'draft',
       'reciprocity obligation gift giving social exchange norm compliance');
  ELSE
    SELECT id INTO v_topic_4 FROM content_topics WHERE title = 'Reciprocity and Obligation Dynamics';
  END IF;

  -- ── T5: Commitment, Consistency, and Identity Lock-In ────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Commitment, Consistency, and Identity Lock-In') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Commitment, Consistency, and Identity Lock-In',
      'How small commitments escalate into large behavioral patterns, why identity-level commitment is the strongest, and how consistency pressure shapes long-term behavior.',
      ARRAY['influence', 'commitment', 'consistency', 'foot-in-the-door', 'identity', 'cognitive-dissonance']
    ) RETURNING id INTO v_topic_5;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_5,
       'The Foot in the Door You Already Stepped Through: Commitments That Are Running Your Life',
       'Self-development practitioners, behavior change coaches',
       'Surface how past commitments constrain present behavior (Fear)',
       'Every identity label you''ve accepted is a commitment that now generates consistency pressure — the larger the commitment, the stronger the pull toward behavior that matches it',
       'blog_post', 'draft',
       'commitment consistency foot in the door identity lock-in cognitive dissonance Cialdini'),
      (gen_random_uuid(), v_topic_5,
       'Identity Commitment vs. Behavioral Commitment: Why ''I Am'' Outperforms ''I Will''',
       'Behavior change researchers, coaches, product designers',
       'Show how identity-framed commitments produce more durable behavior change (Authority)',
       '"I will exercise three times a week" generates compliance pressure; "I am someone who exercises" generates identity consistency — and identity wins over time',
       'long_form_essay', 'draft',
       'commitment consistency foot in the door identity lock-in cognitive dissonance Cialdini'),
      (gen_random_uuid(), v_topic_5,
       'Escalating Commitment in Organizations: When Sunken Costs Become the Strategy',
       'Executives, organizational leaders, project managers',
       'Apply escalating commitment research to organizational decision-making (Fear/Authority)',
       'The largest strategic failures in organizations are usually escalating commitment failures — the point where the honest signal says "stop" is exactly when consistency pressure is strongest',
       'deep_dive', 'draft',
       'commitment consistency foot in the door identity lock-in cognitive dissonance Cialdini'),
      (gen_random_uuid(), v_topic_5,
       'The Tiny Commitment Protocol: Building Agreement Sequences That Close Without Pressure',
       'Sales professionals, coaches, negotiators',
       'Teach micro-commitment sequencing (Authority)',
       'Each small yes increases the psychological cost of saying no later — the key is identifying which commitments in which sequence produce the highest conversion without triggering reactance',
       'how_to_guide', 'draft',
       'commitment consistency foot in the door identity lock-in cognitive dissonance Cialdini');
  ELSE
    SELECT id INTO v_topic_5 FROM content_topics WHERE title = 'Commitment, Consistency, and Identity Lock-In';
  END IF;

  -- ── T6: Scarcity Framing and Decision Architecture ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Scarcity Framing and Decision Architecture') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Scarcity Framing and Decision Architecture',
      'How scarcity — of time, quantity, access, or information — creates urgency and value perception, and when scarcity framing backfires into reactance.',
      ARRAY['influence', 'scarcity', 'urgency', 'reactance', 'decision-architecture', 'loss-aversion']
    ) RETURNING id INTO v_topic_6;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_6,
       'Scarcity vs. Urgency: Two Mechanisms, Two Mistakes, Two Fixes',
       'Marketers, product managers, copywriters',
       'Distinguish scarcity from urgency and their distinct failure modes (Authority)',
       'Scarcity signals value through limited supply; urgency signals cost through limited time — conflating them produces copy that does neither effectively',
       'blog_post', 'draft',
       'scarcity framing urgency loss aversion reactance decision architecture'),
      (gen_random_uuid(), v_topic_6,
       'Why Scarcity Makes Bad Options Feel Like Good Choices',
       'Decision researchers, behavioral economists, consumer advocates',
       'Show how scarcity distorts option evaluation (Fear)',
       'Under scarcity, the brain narrows attention to the immediate opportunity and reduces comparative evaluation — this is why people overpay and underperform when choosing under pressure',
       'long_form_essay', 'draft',
       'scarcity framing urgency loss aversion reactance decision architecture'),
      (gen_random_uuid(), v_topic_6,
       'Reactance and the Boomerang Effect: When Scarcity Makes People Want It Less',
       'Marketers, influence practitioners, researchers',
       'Map when scarcity backfires and triggers psychological reactance (Fear)',
       'If the scarcity feels manufactured, manipulative, or autonomy-threatening, it triggers reactance — and the person becomes less likely to want the thing precisely because they feel pressured to want it',
       'deep_dive', 'draft',
       'scarcity framing urgency loss aversion reactance decision architecture'),
      (gen_random_uuid(), v_topic_6,
       'Ethical Scarcity: How to Create Genuine Urgency Without Manufacturing Fake Pressure',
       'Ethical marketers, coaches, consultants',
       'Teach integrity-compatible scarcity framing (Trust/Authority)',
       'Real scarcity framing surfaces genuine costs of inaction — it doesn''t create artificial pressure, it removes artificial reassurance that delay has no cost',
       'how_to_guide', 'draft',
       'scarcity framing urgency loss aversion reactance decision architecture');
  ELSE
    SELECT id INTO v_topic_6 FROM content_topics WHERE title = 'Scarcity Framing and Decision Architecture';
  END IF;

  -- ── T7: Frame Control and Reality Negotiation ─────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Frame Control and Reality Negotiation') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Frame Control and Reality Negotiation',
      'How frames define what information means before evaluation begins, how frame conflicts are resolved, and how to establish and defend frames in high-stakes interactions.',
      ARRAY['influence', 'framing', 'frame-control', 'priming', 'reality-negotiation', 'context']
    ) RETURNING id INTO v_topic_7;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_7,
       'The Frame You Didn''t Set Is the Frame Someone Else Set for You',
       'Leaders, communicators, strategists',
       'Surface how passive frame acceptance limits agency (Ego/Fear)',
       'Every interaction arrives with a pre-existing frame — if you don''t establish yours first, you''ll be responding within someone else''s definition of what''s possible',
       'blog_post', 'draft',
       'frame control framing effects context reality negotiation meaning-making'),
      (gen_random_uuid(), v_topic_7,
       'Frame Stacking: How Multiple Frames Interact to Create Inescapable Contexts',
       'Advanced communicators, negotiators, practitioners',
       'Teach how to layer frames for compounding effect (Authority/Ego)',
       'A single frame can be challenged; a stack of congruent frames creates a context that interpretation must explain — you''re no longer fighting for a single meaning, you''re designing the field',
       'long_form_essay', 'draft',
       'frame control framing effects context reality negotiation meaning-making'),
      (gen_random_uuid(), v_topic_7,
       'Breaking the Adversarial Frame: The Move That Converts a Negotiation into Collaboration',
       'Negotiators, mediators, conflict resolution practitioners',
       'Teach frame disruption for converting competitive to collaborative context (Trust)',
       'The adversarial frame assumes fixed resources and competing interests — breaking it requires redefining the outcome space, not the bargaining position',
       'how_to_guide', 'draft',
       'frame control framing effects context reality negotiation meaning-making'),
      (gen_random_uuid(), v_topic_7,
       'Reframing vs. Frame-Breaking: When to Expand the Frame and When to Escape It',
       'Coaches, therapists, strategic communicators',
       'Distinguish reframe from frame break and when each is appropriate (Authority)',
       'Reframing works within the existing frame''s logic; frame-breaking exits that logic entirely. Using reframe when frame-breaking is needed produces increasingly sophisticated arguments inside a prison',
       'deep_dive', 'draft',
       'frame control framing effects context reality negotiation meaning-making');
  ELSE
    SELECT id INTO v_topic_7 FROM content_topics WHERE title = 'Frame Control and Reality Negotiation';
  END IF;

  -- ── T8: BATNA and Negotiation Leverage Architecture ───────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'BATNA and Negotiation Leverage Architecture') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'BATNA and Negotiation Leverage Architecture',
      'How alternatives determine power in negotiation, how to develop BATNA before entering negotiation, and how leverage shifts throughout a negotiation sequence.',
      ARRAY['negotiation', 'BATNA', 'leverage', 'power', 'alternatives', 'deal-making']
    ) RETURNING id INTO v_topic_8;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_8,
       'The Only Thing That Determines Your Power in Negotiation (It''s Not Preparation)',
       'Business professionals, negotiators, leaders',
       'Establish BATNA as the primary source of negotiation power (Authority)',
       'Preparation, rapport, and technique are multipliers — but if your BATNA is weak, you are negotiating from a position of structural disadvantage that skill cannot overcome',
       'blog_post', 'draft',
       'BATNA best alternative negotiation agreement leverage power alternatives'),
      (gen_random_uuid(), v_topic_8,
       'Building BATNA Before You Need It: The Long Game That Changes Every Conversation',
       'Entrepreneurs, executives, business developers',
       'Teach proactive BATNA development as a strategic practice (Ego)',
       'Most people think about alternatives after negotiations fail — the practitioners who consistently extract maximum value began building alternatives before the negotiation started',
       'long_form_essay', 'draft',
       'BATNA best alternative negotiation agreement leverage power alternatives'),
      (gen_random_uuid(), v_topic_8,
       'Revealing vs. Concealing Your BATNA: The Information Game That Determines Outcomes',
       'Advanced negotiators, deal-makers',
       'Teach strategic information management around BATNA (Authority/Ego)',
       'Revealing a strong BATNA calibrates the other party''s expectations; concealing it creates information asymmetry. The right choice depends on whether you need to shift their expectations or maintain uncertainty',
       'deep_dive', 'draft',
       'BATNA best alternative negotiation agreement leverage power alternatives'),
      (gen_random_uuid(), v_topic_8,
       'The ZOPA and BATNA Interaction: Finding the Settlement Zone Before Negotiating',
       'Negotiators, deal-makers, researchers',
       'Teach how to estimate ZOPA using BATNA analysis (Authority)',
       'Before entering negotiation, map both parties'' BATNAs to estimate the zone of possible agreement — then determine whether the deal is worth making before making it',
       'how_to_guide', 'draft',
       'BATNA best alternative negotiation agreement leverage power alternatives');
  ELSE
    SELECT id INTO v_topic_8 FROM content_topics WHERE title = 'BATNA and Negotiation Leverage Architecture';
  END IF;

  -- ── T9: Rapport, Pacing, and the Trust Gradient ───────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Rapport, Pacing, and the Trust Gradient') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Rapport, Pacing, and the Trust Gradient',
      'How rapport is built, measured, and maintained, and how pacing and leading operate as the underlying mechanism of interpersonal influence.',
      ARRAY['influence', 'rapport', 'pacing', 'leading', 'trust', 'mirroring', 'calibration']
    ) RETURNING id INTO v_topic_9;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_9,
       'Rapport Is Not Liking — It''s Synchronized Nervous System States',
       'Coaches, sales professionals, therapists',
       'Reframe rapport from social preference to neurological synchrony (Authority)',
       'You don''t build rapport by being likeable — you build it by matching the other person''s physiological and linguistic patterns until your nervous systems are running in sync',
       'blog_post', 'draft',
       'rapport building pacing leading trust calibration interpersonal influence'),
      (gen_random_uuid(), v_topic_9,
       'Pacing Before Leading: Why Influence Without Agreement First Always Fails',
       'Sales professionals, coaches, communicators',
       'Teach the pace-then-lead sequence (Authority)',
       'Leading without pacing is pushing — and pushing produces resistance. You must first establish that you fully understand the other person''s current reality before inviting movement',
       'long_form_essay', 'draft',
       'rapport building pacing leading trust calibration interpersonal influence'),
      (gen_random_uuid(), v_topic_9,
       'Trust Gradients and Rapport Velocity: How Fast Can You Build It Without Breaking It?',
       'Practitioners, coaches, business developers',
       'Map the pace of trust building and its limits (Trust)',
       'Trust has a maximum velocity — build it too fast and it triggers detection of manipulation. The art is maximum pace within the authenticity threshold',
       'deep_dive', 'draft',
       'rapport building pacing leading trust calibration interpersonal influence'),
      (gen_random_uuid(), v_topic_9,
       'Calibration: Reading the Signals That Tell You Rapport Has Shifted',
       'Coaches, negotiators, advanced practitioners',
       'Teach real-time calibration for rapport maintenance (Authority)',
       'Rapport isn''t established once — it fluctuates throughout an interaction. The practitioner who reads the signals that rapport is degrading can intervene before trust collapses',
       'how_to_guide', 'draft',
       'rapport building pacing leading trust calibration interpersonal influence');
  ELSE
    SELECT id INTO v_topic_9 FROM content_topics WHERE title = 'Rapport, Pacing, and the Trust Gradient';
  END IF;

  -- ── T10: Network Effects and Influence Propagation ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Network Effects and Influence Propagation') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Network Effects and Influence Propagation',
      'How ideas, behaviors, and influence spread through social networks, what structural position determines influence, and how to strategically position within networks for maximum propagation.',
      ARRAY['influence', 'network-effects', 'social-networks', 'contagion', 'propagation', 'centrality']
    ) RETURNING id INTO v_topic_10;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
      (gen_random_uuid(), v_topic_10,
       'Why Your Ideas Spread From Who You Know, Not From How Good They Are',
       'Thought leaders, entrepreneurs, change agents',
       'Establish network position as primary driver of idea diffusion (Authority/Ego)',
       'Superior ideas with weak network position lose to inferior ideas with strong network position, consistently and predictably — this is the mathematical reality of social contagion',
       'blog_post', 'draft',
       'network effects influence propagation social contagion centrality diffusion'),
      (gen_random_uuid(), v_topic_10,
       'The Strength of Weak Ties: Why Acquaintances Spread Your Ideas Better Than Friends',
       'Networkers, strategists, entrepreneurs',
       'Apply Granovetter''s weak ties research to strategic networking (Authority)',
       'Strong ties cluster around shared information; weak ties bridge to novel information networks. For diffusion, weak ties are structurally superior to strong ones',
       'long_form_essay', 'draft',
       'network effects influence propagation social contagion centrality diffusion'),
      (gen_random_uuid(), v_topic_10,
       'Structural Holes and Brokerage: The Network Position That Maximizes Information Advantage',
       'Strategists, consultants, executives',
       'Teach Burt''s structural holes theory and its strategic implications (Ego/Authority)',
       'The broker who connects two otherwise unconnected clusters controls the information flowing between them — and this structural position translates directly into influence, opportunity, and leverage',
       'deep_dive', 'draft',
       'network effects influence propagation social contagion centrality diffusion'),
      (gen_random_uuid(), v_topic_10,
       'Seeding Influence: How to Map and Target the Nodes That Propagate to the Network',
       'Marketers, community builders, strategists',
       'Teach network-informed influence seeding strategy (Authority)',
       'You don''t need to reach everyone — you need to reach the structural bridges. Map the network, identify brokers, seed there, and let the contagion run',
       'how_to_guide', 'draft',
       'network effects influence propagation social contagion centrality diffusion');
  ELSE
    SELECT id INTO v_topic_10 FROM content_topics WHERE title = 'Network Effects and Influence Propagation';
  END IF;

END $$;
