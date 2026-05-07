-- Seed Cross-Field Synthesis content topics and angles (Builder's Stack pillar)
-- 5 topics × 4 angles = 20 angles total
-- Idempotent: uses NOT EXISTS guards, no UNIQUE constraint on title

DO $$
DECLARE
  v_pillar_id UUID;
  v_topic_1   UUID;
  v_topic_2   UUID;
  v_topic_3   UUID;
  v_topic_4   UUID;
  v_topic_5   UUID;
BEGIN
  SELECT id INTO v_pillar_id FROM content_pillars WHERE name = 'Builder''s Stack';
  IF v_pillar_id IS NULL THEN
    RAISE EXCEPTION 'Pillar "Builder''s Stack" not found — run pillar seed migration first';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- T1. Information Theory and Knowledge Architecture
  -- ──────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Information Theory and Knowledge Architecture') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(),
      v_pillar_id,
      'Information Theory and Knowledge Architecture',
      'How Shannon''s information theory provides a rigorous framework for thinking about signal, noise, uncertainty, and communication — and what this framework illuminates about how minds process and transmit meaning.',
      ARRAY['information-theory', 'Shannon', 'entropy', 'signal-noise', 'knowledge-architecture', 'communication']
    )
    RETURNING id INTO v_topic_1;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_1,
        'Shannon''s Entropy Is Not Complexity: The Most Misused Concept in Popular Science',
        'Systems thinkers, technically-literate readers who''ve encountered information theory',
        'Correct popular misuse of Shannon entropy (Authority/Ego)',
        'Shannon entropy measures uncertainty, not complexity or meaning — misapplying it to consciousness, markets, and creativity produces impressive-sounding nonsense',
        'blog_post', 'draft',
        'information theory Shannon entropy signal noise communication knowledge uncertainty'
      ),
      (
        gen_random_uuid(), v_topic_1,
        'The Channel Capacity of Human Attention: What Information Theory Tells Us About Cognitive Limits',
        'Cognitive scientists, knowledge workers, behavioral designers',
        'Apply channel capacity concept to human information processing (Authority)',
        'The human cognitive system has measurable channel capacity — and most information environments are designed to saturate it, which is why attention feels scarce',
        'long_form_essay', 'draft',
        'information theory Shannon entropy signal noise communication knowledge uncertainty'
      ),
      (
        gen_random_uuid(), v_topic_1,
        'Compression and Intelligence: Why the Most Intelligent Systems Are the Most Compressed',
        'AI researchers, intelligence researchers, systems thinkers',
        'Connect data compression to intelligence and expertise (Ego/Authority)',
        'Intelligence is compression — the ability to represent complex environments in compact internal models that preserve predictive validity. Expert knowledge is a compressed model of a domain',
        'deep_dive', 'draft',
        'information theory Shannon entropy signal noise communication knowledge uncertainty'
      ),
      (
        gen_random_uuid(), v_topic_1,
        'Signal Architecture for Thought Leaders: Using Information Theory to Design High-Fidelity Communication',
        'Writers, thought leaders, content strategists',
        'Apply information theory principles to content design (Authority)',
        'Content that maximizes mutual information — the overlap between what you transmit and what the receiver understands — requires identifying what your audience''s prior knowledge already covers and transmitting only the residual',
        'how_to_guide', 'draft',
        'information theory Shannon entropy signal noise communication knowledge uncertainty'
      );
  ELSE
    SELECT id INTO v_topic_1 FROM content_topics WHERE title = 'Information Theory and Knowledge Architecture';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- T2. Systems Thinking and the Architecture of Emergence
  -- ──────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Systems Thinking and the Architecture of Emergence') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(),
      v_pillar_id,
      'Systems Thinking and the Architecture of Emergence',
      'How systems thinking reveals properties that cannot be reduced to individual components, how feedback loops create complex behavior from simple rules, and what emergence means for identity and change.',
      ARRAY['systems-thinking', 'emergence', 'feedback-loops', 'complexity', 'Donella-Meadows', 'nonlinear-dynamics']
    )
    RETURNING id INTO v_topic_2;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_2,
        'You Are Not Your Components: The Emergence Problem in Personal Identity',
        'Philosophers, self-development practitioners, complexity scientists',
        'Apply emergence to the question of personal identity (Ego)',
        'Your identity isn''t in any neuron, any memory, any belief — it''s an emergent property of the system they form together. This changes what changing yourself means',
        'blog_post', 'draft',
        'systems thinking emergence feedback loops complex systems Donella Meadows nonlinear dynamics'
      ),
      (
        gen_random_uuid(), v_topic_2,
        'Leverage Points in Systems: Where Small Interventions Produce Large Change',
        'Organizational strategists, systems designers, coaches',
        'Teach Meadows'' leverage points framework for intervention design (Authority)',
        'Donella Meadows identified nine types of leverage points in a system, ordered by their power to produce change — most interventions target the weakest points and wonder why nothing changes',
        'long_form_essay', 'draft',
        'systems thinking emergence feedback loops complex systems Donella Meadows nonlinear dynamics'
      ),
      (
        gen_random_uuid(), v_topic_2,
        'Feedback Loops and Identity Stability: Why Some People Change Easily and Others Don''t',
        'Coaches, behavior change researchers',
        'Apply feedback loop analysis to identity stability and change resistance (Trust/Fear)',
        'Stable identities are maintained by reinforcing feedback loops — behaviors that generate evidence confirming the identity. Change requires either disrupting the loop or installing a competing one',
        'deep_dive', 'draft',
        'systems thinking emergence feedback loops complex systems Donella Meadows nonlinear dynamics'
      ),
      (
        gen_random_uuid(), v_topic_2,
        'Causal Loop Diagrams for Personal Systems: Mapping the Feedback Architecture of Your Behavior',
        'Coaches, strategists, self-aware practitioners',
        'Teach causal loop diagramming as a personal practice tool (Authority)',
        'Drawing a causal loop diagram of your own behavioral patterns reveals the feedback structures that make change harder than it should be — and identifies the actual intervention points',
        'how_to_guide', 'draft',
        'systems thinking emergence feedback loops complex systems Donella Meadows nonlinear dynamics'
      );
  ELSE
    SELECT id INTO v_topic_2 FROM content_topics WHERE title = 'Systems Thinking and the Architecture of Emergence';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- T3. Game Theory, Strategic Identity, and the Payoff Matrix of Self-Concept
  -- ──────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Game Theory, Strategic Identity, and the Payoff Matrix of Self-Concept') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(),
      v_pillar_id,
      'Game Theory, Strategic Identity, and the Payoff Matrix of Self-Concept',
      'How game theory illuminates the strategic structure of identity formation, reputation signaling, and cooperation — and what this reveals about the rational architecture of personality.',
      ARRAY['game-theory', 'strategic-identity', 'Nash-equilibrium', 'signaling', 'cooperation', 'reputation']
    )
    RETURNING id INTO v_topic_3;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_3,
        'Your Personality Is a Strategy: The Game Theory of Why You Are Who You Are',
        'Economists, strategists, philosophy-adjacent practitioners',
        'Reframe personality traits as strategic equilibria (Ego/Authority)',
        'Many stable personality traits are Nash equilibria — strategies that, given what others expect, no individual has incentive to deviate from. Your identity is partly a self-fulfilling strategic commitment',
        'blog_post', 'draft',
        'game theory strategic identity signaling Nash equilibrium cooperation reputation'
      ),
      (
        gen_random_uuid(), v_topic_3,
        'Costly Signaling Theory: Why Authenticity Is Often Strategic (And Why That''s Not Hypocrisy)',
        'Strategists, brand builders, researchers',
        'Apply costly signaling to authentic self-presentation (Authority/Ego)',
        'Costly signals are credible precisely because they''re expensive — and many "authentic" self-disclosures function as costly signals, which is why they work even when the audience suspects strategic intent',
        'long_form_essay', 'draft',
        'game theory strategic identity signaling Nash equilibrium cooperation reputation'
      ),
      (
        gen_random_uuid(), v_topic_3,
        'Iterated Games and Reputation Capital: Why Long-Term Play Requires Different Logic Than Single-Shot Games',
        'Business strategists, negotiators, anyone thinking about reputation',
        'Teach the strategic shift from single-shot to iterated game logic (Authority)',
        'In a single-shot game, defection can be optimal. In an iterated game with the same players, cooperation and reputation dominate — and most people underestimate how iterated their real-world interactions actually are',
        'deep_dive', 'draft',
        'game theory strategic identity signaling Nash equilibrium cooperation reputation'
      ),
      (
        gen_random_uuid(), v_topic_3,
        'Schelling Points and Coordination Without Communication: How Shared Identity Creates Implicit Agreements',
        'Organizational leaders, culture builders, game theory researchers',
        'Apply Schelling point logic to identity and cultural coordination (Ego/Authority)',
        'A Schelling point is what people coordinate on in the absence of communication — and many identity categories function as Schelling points, creating coordination benefits that explain their cultural persistence',
        'how_to_guide', 'draft',
        'game theory strategic identity signaling Nash equilibrium cooperation reputation'
      );
  ELSE
    SELECT id INTO v_topic_3 FROM content_topics WHERE title = 'Game Theory, Strategic Identity, and the Payoff Matrix of Self-Concept';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- T4. Cybernetics and Self-Regulating Systems
  -- ──────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Cybernetics and Self-Regulating Systems') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(),
      v_pillar_id,
      'Cybernetics and Self-Regulating Systems',
      'How Norbert Wiener''s cybernetics and subsequent second-order cybernetics model the feedback mechanisms underlying goal-directed behavior, and what the observer-inclusion problem means for self-knowledge.',
      ARRAY['cybernetics', 'feedback', 'self-regulation', 'Norbert-Wiener', 'second-order-cybernetics', 'autopoiesis']
    )
    RETURNING id INTO v_topic_4;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_4,
        'Cybernetics Is Not Robots: The Original Science of Self-Regulating Systems and What It Still Explains',
        'Systems thinkers, historically-minded readers',
        'Rehabilitate cybernetics as a rigorous framework for self-regulation (Authority)',
        'Norbert Wiener''s cybernetics was about information-based self-correction in any system — biological, mechanical, or social. It was absorbed by its descendants (AI, systems biology) but its core insights are still underutilized',
        'blog_post', 'draft',
        'cybernetics feedback self-regulation Wiener second-order autopoiesis observer'
      ),
      (
        gen_random_uuid(), v_topic_4,
        'Second-Order Cybernetics: When the Observer Is Part of the System Being Observed',
        'Therapists, organizational consultants, researchers in complex systems',
        'Introduce second-order cybernetics and its implications for practice (Ego/Authority)',
        'First-order cybernetics describes systems from outside. Second-order cybernetics acknowledges that the observer is always inside the system — which changes every claim the observer can make about it',
        'long_form_essay', 'draft',
        'cybernetics feedback self-regulation Wiener second-order autopoiesis observer'
      ),
      (
        gen_random_uuid(), v_topic_4,
        'Autopoiesis and the Self-Producing System: Maturana and Varela on What Makes a System Alive',
        'Biologists, philosophers of mind, practitioners of enactive cognition',
        'Introduce autopoiesis as a framework for understanding self-maintaining systems (Authority/Ego)',
        'An autopoietic system produces the components that produce it — self-creation is the defining property of living systems, and understanding it changes how we think about identity, growth, and change',
        'deep_dive', 'draft',
        'cybernetics feedback self-regulation Wiener second-order autopoiesis observer'
      ),
      (
        gen_random_uuid(), v_topic_4,
        'Designing Cybernetic Feedback Loops for Behavioral Self-Regulation',
        'Coaches, performance practitioners, behavioral designers',
        'Apply cybernetic principles to personal feedback system design (Authority)',
        'Goal-directed behavior requires a sensor (measurement), a comparator (gap detection), and an effector (corrective action) — most behavioral change programs fail because they skip the sensor',
        'how_to_guide', 'draft',
        'cybernetics feedback self-regulation Wiener second-order autopoiesis observer'
      );
  ELSE
    SELECT id INTO v_topic_4 FROM content_topics WHERE title = 'Cybernetics and Self-Regulating Systems';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- T5. Complexity Science, Adaptive Systems, and the Edge of Order
  -- ──────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Complexity Science, Adaptive Systems, and the Edge of Order') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(),
      v_pillar_id,
      'Complexity Science, Adaptive Systems, and the Edge of Order',
      'How complexity science reveals the behavior of systems at the edge between order and chaos, what this means for adaptation and learning, and how individuals and organizations navigate complexity.',
      ARRAY['complexity', 'complex-adaptive-systems', 'edge-of-chaos', 'Santa-Fe', 'adaptation', 'emergence']
    )
    RETURNING id INTO v_topic_5;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query)
    VALUES
      (
        gen_random_uuid(), v_topic_5,
        'The Edge of Chaos Is Where Interesting Things Happen: Complexity Science for Practitioners',
        'Practitioners, strategists, organizational leaders',
        'Introduce the edge-of-chaos concept and its practical implications (Ego/Authority)',
        'Too much order produces rigidity; too much chaos produces incoherence. The edge between them — where rules exist but aren''t over-specified — is where adaptation, creativity, and learning are possible',
        'blog_post', 'draft',
        'complexity science complex adaptive systems edge of chaos Santa Fe Institute adaptation'
      ),
      (
        gen_random_uuid(), v_topic_5,
        'Complex Adaptive Systems and the Limits of Planning: Why the Map Is Not the Strategy',
        'Organizational strategists, entrepreneurs, leaders in uncertain environments',
        'Apply CAS principles to strategic planning under uncertainty (Fear/Authority)',
        'In a complex adaptive system, detailed planning is a liability — the environment changes faster than the plan can be executed. Strategy in complexity is about fitness, not foresight',
        'long_form_essay', 'draft',
        'complexity science complex adaptive systems edge of chaos Santa Fe Institute adaptation'
      ),
      (
        gen_random_uuid(), v_topic_5,
        'Fitness Landscapes and Evolutionary Search: Why You Can''t Optimize Your Way to the Global Maximum',
        'Researchers, strategists, entrepreneurs, evolutionary biologists',
        'Introduce fitness landscape concept and its implications for strategy (Authority/Ego)',
        'Local optimization always reaches a local maximum — but the global maximum may be on the other side of a valley that looks like failure. Understanding fitness landscapes explains why breakthroughs require apparent regression',
        'deep_dive', 'draft',
        'complexity science complex adaptive systems edge of chaos Santa Fe Institute adaptation'
      ),
      (
        gen_random_uuid(), v_topic_5,
        'Sense-Making in Complex Environments: The Cynefin Framework for Decision Architecture',
        'Leaders, consultants, organizational designers',
        'Teach the Cynefin framework as a complexity navigation tool (Authority)',
        'The Cynefin framework maps domains (simple, complicated, complex, chaotic) and specifies different decision approaches for each — the most common leadership error is applying complicated-domain thinking (best practices) to complex-domain problems',
        'how_to_guide', 'draft',
        'complexity science complex adaptive systems edge of chaos Santa Fe Institute adaptation'
      );
  ELSE
    SELECT id INTO v_topic_5 FROM content_topics WHERE title = 'Complexity Science, Adaptive Systems, and the Edge of Order';
  END IF;

END $$;
