/**
 * Lift candidate insights out of a published article (content_posts) with Claude.
 * Returns candidates for Austin to review; nothing is saved here (POST /insights/bulk saves the accepted ones).
 * Lines are lifted from the article, never invented: each candidate is checked against the article text.
 */
import { generateText, parseJsonReply } from '@/lib/ai/generate';
import { buildVoiceSystemPrompt, getVoicePack } from '@/lib/content/voice-pack';
import { isUuid, type Db } from './graph';

export interface InsightCandidate {
  line: string;
  /** Section heading the line came from. */
  source_ref: string | null;
  /** Factual claim with its cited source, if the line states a fact. */
  claim: string | null;
  claim_source: string | null;
  /** Share of the line's words found in the article (0..1). */
  grounding: number;
}

export interface ExtractResult {
  post: { id: string; slug: string; title: string };
  candidates: InsightCandidate[];
}

export class ExtractError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'ExtractError';
  }
}

const MAX_BODY_CHARS = 60_000;
const MIN_GROUNDING = 0.6;

/** House rule: no em dashes. Spaced dashes become commas; a digit range keeps an en dash as "to". */
export function stripEmDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/^,\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Markdown/MDX body → plain text with "## Heading" markers kept, so the model can name sections. */
export function articleToSections(body: string): { heading: string; text: string }[] {
  const lines = body
    .replace(/<[^>]+>/g, ' ')                  // inline html / mdx components
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')        // images
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 ($2)') // keep link targets: they are the cited sources
    .split('\n');
  const sections: { heading: string; text: string }[] = [];
  let current = { heading: 'Introduction', text: '' };
  for (const raw of lines) {
    const m = raw.match(/^#{1,4}\s+(.+?)\s*#*\s*$/);
    if (m) {
      if (current.text.trim()) sections.push(current);
      current = { heading: m[1].replace(/[*_`]/g, '').trim(), text: '' };
      continue;
    }
    current.text += `${raw.replace(/[*_`>]/g, '').trimEnd()}\n`;
  }
  if (current.text.trim()) sections.push(current);
  return sections.map((s) => ({ heading: s.heading, text: s.text.replace(/\n{3,}/g, '\n\n').trim() }));
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).map((w) => w.replace(/'/g, '')).filter((w) => w.length > 3);
}

/** Share of the line's content words that appear in the article. */
export function groundingScore(line: string, articleWords: Set<string>): number {
  const ws = words(line);
  if (!ws.length) return 0;
  return ws.filter((w) => articleWords.has(w)).length / ws.length;
}

const nullable = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = stripEmDashes(v).slice(0, max);
  return t ? t : null;
};

/** Clean, ground-check and dedupe the model's reply. Exported for tests. */
export function cleanCandidates(raw: unknown, articleText: string, headings: string[]): InsightCandidate[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { candidates?: unknown })?.candidates) ? (raw as { candidates: unknown[] }).candidates : [];
  const articleWords = new Set(words(articleText));
  const headingByLower = new Map(headings.map((h) => [h.toLowerCase(), h]));
  const seen = new Set<string>();
  const out: InsightCandidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const line = nullable(c.line, 600);
    if (!line || line.length < 12) continue;
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    const grounding = Math.round(groundingScore(line, articleWords) * 100) / 100;
    if (grounding < MIN_GROUNDING) continue; // not in the article: invented or paraphrased too far
    seen.add(key);
    const ref = nullable(c.source_ref, 500);
    const claimText = nullable(c.claim, 1200);
    const claimSource = nullable(c.claim_source, 500);
    out.push({
      line,
      source_ref: ref ? headingByLower.get(ref.toLowerCase()) ?? ref : null,
      claim: claimText ? (claimSource && !claimText.includes(claimSource) ? `${claimText} (source: ${claimSource})` : claimText) : null,
      claim_source: claimText ? claimSource : null,
      grounding,
    });
    if (out.length >= 12) break;
  }
  return out;
}

const ROLE = `You are pulling the insight bank out of one of Austin's published articles. An insight is one idea in one sentence, in Austin's own words, that a Short, a carousel, an X line or a Reddit answer could carry on its own.

Rules:
- Return 5 to 12 insights. Fewer is fine when the article holds fewer real ideas.
- Lift each line from the article. Keep his words and phrasing; only trim filler or join a split sentence. Never write a new idea, never summarise, never add a claim the article doesn't make.
- One sentence each. No em dashes.
- source_ref is the exact section heading the line comes from (from the "## " markers).
- If the line states a fact (a study, a number, a mechanism attributed to research), put that fact in claim and the source the article cites for it in claim_source (author, publication or url, as the article gives it). If the article cites no source, claim_source is null. If the line is a belief or a practice, claim and claim_source are null.

Reply with JSON only: {"candidates":[{"line":"...","source_ref":"...","claim":null,"claim_source":null}]}`;

/** Load the article and ask Claude for candidate insight lines. Does not save. */
export async function extractInsightsFromArticle(client: Db, postId: string): Promise<ExtractResult> {
  if (!isUuid(postId)) throw new ExtractError('postId must be a uuid');
  const { data: post, error } = await client
    .from('content_posts')
    .select('id, slug, title, excerpt, body')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!post) throw new ExtractError('Article not found', 404);
  const body = String(post.body ?? '');
  if (body.trim().length < 200) throw new ExtractError('The article has too little text to extract from');

  const sections = articleToSections(body);
  const articleText = [post.title, post.excerpt ?? '', ...sections.map((s) => `${s.heading}\n${s.text}`)].join('\n\n');
  const prompt = `ARTICLE: ${post.title}\n\n${sections.map((s) => `## ${s.heading}\n${s.text}`).join('\n\n')}`.slice(0, MAX_BODY_CHARS);

  const pack = await getVoicePack();
  const system = buildVoiceSystemPrompt(pack, { role: ROLE });
  const reply = await generateText({
    tier: 'standard',
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 3000,
    json: true,
    timeoutMs: 120_000,
  });

  let parsed: unknown;
  try {
    parsed = parseJsonReply(reply.text);
  } catch {
    throw new ExtractError('Claude did not return candidates in the expected shape; try again', 502);
  }
  return {
    post: { id: post.id, slug: post.slug, title: post.title },
    candidates: cleanCandidates(parsed, articleText, sections.map((s) => s.heading)),
  };
}
