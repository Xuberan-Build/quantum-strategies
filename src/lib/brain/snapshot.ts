import { z } from 'zod';

/**
 * Brain Snapshot — the contract between the brain tick and /admin/brain.
 *
 * The second brain lives in a private repo (Xuberan-Build/quantum-brain) as markdown.
 * The local brain tick distils it into this JSON and uploads it to the private
 * Supabase Storage bucket `brain` at `snapshots/latest.json` (plus a dated copy).
 * The admin reads it server-side with the service role. Nothing in the public
 * app repo contains brain content.
 */

export const BRAIN_BUCKET = 'brain';
export const BRAIN_LATEST_PATH = 'snapshots/latest.json';

export const RiteSchema = z.enum(['perception', 'orientation', 'declaration']);
export const PillarSlugSchema = z.enum([
  'architecture-of-self',
  'value-as-waveform',
  'direction-over-outcome',
  'state-engineering',
  'anchored-ascended',
]);

const TagsSchema = z.object({
  rite: RiteSchema.optional(),
  pillar: PillarSlugSchema.optional(),
  domain: z.string().optional(),
});

export const QuoteSchema = z.object({
  text: z.string().max(400),
  source: z.string(), // e.g. "<creator> · YouTube comment", "Beta user", "Forum"
  likes: z.number().int().nonnegative().optional(),
  url: z.string().url().optional(),
});

export const StatSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  delta: z.string().optional(), // e.g. "+31x", "-12%"
  note: z.string().optional(),
});

export const SlideSchema = z.object({
  id: z.string(),
  kind: z.enum(['headline', 'stats', 'quotes', 'bars', 'list', 'comparison']),
  title: z.string(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  stats: z.array(StatSchema).optional(),
  quotes: z.array(QuoteSchema).optional(),
  bars: z.array(z.object({ label: z.string(), value: z.number(), note: z.string().optional() })).optional(),
  bullets: z.array(z.string()).optional(),
  comparison: z
    .object({
      left: z.object({ heading: z.string(), points: z.array(z.string()) }),
      right: z.object({ heading: z.string(), points: z.array(z.string()) }),
    })
    .optional(),
  tags: TagsSchema.optional(),
  sources: z.array(z.string()).optional(), // brain-relative paths backing this slide
});

/**
 * Voice pack: the runtime voice contract every content generator loads (via
 * src/lib/content/voice-pack.ts). Built by the brain tick from the private voice
 * sources. Optional so snapshots without it stay valid.
 */
export const VoicePackSchema = z.object({
  version: z.string(), // e.g. "2026-10-16" or the language doc's version
  voiceRules: z.array(z.string()).min(1),
  canon: z.array(z.object({ term: z.string(), meaning: z.string(), use: z.string(), avoid: z.string() })),
  bannedTerms: z.array(z.string()), // lowercase exact phrases a checker can match
  handleWithCare: z.array(z.object({ term: z.string(), rule: z.string() })),
  ctaSpamPatterns: z.array(z.string()), // phrases or regex sources (case-insensitive)
  outcomeTimeboxPatterns: z.array(z.string()), // phrases or regex sources (case-insensitive)
  identity: z.object({
    brand: z.string(),
    identityTerm: z.string(), // the identity the reader becomes
    stages: z.array(z.string()), // ordered journey stages that lead to it
    audience: z.string(),
    positioning: z.string(),
  }),
  chartPolicy: z.string(),
  systemPreamble: z.string(),
  // AI-prose tells to flag in generated copy: phrases or regex sources (case-insensitive).
  // Added 2026-10; older snapshots omit it.
  aiProsePatterns: z.array(z.string()).optional(),
});

export const DeckSchema = z.object({
  id: z.string(),
  title: z.string(),
  period: z.string(), // e.g. "2026-W42" or "2026-10-16"
  summary: z.string(),
  slides: z.array(SlideSchema).min(1),
});

const CoverageSchema = z.object({
  covered: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  pct: z.number().min(0).max(100),
});

export const CorpusBridgeSchema = z.object({
  asOf: z.string(), // date of the corpus-links run
  tierFilter: z.enum(['evidence_tiers', 'unfiltered']), // unfiltered = coverage is an upper bound
  coverage: CoverageSchema.extend({
    claimsPct: z.number().min(0).max(100).optional(),
    topicsPct: z.number().min(0).max(100).optional(),
  }),
  byPillar: z.array(CoverageSchema.extend({ pillar: PillarSlugSchema, medianBest: z.number().nullable().optional() })),
  topGaps: z.array(
    z.object({
      label: z.string(),
      kind: z.enum(['claim', 'topic', 'query']),
      pillar: PillarSlugSchema.optional(),
      bestSimilarity: z.number().nullable().optional(),
    }),
  ),
  chunksByTier: z.record(z.string(), z.number().int().nonnegative()), // tier -> chunks, or { total } before tiers exist
  note: z.string().optional(),
});

export const BrainSnapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(), // ISO datetime
  brainCommit: z.string().optional(), // quantum-brain commit the snapshot was built from

  decks: z.array(DeckSchema).min(1), // newest first; decks[0] is the current briefing

  marketVoice: z.object({
    pillars: z.array(
      z.object({
        pillar: PillarSlugSchema,
        pains: z.array(z.string()),
        desires: z.array(z.string()),
        objections: z.array(z.string()),
        quotes: z.array(QuoteSchema),
        evidence: z.object({ sources: z.number().int(), items: z.number().int() }),
      }),
    ),
    enemy: z.object({ summary: z.string(), quotes: z.array(QuoteSchema) }),
  }),

  creators: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      followers: z.number().int().nullable(),
      medianViews: z.number().nullable(),
      stance: z.string(), // one line: how they relate to QS (ally, contrast, adjacent)
      outliers: z.array(
        z.object({ id: z.string(), title: z.string(), views: z.number(), outlier: z.number(), tags: TagsSchema.optional() }),
      ),
      takeaways: z.array(z.string()),
    }),
  ),

  taxonomy: z.object({
    rites: z.array(z.object({ slug: RiteSchema, title: z.string(), move: z.string() })),
    pillars: z.array(
      z.object({ slug: PillarSlugSchema, title: z.string(), rite: RiteSchema, belief: z.string(), lazyVersion: z.string() }),
    ),
    domains: z.array(z.object({ slug: z.string(), title: z.string() })),
    topics: z.array(
      z.object({ title: z.string(), pillar: PillarSlugSchema, domain: z.string(), angles: z.number().int(), proposed: z.boolean().optional() }),
    ),
    status: z.enum(['proposal', 'approved']),
  }),

  customers: z.object({
    asOf: z.string(),
    counts: z.record(z.string(), z.number()),
    topPains: z.array(z.object({ label: z.string(), count: z.number() })),
    lands: z.array(z.string()),
    stuck: z.array(z.string()),
    quotes: z.array(QuoteSchema),
    caveat: z.string().optional(),
  }),

  hooks: z.array(
    z.object({ text: z.string(), tags: TagsSchema, evidence: z.string().optional(), status: z.enum(['idea', 'validated', 'used']).default('idea') }),
  ),

  journey: z.object({
    eras: z.array(z.object({ title: z.string(), start: z.string(), end: z.string(), summary: z.string() })),
    incidents: z.array(z.object({ date: z.string(), title: z.string(), impact: z.string(), guardrail: z.string() })),
    learnings: z.array(z.object({ theme: z.string(), text: z.string() })),
    openQuestions: z.array(z.object({ group: z.string(), question: z.string() })),
  }),

  sources: z.array(z.object({ path: z.string(), updatedAt: z.string() })),

  voicePack: VoicePackSchema.optional(), // added 2026-10; older snapshots omit it

  corpus: CorpusBridgeSchema.optional(), // corpus <-> brain bridge status; added 2026-10; older snapshots omit it
});

export type BrainSnapshot = z.infer<typeof BrainSnapshotSchema>;
export type BrainDeck = z.infer<typeof DeckSchema>;
export type BrainSlide = z.infer<typeof SlideSchema>;
export type BrainQuote = z.infer<typeof QuoteSchema>;
export type PillarSlug = z.infer<typeof PillarSlugSchema>;
export type Rite = z.infer<typeof RiteSchema>;
export type BrainVoicePack = z.infer<typeof VoicePackSchema>;
export type BrainCorpusBridge = z.infer<typeof CorpusBridgeSchema>;
