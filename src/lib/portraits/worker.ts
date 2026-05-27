/**
 * Portrait Extraction Worker
 *
 * processPortraitUpdate(queueId) is the canonical extraction entry point.
 * It is called by the cron worker at /api/cron/portrait-extraction-queue,
 * which drains portrait_update_queue every 5 minutes. Do not call this
 * function from any other HTTP request path — enqueue into
 * portrait_update_queue and let the cron pick it up.
 *
 * Remaining TODOs (now that async mode is live):
 *   1. Implement advisory locks (pg_try_advisory_lock on user_id) if
 *      multiple concurrent cron workers are ever added.
 *   2. FOR UPDATE SKIP LOCKED on the claim step would allow safe
 *      parallelism within a single cron invocation; currently the cron
 *      processes rows sequentially to avoid model rate-limit spikes.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { openai } from '@/lib/openai/client';
import {
  ExtractionResultSchema,
  StoredSectionsSchema,
  SECTION_NAMES,
  type ExtractionResult,
  type PortraitFact,
  type PortraitSection,
  type StoredSections,
} from './schema';

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const PORTRAIT_EXTRACTION_SYSTEM_PROMPT = `You extract structured updates to a user portrait from a briefing plus the user's responses.

RULES:
1. Output ONLY valid JSON. No prose.
2. Every populated section MUST include evidence — short verbatim quotes.
3. If no direct evidence for a section, OMIT it entirely. Don't fabricate.
4. Use the user's exact language. Quote, don't paraphrase.

Sections (omit any you can't ground):
- identity: who they are / are being seen as / their broadcast
- values: what they actually prioritize (revealed vs. stated)
- energy: what fuels vs. drains, natural operating mode
- activity: current life shape, work, role, stage
- results: what's happening (income, output, satisfaction)
- path: direction, vision, commitments

For each populated section: stated (their words), revealed (what behavior implies), summary (one sentence), evidence (1+ quotes), confidence (0-1), source_product, source_briefing_id, set_at.`;

// ---------------------------------------------------------------------------
// Types for DB rows (only the columns we need)
// ---------------------------------------------------------------------------

interface QueueRow {
  id: string;
  user_id: string;
  briefing_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

interface BriefingRow {
  id: string;
  user_id: string;
  product_session_id: string;
  product_slug: string;
  full_text: string;
}

interface ConversationRow {
  step_number: number;
  messages: Array<{ role: string; content: string; type?: string }>;
}

interface PortraitRow {
  user_id: string;
  sections: Record<string, unknown>;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmptySection(): PortraitSection {
  return { current: null, prior: [], transitions: [] };
}

/**
 * Merge one ExtractionResult into the existing StoredSections.
 * Returns the updated sections object and the list of section names that
 * were actually changed (for audit log writing).
 */
function mergeSections(
  existing: StoredSections,
  extracted: ExtractionResult,
  briefingId: string,
  productSlug: string,
): { updated: StoredSections; changedSections: Array<{ name: string; old: PortraitFact | null; next: PortraitFact }> } {
  const now = new Date().toISOString();
  const updated: StoredSections = { ...existing };
  const changedSections: Array<{ name: string; old: PortraitFact | null; next: PortraitFact }> = [];

  for (const sectionName of SECTION_NAMES) {
    const newFact = extracted[sectionName];
    if (!newFact) continue; // model did not return this section — leave it alone

    const existingSection: PortraitSection = existing[sectionName] ?? buildEmptySection();
    const currentFact = existingSection.current;

    // Determine if the fact actually changed. We compare the "revealed" field
    // as the primary signal; fall back to summary, then stated.
    const hasChanged =
      currentFact === null ||
      currentFact.revealed !== newFact.revealed ||
      currentFact.summary !== newFact.summary ||
      currentFact.stated !== newFact.stated;

    if (!hasChanged) continue;

    const nextSection: PortraitSection = {
      current: newFact,
      prior: currentFact ? [...existingSection.prior, currentFact] : existingSection.prior,
      transitions:
        currentFact !== null
          ? [
              ...existingSection.transitions,
              {
                from: currentFact,
                to: newFact,
                detected_at: now,
                source_product: productSlug,
              },
            ]
          : existingSection.transitions,
    };

    updated[sectionName] = nextSection;
    changedSections.push({ name: sectionName, old: currentFact, next: newFact });
  }

  return { updated, changedSections };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function processPortraitUpdate(queueId: string): Promise<void> {
  // ------------------------------------------------------------------
  // 1. Claim the queue row: read current attempts, then mark processing.
  // Two steps: SELECT to get attempts, then UPDATE with attempts+1.
  // (PostgREST does not support column expressions like attempts+1 in
  //  the update payload, so we read first and compute in JS.)
  // ------------------------------------------------------------------
  const { data: queueRead, error: queueFetchError } = await supabaseAdmin
    .from('portrait_update_queue')
    .select('id, user_id, briefing_id, status, attempts, max_attempts')
    .eq('id', queueId)
    .single();

  if (queueFetchError || !queueRead) {
    // Row may have been deleted or already processed by a concurrent worker.
    console.error('[portraits/worker] Failed to fetch queue row', queueId, queueFetchError);
    return;
  }

  const queue = queueRead as QueueRow;

  // ------------------------------------------------------------------
  // max_attempts guard — if the row has already exhausted its retries,
  // permanently fail it here without running extraction. The cron also
  // checks this before calling us, but the guard here defends against
  // direct calls and race conditions.
  // ------------------------------------------------------------------
  if (queue.attempts >= queue.max_attempts) {
    console.error(
      '[portraits/worker] Queue row', queueId,
      'has exhausted max_attempts (', queue.max_attempts, '). Marking failed.',
    );
    await supabaseAdmin
      .from('portrait_update_queue')
      .update({
        status: 'failed',
        error_message: `Exhausted max_attempts (${queue.max_attempts}) without successful extraction`,
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueId);
    return;
  }

  const { error: claimError } = await supabaseAdmin
    .from('portrait_update_queue')
    .update({
      status: 'processing',
      attempts: queue.attempts + 1,
      processing_started_at: new Date().toISOString(),
    })
    .eq('id', queueId);

  if (claimError) {
    console.error('[portraits/worker] Failed to claim queue row', queueId, claimError);
    return;
  }

  try {
    // ------------------------------------------------------------------
    // 2. Load briefing + product_session for context
    // ------------------------------------------------------------------
    const { data: briefing, error: briefingError } = await supabaseAdmin
      .from('briefings')
      .select('id, user_id, product_session_id, product_slug, full_text')
      .eq('id', queue.briefing_id)
      .single();

    if (briefingError || !briefing) {
      throw new Error(`Briefing not found: ${queue.briefing_id}`);
    }

    const b = briefing as BriefingRow;

    // ------------------------------------------------------------------
    // 3. Load conversations for user responses
    // ------------------------------------------------------------------
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('step_number, messages')
      .eq('session_id', b.product_session_id)
      .order('step_number', { ascending: true });

    const userResponses = ((conversations ?? []) as ConversationRow[])
      .flatMap((c) =>
        (c.messages ?? [])
          .filter((m) => m.role === 'user')
          .map((m) => `Step ${c.step_number}: ${m.content}`),
      )
      .join('\n');

    // ------------------------------------------------------------------
    // 4. Load current user_portraits row (or default to empty)
    // ------------------------------------------------------------------
    const { data: portraitRow } = await supabaseAdmin
      .from('user_portraits')
      .select('user_id, sections, updated_at')
      .eq('user_id', queue.user_id)
      .maybeSingle();

    // Coerce stored sections through Zod — silently drops invalid keys.
    const existingParseResult = StoredSectionsSchema.safeParse(
      (portraitRow as PortraitRow | null)?.sections ?? {},
    );
    const existingSections: StoredSections = existingParseResult.success
      ? existingParseResult.data
      : {};

    // Capture updated_at for optimistic concurrency.
    const snapshotUpdatedAt: string | null = (portraitRow as PortraitRow | null)?.updated_at ?? null;

    // ------------------------------------------------------------------
    // 5. Call gpt-4o-mini for extraction
    // ------------------------------------------------------------------
    const userMessage = [
      `product_slug: ${b.product_slug}`,
      `briefing_id: ${b.id}`,
      ``,
      `--- BRIEFING ---`,
      b.full_text,
      ``,
      `--- USER RESPONSES ---`,
      userResponses || '(no conversation responses recorded)',
    ].join('\n');

    let rawContent: string;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PORTRAIT_EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      rawContent = completion.choices[0]?.message?.content ?? '{}';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI call failed: ${message}`);
    }

    // ------------------------------------------------------------------
    // Parse and validate with Zod
    // ------------------------------------------------------------------
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error('Model returned non-JSON output');
    }

    const extractionResult = ExtractionResultSchema.safeParse(parsed);
    if (!extractionResult.success) {
      throw new Error(
        `Extraction schema validation failed: ${extractionResult.error.message}`,
      );
    }

    const extracted: ExtractionResult = extractionResult.data;

    // ------------------------------------------------------------------
    // 6. Merge into portrait sections with current -> prior promotion
    // ------------------------------------------------------------------
    const { updated: newSections, changedSections } = mergeSections(
      existingSections,
      extracted,
      b.id,
      b.product_slug,
    );

    // ------------------------------------------------------------------
    // 7. Write user_portraits with optimistic concurrency (retry once)
    // ------------------------------------------------------------------
    const persistPortrait = async (): Promise<boolean> => {
      if (snapshotUpdatedAt !== null) {
        // Row exists — optimistic UPDATE: only applies if updated_at hasn't moved.
        const { data, error } = await supabaseAdmin
          .from('user_portraits')
          .update({
            sections: newSections,
            last_extracted_at: new Date().toISOString(),
          })
          .eq('user_id', queue.user_id)
          .eq('updated_at', snapshotUpdatedAt)
          .select('updated_at');

        if (error) {
          console.error('[portraits/worker] Portrait update error:', error);
          return false;
        }
        // 0 rows returned means the optimistic lock missed.
        if (!data || (data as unknown[]).length === 0) {
          return false;
        }
        return true;
      }

      // Row does not exist yet — INSERT via upsert.
      const { error } = await supabaseAdmin
        .from('user_portraits')
        .upsert(
          {
            user_id: queue.user_id,
            sections: newSections,
            last_extracted_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (error) {
        console.error('[portraits/worker] Portrait upsert error:', error);
        return false;
      }
      return true;
    };

    let writeOk = await persistPortrait();
    if (!writeOk) {
      // Retry once: re-read the portrait to get the latest updated_at.
      console.warn('[portraits/worker] Optimistic lock miss on user_id', queue.user_id, '— retrying once');
      const { data: reread } = await supabaseAdmin
        .from('user_portraits')
        .select('sections, updated_at')
        .eq('user_id', queue.user_id)
        .maybeSingle();

      // On retry we don't re-merge; we just overwrite with our computed sections
      // (last-writer-wins is acceptable given the queue serialises per user).
      if (reread) {
        const { error: retryError } = await supabaseAdmin
          .from('user_portraits')
          .update({
            sections: newSections,
            last_extracted_at: new Date().toISOString(),
          })
          .eq('user_id', queue.user_id)
          .eq('updated_at', (reread as PortraitRow).updated_at);

        if (retryError) {
          throw new Error(`Portrait update retry failed: ${retryError.message}`);
        }
        writeOk = true;
      } else {
        // Row truly doesn't exist — INSERT via upsert.
        const { error: insertError } = await supabaseAdmin
          .from('user_portraits')
          .upsert(
            {
              user_id: queue.user_id,
              sections: newSections,
              last_extracted_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );
        if (insertError) {
          throw new Error(`Portrait upsert failed: ${insertError.message}`);
        }
      }
    }

    // ------------------------------------------------------------------
    // 8. Write portrait_audit_log (direction='write') for each change
    // ------------------------------------------------------------------
    if (changedSections.length > 0) {
      const auditRows = changedSections.map(({ name, old: oldFact, next: nextFact }) => ({
        user_id: queue.user_id,
        briefing_id: b.id,
        direction: 'write' as const,
        section: name,
        field_path: 'current',
        old_value: oldFact ? (oldFact as unknown as Record<string, unknown>) : null,
        new_value: nextFact as unknown as Record<string, unknown>,
        actor_id: null,
      }));

      const { error: auditError } = await supabaseAdmin
        .from('portrait_audit_log')
        .insert(auditRows);

      if (auditError) {
        // Audit failure is non-fatal — log and continue.
        console.error('[portraits/worker] Failed to write audit log:', auditError);
      }
    }

    // ------------------------------------------------------------------
    // 9. Update briefing: structured_extract, extraction_status, extracted_at
    // ------------------------------------------------------------------
    const { error: briefingUpdateError } = await supabaseAdmin
      .from('briefings')
      .update({
        structured_extract: extracted as unknown as Record<string, unknown>,
        extraction_status: 'completed',
        extracted_at: new Date().toISOString(),
      })
      .eq('id', b.id);

    if (briefingUpdateError) {
      // Non-fatal: portrait was written; don't fail the queue item over this.
      console.error('[portraits/worker] Failed to update briefing status:', briefingUpdateError);
    }

    // ------------------------------------------------------------------
    // 10. Mark queue completed
    // ------------------------------------------------------------------
    await supabaseAdmin
      .from('portrait_update_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[portraits/worker] Processing failed for queue', queueId, message);

    await supabaseAdmin
      .from('portrait_update_queue')
      .update({
        status: 'failed',
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    // Do not re-throw — the API route treats a failed queue item as a
    // non-fatal outcome and returns the queue status to the caller.
  }
}
