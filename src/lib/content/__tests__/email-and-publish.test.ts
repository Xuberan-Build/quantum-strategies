import { describe, it, expect } from 'vitest';
import { parseEmailSequence, parseSingleEmail, textToEmailHtml, MIN_EMAIL_BODY_WORDS } from '../email-sequence';
import { nextPublishedAt, postTypeForPiece, resolvePillarId, sanitizeMarkdownForMdx } from '../publish';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('parseEmailSequence', () => {
  it('parses the marked full-email format', () => {
    const text = [1, 2].map((n) => `=== EMAIL ${n} ===\nPURPOSE: value\nSUBJECT: Subject ${n}\nPREVIEW: Preview ${n}\nBODY:\n${words(200)}\n\nSecond paragraph.`).join('\n\n');
    const emails = parseEmailSequence(text);
    expect(emails).toHaveLength(2);
    expect(emails[1]).toMatchObject({ index: 2, purpose: 'value', subject: 'Subject 2', preview: 'Preview 2', isSummary: false });
    expect(emails[0].body).toContain('Second paragraph.');
    expect(emails[0].body).not.toContain('SUBJECT');
  });

  it('flags legacy 150-200 word summaries so they are not loaded as bodies', () => {
    const legacy = `EMAIL 1 — [Purpose: welcome]\nSUBJECT: Hi\nPREVIEW: p\nBODY: [${words(60)}]\n\nEMAIL 2 — value\nSUBJECT: Next\nPREVIEW: q\nBODY: ${words(MIN_EMAIL_BODY_WORDS - 1)}`;
    const emails = parseEmailSequence(legacy);
    expect(emails).toHaveLength(2);
    expect(emails.every((e) => e.isSummary)).toBe(true);
    expect(emails[0].purpose).toBe('welcome');
  });

  it('returns no emails for unstructured text', () => {
    expect(parseEmailSequence('just some text')).toEqual([]);
  });

  it('strips header lines from a single email', () => {
    const email = parseSingleEmail(`SUBJECT: Hello\nPREVIEW: Short\n\n${words(150)}`);
    expect(email.subject).toBe('Hello');
    expect(email.body.startsWith('word0')).toBe(true);
  });

  it('escapes HTML when converting to an email body', () => {
    expect(textToEmailHtml('a <b>\n\nc & d')).toBe('<p>a &lt;b&gt;</p>\n<p>c &amp; d</p>');
  });
});

describe('publish helpers', () => {
  it('maps only article-shaped pieces to a post type', () => {
    expect(postTypeForPiece('blog')).toBe('blog');
    for (const t of ['social_twitter', 'social_linkedin', 'social_ig', 'email', 'email_sequence', 'gpt_product', 'video_script']) {
      expect(postTypeForPiece(t)).toBeNull();
    }
  });

  it('sets published_at on first publish and on republish after unpublish, keeps the original otherwise', () => {
    expect(nextPublishedAt(true, null, 'NOW')).toBe('NOW');
    expect(nextPublishedAt(true, '2026-01-01', 'NOW')).toBe('2026-01-01');
    expect(nextPublishedAt(false, '2026-01-01', 'NOW')).toBeNull();
  });

  it('takes the pillar from the topic, else from angle metadata', () => {
    const uuid = '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a';
    expect(resolvePillarId('topic-pillar', { pillar_id: uuid })).toBe('topic-pillar');
    expect(resolvePillarId(null, { pillar_id: uuid })).toBe(uuid);
    expect(resolvePillarId(null, { pillar_id: 'not-a-uuid' })).toBeNull();
    expect(resolvePillarId(null, null)).toBeNull();
  });

  it('escapes MDX-breaking characters outside code, leaves code alone', () => {
    const input = 'Use {braces} and <Tag> here.\nimport x from "y"\n\n```js\nconst a = {b: 1} < 2;\n```\n\nInline `{ok}` stays.';
    const out = sanitizeMarkdownForMdx(input);
    expect(out).toContain('Use \\{braces\\} and &lt;Tag> here.');
    expect(out).toContain('&#105;mport x from "y"');
    expect(out).toContain('const a = {b: 1} < 2;');
    expect(out).toContain('`{ok}`');
  });
});
