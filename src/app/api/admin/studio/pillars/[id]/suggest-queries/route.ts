import { NextResponse } from 'next/server';
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { id } = await params;

  const [pillarRes, corpusCountRes] = await Promise.all([
    supabaseAdmin.from('content_angles').select('title, format, audience, goal, angle, tradition_filter').eq('id', id).single(),
    supabaseAdmin.from('knowledge_chunks').select('id', { count: 'exact', head: true }),
  ]);

  if (pillarRes.error) return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });

  const pillar = pillarRes.data;
  const corpusTotal = corpusCountRes.count ?? 0;

  // Can't suggest without any brief context
  const hasBrief = pillar.title || pillar.goal || pillar.angle;
  if (!hasBrief) {
    return NextResponse.json({ queries: [], corpusTotal });
  }

  const TRADITION_CORPUS: Record<string, string> = {
    taoism:              'Tao Te Ching, Zhuangzi, Neiye, I Ching',
    kabbalah:            'Zohar, Sefer Yetzirah, Sha\'are Orah, Bahir',
    tantra:              'Vijñana Bhairava Tantra, Shiva Sutras, Tantraloka',
    sufism:              'Masnavi (Rumi), Fusus al-Hikam (Ibn Arabi), Conference of the Birds (Attar)',
    christian_mysticism: 'Cloud of Unknowing, Dark Night of the Soul, Meister Eckhart Sermons, Interior Castle',
    hermeticism:         'Corpus Hermeticum, Emerald Tablet, Kybalion',
    rosicrucianism:      'Fama Fraternitatis, Chymical Wedding, Atalanta Fugiens',
    hinduism:            'Vedantic texts, Upanishads',
    buddhism:            'Buddhist sutras, Heart Sutra, Pali Canon',
    science:             'REBUS model (Carhart-Harris), IIT (Tononi), DMN meditation research, gamma coherence studies',
  };

  const traditionHint = pillar.tradition_filter
    ? `Primary tradition: ${pillar.tradition_filter} — corpus includes: ${TRADITION_CORPUS[pillar.tradition_filter] ?? pillar.tradition_filter}`
    : 'All traditions available: Taoism, Kabbalah, Tantra, Sufism, Christian Mysticism, Hermeticism, Rosicrucianism, Buddhism, Hinduism, Science overlay';

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{
      role: 'user',
      content: `You are a research director for Quantum Strategies, a mystical consciousness and transformation company. You're helping surface relevant passages from a sacred text corpus for a content piece.

CONTENT PIECE:
Title: ${pillar.title}
Format: ${pillar.format}
Audience: ${pillar.audience || 'not specified'}
Goal: ${pillar.goal || 'not specified'}
Angle: ${pillar.angle || 'not specified'}

CORPUS: ${traditionHint}

Generate 6 specific corpus search queries that will surface the most relevant passages for this piece. Each query should:
- Be 4-8 keywords or short phrases (not a full sentence)
- Target a distinct thematic angle of the content
- Use terms that appear in mystical/philosophical texts (e.g. "fana annihilation non-self" not "ego dissolution")
- Cover different dimensions: conceptual, practical, experiential, cross-tradition

Return JSON: { "queries": ["query1", "query2", "query3", "query4", "query5", "query6"] }
Return ONLY valid JSON.`,
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 400,
    temperature: 0.5,
  });

  let queries: string[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    queries = Array.isArray(parsed.queries) ? parsed.queries.slice(0, 6) : [];
  } catch { /* return empty */ }

  return NextResponse.json({ queries, corpusTotal });
}
