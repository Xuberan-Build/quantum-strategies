// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildPerceptionReadRow } from '../perception-read-row';
import type { ReadQuestion } from '../../../src/lib/read/types';

const fixture: ReadQuestion[] = [
  { id: 'q2', order: 2, title: 'Two', question: 'Second?', kind: 'multi', required: true, maxPicks: 3, options: [{ value: 'say:a', label: 'A' }] },
  { id: 'q1', order: 1, title: 'One', question: 'First?', kind: 'single', required: true, options: [{ value: 'seg:operator', label: 'Op' }] },
  { id: 'q3', order: 3, title: 'Three', question: 'Third?', kind: 'scale', required: false, scale: { min: 1, max: 10, minLabel: 'lo', maxLabel: 'hi' } },
];

describe('buildPerceptionReadRow', () => {
  it('renders the product row with the contract flags and steps from the questions', () => {
    const row = buildPerceptionReadRow(fixture);
    expect(row).toMatchObject({
      product_slug: 'perception-read',
      name: 'The Perception Read',
      is_free: true,
      requires_auth: false,
      requires_chart: false,
      is_purchasable: false,
      price: 0,
      experience_kind: 'read',
      estimated_duration: '5 minutes',
      total_steps: 3,
    });
    expect(row.steps.map((s) => s.id)).toEqual(['q1', 'q2', 'q3']);
    expect(row.steps[0]).not.toBe(fixture[1]); // plain JSON copy
    expect(row).not.toHaveProperty('is_active'); // set on insert only, by the seed script
  });

  it('rejects empty or duplicate question lists', () => {
    expect(() => buildPerceptionReadRow([])).toThrow();
    expect(() => buildPerceptionReadRow([fixture[0], fixture[0]])).toThrow(/Duplicate/);
  });
});
