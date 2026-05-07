import { NextRequest, NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { queue_id, source_url, raw_text, tradition_tags } = body ?? {};

  if (!queue_id && !source_url && !raw_text) {
    return NextResponse.json(
      { error: 'One of queue_id, source_url, or raw_text is required' },
      { status: 400 }
    );
  }

  // ── Resolve source text ───────────────────────────────────────────────────
  let textToEvaluate = raw_text ?? '';
  let resolvedUrl = source_url ?? null;
  let resolvedTraditionTags: string[] = tradition_tags ?? [];

  if (queue_id) {
    const { data: queueRow, error: qErr } = await supabaseAdmin
      .from('corpus_ingestion_queue')
      .select('*')
      .eq('id', queue_id)
      .single();

    if (qErr || !queueRow) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    textToEvaluate = queueRow.raw_text ?? '';
    resolvedUrl = queueRow.source_url ?? null;
    resolvedTraditionTags = queueRow.tradition_tags ?? [];

    // Mark as evaluating
    await supabaseAdmin
      .from('corpus_ingestion_queue')
      .update({ status: 'evaluating' })
      .eq('id', queue_id);
  }

  // If we have a URL but no text, fetch it
  if (resolvedUrl && !textToEvaluate) {
    try {
      const fetchRes = await fetch(resolvedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuantumStrategies/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (fetchRes.ok) {
        const html = await fetchRes.text();
        textToEvaluate = stripHtml(html).slice(0, 4000);
      }
    } catch (err) {
      console.warn('[source-evaluator] URL fetch failed:', err);
    }
  }

  if (!textToEvaluate) {
    return NextResponse.json({ error: 'Could not retrieve source text' }, { status: 422 });
  }

  const excerpt = textToEvaluate.slice(0, 3500);

  // ── Evaluate with model ───────────────────────────────────────────────────
  let result: {
    quality_score: number;
    recommendation: 'approve' | 'reject';
    reasoning: string;
    suggested_tradition_tags: string[];
  };

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 600,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are a corpus quality evaluator for a knowledge base covering: identity psychology, NLP, neuroscience, behavioral influence, and spiritual/philosophical traditions (Taoism, Kabbalah, Sufism, Tantra, Christian Mysticism, Hermeticism, Buddhism, Hinduism).

Score the provided text across four dimensions (0.0–1.0 each), then produce a weighted overall score:
1. Depth (0.25 weight): Does it go beyond surface-level? Does it cite mechanisms, practices, or original concepts?
2. Citation quality (0.25 weight): Does it reference sources, studies, lineages, or named practitioners?
3. Tradition accuracy (0.25 weight): If it claims to represent a tradition, is it accurate and non-appropriative?
4. Corpus relevance (0.25 weight): Does it address identity, state, behavior, influence, or the named traditions?

Recommend 'approve' if overall score >= 0.60, else 'reject'.
Suggest up to 3 tradition_tags from: taoism, kabbalah, tantra, sufism, christian_mysticism, hermeticism, rosicrucianism, science, buddhism, hinduism, qs_doctrine

Return JSON:
{
  "quality_score": 0.0–1.0,
  "recommendation": "approve" | "reject",
  "reasoning": "2-3 sentence explanation of the scores",
  "suggested_tradition_tags": ["tag1"]
}`,
        },
        {
          role: 'user',
          content: `${resolvedUrl ? `SOURCE URL: ${resolvedUrl}\n\n` : ''}CLAIMED TRADITION TAGS: ${resolvedTraditionTags.join(', ') || 'none specified'}

TEXT TO EVALUATE:
${excerpt}`,
        },
      ],
    });

    result = JSON.parse(completion.choices[0].message.content ?? '{}');
  } catch (err: any) {
    if (queue_id) {
      await supabaseAdmin
        .from('corpus_ingestion_queue')
        .update({ status: 'pending' })
        .eq('id', queue_id);
    }
    console.error('[source-evaluator]', err);
    return NextResponse.json({ error: 'Evaluation failed', detail: err?.message }, { status: 500 });
  }

  // ── Update queue record if applicable ────────────────────────────────────
  if (queue_id) {
    try {
      await supabaseAdmin
        .from('corpus_ingestion_queue')
        .update({
          status: result.recommendation === 'approve' ? 'approved' : 'rejected',
          quality_score: result.quality_score,
          evaluator_output: result,
          rejection_reason: result.recommendation === 'reject' ? result.reasoning : null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', queue_id);
    } catch { /* corpus_ingestion_queue not yet migrated */ }
  }

  return NextResponse.json({ queue_id: queue_id ?? null, ...result });
}
