/** Synthetic architecture for the topical map tests (shape of brain/content/architecture.json, no strategy content). */
import type { Architecture } from '../../../graph/extract-architecture';

export const ARCH = {
  pillars: [
    {
      id: 'P1',
      slug: 'architecture-of-self',
      name: 'Architecture of Self',
      job: 'Make the self-image observable.',
      law: 'You run a picture.',
      misbelief: 'A better story fixes it.',
      product: 'Free quiz, then Rite I',
      subpillars: [
        {
          id: 'P1.1',
          name: 'The self-image servo',
          clusters: [
            {
              id: 'P1.1a',
              name: 'Why you snap back to the old you',
              misbelief: 'Wanting it badly stops the slipping.',
              angle: 'The servo is a model.',
              cornerstone: { id: 'P1.1a-CS', title: 'Why you keep snapping back', format: 'article', cta: 'quiz>I', status: 'TO BUILD', source: 'Roadmap C1 · claims P1, P2' },
              spokes: [
                { id: 'P1.1a-01', title: 'How your self-image runs your life', format: 'long_video', cta: 'quiz>I', status: 'BUILT', source: 'claims P1' },
                { id: 'P1.1a-02', title: 'The loop in one diagram', format: 'short', cta: 'quiz>I', status: 'REFRESH' },
              ],
            },
          ],
        },
      ],
    },
  ],
  spine: {
    id: 'X',
    slug: 'the-spine',
    name: 'The Spine (cross-cutting authority pages)',
    job: 'Authority pages.',
    subpillars: [
      {
        id: 'X.2',
        name: 'Receipts',
        clusters: [
          {
            id: 'X.2a',
            name: 'The Contested File',
            cornerstone: { id: 'X.2a-CS', title: 'The Contested File', cta: 'quiz>I', status: 'TO BUILD' },
            spokes: [{ id: 'X.2a-01', title: 'Claims we retired', cta: 'quiz>I', status: 'TO BUILD' }],
          },
        ],
      },
    ],
  },
} as unknown as Architecture;
