/**
 * Pull question/answer pairs out of an article body for FAQPage JSON-LD.
 *
 * Convention: an H2 whose text starts with "Frequently asked questions" (or "FAQ"),
 * followed by one H3 per question and the answer as the paragraphs under it.
 * The section ends at the next H2 or the end of the body.
 */

export type FaqItem = { question: string; answer: string };

// Markdown to plain text, enough for schema answers: links keep their text,
// emphasis and inline code markers are dropped, HTML comments removed.
function toPlainText(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFaq(body: string): FaqItem[] {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => /^##\s+(frequently asked questions|faqs?)\b/i.test(l.trim()));
  if (start === -1) return [];

  const items: FaqItem[] = [];
  let question: string | null = null;
  let answer: string[] = [];

  const flush = () => {
    const text = toPlainText(answer.join('\n'));
    if (question && text) items.push({ question, answer: text });
  };

  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      question = toPlainText(h3[1]);
      answer = [];
    } else if (question) {
      answer.push(line);
    }
  }
  flush();
  return items;
}

export function faqJsonLd(items: FaqItem[]) {
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}
