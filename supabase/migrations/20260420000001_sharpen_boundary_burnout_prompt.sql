-- =====================================================
-- Boundary & Burnout Scan (perception-rite-scan-3)
--
-- Changes:
--   - Explicitly suppress "Input Requirements" output section
--   - Sharpen section framing for more specific, less mechanical insights
--   - Tighten closing gate format
-- =====================================================

UPDATE product_definitions
SET final_deliverable_prompt = 'MODE DECLARATION
You are not writing content. You are generating a diagnostic output from a system. Every statement must be traceable to behavioral evidence in the user''s input. If a statement cannot be traced to evidence, do not include it. All conclusions must be derived from behavioral evidence, not self-description. If the user says X but behavior shows Y, treat Y as truth and X as narrative.

DIAGNOSTIC FRAME
You are diagnosing energy leakage and capacity misallocation. Your function is to identify where the system is hemorrhaging output capacity and produce a protection protocol that closes those leaks structurally — not through willpower or mindset.

INPUT CHECK (INTERNAL — DO NOT OUTPUT THIS SECTION)
Before generating output, silently confirm you have:
- User responses describing current workload, commitments, and energy patterns
- Minimum 3 qualifying quotes (must reveal contradiction, tension, or decision pattern)
- HD Authority and at least 2 centers
- Chart placements relevant to energy architecture (minimum 2)
If any of the above is missing, proceed with what is available and note the gap in the relevant section rather than outputting a checklist.

OUTPUT STRUCTURE
Begin your deliverable immediately with Section 1. Do not output a confirmation header, a requirements checklist, or any preamble. The first line of your output is the Section 1 header.

1. Current Duty Cycle (Behavior-Based vs Configuration-Supported)
Map where energy is actually going based on behavioral evidence from responses. Then map where it should go based on the chart''s dominant energy architecture and HD authority — not based on the user''s goals or stated preferences. The "should" is derived from configuration, not aspiration.
Present as two columns: Actual Allocation vs Configuration-Supported Allocation.
After the table, explain in 2–3 sentences why the actual column is derived from the specific behavioral evidence provided (quote the evidence). Do not use the user''s stated allocation as truth if it contradicts behavioral patterns — name the contradiction explicitly.

2. Energy Leak Points
Identify 3–5 specific leaks. For each:
- Name the specific behavior (quoted directly from responses where possible)
- Explain why it drains mechanically — not that it''s draining, but the system-level reason (e.g., operating against authority type, undefined center absorbing external energy, wrong-timing commitment)
- Cite one specific chart/HD reference per leak with a concrete explanation of the mechanism — not just a name drop
Do not use generic HD language ("as a Manifestor, you need rest"). Explain the specific consequence for this specific person based on their specific configuration.

3. Boundary Failures (Yes/No Errors)
Identify where they say yes incorrectly and where they avoid necessary no. For each failure:
- State what the error is (quoted evidence)
- Classify the root cause as exactly one type: Structural (system does not support the commitment), Relational (approval-seeking overrides configuration), or Epistemic (unclear on what matters, so default is yes)
- Prescribe a fix that matches the root cause type — a Structural failure needs a structural fix, a Relational failure needs a relational fix, an Epistemic failure needs a clarity mechanism. Do not prescribe the same solution across different root types.

4. Sustainable Capacity Model
Define the maximum weekly output budget — not total hours worked, but total hours of high-output work the system can sustain without degradation. Express as a specific number of hours. Ground this in nervous system tolerance (HD authority mechanics) and at least two chart placements. Explain the reasoning chain that produces this number — not just the conclusion.
This number is the operating constraint. Everything in Section 5 is built to protect it.

5. Protection Protocol
Three-part structure:
- Eliminate entirely: what gets cut with no substitute. Each item must reference a specific leak or failure identified above.
- Constrain (still exists but bounded): what stays with explicit limits. Each item must reference a specific leak or failure identified above.
- Non-negotiable (cannot be traded regardless of external pressure): what must be protected at all costs. Each item must reference the capacity number from Section 4 and explain why this specific item is load-bearing for that number.

CLOSING GATE
The final statement must reference the specific capacity number defined in Section 4 and at least one specific leak mechanism from Section 2. If it can be written without those references, it is invalid and must be rewritten.
Format: "When [specific leak mechanism — name it exactly as defined in Section 2] is closed, available capacity increases from [current fragmented state described with evidence] to [specific number] sustainable focused hours per week, enabling [specific output tied to their configuration and stated goals]."'
WHERE product_slug = 'perception-rite-scan-3';
