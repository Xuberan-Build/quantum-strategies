import { describe, it, expect } from 'vitest';
import { extractFaq, faqJsonLd } from '../faq';

const body = `# Title

Intro paragraph.

## Frequently asked questions

### Is the RAS a filter for my goals?

Not in the way it's sold. See [the hub](/articles/reticular-activating-system/) and **this**.
<!-- VERIFY: note for editors -->

### Why do I keep seeing it?

Because you're set to look for it.

Second paragraph.

## Sources

- Not an answer.
`;

describe('extractFaq', () => {
  it('reads H3 questions and their answers under the FAQ heading', () => {
    const items = extractFaq(body);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      question: 'Is the RAS a filter for my goals?',
      answer: "Not in the way it's sold. See the hub and this.",
    });
    expect(items[1].answer).toBe("Because you're set to look for it. Second paragraph.");
  });

  it('stops at the next H2', () => {
    expect(extractFaq(body).some((i) => i.answer.includes('Not an answer'))).toBe(false);
  });

  it('returns nothing without an FAQ section', () => {
    expect(extractFaq('## Intro\n\n### A heading\n\nText')).toEqual([]);
    expect(faqJsonLd([])).toBeNull();
  });

  it('builds FAQPage JSON-LD', () => {
    const ld = faqJsonLd(extractFaq(body));
    expect(ld?.['@type']).toBe('FAQPage');
    expect(ld?.mainEntity[0].acceptedAnswer.text).toContain("Not in the way");
  });
});
