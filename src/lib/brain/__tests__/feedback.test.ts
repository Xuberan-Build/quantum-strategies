import { describe, expect, it } from 'vitest';
import {
  FeedbackInputSchema,
  FeedbackUpdateSchema,
  feedbackInsertRow,
  feedbackPatch,
  formatInboxEntry,
  idsInInbox,
  type BrainFeedbackRow,
} from '../feedback';

const ID = '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a';

const row = (extra: Partial<BrainFeedbackRow> = {}): BrainFeedbackRow => ({
  id: ID,
  created_at: '2026-10-17T10:00:00Z',
  updated_at: null,
  author_id: null,
  target_type: 'slide',
  target_id: 'deck-1',
  deck_id: 'deck-1',
  slide_id: 's2',
  anchor: null,
  kind: 'change',
  body: 'Line one\nLine two',
  status: 'open',
  resolved_note: null,
  reply: null,
  replied_at: null,
  synced_to_brain_at: null,
  ...extra,
});

describe('FeedbackInputSchema', () => {
  it('accepts slide, deck and doc targets', () => {
    expect(FeedbackInputSchema.safeParse({ target_type: 'slide', target_id: 'deck-1', slide_id: 's1', kind: 'agree', body: 'ok' }).success).toBe(true);
    expect(FeedbackInputSchema.safeParse({ target_type: 'deck', target_id: 'deck-1', kind: 'idea', body: 'ok' }).success).toBe(true);
    expect(
      FeedbackInputSchema.safeParse({
        target_type: 'doc',
        target_id: 'gtm--spec',
        kind: 'question',
        body: 'why?',
        anchor: { headingPath: ['A', 'B'], quote: 'text', versionHash: 'abc', blockId: 'a-b-1', docPath: 'gtm/spec.md' },
      }).success,
    ).toBe(true);
  });

  it('rejects bad kinds, empty bodies, unsafe ids and mismatched fields', () => {
    const ok = { target_type: 'deck', target_id: 'deck-1', kind: 'agree', body: 'x' };
    expect(FeedbackInputSchema.safeParse({ ...ok, kind: 'love' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ...ok, body: '   ' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ...ok, target_id: '../x' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ...ok, target_type: 'slide' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ...ok, slide_id: 's1' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ...ok, anchor: { headingPath: [] } }).success).toBe(false);
  });

  it('maps input to the row shape', () => {
    const slide = feedbackInsertRow(FeedbackInputSchema.parse({ target_type: 'slide', target_id: 'd', slide_id: 's', kind: 'agree', body: ' hi ' }), 'u1');
    expect(slide).toMatchObject({ author_id: 'u1', deck_id: 'd', slide_id: 's', anchor: null, body: 'hi' });
    const doc = feedbackInsertRow(FeedbackInputSchema.parse({ target_type: 'doc', target_id: 'x', kind: 'idea', body: 'b', anchor: { headingPath: ['H'] } }), null);
    expect(doc).toMatchObject({ deck_id: null, slide_id: null, anchor: { headingPath: ['H'] } });
  });
});

describe('feedback updates', () => {
  it('requires something to update and stamps replies', () => {
    expect(FeedbackUpdateSchema.safeParse({}).success).toBe(false);
    expect(FeedbackUpdateSchema.safeParse({ status: 'shipped' }).success).toBe(false);
    const patch = feedbackPatch({ status: 'applied', reply: 'Done.' }, 'T');
    expect(patch).toEqual({ updated_at: 'T', status: 'applied', reply: 'Done.', replied_at: 'T' });
  });
});

describe('inbox formatting', () => {
  it('formats a slide entry with an id marker and quoted body', () => {
    const md = formatInboxEntry(row(), { deckTitles: { 'deck-1': 'Deck One' }, slideTitles: { 'deck-1/s2': 'Slide Two' } });
    expect(md).toContain(`<!-- feedback-id: ${ID} -->`);
    expect(md).toContain('- deck: `deck-1` (Deck One)');
    expect(md).toContain('- slide: `s2` (Slide Two)');
    expect(md).toContain('> Line one\n> Line two');
    expect(idsInInbox(md)).toEqual(new Set([ID]));
  });

  it('formats a doc entry with path, heading path and quote', () => {
    const md = formatInboxEntry(
      row({
        target_type: 'doc',
        target_id: 'gtm--spec',
        deck_id: null,
        slide_id: null,
        kind: 'question',
        anchor: { headingPath: ['Spec', 'Pricing'], quote: 'costs  $9', versionHash: 'abc123', docPath: 'gtm/spec.md' },
      }),
    );
    expect(md).toContain('- doc: `gtm/spec.md` · slug `gtm--spec`');
    expect(md).toContain('- section: Spec > Pricing');
    expect(md).toContain('- quoted: "costs $9"');
    expect(md).toContain('- version: `abc123`');
  });
});

describe('graph node targets', () => {
  it('accepts <type>:<slug> node ids and rejects malformed ones', () => {
    const ok = FeedbackInputSchema.safeParse({ target_type: 'node', target_id: 'problem:sample-problem', kind: 'question', body: 'Why?' });
    expect(ok.success).toBe(true);
    for (const bad of ['no-colon', 'problem:has space', 'problem:a,b', 'problem:../x']) {
      expect(FeedbackInputSchema.safeParse({ target_type: 'node', target_id: bad, kind: 'idea', body: 'x' }).success).toBe(false);
    }
    // A node id is not a valid deck id; decks, slides and docs keep SAFE_ID.
    expect(FeedbackInputSchema.safeParse({ target_type: 'deck', target_id: 'problem:x', kind: 'idea', body: 'x' }).success).toBe(false);
  });

  it('stores node notes without deck/slide/anchor and formats them for the inbox', () => {
    const r = feedbackInsertRow({ target_type: 'node', target_id: 'claim:c1', kind: 'change', body: 'Weak.' }, null);
    expect(r).toMatchObject({ target_type: 'node', target_id: 'claim:c1', deck_id: null, slide_id: null, anchor: null });
    const md = formatInboxEntry(row({ target_type: 'node', target_id: 'claim:c1', deck_id: null, slide_id: null }), {
      nodes: { 'claim:c1': { label: 'Claim one', type: 'claim', sourcePath: 'notes/claims.md' } },
    });
    expect(md).toContain('· node claim:c1');
    expect(md).toContain('- node: `claim:c1` (Claim one)');
    expect(md).toContain('- source: `notes/claims.md`');
    expect(md).toContain(`<!-- feedback-id: ${ID} -->`);
  });
});
