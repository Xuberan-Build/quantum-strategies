/**
 * Builds the product_definitions row for The Perception Read from the question list.
 * Pure (no DB) so it can be tested with a fixture. Used by seed-perception-read.ts.
 */
import type { ReadQuestion } from '../../src/lib/read/types';
import { READ_PRODUCT_SLUG } from '../../src/lib/read/types';

export interface PerceptionReadRow {
  product_slug: string;
  name: string;
  description: string;
  price: number;
  is_free: boolean;
  requires_auth: boolean;
  requires_chart: boolean;
  is_purchasable: boolean;
  experience_kind: 'read';
  estimated_duration: string;
  total_steps: number;
  steps: ReadQuestion[];
  system_prompt: string;
  final_deliverable_prompt: string;
}

export function buildPerceptionReadRow(questions: readonly ReadQuestion[]): PerceptionReadRow {
  if (!questions.length) throw new Error('READ_QUESTIONS is empty');
  const ids = new Set<string>();
  for (const q of questions) {
    if (!q.id || ids.has(q.id)) throw new Error(`Duplicate or missing question id: ${q.id}`);
    ids.add(q.id);
  }
  // JSON round trip: plain data only (what jsonb stores), sorted by display order.
  const steps = (JSON.parse(JSON.stringify(questions)) as ReadQuestion[]).sort((a, b) => a.order - b.order);
  return {
    product_slug: READ_PRODUCT_SLUG,
    name: 'The Perception Read',
    description:
      'Free. Twelve questions about what you did and said this month: where last week went, the pattern your answers repeat, and one thing to try this week.',
    price: 0,
    is_free: true,
    requires_auth: false,
    requires_chart: false,
    is_purchasable: false,
    experience_kind: 'read',
    estimated_duration: '5 minutes',
    total_steps: steps.length,
    steps,
    // NOT NULL columns. The Read is scored in code (src/lib/read); there is no product prompt.
    system_prompt: '',
    final_deliverable_prompt: '',
  };
}
