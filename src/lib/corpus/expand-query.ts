import OpenAI from 'openai';

const FAST_MODEL = 'gpt-4o-mini';

// Tradition-specific synonym vocabulary the model can draw from
const TRADITION_VOCAB = `
Taoism: wu wei, tao, te, ziran, wuji, taiji, yin-yang, ming, de, jing, shen, qi, emptiness, non-action, natural flow
Kabbalah: ein sof, tzimtzum, sefirot, keter, chokmah, binah, tiferet, yesod, malkuth, klipoth, tikkun, devekut, hitbonenut
Tantra: shakti, shiva, kundalini, prana, nadis, chakra, bindu, samadhi, spanda, pratyabhijna, recognition, turiya
Sufism: fana, baqa, hal, maqam, tawakkul, fanaa, qalb, ruh, kashf, mahabbah, annihilation, subsistence, stations
Christian Mysticism: apophatic, cataphatic, kenosis, theosis, via negativa, dark night, purgation, illumination, union, deification, contemplation
Hermeticism: as above so below, nous, logos, pleroma, pneuma, hypostasis, emanation, the All, hermetic chain, correspondence
Rosicrucianism: invisible college, philosopher's stone, chymical wedding, solve et coagula, paracelsus, alchemy, transmutation
Science: REBUS model, predictive processing, default mode network, gamma coherence, integrated information theory, neuroplasticity, altered states, psychedelic
Buddhism: sunyata, dependent origination, anatta, nirvana, dukkha, bodhi, dharma, sangha, rigpa, dzogchen, mahamudra
Hinduism: brahman, atman, maya, lila, sat-chit-ananda, dharma, moksha, prajna, turiya, samadhi, advaita`;

export interface QueryExpansion {
  queries: string[];          // 3-4 search strings to embed and run
  tradition_bridges: string[]; // cross-tradition concepts surfaced
  raw_terms: string[];        // synonym expansions of the original
}

export async function expandQuery(
  openai: OpenAI,
  userQuery: string,
  brief: { title?: string | null; audience?: string | null; goal?: string | null; angle?: string | null; tradition_filter?: string | null }
): Promise<QueryExpansion> {
  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [{
      role: 'user',
      content: `You are a semantic search expert for a sacred text corpus. Your job is to expand a research query into multiple precise search strings that will surface relevant passages across traditions — including passages that use completely different vocabulary to describe the same concept.

CONTENT BRIEF:
Title: ${brief.title ?? 'not provided'}
Audience: ${brief.audience ?? 'not provided'}
Goal: ${brief.goal ?? 'not provided'}
Angle: ${brief.angle ?? 'not provided'}
Primary tradition: ${brief.tradition_filter ?? 'all traditions'}

USER QUERY: "${userQuery}"

TRADITION VOCABULARY REFERENCE:
${TRADITION_VOCAB}

Generate:
1. queries: 3-4 search strings optimized for embedding similarity against sacred texts. Each should use different vocabulary to capture distinct facets of the concept. Include at least one that uses tradition-specific terms (fana, wu wei, kenosis, tzimtzum, etc). Keep each to 5-10 words.
2. tradition_bridges: 3-5 cross-tradition concept names (e.g. "ego dissolution", "surrender to source") that link the query across different vocabularies
3. raw_terms: 5-8 individual keyword synonyms/expansions of the user query

Return JSON: { "queries": [], "tradition_bridges": [], "raw_terms": [] }
Return ONLY valid JSON.`,
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 350,
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    return {
      queries: (parsed.queries ?? []).slice(0, 4),
      tradition_bridges: (parsed.tradition_bridges ?? []).slice(0, 5),
      raw_terms: (parsed.raw_terms ?? []).slice(0, 8),
    };
  } catch {
    // Fallback: return the raw query as-is
    return { queries: [userQuery], tradition_bridges: [], raw_terms: [] };
  }
}

export interface RankedChunk {
  chunk_id: string;
  score: number;       // 0–10
  reason: string;      // one sentence why this passage is relevant
}

export async function rerankChunks(
  openai: OpenAI,
  brief: { title?: string | null; angle?: string | null; goal?: string | null },
  chunks: Array<{ id: string; tradition: string; text_name: string; content: string }>,
  userQuery: string
): Promise<RankedChunk[]> {
  if (chunks.length === 0) return [];

  // Send only first 120 chars per chunk to keep tokens minimal
  const chunkList = chunks
    .map((c, i) => `[${i}] id:${c.id} (${c.tradition} — ${c.text_name.replace(/_/g, ' ')})\n"${c.content.slice(0, 120).replace(/\n/g, ' ')}..."`)
    .join('\n\n');

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [{
      role: 'user',
      content: `You are ranking sacred text passages for relevance to a content piece.

CONTENT PIECE:
Title: ${brief.title ?? ''}
Angle: ${brief.angle ?? ''}
Goal: ${brief.goal ?? ''}
Query: "${userQuery}"

PASSAGES TO RANK:
${chunkList}

Score each passage 0–10 for how useful it would be as source material for this content piece.
- 9–10: Directly addresses the core concept; highly quotable
- 7–8: Strong thematic resonance; good supporting material
- 5–6: Tangentially related; background context only
- 0–4: Not relevant

Return JSON: { "rankings": [{ "id": "chunk_uuid", "score": 8, "reason": "one sentence why" }] }
Only include passages with score >= 5. Return ONLY valid JSON.`,
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 600,
    temperature: 0.1,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    return (parsed.rankings ?? []) as RankedChunk[];
  } catch {
    return [];
  }
}
