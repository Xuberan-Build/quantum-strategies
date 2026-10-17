/**
 * Graph config. The strategy-specific mappings (which research codes merge into which problem,
 * which pillar a problem belongs to, product names, link keywords) live in the PRIVATE brain at
 * <brain>/graph/config.json. This file only defines the shape.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const ProblemCfg = z.object({
  row: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  codes: z.array(z.string()).default([]),
  pillars: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  guardrail: z.boolean().optional(),
});

export const GraphConfigSchema = z.object({
  version: z.number().default(1),
  problem_map: z.string().default('gtm/problem-solution-map.md'),
  quiz_spec: z.string().default('gtm/free-quiz-spec-v2.md'),
  claims: z.string().default('strategy/thesis-evidence-map.md'),
  architecture: z.string().default('content/architecture.json'),
  audience: z.array(z.object({ path: z.string(), kind: z.enum(['youtube', 'forum', 'reddit']) })).default([]),
  problems: z.array(ProblemCfg).default([]),
  rites: z.array(z.object({ slug: z.string(), name: z.string(), status: z.string().optional() })).default([]),
  products: z
    .array(z.object({ slug: z.string(), name: z.string(), rite: z.string().optional(), status: z.string().optional(), aliases: z.array(z.string()).default([]) }))
    .default([]),
  tried: z.array(z.object({ slug: z.string(), row: z.string().optional(), codes: z.array(z.string()) })).default([]),
  skip_dirs: z.array(z.string()).default(['.snapshots', 'node_modules']),
});
export type GraphConfig = z.infer<typeof GraphConfigSchema>;
export type ProblemConfig = z.infer<typeof ProblemCfg>;

export function loadGraphConfig(brainDir: string, override?: string): { config: GraphConfig; path: string | null } {
  const p = override ?? path.join(brainDir, 'graph', 'config.json');
  if (!existsSync(p)) return { config: GraphConfigSchema.parse({}), path: null };
  const parsed = GraphConfigSchema.safeParse(JSON.parse(readFileSync(p, 'utf8')));
  if (!parsed.success) throw new Error(`invalid graph config ${p}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return { config: parsed.data, path: p };
}

/** code (case-sensitive, with any " (new)" suffix stripped) -> problem slug */
export function codeIndex(config: GraphConfig): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of config.problems) for (const c of p.codes) m.set(normCode(c), p.slug);
  return m;
}

export const normCode = (c: string) => c.replace(/\s*\(new\)\s*$/i, '').trim();

/** First tried bucket whose substring matches the free-text `tried` value. */
export function triedBucket(config: GraphConfig, tried: string): string | null {
  const t = tried.toLowerCase();
  for (const b of config.tried) if (b.codes.some((c) => t.includes(c.toLowerCase()))) return b.slug;
  return null;
}
