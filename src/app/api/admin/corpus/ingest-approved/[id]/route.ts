import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const EMBED_MODEL = 'text-embedding-3-small';
const MAX_WORDS_PER_CHUNK = 400;

type Params = { params: Promise<{ id: string }> };

function splitIntoChunks(text: string, maxWords: number): string[] {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (wordCount + words > maxWords && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [];
      wordCount = 0;
    }
    current.push(para);
    wordCount += words;
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));

  return chunks.filter((c) => c.trim().length > 0);
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuantumStrategies/1.0 (corpus ingestion)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  const html = await res.text();
  // Strip HTML tags for basic text extraction
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{3,}/g, '\n\n')
    .trim();
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;

  const { data: item, error: fetchErr } = await supabaseAdmin
    .from('corpus_ingestion_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  }
  if (item.status !== 'approved') {
    return NextResponse.json({ error: 'Item must be approved before ingestion' }, { status: 400 });
  }

  // Get text to ingest
  let rawText: string;
  try {
    if (item.raw_text) {
      rawText = item.raw_text;
    } else if (item.source_url) {
      rawText = await fetchUrlText(item.source_url);
    } else {
      return NextResponse.json({ error: 'No text or URL available for ingestion' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to retrieve text: ${(err as Error).message}` }, { status: 422 });
  }

  const chunks = splitIntoChunks(rawText, MAX_WORDS_PER_CHUNK);
  if (chunks.length === 0) {
    return NextResponse.json({ error: 'No content chunks could be extracted' }, { status: 422 });
  }

  // Batch embed all chunks
  const embeddingRes = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: chunks,
  });
  const embeddings = embeddingRes.data.map((d) => d.embedding);

  // Determine tradition from tags
  const tradition = (item.tradition_tags as string[])?.[0] ?? 'qs_doctrine';
  const sourceName = item.source_name ?? item.source_url ?? 'unknown';
  const textName = sourceName
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 60);

  // Insert chunks
  const rows = chunks.map((content, i) => ({
    tradition,
    text_name: textName,
    section: `chunk_${i + 1}`,
    content,
    embedding: embeddings[i],
    source_url: item.source_url ?? null,
    themes: item.tradition_tags ?? [],
    priority: 2,
    content_type: 'synthesis',
  }));

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('knowledge_chunks')
    .insert(rows)
    .select('id');

  if (insertErr) {
    return NextResponse.json({ error: `Chunk insert failed: ${insertErr.message}` }, { status: 500 });
  }

  const chunkIds = (inserted ?? []).map((r) => r.id);

  await supabaseAdmin
    .from('corpus_ingestion_queue')
    .update({
      status: 'ingested',
      ingested_chunk_ids: chunkIds,
      ingested_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({ success: true, chunks_ingested: chunkIds.length, chunk_ids: chunkIds });
}
