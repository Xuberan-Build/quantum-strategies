-- Seed: Quantum Mechanics discovery field topics and angles
-- Pillar: Architecture of Reality
-- 5 topics, 20 angles total

DO $$
DECLARE
  v_pillar_id UUID;
  v_topic_1   UUID;
  v_topic_2   UUID;
  v_topic_3   UUID;
  v_topic_4   UUID;
  v_topic_5   UUID;
BEGIN
  SELECT id INTO v_pillar_id FROM content_pillars WHERE name = 'Architecture of Reality';
  IF v_pillar_id IS NULL THEN
    RAISE EXCEPTION 'Pillar "Architecture of Reality" not found — run pillar seed migration first';
  END IF;

  -- ── T1: Measurement, Observer Effects, and the Act of Looking ─────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Measurement, Observer Effects, and the Act of Looking') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Measurement, Observer Effects, and the Act of Looking',
      'What the quantum measurement problem actually says — and doesn''t say — about the role of conscious observers in reality, and what this legitimately implies for first-person experience.',
      ARRAY['quantum', 'measurement-problem', 'observer-effect', 'wavefunction', 'Copenhagen', 'consciousness']
    )
    RETURNING id INTO v_topic_1;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_1,
        'The Measurement Problem Is Not What You Think It Is (And That Makes It More Interesting)',
        'Physics-literate readers who''ve encountered quantum-consciousness hype',
        'Correct popular misunderstandings while preserving genuine philosophical import (Authority/Ego)',
        '"The observer collapses the wave function" doesn''t require a conscious observer — but the measurement problem does raise genuine questions about what constitutes a physical interaction',
        'blog_post', 'draft',
        'quantum measurement problem observer effect consciousness wavefunction collapse Copenhagen'
      ),
      (
        gen_random_uuid(), v_topic_1,
        'Copenhagen, Many-Worlds, and QBism: Three Interpretations and What They Say About Reality',
        'Physicists, philosophers of physics, advanced readers',
        'Survey interpretations rigorously and their implications for observer/reality relationship (Authority)',
        'The three dominant interpretations make identical empirical predictions but radically different ontological commitments — the choice between them is philosophical, not empirical',
        'comparison', 'draft',
        'quantum measurement problem observer effect consciousness wavefunction collapse Copenhagen'
      ),
      (
        gen_random_uuid(), v_topic_1,
        'QBism and the First-Person Perspective in Physics: When the Observer Cannot Be Removed',
        'Philosophers of science, physicists interested in foundations, meditators with physics background',
        'Introduce QBism as a rigorous first-person framework within physics (Ego/Authority)',
        'QBism (Quantum Bayesianism) treats quantum states as beliefs of an agent, not features of the world — this makes the observer formally irreducible in a way that other interpretations try to eliminate',
        'deep_dive', 'draft',
        'quantum measurement problem observer effect consciousness wavefunction collapse Copenhagen'
      ),
      (
        gen_random_uuid(), v_topic_1,
        'The Double Slit Experiment as a Meditation on Attention: A Physicist''s Perspective',
        'Meditators with physics background, practitioners of contemplative science',
        'Draw legitimate analogy between quantum measurement and attentional focusing without pseudoscience (Trust/Authority)',
        'The double slit experiment doesn''t prove meditation works, but it does offer a rigorous analog for how attention affects information structure — and that analog is philosophically productive',
        'long_form_essay', 'draft',
        'quantum measurement problem observer effect consciousness wavefunction collapse Copenhagen'
      );
  ELSE
    SELECT id INTO v_topic_1 FROM content_topics WHERE title = 'Measurement, Observer Effects, and the Act of Looking';
  END IF;

  -- ── T2: Superposition, Potential States, and the Phenomenology of Possibility ─
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Superposition, Potential States, and the Phenomenology of Possibility') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Superposition, Potential States, and the Phenomenology of Possibility',
      'How quantum superposition formalizes the idea of simultaneous potential states, what this means at the quantum level versus the classical level, and what it legitimately illuminates about the experience of holding multiple possibilities before deciding.',
      ARRAY['quantum', 'superposition', 'probability-amplitude', 'potential', 'decoherence', 'decision']
    )
    RETURNING id INTO v_topic_2;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_2,
        'Superposition Is Not Magic: What Actually Happens Before You Measure',
        'Physics-literate readers, engineers',
        'Rigorously explain superposition and correct mysticism (Authority)',
        'Superposition describes a probability distribution over outcomes, not multiple simultaneous realities — understanding this correctly makes it more interesting, not less',
        'blog_post', 'draft',
        'quantum superposition potential states probability amplitude decoherence decision'
      ),
      (
        gen_random_uuid(), v_topic_2,
        'Decoherence and the Classical World: Why You Don''t Experience Superposition',
        'Physicists, philosophically-minded scientists',
        'Explain why quantum effects don''t scale to human experience (Authority/Ego)',
        'The environment continuously measures quantum systems, destroying superposition through decoherence — this is why your decisions don''t feel like wave function collapse, even though individual neurons obey quantum mechanics',
        'deep_dive', 'draft',
        'quantum superposition potential states probability amplitude decoherence decision'
      ),
      (
        gen_random_uuid(), v_topic_2,
        'Potential vs. Actual: The Philosophical Gap That Quantum Mechanics Forces Open',
        'Philosophers, physicists interested in metaphysics',
        'Use quantum potential to reopen classical debates about actuality (Ego/Authority)',
        'In classical physics, only the actual is real. Quantum mechanics forces a reckoning with the ontological status of the potential — and this has implications for how we understand possibility, freedom, and becoming',
        'long_form_essay', 'draft',
        'quantum superposition potential states probability amplitude decoherence decision'
      ),
      (
        gen_random_uuid(), v_topic_2,
        'The Many-Worlds Interpretation and the Self: What It Would Mean If Every Decision Branches',
        'Physics-literate philosophers, decision researchers',
        'Take Many-Worlds seriously as an ethical and phenomenological challenge (Ego)',
        'If MWI is correct, the self that makes a choice is not the same self that experiences the consequence — and the ethical implications of this for how we understand responsibility are underexplored',
        'deep_dive', 'draft',
        'quantum superposition potential states probability amplitude decoherence decision'
      );
  ELSE
    SELECT id INTO v_topic_2 FROM content_topics WHERE title = 'Superposition, Potential States, and the Phenomenology of Possibility';
  END IF;

  -- ── T3: Entanglement, Non-Locality, and Correlation Without Causation ────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Entanglement, Non-Locality, and Correlation Without Causation') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Entanglement, Non-Locality, and Correlation Without Causation',
      'What quantum entanglement actually demonstrates about the structure of reality, what Bell''s theorem proves, and what this legitimately implies about interconnectedness versus the pseudoscientific claims.',
      ARRAY['quantum', 'entanglement', 'Bell-theorem', 'non-locality', 'EPR', 'correlation']
    )
    RETURNING id INTO v_topic_3;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_3,
        'Quantum Entanglement Doesn''t Mean What You''ve Been Told It Means',
        'Science-literate readers who''ve encountered quantum-entanglement hype',
        'Correct popular misconceptions while honoring what entanglement does show (Authority/Trust)',
        'Entanglement produces correlations that cannot be explained by local hidden variables — but it cannot transmit information, and it doesn''t prove mystical interconnectedness',
        'blog_post', 'draft',
        'quantum entanglement Bell theorem non-locality EPR paradox correlation'
      ),
      (
        gen_random_uuid(), v_topic_3,
        'Bell''s Theorem: The Most Important Proof You''ve Never Understood',
        'Technically-minded readers, physicists, philosophers',
        'Explain Bell''s theorem rigorously and its implications for local realism (Authority)',
        'Bell''s theorem proves that if quantum mechanics is correct, either locality or realism (or both) must be false — and experiments have confirmed it. This is genuinely philosophically radical.',
        'deep_dive', 'draft',
        'quantum entanglement Bell theorem non-locality EPR paradox correlation'
      ),
      (
        gen_random_uuid(), v_topic_3,
        'What Non-Locality Actually Tells Us About the Structure of Reality',
        'Philosophers of physics, metaphysicians, advanced practitioners',
        'Draw the legitimate ontological implications of Bell inequality violations (Ego/Authority)',
        'The universe is non-locally correlated at the quantum level — not in a way that allows faster-than-light communication, but in a way that requires rethinking what physical separateness means',
        'long_form_essay', 'draft',
        'quantum entanglement Bell theorem non-locality EPR paradox correlation'
      ),
      (
        gen_random_uuid(), v_topic_3,
        'From Entanglement to Interconnection: Where the Analogy Is Productive and Where It Breaks',
        'Practitioners using quantum metaphors for personal development',
        'Map where quantum-human analogies are legitimate and where they mislead (Trust/Authority)',
        'Quantum entanglement is a rigorous concept. "We are all entangled" is a metaphor. The metaphor can be useful or harmful depending on how carefully the distinction is maintained',
        'how_to_guide', 'draft',
        'quantum entanglement Bell theorem non-locality EPR paradox correlation'
      );
  ELSE
    SELECT id INTO v_topic_3 FROM content_topics WHERE title = 'Entanglement, Non-Locality, and Correlation Without Causation';
  END IF;

  -- ── T4: The Wave Function and Probability Amplitudes ─────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'The Wave Function and Probability Amplitudes') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'The Wave Function and Probability Amplitudes',
      'What the wave function actually is mathematically, what it represents physically, and what the debate over wave function realism reveals about the limits of scientific ontology.',
      ARRAY['quantum', 'wave-function', 'probability-amplitude', 'Born-rule', 'psi-ontic', 'psi-epistemic']
    )
    RETURNING id INTO v_topic_4;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_4,
        'Is the Wave Function Real? The Question That Splits Physicists',
        'Physicists, philosophers of physics',
        'Introduce the psi-ontic vs psi-epistemic debate (Authority/Ego)',
        'Whether the wave function represents something real (psi-ontic) or just our knowledge (psi-epistemic) is undecided by experiment — but the answer would fundamentally change what we mean by "physical reality"',
        'blog_post', 'draft',
        'wave function probability amplitude Born rule realism epistemic ontic interpretation'
      ),
      (
        gen_random_uuid(), v_topic_4,
        'The Born Rule: Why Probability Squared Is the Most Mysterious Formula in Physics',
        'Physics-literate readers',
        'Explain the Born rule and why it is an unexplained postulate (Authority)',
        'The Born rule — that probability is the squared modulus of the amplitude — works perfectly but has no derivation from first principles. It''s the rule that makes quantum mechanics predictive, and nobody knows why it''s true',
        'long_form_essay', 'draft',
        'wave function probability amplitude Born rule realism epistemic ontic interpretation'
      ),
      (
        gen_random_uuid(), v_topic_4,
        'Epistemic vs. Ontic: The Deepest Divide in the Philosophy of Quantum Mechanics',
        'Philosophers of physics, quantum foundations researchers',
        'Map the epistemic/ontic debate and its implications (Ego/Authority)',
        'If the wave function is epistemic (represents knowledge), quantum mechanics is about what agents know. If it''s ontic (represents reality), we need a different story about collapse. This distinction determines everything else.',
        'deep_dive', 'draft',
        'wave function probability amplitude Born rule realism epistemic ontic interpretation'
      ),
      (
        gen_random_uuid(), v_topic_4,
        'Pilot Wave Theory: The Quantum Interpretation That Restores Determinism (And Its Cost)',
        'Physicists, philosophers, readers interested in hidden variable theories',
        'Present Bohmian mechanics as a serious alternative interpretation (Authority)',
        'De Broglie-Bohm pilot wave theory is deterministic, local in the particle, non-local in the wave, and empirically equivalent to standard QM — and most physicists ignore it, which tells us something about what physicists value',
        'comparison', 'draft',
        'wave function probability amplitude Born rule realism epistemic ontic interpretation'
      );
  ELSE
    SELECT id INTO v_topic_4 FROM content_topics WHERE title = 'The Wave Function and Probability Amplitudes';
  END IF;

  -- ── T5: The Quantum Zeno Effect and the Role of Sustained Observation ────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'The Quantum Zeno Effect and the Role of Sustained Observation') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'The Quantum Zeno Effect and the Role of Sustained Observation',
      'How repeated measurement suppresses quantum transitions, what this demonstrates about the relationship between attention and system evolution, and its legitimate analogical implications for intentional practice.',
      ARRAY['quantum', 'quantum-Zeno-effect', 'measurement', 'attention', 'state-transitions', 'sustained-observation']
    )
    RETURNING id INTO v_topic_5;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_5,
        'Watching a Pot That Never Boils: The Quantum Zeno Effect and the Physics of Attention',
        'Physicists, meditators with physics background',
        'Introduce the QZE rigorously and surface its philosophical interest (Ego/Authority)',
        'Frequently observing a quantum system suppresses its evolution — the act of measurement freezes the state. This is real physics with a genuinely strange implication: some things only change when you stop watching',
        'blog_post', 'draft',
        'quantum Zeno effect repeated measurement state transition sustained attention observation'
      ),
      (
        gen_random_uuid(), v_topic_5,
        'From QZE to Zeno Dynamics: When Continuous Measurement Creates Protected Subspaces',
        'Physicists, quantum computing researchers',
        'Explain Zeno dynamics and decoherence protection (Authority)',
        'The quantum Zeno effect has moved from philosophical curiosity to practical tool — in quantum computing, Zeno dynamics can suppress decoherence by confining evolution to a protected subspace',
        'deep_dive', 'draft',
        'quantum Zeno effect repeated measurement state transition sustained attention observation'
      ),
      (
        gen_random_uuid(), v_topic_5,
        'The Anti-Zeno Effect: When Observation Accelerates Instead of Suppresses',
        'Physics-literate readers, researchers',
        'Introduce the Anti-Zeno effect as a counterintuitive complement (Ego/Authority)',
        'At different measurement frequencies, observation suppresses or accelerates quantum transitions — the transition has a resonance frequency, and measurement at that frequency provides maximum amplification',
        'long_form_essay', 'draft',
        'quantum Zeno effect repeated measurement state transition sustained attention observation'
      ),
      (
        gen_random_uuid(), v_topic_5,
        'Sustained Attention and Neural Zeno: Where the Quantum Analogy Holds and Where It Doesn''t',
        'Neuroscientists, meditators, practitioners of contemplative science',
        'Map the legitimate analogy between QZE and attention''s role in neural stabilization (Trust/Authority)',
        'The neural attention system stabilizes representations through repeated sampling — functionally analogous to QZE, but through a completely different mechanism. The analogy is pedagogically useful if you''re clear it''s an analogy',
        'how_to_guide', 'draft',
        'quantum Zeno effect repeated measurement state transition sustained attention observation'
      );
  ELSE
    SELECT id INTO v_topic_5 FROM content_topics WHERE title = 'The Quantum Zeno Effect and the Role of Sustained Observation';
  END IF;

END $$;
