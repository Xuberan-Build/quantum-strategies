-- =====================================================
-- Suppress "Input Requirements" output section across
-- all 7 remaining products (scan-3 already patched).
--
-- Three targeted string replacements per product:
--   1. Rename section header so AI treats it as internal
--   2. Insert "silently" to reinforce the check is private
--   3. Add explicit "begin at Section 1" instruction
--      immediately after the OUTPUT STRUCTURE heading
-- =====================================================

UPDATE product_definitions
SET final_deliverable_prompt =
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          final_deliverable_prompt,
          -- 1. Mark the block as internal
          'INPUT REQUIREMENTS',
          'INPUT CHECK (INTERNAL — DO NOT OUTPUT THIS SECTION)'
        ),
        -- 2a. Standard phrasing
        'Before generating output, confirm you have:',
        'Before generating output, silently confirm you have:'
      ),
      -- 2b. Strategic Path variant
      'Before generating output, confirm you have outputs or synthesis from:',
      'Before generating output, silently confirm you have outputs or synthesis from:'
    ),
    -- 3. Inject the "start at Section 1" rule right after OUTPUT STRUCTURE
    'OUTPUT STRUCTURE',
    'OUTPUT STRUCTURE'
    || E'\n'
    || 'Begin your deliverable immediately with Section 1. Do not output a confirmation header, a requirements checklist, or any preamble. The first line of your output is the Section 1 header.'
  )
WHERE product_slug IN (
  'perception-rite-scan-1',
  'perception-rite-scan-2',
  'perception-rite-scan-4',
  'perception-rite-scan-5',
  'declaration-rite-life-vision',
  'declaration-rite-business-model',
  'declaration-rite-strategic-path'
);
