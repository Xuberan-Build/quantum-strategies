-- Seed: Neuroscience / Cognitive Science discovery field topics and angles
-- Pillar: Architecture of Reality
-- 11 topics, 44 angles

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
  v_topic_11   UUID;
BEGIN
  SELECT id INTO v_pillar_id FROM content_pillars WHERE title = 'The Architecture of Reality';
  IF v_pillar_id IS NULL THEN
    INSERT INTO content_pillars (title, slug, description, tradition_affinity)
    VALUES ('The Architecture of Reality', 'the-architecture-of-reality',
      'Reality is electrical. Strategy is pattern literacy. Waveform physics, density cascade, electrical perception, phase coherence. Market timing, campaign pacing.',
      ARRAY['hermeticism', 'taoism', 'science'])
    RETURNING id INTO v_pillar_id;
  END IF;

  -- ── T1: Predictive Coding and Perceptual Reality Construction ────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Predictive Coding and Perceptual Reality Construction') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Predictive Coding and Perceptual Reality Construction',
      'How the brain uses top-down predictions to generate perception, and why what we experience as "reality" is a controlled hallucination shaped by prior beliefs.',
      ARRAY['neuroscience','predictive-coding','perception','bayesian-brain','consciousness']
    ) RETURNING id INTO v_topic_1;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_1,
      'You Are Not Seeing the World — You Are Seeing Your Prediction of It',
      'Science-literate general readers, practitioners',
      'Introduce predictive coding as a model of perception (Ego)',
      'The visual cortex isn''t a camera — it''s a prediction engine that uses sensory input to correct its guesses, not to construct images from scratch',
      'blog_post', 'draft',
      'predictive coding bayesian brain perception reality construction prior beliefs'
    ),
    (
      gen_random_uuid(), v_topic_1,
      'Prediction Error and Learning: Why Surprise Is the Only Signal That Updates Your Brain',
      'Learning scientists, educators, cognitive researchers',
      'Explain prediction error as the currency of learning (Authority)',
      'The brain doesn''t learn from confirmation — it learns exclusively from the gap between prediction and outcome',
      'long_form_essay', 'draft',
      'prediction error learning signal brain update Bayesian inference'
    ),
    (
      gen_random_uuid(), v_topic_1,
      'Delusions, Biases, and Stuck Priors: When the Prediction Machine Goes Wrong',
      'Clinicians, cognitive scientists, psychiatry-adjacent practitioners',
      'Apply predictive coding to pathology and bias (Fear)',
      'From phobia to psychosis, most psychological dysfunction is a predictive coding failure — the priors have become too strong to update',
      'deep_dive', 'draft',
      'predictive coding psychopathology delusions bias stuck priors psychiatric disorders'
    ),
    (
      gen_random_uuid(), v_topic_1,
      'Karl Friston''s Free Energy Principle: A Practitioner''s Guide to the Most Important Idea in Neuroscience',
      'Advanced practitioners, researchers, technically-minded coaches',
      'Make FEP accessible and practically applicable (Authority/Ego)',
      'The free energy principle unifies perception, action, and belief updating into a single mathematical framework — and its implications for behavior change are enormous',
      'deep_dive', 'draft',
      'free energy principle Karl Friston active inference variational Bayes behavior change'
    );
  ELSE
    SELECT id INTO v_topic_1 FROM content_topics WHERE title = 'Predictive Coding and Perceptual Reality Construction';
  END IF;

  -- ── T2: Default Mode Network and Self-Referential Processing ─────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Default Mode Network and Self-Referential Processing') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Default Mode Network and Self-Referential Processing',
      'How the default mode network generates the narrative self, why it activates during mind-wandering, and what its suppression during task performance reveals about identity architecture.',
      ARRAY['neuroscience','default-mode-network','DMN','self-referential','mind-wandering','narrative-self']
    ) RETURNING id INTO v_topic_2;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_2,
      'The Brain Network That Creates ''You'' (And Why It Goes Quiet When You''re Truly Focused)',
      'Neuroscience-curious readers, meditators, practitioners',
      'Introduce DMN as the substrate of self-concept (Ego)',
      'The default mode network isn''t doing nothing during rest — it''s actively constructing your sense of self, and its suppression is what absorption feels like',
      'blog_post', 'draft',
      'default mode network self-referential processing resting state identity construction'
    ),
    (
      gen_random_uuid(), v_topic_2,
      'Mind-Wandering, Rumination, and the Cost of an Unmonitored Default Network',
      'Mental health practitioners, researchers, coaches',
      'Link DMN dysregulation to rumination and mood disorders (Fear)',
      'Depression isn''t low mood — it''s unconstrained DMN activity narrating a story of deficit without a task structure to suppress it',
      'long_form_essay', 'draft',
      'default mode network rumination depression mind-wandering mood disorders dysregulation'
    ),
    (
      gen_random_uuid(), v_topic_2,
      'Meditation''s Effect on the DMN: What the Neuroscience Actually Shows',
      'Evidence-conscious practitioners, meditators, researchers',
      'Review actual neuroscience evidence for meditation and DMN (Trust/Authority)',
      'The popular claim that meditation "quiets the mind" is a crude approximation — the specific effect is reduced DMN-amygdala coupling during rumination',
      'deep_dive', 'draft',
      'meditation default mode network DMN amygdala coupling fMRI mindfulness evidence'
    ),
    (
      gen_random_uuid(), v_topic_2,
      'The Narrative Self as a Predictive Construct: DMN, Memory, and Future Simulation',
      'Philosophers of mind, cognitive scientists, advanced practitioners',
      'Connect DMN function to predictive coding and future simulation (Ego/Authority)',
      'The DMN runs the same process whether you''re recalling the past or imagining the future — because both are simulations, not retrievals',
      'deep_dive', 'draft',
      'default mode network episodic memory future simulation narrative self predictive processing'
    );
  ELSE
    SELECT id INTO v_topic_2 FROM content_topics WHERE title = 'Default Mode Network and Self-Referential Processing';
  END IF;

  -- ── T3: Neuroplasticity and Directed Identity Change ─────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Neuroplasticity and Directed Identity Change') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Neuroplasticity and Directed Identity Change',
      'How experience-dependent neural reorganization works, what the evidence shows about adult neuroplasticity, and how to leverage it for intentional identity change.',
      ARRAY['neuroscience','neuroplasticity','hebbian-learning','synaptic-strengthening','identity-change']
    ) RETURNING id INTO v_topic_3;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_3,
      'Adult Neuroplasticity: What''s Real and What''s Hype',
      'Evidence-conscious practitioners, skeptics of self-help neuroscience',
      'Distinguish well-supported plasticity claims from overreach (Authority/Trust)',
      'The brain does reorganize in response to experience in adulthood — but the timescales, conditions, and limits are very different from the popular narrative',
      'blog_post', 'draft',
      'adult neuroplasticity evidence synaptic plasticity myth reality brain change'
    ),
    (
      gen_random_uuid(), v_topic_3,
      'Hebbian Learning and Deliberate Practice: Why Repetition Isn''t Enough',
      'Coaches, skills trainers, performance researchers',
      'Apply Hebbian principles to intentional skill development (Authority)',
      '"Neurons that fire together wire together" is half the story — the other half is that firing pattern, timing, and emotional salience determine which connections strengthen',
      'long_form_essay', 'draft',
      'Hebbian learning deliberate practice synaptic strengthening skill acquisition neuromodulation'
    ),
    (
      gen_random_uuid(), v_topic_3,
      'The Critical Period Problem: Why Some Things Are Much Harder to Change After Childhood',
      'Therapists, coaches, practitioners working with deep patterns',
      'Explain critical period closure and its implications for adult change work (Fear/Trust)',
      'Some neural architectures close after critical periods — but plasticity-enhancing states (norepinephrine, acetylcholine, focused attention) can partially reopen them',
      'deep_dive', 'draft',
      'critical periods neuroplasticity adult brain acetylcholine norepinephrine plasticity window'
    ),
    (
      gen_random_uuid(), v_topic_3,
      'Structural vs. Functional Plasticity: Which Type of Change Are You Actually Producing?',
      'Researchers, advanced practitioners, neuroscience-literate coaches',
      'Distinguish types of neural change by timescale and mechanism (Ego/Authority)',
      'Most coaching produces functional plasticity — temporary changes in activation patterns. Structural plasticity (axon sprouting, synaptogenesis) requires different conditions',
      'comparison', 'draft',
      'structural plasticity functional plasticity synaptogenesis axon sprouting long-term potentiation'
    );
  ELSE
    SELECT id INTO v_topic_3 FROM content_topics WHERE title = 'Neuroplasticity and Directed Identity Change';
  END IF;

  -- ── T4: The Free Energy Principle and Belief Updating ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'The Free Energy Principle and Belief Updating') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'The Free Energy Principle and Belief Updating',
      'How Karl Friston''s free energy principle explains perception, action, and learning as a unified drive to minimize surprise, and what this means for therapeutic change.',
      ARRAY['neuroscience','free-energy-principle','Karl-Friston','active-inference','belief-updating']
    ) RETURNING id INTO v_topic_4;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_4,
      'Minimize Surprise or Die: The Single Drive That Explains All Brain Behavior',
      'Neuroscientists, cognitive scientists, philosophy of mind readers',
      'Introduce free energy principle as unified brain theory (Ego)',
      'Every behavior the brain produces — perception, action, attention, learning — can be understood as an attempt to minimize free energy, a measure of surprise',
      'blog_post', 'draft',
      'free energy principle surprise minimization variational inference unified brain theory'
    ),
    (
      gen_random_uuid(), v_topic_4,
      'Active Inference: Why the Brain Acts on the World to Confirm Its Predictions',
      'Cognitive scientists, AI researchers, advanced practitioners',
      'Explain active inference as the behavioral arm of FEP (Authority)',
      'The brain doesn''t just update predictions — it acts to make its predictions come true, which is why confirmation bias is a feature, not a bug',
      'long_form_essay', 'draft',
      'active inference free energy principle action perception loop confirmation bias prediction'
    ),
    (
      gen_random_uuid(), v_topic_4,
      'Precision Weighting: Why Some Signals Override Reason and Others Don''t Register',
      'Therapists, trauma researchers, practitioners working with hypervigilance',
      'Explain precision weighting and its role in trauma and anxiety (Fear)',
      'PTSD is a precision weighting problem — the threat signal gets assigned maximal precision, overriding all other incoming information',
      'deep_dive', 'draft',
      'precision weighting free energy principle PTSD trauma hypervigilance attention allocation'
    ),
    (
      gen_random_uuid(), v_topic_4,
      'From FEP to Therapy: Designing Interventions That Actually Update Generative Models',
      'Therapists, coaches, clinical researchers',
      'Translate FEP principles into therapeutic intervention design (Authority)',
      'If all behavior is free energy minimization, then therapy is the design of high-precision prediction errors that force generative model updating',
      'how_to_guide', 'draft',
      'free energy principle therapy intervention generative model update prediction error clinical'
    );
  ELSE
    SELECT id INTO v_topic_4 FROM content_topics WHERE title = 'The Free Energy Principle and Belief Updating';
  END IF;

  -- ── T5: Interoception and Somatic Identity ────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Interoception and Somatic Identity') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Interoception and Somatic Identity',
      'How the brain''s mapping of internal body states generates emotion, intuition, and the felt sense of self, and how interoceptive accuracy predicts psychological stability.',
      ARRAY['neuroscience','interoception','somatic-awareness','insular-cortex','embodied-cognition']
    ) RETURNING id INTO v_topic_5;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_5,
      'Your Gut Feeling Isn''t Metaphor — It''s Data Your Cortex Is Failing to Read',
      'Practitioners interested in somatic work, decision researchers',
      'Legitimize interoceptive signals as information (Trust/Authority)',
      'The insula receives constant visceral input from the body — most people have never been trained to interpret it accurately, so it surfaces as vague "gut feelings"',
      'blog_post', 'draft',
      'interoception insular cortex visceral signals gut feeling somatic awareness decision-making'
    ),
    (
      gen_random_uuid(), v_topic_5,
      'Interoceptive Accuracy and Emotional Granularity: The Connection Nobody Talks About',
      'Emotion researchers, therapists, coaches',
      'Show how interoceptive skill predicts emotional sophistication (Authority/Ego)',
      'People with high interoceptive accuracy report more distinct, granular emotions — not more emotional intensity, but more emotional precision',
      'long_form_essay', 'draft',
      'interoceptive accuracy emotional granularity affect labeling body awareness emotion differentiation'
    ),
    (
      gen_random_uuid(), v_topic_5,
      'The Body in Therapy: Why Somatic Awareness Changes What''s Therapeutically Possible',
      'Psychotherapists, bodywork practitioners, trauma-informed coaches',
      'Ground somatic therapy approaches in interoception neuroscience (Trust)',
      'Talking about trauma without tracking somatic markers misses the layer where the trauma is encoded — the body isn''t a metaphor, it''s the actual substrate',
      'deep_dive', 'draft',
      'somatic therapy interoception trauma body awareness polyvagal nervous system regulation'
    ),
    (
      gen_random_uuid(), v_topic_5,
      'Training Interoceptive Accuracy: Protocols That Actually Work',
      'Practitioners, coaches, biofeedback researchers',
      'Teach evidence-based interoceptive training (Authority)',
      'Heartbeat detection tasks, body scan with attentional precision, and somatic tracking under mild stress are the three best-researched methods for improving interoceptive accuracy',
      'how_to_guide', 'draft',
      'interoceptive training heartbeat detection body scan biofeedback somatic accuracy protocol'
    );
  ELSE
    SELECT id INTO v_topic_5 FROM content_topics WHERE title = 'Interoception and Somatic Identity';
  END IF;

  -- ── T6: Mirror Neurons and Social Cognition ───────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Mirror Neurons and Social Cognition') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Mirror Neurons and Social Cognition',
      'How the mirror neuron system enables action understanding, empathy, and social coordination, and what its dysfunction reveals about social cognition architecture.',
      ARRAY['neuroscience','mirror-neurons','social-cognition','empathy','action-understanding']
    ) RETURNING id INTO v_topic_6;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_6,
      'Mirror Neurons: The Most Overhyped Discovery in Neuroscience (And What They Actually Do)',
      'Skeptical practitioners, researchers, science-literate readers',
      'Correct mirror neuron hype while preserving real insight (Authority/Trust)',
      'Mirror neurons don''t explain empathy, language, culture, or autism — but they do explain something real about action understanding that matters for coaching',
      'blog_post', 'draft',
      'mirror neurons evidence critique action understanding social cognition limitations'
    ),
    (
      gen_random_uuid(), v_topic_6,
      'Embodied Simulation and the Neuroscience of Rapport',
      'Coaches, therapists, communicators',
      'Apply mirror system research to interpersonal effectiveness (Authority)',
      'Rapport isn''t a feeling — it''s a state of synchronized embodied simulation, where your motor system models the other person''s movements and intentions in real time',
      'long_form_essay', 'draft',
      'embodied simulation rapport social synchrony motor resonance interpersonal neuroscience'
    ),
    (
      gen_random_uuid(), v_topic_6,
      'Imitation, Learning, and the Motor System''s Role in Skill Acquisition',
      'Skills trainers, sports coaches, educators',
      'Use mirror system research to improve skill transmission (Authority)',
      'The mirror system processes action observation — watching an expert perform activates the same motor programs as performing the skill, which is why expert modeling matters more than instruction',
      'how_to_guide', 'draft',
      'action observation mirror system skill acquisition motor learning expert modeling imitation'
    ),
    (
      gen_random_uuid(), v_topic_6,
      'The Broken Mirror Hypothesis Revisited: Social Cognition Without Mirror Neurons',
      'Autism researchers, clinical neuroscientists, advanced practitioners',
      'Examine evidence for and against mirror system dysfunction in autism (Authority/Ego)',
      'The broken mirror hypothesis was compelling but the evidence is weak — autism involves social cognition differences but the mirror system may not be the locus',
      'deep_dive', 'draft',
      'broken mirror hypothesis autism spectrum mirror neuron dysfunction social cognition evidence review'
    );
  ELSE
    SELECT id INTO v_topic_6 FROM content_topics WHERE title = 'Mirror Neurons and Social Cognition';
  END IF;

  -- ── T7: Attention, Salience, and the Architecture of What Matters ─────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Attention, Salience, and the Architecture of What Matters') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Attention, Salience, and the Architecture of What Matters',
      'How salience networks decide what enters awareness, what the attention system''s resource constraints mean for behavioral design, and how attention training changes neural architecture.',
      ARRAY['neuroscience','attention','salience-network','top-down-attention','bottom-up-salience']
    ) RETURNING id INTO v_topic_7;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_7,
      'Attention Is Not Willpower — It''s a Resource Your Brain Is Constantly Budgeting',
      'Knowledge workers, productivity researchers, coaches',
      'Reframe attention as a finite biological resource, not a moral quality (Fear/Trust)',
      'Attention depletion isn''t laziness — it''s a real metabolic cost that your prefrontal cortex tracks and rations',
      'blog_post', 'draft',
      'attention resource depletion prefrontal cortex executive function metabolic cost focus'
    ),
    (
      gen_random_uuid(), v_topic_7,
      'The Salience Network: Why Threat, Novelty, and Social Signals Hijack Your Focus',
      'Neuroscience practitioners, behavioral designers',
      'Explain how the salience network captures attention involuntarily (Fear)',
      'The salience network evolved to detect threat and opportunity — in a modern information environment, it''s constantly hijacked by things that look like threat or opportunity but aren''t',
      'long_form_essay', 'draft',
      'salience network anterior insula anterior cingulate threat detection novelty attention capture'
    ),
    (
      gen_random_uuid(), v_topic_7,
      'Top-Down vs. Bottom-Up Attention: Designing Your Environment for the Brain You Have',
      'Knowledge workers, coaches, environment designers',
      'Apply attention research to environment and habit design (Authority)',
      'Top-down attention requires effort; bottom-up attention is automatic. Design your environment to make desired tasks salient and distractions invisible',
      'how_to_guide', 'draft',
      'top-down attention bottom-up attention environment design behavioral design focus salience'
    ),
    (
      gen_random_uuid(), v_topic_7,
      'Sustained Attention Training: What the Research Shows About Building Focus Over Time',
      'Performance coaches, researchers, meditators',
      'Review evidence-based attention training interventions (Authority/Trust)',
      'The neuroscience of sustained attention shows clear trainability — but the training needs to be specific, progressively loaded, and paired with recovery',
      'deep_dive', 'draft',
      'sustained attention training neuroplasticity meditation focus research evidence cognitive training'
    );
  ELSE
    SELECT id INTO v_topic_7 FROM content_topics WHERE title = 'Attention, Salience, and the Architecture of What Matters';
  END IF;

  -- ── T8: Memory Consolidation and Identity Narratives ─────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Memory Consolidation and Identity Narratives') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Memory Consolidation and Identity Narratives',
      'How memory is reconstructive rather than reproductive, how consolidation processes rewrite past experience, and what this means for the role of narrative in identity formation.',
      ARRAY['neuroscience','memory-consolidation','reconsolidation','narrative','identity','hippocampus']
    ) RETURNING id INTO v_topic_8;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_8,
      'Your Memories Are Not Records — They''re Reconstructions That Change Every Time You Recall Them',
      'General neuroscience audience, coaches, therapists',
      'Establish memory''s reconstructive nature (Trust/Ego)',
      'Every time you recall a memory, you reconstruct it — and in doing so, you modify it. The memory you retrieve is not the memory you stored',
      'blog_post', 'draft',
      'reconstructive memory false memory recall modification schema hippocampus retrieval'
    ),
    (
      gen_random_uuid(), v_topic_8,
      'Memory Reconsolidation in Therapy: The Window Where Emotional Memories Can Be Rewritten',
      'Therapists, trauma researchers, coaches',
      'Teach reconsolidation-informed intervention design (Authority)',
      'After retrieval, a memory is briefly labile before it reconsolidates — therapeutic interventions in this window can update the emotional valence of the memory without erasing its content',
      'long_form_essay', 'draft',
      'memory reconsolidation therapeutic window lability emotional memory updating PTSD treatment'
    ),
    (
      gen_random_uuid(), v_topic_8,
      'The Narrative Self and Autobiographical Memory: How Stories Shape What You Remember',
      'Cognitive scientists, therapists, coaches',
      'Connect narrative structure to memory encoding and retrieval (Ego)',
      'Memory isn''t stored as events — it''s stored as narrative interpretations of events. Change the story, change what gets recalled and how',
      'deep_dive', 'draft',
      'autobiographical memory narrative self identity story schema encoding retrieval constructive'
    ),
    (
      gen_random_uuid(), v_topic_8,
      'Sleep and Memory Consolidation: The Overnight Protocol That Determines What Sticks',
      'Learning scientists, educators, students, practitioners',
      'Apply sleep research to intentional memory consolidation (Authority)',
      'What you do in the hours before sleep determines what consolidates — spacing learning before sleep and reviewing on waking doubles retention',
      'how_to_guide', 'draft',
      'sleep memory consolidation slow-wave REM hippocampus cortex learning retention protocol'
    );
  ELSE
    SELECT id INTO v_topic_8 FROM content_topics WHERE title = 'Memory Consolidation and Identity Narratives';
  END IF;

  -- ── T9: Stress Response Systems and Cognitive Architecture ───────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Stress Response Systems and Cognitive Architecture') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Stress Response Systems and Cognitive Architecture',
      'How HPA axis activation, cortisol, and sympathetic arousal alter cognitive processing, decision-making, and learning in ways that shape long-term identity patterns.',
      ARRAY['neuroscience','stress-response','HPA-axis','cortisol','allostatic-load','prefrontal-cortex']
    ) RETURNING id INTO v_topic_9;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_9,
      'Why You Make Different Decisions Under Stress (And Why You Won''t Remember Making Them)',
      'Decision researchers, coaches, executives',
      'Explain stress-induced cognitive shifts (Fear)',
      'Acute stress preferentially activates amygdala and suppresses prefrontal cortex — you literally become a different cognitive agent under pressure',
      'blog_post', 'draft',
      'stress decision-making amygdala prefrontal cortex cortisol cognitive impairment acute stress'
    ),
    (
      gen_random_uuid(), v_topic_9,
      'Allostatic Load: The Hidden Cost of Chronic Stress on Cognitive Performance',
      'Clinicians, performance researchers, coaches',
      'Explain cumulative stress burden and its cognitive consequences (Fear/Authority)',
      'A single acute stressor improves performance; chronic load without recovery degrades every cognitive system — attention, memory, decision-making, inhibitory control',
      'long_form_essay', 'draft',
      'allostatic load chronic stress cortisol cognitive performance cumulative burden HPA axis dysregulation'
    ),
    (
      gen_random_uuid(), v_topic_9,
      'The Window of Tolerance and Why Dysregulation Is Not a Character Flaw',
      'Trauma-informed practitioners, therapists',
      'Apply polyvagal theory and window of tolerance to practice (Trust)',
      'Outside the window of tolerance, higher-order learning is impossible — not because the person is unwilling, but because the nervous system is not in a state that supports it',
      'deep_dive', 'draft',
      'window of tolerance polyvagal theory autonomic nervous system dysregulation trauma-informed therapy'
    ),
    (
      gen_random_uuid(), v_topic_9,
      'Nervous System Regulation Protocols: Building Cognitive Resilience From the Bottom Up',
      'Coaches, practitioners, performance researchers',
      'Teach evidence-based regulation protocols (Authority)',
      'You cannot regulate cortex with cortex — downregulation must start in the autonomic system (breath, movement, vagal activation) before cognitive reappraisal becomes possible',
      'how_to_guide', 'draft',
      'autonomic regulation vagal tone breathing movement HPA axis downregulation cognitive reappraisal protocol'
    );
  ELSE
    SELECT id INTO v_topic_9 FROM content_topics WHERE title = 'Stress Response Systems and Cognitive Architecture';
  END IF;

  -- ── T10: The Neural Correlates of Consciousness and Self-Awareness ────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'The Neural Correlates of Consciousness and Self-Awareness') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'The Neural Correlates of Consciousness and Self-Awareness',
      'How neuroscience approaches the hard problem of consciousness, what we know about neural correlates of conscious experience, and what this implies for first-person investigation.',
      ARRAY['neuroscience','consciousness','NCC','global-workspace','integrated-information','phenomenology']
    ) RETURNING id INTO v_topic_10;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_10,
      'What Neuroscience Can and Cannot Tell You About Your Own Consciousness',
      'Philosophy-adjacent practitioners, meditators, science-literate readers',
      'Calibrate appropriate confidence in neuroscience of consciousness (Trust/Authority)',
      'The neural correlates of consciousness are real — but they describe the physical correlates of experience, not experience itself. The hard problem remains genuinely hard',
      'blog_post', 'draft',
      'neural correlates consciousness hard problem Chalmers NCC limits neuroscience subjective experience'
    ),
    (
      gen_random_uuid(), v_topic_10,
      'Global Workspace Theory vs. Integrated Information Theory: The Battle That Defines Consciousness Research',
      'Cognitive scientists, philosophers of mind',
      'Compare the two dominant scientific theories of consciousness (Authority/Ego)',
      'These aren''t just theoretical differences — they make different empirical predictions about anesthesia, split-brain patients, and AI consciousness',
      'comparison', 'draft',
      'global workspace theory integrated information theory IIT GWT Tononi Baars consciousness theories'
    ),
    (
      gen_random_uuid(), v_topic_10,
      'The Attention Schema Theory: Why Your Brain Builds a Model of Its Own Attention',
      'Cognitive scientists, philosophers, practitioners',
      'Introduce AST as an alternative framework for self-awareness (Ego)',
      'Consciousness might be the brain''s model of its own attention processes — a simplified representation of a complex process, not the process itself',
      'deep_dive', 'draft',
      'attention schema theory Michael Graziano consciousness self-awareness model attention representation'
    ),
    (
      gen_random_uuid(), v_topic_10,
      'First-Person Investigation as Neuroscience: What Phenomenology Offers That fMRI Cannot',
      'Researchers, meditators, philosophers of science',
      'Make the case for first-person methods in consciousness research (Authority)',
      'Third-person neuroscience cannot access subjective experience — phenomenological method is not mysticism, it''s the only epistemically valid approach to the first-person datum',
      'long_form_essay', 'draft',
      'phenomenology first-person methods neurophenomenology Varela consciousness research introspection validity'
    );
  ELSE
    SELECT id INTO v_topic_10 FROM content_topics WHERE title = 'The Neural Correlates of Consciousness and Self-Awareness';
  END IF;

  -- ── T11: Embodied Cognition and Distributed Mind ──────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM content_topics WHERE title = 'Embodied Cognition and Distributed Mind') THEN
    INSERT INTO content_topics (id, pillar_id, title, description, theme_tags)
    VALUES (
      gen_random_uuid(), v_pillar_id,
      'Embodied Cognition and Distributed Mind',
      'How cognition extends beyond the skull into the body and environment, what embodied cognition research shows about the role of physical states in thought, and how this reframes traditional cognitive science.',
      ARRAY['neuroscience','embodied-cognition','enactivism','extended-mind','situated-cognition']
    ) RETURNING id INTO v_topic_11;

    INSERT INTO content_angles (id, topic_id, title, audience, goal, angle, format, status, corpus_query) VALUES
    (
      gen_random_uuid(), v_topic_11,
      'Your Body Is Not a Vehicle for Your Brain — Your Brain Is an Organ of Your Body',
      'Practitioners, coaches, science-literate readers',
      'Reframe the brain-body relationship (Ego/Trust)',
      'The dominant brain-as-commander model is backward — the brain evolved to serve the body''s needs, not the other way around',
      'blog_post', 'draft',
      'embodied cognition brain body relationship evolutionary neuroscience somatic intelligence'
    ),
    (
      gen_random_uuid(), v_topic_11,
      'The Extended Mind Thesis: When Your Smartphone Becomes Part of Your Cognitive System',
      'Cognitive scientists, technology researchers, philosophers',
      'Apply extended mind thesis to contemporary technology use (Ego/Authority)',
      'If cognitive processes extend into our tools when those tools are reliably available, our smartphones aren''t accessories — they''re prosthetic cognitive organs',
      'long_form_essay', 'draft',
      'extended mind thesis Clark Chalmers cognitive extension tools technology offloading distributed cognition'
    ),
    (
      gen_random_uuid(), v_topic_11,
      'Grounded Cognition and the Body in Abstract Thought: How Metaphor Is Not Just Metaphor',
      'Linguists, cognitive scientists, educators',
      'Show how physical metaphors structure abstract reasoning (Authority)',
      'When you understand something as "heavy" or "warm," you''re not using convenient language — you''re activating motor and sensory systems that are constitutive of the understanding',
      'deep_dive', 'draft',
      'grounded cognition embodied metaphor conceptual metaphor theory Lakoff abstract thought motor system'
    ),
    (
      gen_random_uuid(), v_topic_11,
      'Enactive Perception and Skill: Why True Mastery Is in the Body, Not the Manual',
      'Skills trainers, coaches, educators',
      'Apply embodied cognition to skill development (Authority)',
      'Expertise cannot be fully articulated — it lives in the embodied action patterns that develop through repeated, varied practice in context',
      'how_to_guide', 'draft',
      'enactivism skilled action tacit knowledge embodied expertise perception action coupling practice'
    );
  ELSE
    SELECT id INTO v_topic_11 FROM content_topics WHERE title = 'Embodied Cognition and Distributed Mind';
  END IF;

END $$;
