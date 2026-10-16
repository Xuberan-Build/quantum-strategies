/**
 * Helpers for publishing studio pieces to content_posts (rendered at /articles/[slug]).
 * Pure functions: safe in tests and on either side.
 */

/** content_posts.type CHECK: 'blog' | 'whitepaper' | 'resource'. */
export type PostType = 'blog' | 'whitepaper' | 'resource';

/**
 * Which piece types can become an article, and as what post type. Social copy,
 * emails, prompts and scripts are not articles and are refused rather than
 * published as a blog post.
 */
const PIECE_TYPE_TO_POST_TYPE: Record<string, PostType> = {
  blog: 'blog',
};

export function postTypeForPiece(pieceType: string): PostType | null {
  return PIECE_TYPE_TO_POST_TYPE[pieceType] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The pillar for a post: the topic's pillar when the angle hangs off a topic, else the
 * `metadata.pillar_id` the new-piece form stores on the angle.
 */
export function resolvePillarId(topicPillarId: string | null | undefined, angleMetadata: unknown): string | null {
  if (topicPillarId) return topicPillarId;
  if (angleMetadata && typeof angleMetadata === 'object' && !Array.isArray(angleMetadata)) {
    const candidate = (angleMetadata as Record<string, unknown>).pillar_id;
    if (typeof candidate === 'string' && UUID.test(candidate)) return candidate;
  }
  return null;
}

/** published_at on (re)publish: keep the original date if there is one, else now. Null when unpublishing. */
export function nextPublishedAt(publish: boolean, existing: string | null | undefined, now: string): string | null {
  if (!publish) return null;
  return existing ?? now;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Makes model-written markdown safe to compile as MDX. Outside code blocks and
 * inline code it escapes `{` `}` (JS expressions) and `<` (JSX/HTML), and defuses
 * line-leading `import`/`export` (ESM). Markdown formatting is left alone.
 */
export function sanitizeMarkdownForMdx(markdown: string): string {
  const text = markdown.replace(/\r\n/g, '\n');
  // Split into fenced code blocks (kept verbatim) and prose.
  const parts = text.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m);
  return parts
    .map((part) => (/^(?:```|~~~)/.test(part) ? part : sanitizeProse(part)))
    .join('');
}

function sanitizeProse(prose: string): string {
  // Keep inline code spans verbatim; escape the rest.
  return prose
    .split(/(`[^`\n]+`)/)
    .map((piece) =>
      piece.startsWith('`') && piece.endsWith('`') && piece.length > 1
        ? piece
        : piece
            .replace(/\\?([{}])/g, '\\$1')
            .replace(/</g, '&lt;')
            .replace(/^([ \t]*)(import|export)\b/gm, (_m, indent: string, word: string) => `${indent}&#${word.charCodeAt(0)};${word.slice(1)}`),
    )
    .join('');
}

/** First ~200 characters of plain text, for the post excerpt. */
export function excerptFrom(markdown: string, max = 200): string {
  const plain = markdown
    .replace(/^#+\s.*$/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
