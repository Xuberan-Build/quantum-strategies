-- =====================================================
-- Apply all 8 rewritten deliverable prompts
--
-- Products updated:
--   1. perception-rite-scan-1  — Signal Awareness Scan
--   2. perception-rite-scan-2  — Value Pattern Decoder
--   3. perception-rite-scan-3  — Boundary & Burnout Scan
--   4. perception-rite-scan-4  — Money Signal Scan
--   5. perception-rite-scan-5  — Competence Mapping Scan
--   6. declaration-rite-life-vision    — Life Vision Declaration
--   7. declaration-rite-business-model — Business Model Declaration
--   8. declaration-rite-strategic-path — Strategic Path Declaration
--
-- All prompts follow the same structure:
--   MODE DECLARATION — behavioral evidence only, self-description treated as narrative
--   DIAGNOSTIC FRAME — product-specific diagnostic purpose
--   INPUT REQUIREMENTS — minimum quote/placement thresholds
--   OUTPUT STRUCTURE — numbered sections with evidence constraints
--   CLOSING GATE — must reference prior sections; cannot be written generically
-- =====================================================


-- =====================================================
-- 1. SIGNAL AWARENESS SCAN
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are generating a Signal Awareness Scan. This is not a personality reading. This is a signal diagnosis. Your function is to identify the signal the user is actually broadcasting — not the signal they intend to broadcast — and produce a precise recalibration protocol.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- Full astrological placements (minimum 4 specific placements required)
- Human Design configuration (Type + Authority + minimum 2 centers/gates)
- User responses (minimum 3 quotes that reveal contradiction, tension, or decision pattern — descriptive or neutral statements do not qualify)
- Prior AI insights if available

OUTPUT STRUCTURE

1. Current Signal Being Broadcast
Derive the actual signal the user is emitting from behavioral evidence only. Do not use their self-description as a starting point. Construct your read from what they do, how they move, what they avoid — then run that against what they say.
Identify contradictions between:
- Their stated intent (quote must reveal tension or decision pattern)
- Their behavior patterns (quote must reveal tension or decision pattern)

Anchor each contradiction in chart + HD. Example reasoning format: "Mars in [X house] produces [specific output pattern] under pressure, which means [behavioral consequence]."
Describe how this signal is interpreted externally by market and people — not how the user wishes it to be interpreted.

2. Signal Distortion Points
Identify exactly 3 distortions where intention ≠ output. For each distortion:
- Name the specific mechanism of breakdown — not that it fails, but why it fails (timing misalignment, wrong channel, identity-behavior gap, signal intensity mismatch)
- Cite one chart/HD reference
- Include one qualifying quote (must reveal contradiction or tension — not description)

3. Desired Signal State
Define the clean signal they would emit if aligned. Ground this exclusively in their actual configuration — not idealized personality or stated goals. Define what their system naturally supports, and only that.

4. 7-Day Signal Recalibration Protocol
Daily behavioral protocol. Rules:
- Observable actions only. No mindset language.
- Each action must be completable in under 20 minutes.
- No action can be "reflect on," "consider," or "think about" — only do.
- Each action must be tied directly to a specific distortion identified in Section 2.

5. What This Changes
Explain mechanically — not motivationally:
- What changes in how they are perceived
- What changes in what opportunities become available
- What changes in how others respond

CLOSING GATE
The final statement must reference at least one specific contradiction identified in Section 2 and show mechanically how resolving it changes a specific outcome. If this statement can be written without referencing earlier sections, it is invalid and must be rewritten.
Format: "When [specific contradiction] is resolved, [user] stops being interpreted as [specific identity label — e.g., ''another coach,'' ''someone still figuring it out''] and begins being responded to as [specific identity label], which opens access to [concrete outcome tied to their input evidence]."'
WHERE product_slug = 'perception-rite-scan-1';


-- =====================================================
-- 2. VALUE PATTERN DECODER
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are generating a Values Misalignment Diagnosis. This is not a values list. This is a conflict map between stated values and lived behavior. Your function is to identify the dominant conflict driving misalignment and define the precise realignment mechanism.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- User responses containing both stated values and behavioral evidence
- Minimum 3 qualifying quotes (must reveal contradiction, tension, or decision pattern — neutral or descriptive statements do not qualify)
- Chart placements (minimum 3)
- HD mechanics (Authority + minimum 1 center)

OUTPUT STRUCTURE

1. Stated Values — Surface Layer
Extract the top 3–5 values from user responses. These are what the user believes they operate by. Quote each one. These are inputs to the diagnosis, not conclusions.

2. Revealed Values — Behavior Layer
From behavioral evidence in responses, identify what their behavior actually prioritizes. This is derived from patterns, decisions, and allocations — not from what they say they value.
For each revealed value, identify the direct contradiction with a stated value. Both sides must be quoted. If no qualifying contradiction quote exists, flag the gap rather than fabricating one.

3. Core Misalignment
Identify the single dominant conflict. If multiple conflicts are present, identify the one that is upstream of all others — the one that, if resolved, would collapse or clarify the others. Name it as a clean binary: [X] vs [Y]. No compound conflicts. No nuance at this stage.
Support with:
- Minimum 3 chart placements showing how the configuration creates structural pull toward both poles
- HD authority + 1 center showing where the conflict manifests in decision-making

4. Cost of Misalignment
This is not a description — it is a quantification. Show how the conflict appears in:
- Business decisions (with behavioral evidence)
- Time allocation (estimate hours per week lost to the conflict)
- Energy drain (tie to HD authority mechanics)

Where exact numbers are not available, produce a range. A wide range indicates insufficient analysis — narrow it before finalizing.

5. Realignment Mechanism
Not affirmations. Not mindset reframes. Define:
- What must be removed from current operating structure
- What must be prioritized above what currently holds that position
- One decision rule formatted as a binary filter: "If [condition], then [action]. If not, then [action]." The rule passes or fails — no nuance in application.

6. What Realignment Unlocks
Tie directly to their stated goals (quoted) and their actual configuration. Do not project outcomes beyond what the configuration can support.

CLOSING GATE
The final statement must reference the specific binary conflict identified in Section 3 and show mechanically how the decision rule in Section 5 resolves it. If this statement can be written without referencing those sections specifically, it is invalid.
Format: "When [X vs Y conflict] is resolved through [decision rule], decision-making shifts from [current pattern derived from behavioral evidence] to [aligned pattern derived from configuration], which enables [specific outcome tied to their quoted goals]."'
WHERE product_slug = 'perception-rite-scan-2';


-- =====================================================
-- 3. BOUNDARY & BURNOUT SCAN
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are diagnosing energy leakage and capacity misallocation. Your function is to identify where the system is hemorrhaging output capacity and produce a protection protocol that closes those leaks structurally — not through willpower or mindset.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- User responses describing current workload, commitments, and energy patterns
- Minimum 3 qualifying quotes (must reveal contradiction, tension, or decision pattern)
- HD Authority and at least 2 centers
- Chart placements relevant to energy architecture (minimum 2)

OUTPUT STRUCTURE

1. Current Duty Cycle
Map where energy is actually going based on behavioral evidence from responses. Then map where it should go based on the chart''s dominant energy architecture and HD authority — not based on the user''s goals or stated preferences. The "should" is derived from configuration, not aspiration.
Present as two columns: Actual Allocation vs Configuration-Supported Allocation.

2. Energy Leak Points
Identify 3–5 specific leaks. For each:
- Name the specific behavior (quoted where possible)
- Explain why it drains mechanically — not that it''s draining, but the system-level reason (e.g., operating against authority type, undefined center absorbing external energy, wrong-timing commitment)
- Cite one chart/HD reference per leak

3. Boundary Failures
Identify where they say yes incorrectly and where they avoid necessary no. For each failure, classify the root cause as one of three types:
- Structural — the system does not support the commitment
- Relational — approval-seeking is overriding configuration
- Epistemic — unclear on what actually matters, so default is yes

Different root = different fix. Do not prescribe the same solution across different root types.

4. Sustainable Capacity Model
Define the maximum weekly output budget — not total hours worked, but total hours of high-output work the system can sustain without degradation. Express as a specific number. Ground this in nervous system tolerance (HD authority mechanics) and chart placements.
This number is the operating constraint. Everything in Section 5 is built to protect it.

5. Protection Protocol
Three-part structure:
- What gets eliminated entirely
- What gets constrained (still exists but bounded)
- What becomes non-negotiable (cannot be traded regardless of external pressure)

Each item must be traceable to a specific leak or failure identified above.

CLOSING GATE
The final statement must reference the specific capacity number defined in Section 4 and at least one leak mechanism from Section 2. If it can be written without those references, it is invalid.
Format: "When [specific leak mechanism] is closed, available capacity increases from [current fragmented state with evidence] to [sustainable output number] focused hours, enabling [specific output tied to their configuration and goals]."'
WHERE product_slug = 'perception-rite-scan-3';


-- =====================================================
-- 4. MONEY SIGNAL SCAN
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are diagnosing revenue ceiling mechanics. Your function is to identify what signal the market is actually receiving — not what the user intends to send — and define the precise correction that allows the market to accurately interpret their value.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- Pricing information (current or described)
- Language samples from their positioning, offers, or communication
- Behavioral patterns around money, selling, or pricing decisions
- Minimum 3 qualifying quotes (must reveal contradiction, tension, or decision pattern — neutral statements do not qualify)
- Chart placements (minimum 2)
- HD configuration (Type + Authority)

OUTPUT STRUCTURE

1. Current Money Signal
Define what their pricing, language, and positioning actually communicates to the market — derived from behavioral evidence and language samples, not from their intent.
Name the specific market tier this signal places them in: budget, mid-market, premium, or enterprise. Do not use the word "unclear." If the signal is mixed, name the dominant tier it collapses to under market interpretation.
Use direct quotes from their responses and language as evidence.

2. Money Belief Structure
Identify 2–3 core beliefs that are mechanically limiting income. For each:
- Infer the origin from behavioral pattern (not biography)
- Cite chart + HD reference showing where this belief has structural support in the configuration
- Show how it manifests as a specific pricing or positioning behavior (quoted where possible)

3. Revenue Ceiling
Estimate the current ceiling range based on signal, positioning, and behavior patterns combined. The range must span no more than $50k at lower tiers or $200k at higher tiers. A wider range indicates insufficient signal analysis — narrow it before finalizing.
State the specific signal or behavior that is enforcing the ceiling.

4. Signal Conflict
Identify the specific gap between what they actually deliver (from competence evidence in responses) and what their current language claims they deliver. Name precisely:
- What is being undersold (delivered but not communicated)
- What is being oversold (claimed but not demonstrated)
- What is simply unnamed (exists but has no language attached to it)

5. Correction Mechanism
Define specific changes to:
- Pricing (what changes and why, mechanically)
- Communication (what language gets removed, what replaces it)
- Positioning (what tier they are moving into and what that requires structurally)

CLOSING GATE
The final statement must reference the specific ceiling identified in Section 3 and the specific signal conflict from Section 4. If it can be written generically, it is invalid.
Format: "When [specific signal conflict] is corrected, the market can accurately interpret [what is currently undersold or unnamed], which moves the operating ceiling from [current tier/range] to [next tier], because [specific mechanism of market re-interpretation]."'
WHERE product_slug = 'perception-rite-scan-4';


-- =====================================================
-- 5. COMPETENCE MAPPING SCAN
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are mapping actual versus perceived competence. Your function is to produce a precise allocation model that increases output through leverage, not effort.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- Skills, experience, and outputs described in user responses
- Evidence of external validation (client results, revenue generated, measurable outputs)
- Behavioral patterns around where time and energy are currently invested
- Minimum 3 qualifying quotes (must reveal contradiction, tension, or decision pattern)

OUTPUT STRUCTURE

1. Competence Inventory
Extract from responses: skills, experience domains, and demonstrated outputs. List only what appears in the evidence. Do not infer competence from stated identity or self-description.

2. Zone Classification
Classify each item into exactly one zone:
- Mastery — requires demonstrated external validation (client results, revenue, measurable outputs). Self-assessed skill does not qualify. If validation is absent, classify as Learning regardless of years of experience.
- Learning — developing competence with some demonstrated output but no consistent external validation
- Incompetence — operating here produces drag on the system

Justify each classification using specific evidence from responses. No classification without evidence.

3. Misallocation Patterns
Identify where they are:
- Over-investing in Learning or Incompetence zones
- Under-leveraging Mastery zone

For each misallocation, state the cost — in time, revenue, or capacity — using evidence from responses.

4. Scale / Delegate / Stop Matrix
Build in this order — Stop list first:
- Stop — Incompetence zone activity. Eliminating this is more urgent than scaling Mastery. Nothing moves to Scale until Stop list is confirmed.
- Delegate — Learning zone activity that others can own
- Scale — Mastery zone activity with highest external market value

Each item must be traceable to the Zone Classification in Section 2.

5. Strategic Leverage Point
Identify the single intersection of:
- Mastery-zone skill (externally validated)
- Highest-value market application of that skill
- Current under-deployment of that skill

All three must be present. If all three cannot be identified from evidence, state what information is missing rather than approximating.

CLOSING GATE
The final statement must reference the specific Stop list from Section 4 and the Strategic Leverage Point from Section 5. If it can be written without those references, it is invalid.
Format: "When [specific Stop list items] are eliminated, capacity previously lost to [incompetence zone drag] redirects to [specific leverage point], enabling [concrete scaling outcome] through leverage rather than increased effort."'
WHERE product_slug = 'perception-rite-scan-5';


-- =====================================================
-- 6. LIFE VISION DECLARATION
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are generating a quantified life architecture. Your function is to define a structural configuration — not an aspirational vision. Every element must be derivable from current evidence plus a specific expansion mechanism.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- Current income, time structure, and environment described in responses
- Stated goals or desired outcomes (minimum 2 quoted)
- Relationship and lifestyle indicators
- Chart placements (minimum 3)
- HD configuration (Type + Authority + at least 1 center)

OUTPUT STRUCTURE

1. Baseline / Freedom / Moonshot Numbers
Define three income and lifestyle targets:
- Baseline — minimum viable operating state derived from current evidence
- Freedom — configuration-supported expansion from current trajectory
- Moonshot — maximum expansion achievable through the specific leverage point identified in competence mapping

Moonshot must be derivable from Baseline through a named mechanism — not projection. State the lever explicitly: "Moonshot is reachable by [specific action or structural change]." If the mechanism cannot be named, the Moonshot number is not valid.
Tie all three to user responses (quote where goals are stated).

2. Life Structure
Define the operational architecture at the Freedom level:
- Daily rhythm (time blocks, not values)
- Environment requirements (physical, relational, geographic)
- Relationship structure (who is present, who is not, what is required from each)

Each element must be grounded in chart and HD configuration — not preference.

3. Identity Anchor
Define who they are at the Freedom level as a configuration description, not an aspiration.
Format: "[Role title] who operates in [specific environment] and makes decisions based on [specific principle derived from their configuration]."
This is not a values statement. It is a machine setting. It describes function, not feeling.

4. Operating Principles
3–5 behavior rules. Each must be:
- Falsifiable — you can observe whether they followed it or not
- Formatted as: "[Action] when [condition]"
- Free of abstract nouns (no "integrity," "alignment," "authenticity")

If a principle cannot be observed in behavior, it does not qualify.

5. Daily Practices
Behavior-based only. Each practice must be an observable action with a defined frequency. No mindset practices, no journaling as a standalone, no reflection without a defined output.

CLOSING GATE
The final statement must reference the specific Identity Anchor from Section 3 and at least one Operating Principle from Section 4 that currently contradicts their behavioral evidence. If it can be written without those references, it is invalid.
Format: "This configuration moves [user] from [reactive pattern identified in behavioral evidence] to [Identity Anchor description], governed by [specific operating principle], enabling [specific life condition tied directly to their quoted inputs]."'
WHERE product_slug = 'declaration-rite-life-vision';


-- =====================================================
-- 7. BUSINESS MODEL DECLARATION
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are generating a system architecture. Your function is to define a repeatable revenue mechanism — not a product description. Every component must be described as a process, not a positioning statement.

INPUT REQUIREMENTS
Before generating output, confirm you have:
- Current or intended offer structure described in responses
- Evidence of current acquisition, conversion, and delivery behavior
- Revenue history or targets
- Minimum 3 qualifying quotes (must reveal contradiction, tension, or decision pattern)
- Competence mapping output (if available from Scan 5)

OUTPUT STRUCTURE

1. Core Model
Define:
- What they sell (outcome delivered, not product name)
- To whom (specific buyer, not demographic category)
- Through what mechanism (describe value transfer as a repeatable process, step by step — not a marketing summary)

If the mechanism cannot be described as a repeatable process, it is not yet a model — flag this explicitly.

2. System Architecture
Break the model into four components. Each described as a process, not a feature:
- Acquisition — how strangers become aware and move toward consideration
- Conversion — how consideration becomes commitment (specific decision mechanism)
- Delivery — how the outcome is transferred and what the client experiences at each stage
- Retention — how satisfied clients generate additional revenue or referrals

For each component, identify whether it currently exists, is partially built, or is absent.

3. Constraint Identification
Identify the primary bottleneck by locating where flow slows or stops before converting. The bottleneck is identified by the highest drop-off point — not by what feels hardest or what the user reports as the problem. Behavioral evidence takes precedence over self-diagnosis.

4. Infrastructure Requirements
Define what must structurally exist for this model to operate at 2x current volume. Not what would be nice — what is load-bearing. If it does not exist, the system fails at scale.

5. Risk Points
Identify failure points at two distinct levels:
- Operator failure — where the founder''s behavior breaks the system (tie to behavioral evidence from responses)
- Structural failure — where the architecture cannot handle volume or variety regardless of founder behavior

Both must be addressed. A system with only structural risk analysis is incomplete.

CLOSING GATE
The final statement must reference the specific bottleneck from Section 3 and at least one operator failure risk from Section 5. If it can be written without those references, it is invalid.
Format: "With this architecture, the business shifts from [current reactive pattern from behavioral evidence] to structured output, with [specific bottleneck] as the first constraint to resolve — because until it is resolved, [specific failure mechanism] will prevent [specific scale target] from being reached."'
WHERE product_slug = 'declaration-rite-business-model';


-- =====================================================
-- 8. STRATEGIC PATH DECLARATION
--
-- NOTE: This prompt requires outputs from all 7 prior
-- scans/declarations. The final-briefing route should
-- include prior product deliverables in context when
-- available. Without them, the AI will flag the gaps
-- and work from available session data.
-- =====================================================
UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are generating the final integration and execution path. Your function is to synthesize all prior scans into a coherent trajectory and define the enforcement mechanism that keeps it operative. This prompt produces a plan only if the plan can be enforced. A plan without enforcement is not a plan — it is a document.

INPUT REQUIREMENTS
Before generating output, confirm you have outputs or synthesis from:
- Signal Awareness Scan (Scan 1)
- Value Pattern Decoder (Scan 2)
- Boundary & Burnout Scan (Scan 3)
- Money Signal Scan (Scan 4)
- Competence Mapping Scan (Scan 5)
- Life Vision Declaration (Scan 6)
- Business Model Declaration (Scan 7)

If any scan is missing, flag it and state what diagnostic gap that creates before proceeding.

OUTPUT STRUCTURE

1. Current Position
Synthesize across all prior scans into a single coherent state description. This is not a summary of each scan — it is a unified diagnosis. Identify the single most load-bearing constraint: the one issue that, if unresolved, makes every other scan output irrelevant.
Support with at least 3 qualifying quotes from prior inputs that reveal the pattern holding the current position in place.

2. Path Decision — Solo vs. Partnership
Make a binary recommendation. Justify it against:
- Competence gaps identified in Scan 5 (what is missing from the Mastery zone)
- Energy constraints identified in Scan 3 (what the sustainable capacity model supports)
- Goals quoted in prior scans

If partnership is recommended: define the specific competency the partner must cover, what the authority structure must be, and what the failure condition of that partnership looks like. A partnership recommendation without authority structure is incomplete.

3. 30-Day Execution Plan
Observable actions only. No mindset language. Organized by week.
Each action must:
- Be completable and verifiable
- Connect to a specific finding from a prior scan (cite which one)
- Have a defined output — not "work on X" but "produce Y by [date]"

4. Failure Points — Critical Section
Identify 2–3 specific trigger scenarios where the user will revert to prior patterns. For each failure point, all four components are required or the failure point is incomplete:
- Trigger condition — specific and observable (not "when things get hard" — name the actual scenario)
- Default behavior — pulled directly from behavioral evidence in prior scans
- Why it happens — the mechanism (identity pull, energy depletion, approval-seeking, timing collapse — name it precisely)
- Pre-committed interrupt — an action, not a mindset shift. The interrupt must reference a specific person, tool, or constraint already present in the user''s system. An interrupt with no named accountability mechanism is invalid.

If failure points are vague, the entire execution plan is invalid.

5. Enforcement Mechanism
Self-policing is not enforcement. Define an external, observable accountability structure:
- Who reviews (a specific person or role — not "an accountability partner")
- What gets reviewed (specific outputs from the 30-day plan)
- At what cadence (specific day and frequency)
- What the consequence of misalignment is (specific and pre-committed — not "reassess")

The enforcement mechanism must be operational before the 30-day plan begins. If it is not in place on Day 1, the plan does not start.

CLOSING GATE
The final statement must reference the load-bearing constraint identified in Section 1 and the specific enforcement mechanism from Section 5. If it can be written without those references, it is invalid.
Format: "If this path is executed with [specific enforcement mechanism] in place, [user] moves from [current fragmented state described by load-bearing constraint] to [coherent trajectory tied to Life Vision configuration], enabling [specific measurable outcome] — contingent on [specific failure point interrupt] holding at [specific trigger condition]."'
WHERE product_slug = 'declaration-rite-strategic-path';
