// @vitest-environment node
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAndExtract, median, planEmbeddings } from '../build';
import { codeIndex, loadGraphConfig, triedBucket } from '../config';
import type { ExtractContext } from '../context';
import { claimRefs, extractArchitecture } from '../extract-architecture';
import { codebookLabels, communityName, extractAudience } from '../extract-audience';
import { extractClaims, ledgerBullets, relatedClaimIds } from '../extract-claims';
import { extractNotes } from '../extract-notes';
import { cardFields, claimIdsIn, extractProblemMap, quotedPhrases } from '../extract-problem-map';
import { expandManifest, extractRecords } from '../extract-records';
import { contentHash, isValidId } from '../ids';
import type { ExtractResult } from '../types';

const BRAIN = path.join(__dirname, 'fixtures', 'brain');
const ctx: ExtractContext = { brainDir: BRAIN, config: loadGraphConfig(BRAIN).config };
const edge = (r: ExtractResult, src: string, type: string, dst: string) => r.edges.find((e) => e.src === src && e.type === type && e.dst === dst);
const node = (r: ExtractResult, id: string) => r.nodes.find((n) => n.id === id);

describe('notes extractor', () => {
  const r = extractNotes(ctx);
  it('makes a note per .md, skipping dot-dirs and skip_dirs', () => {
    const paths = r.nodes.map((n) => n.source_path).sort();
    expect(paths).toContain('README.md');
    expect(paths).toContain('gtm/map.md');
    expect(paths.some((p) => p?.includes('.snapshots'))).toBe(false);
    expect(paths.some((p) => p?.startsWith('graph/'))).toBe(false);
  });
  it('uses the admin doc slug for ids, H1 for label, first paragraph for summary', () => {
    const map = node(r, 'note:gtm--map')!;
    expect(map.label).toBe('Problem map');
    expect(map.summary).toContain('summary of the map');
  });
  it('links wikilinks, markdown links and cited paths; drops unresolved ones', () => {
    expect(edge(r, 'note:readme', 'links_to', 'note:gtm--map')?.props?.kinds).toEqual(['markdown', 'wikilink']);
    expect(edge(r, 'note:readme', 'links_to', 'note:strategy--claims')).toBeTruthy();
    expect(r.edges.some((e) => e.dst.includes('nowhere'))).toBe(false);
    expect(r.warnings?.[0]).toMatch(/did not resolve/);
  });
  it('weights notes by inbound links', () => {
    expect(node(r, 'note:gtm--map')!.weight).toBeGreaterThan(1);
  });
});

describe('architecture extractor', () => {
  const r = extractArchitecture(ctx);
  it('builds the pillar tree with part_of edges', () => {
    expect(node(r, 'pillar:first-pillar')?.props?.code).toBe('P1');
    expect(node(r, 'pillar:the-spine')).toBeTruthy();
    expect(edge(r, 'sub_pillar:p1-1', 'part_of', 'pillar:first-pillar')).toBeTruthy();
    expect(edge(r, 'cluster:p1-1a', 'part_of', 'sub_pillar:p1-1')).toBeTruthy();
    expect(edge(r, 'cornerstone:p1-1a-cs', 'part_of', 'cluster:p1-1a')).toBeTruthy();
    expect(edge(r, 'spoke:p1-1a-01', 'part_of', 'cluster:p1-1a')).toBeTruthy();
  });
  it('links pieces to the claims in their source line and to problems by keyword', () => {
    expect(edge(r, 'cornerstone:p1-1a-cs', 'mentions', 'claim:p1')).toBeTruthy();
    expect(edge(r, 'cornerstone:p1-1a-cs', 'mentions', 'claim:p2')).toBeTruthy();
    expect(edge(r, 'spoke:p1-1a-01', 'mentions', 'problem:stuck-start')).toBeTruthy();
    expect(node(r, 'spoke:p1-1a-01')!.source_path).toBe('content/x.json');
  });
  it('parses claim refs', () => {
    expect(claimRefs('Roadmap C1 · claims P1, P2 and D4')).toEqual(['P1', 'P2', 'D4']);
    expect(claimRefs('script 06')).toEqual([]);
  });
});

describe('problem-map extractor', () => {
  const r = extractProblemMap(ctx);
  it('makes a problem per configured row with counts, label from the quoted phrase', () => {
    const p = node(r, 'problem:stuck-start')!;
    expect(p.label).toBe("I'm stuck at the start");
    expect(p.props?.merged_n).toBe(12);
    expect(p.props?.youtube).toEqual({ n: 8, likes: 1200 });
    expect(node(r, 'problem:out-of-scope')?.props?.guardrail).toBe(true);
  });
  it('mechanism, solution and product edges from the cards', () => {
    expect(edge(r, 'mechanism:stuck-start', 'explains', 'problem:stuck-start')).toBeTruthy();
    expect(edge(r, 'claim:p1', 'supports', 'mechanism:stuck-start')).toBeTruthy();
    expect(edge(r, 'claim:x1', 'supports', 'mechanism:stuck-start')).toBeUndefined();
    expect(edge(r, 'solution_type:stuck-start', 'solves', 'problem:stuck-start')).toBeTruthy();
    expect(edge(r, 'product:scan-a', 'addresses', 'problem:stuck-start')?.props?.later).toBe(false);
    expect(edge(r, 'product:later-thing', 'addresses', 'problem:stuck-start')?.props?.later).toBe(true);
    expect(node(r, 'problem:stuck-start')!.props?.their_words).toEqual(['"I never get going." (5 likes · YouTube)', '"Day one never comes." (HN)']);
  });
  it('quiz routes, belongs_to_pillar, products under rites, tried matrix', () => {
    expect(edge(r, 'problem:stuck-start', 'routes_to', 'product:scan-a')?.props?.pattern).toBe('STUCK_PATTERN');
    expect(edge(r, 'problem:stuck-start', 'belongs_to_pillar', 'pillar:first-pillar')).toBeTruthy();
    expect(edge(r, 'product:scan-a', 'part_of', 'rite:first')).toBeTruthy();
    expect(edge(r, 'claim:p2', 'contradicts', 'solution_type:tried-apps')).toBeTruthy();
    expect(node(r, 'segment:quiz-owner')?.label).toBe('I run a shop');
    expect(r.warnings).toEqual([expect.stringMatching(/GHOST_PATTERN/)]);
  });
  it('helpers', () => {
    expect(claimIdsIn('P1, O2/P3 and X12; not P9x')).toEqual(['P1', 'O2', 'P3', 'X12']);
    expect(quotedPhrases('**"Abc"** / “Bee sting”')).toEqual(['Abc', 'Bee sting']);
    expect(cardFields('**Mechanism QS names.** a b\n\n**Product.** c')).toEqual({ 'mechanism qs names': 'a b', product: 'c' });
  });
});

describe('claims extractor', () => {
  const r = extractClaims(ctx);
  it('claims with tier, strength and kind', () => {
    expect(node(r, 'claim:p1')).toMatchObject({ label: 'People act to stay consistent', tier: 'E1' });
    expect(node(r, 'claim:m1')?.props?.kind).toBe('myth');
    expect(node(r, 'claim:x1')?.props?.kind).toBe('will_not_say');
    expect(node(r, 'claim:p1')?.props?.source_cards).toEqual(['some_card']);
  });
  it('supports / contradicts from evidence and contested bullets; negations ignored', () => {
    expect(edge(r, 'claim:p1', 'supports', 'claim:p2')).toBeTruthy();
    expect(edge(r, 'claim:p1', 'contradicts', 'claim:m1')).toBeTruthy();
    expect(edge(r, 'claim:p2', 'supports', 'claim:p1')).toBeUndefined();
    expect(edge(r, 'claim:p1', 'supports', 'product:scan-a')).toBeTruthy();
  });
  it('helpers', () => {
    expect(relatedClaimIds('Backed by P1. Never cite as support for D1.')).toEqual(['P1']);
    expect(Object.keys(ledgerBullets('- **Evidence:** a\n- **Must NOT be stretched to:** b'))).toEqual(['evidence', 'must not be stretched to']);
  });
});

describe('audience extractor', () => {
  const r = extractAudience(ctx);
  it('quotes voice the merged problems, with weight from likes/score', () => {
    const q = r.nodes.filter((n) => n.type === 'quote');
    expect(q).toHaveLength(5);
    const yt = q.find((n) => n.summary === 'I never get going.')!;
    expect(yt.id).toMatch(/^quote:yt-[0-9a-f]{12}$/);
    expect(yt.weight).toBe(120);
    expect(edge(r, yt.id, 'voices', 'problem:stuck-start')).toBeTruthy();
    expect(edge(r, yt.id, 'voices', 'problem:too-busy')).toBeTruthy();
    expect(edge(r, yt.id, 'from_source', 'source:yt-vid1')).toBeTruthy();
    expect(edge(r, yt.id, 'in_community', 'community:yt-some-channel')).toBeTruthy();
    expect(edge(r, yt.id, 'mentions', 'solution_type:tried-apps')).toBeTruthy();
  });
  it('unknown codes become their own unclustered problem, labelled from the codebook', () => {
    expect(node(r, 'problem:code-brand-new-code')?.props?.clustered).toBe(false);
    expect(node(r, 'problem:code-hop')?.label).toBe('technique hopping');
  });
  it('threads, communities and segments; no usernames', () => {
    expect(node(r, 'community:hackernews-ask-hn')?.label).toBe('Ask HN');
    expect(r.nodes.filter((n) => n.type === 'source' && n.props?.platform === 'hackernews')).toHaveLength(1);
    expect(node(r, 'community:reddit-somesub')?.label).toBe('r/SomeSub');
    expect(edge(r, 'community:reddit-somesub', 'part_of', 'segment:research-some-type')).toBeTruthy();
    expect(edge(r, 'source:yt-vid1', 'part_of', 'creator:some-channel')).toBeTruthy();
    expect(node(r, 'problem:stuck-start')?.props?.quote_count).toBe(3);
  });
  it('helpers', () => {
    expect(communityName('Goodreads: The Secret (1*)')).toBe('Goodreads: The Secret');
    expect(codebookLabels({ codebook_note: 'BLAME (blames the person), HOP (hopping)' }).get('BLAME')).toBe('blames the person');
    expect(codeIndex(ctx.config).get('BUSY')).toBe('too-busy');
    expect(triedBucket(ctx.config, 'Planner apps')).toBe('apps');
    expect(triedBucket(ctx.config, 'therapy')).toBeNull();
  });
});

describe('records extractor', () => {
  const r = extractRecords(ctx);
  it('decisions with decided_in', () => {
    expect(edge(r, 'decision:2026-01-01-founder-decisions-1', 'decided_in', 'note:decisions--2026-01-01-founder-decisions')).toBeTruthy();
    expect(node(r, 'decision:2026-01-01-founder-decisions-2')?.label).toBe('Second decision');
    expect(edge(r, 'decision:2026-01-02-ship-the-fixture', 'decided_in', 'note:journey--log--2026-01-02-fixture')).toBeTruthy();
    expect(edge(r, 'decision:2026-01-03-no-log-entry', 'decided_in', 'note:journey--decisions')).toBeTruthy();
  });
  it('principles with feedback_on, decks and docs with mentions', () => {
    const p = node(r, 'principle:build-from-real-problems')!;
    expect(p.props?.feedback_ids).toEqual(['F-001']);
    expect(edge(r, p.id, 'feedback_on', 'note:gtm--map')).toBeTruthy();
    expect(edge(r, 'deck:2026-01-01-deck', 'mentions', 'note:gtm--map')).toBeTruthy();
    expect(edge(r, 'deck:2026-01-01-deck', 'mentions', 'note:strategy--claims')).toBeTruthy();
    expect(edge(r, 'deck:2026-01-01-deck', 'mentions', 'problem:stuck-start')).toBeTruthy();
    expect(edge(r, 'deck:2026-01-01-deck', 'mentions', 'pillar:first-pillar')).toBeTruthy();
    expect(edge(r, 'deck:2026-01-01-deck', 'mentions', 'product:scan-a')).toBeTruthy();
    expect(edge(r, 'doc:gtm--map', 'mentions', 'note:gtm--map')).toBeTruthy();
    expect(edge(r, 'doc:gtm--map', 'mentions', 'problem:stuck-start')).toBeTruthy();
  });
  it('expands the docs manifest', () => {
    expect(expandManifest(ctx, ['gtm/*.md', 'missing/file.md']).sort()).toEqual(['gtm/map.md', 'gtm/quiz.md']);
  });
});

describe('full extraction', () => {
  const { graph } = loadAndExtract(BRAIN);
  it('every id is valid and every edge endpoint exists', () => {
    for (const id of graph.nodes.keys()) expect(isValidId(id), id).toBe(true);
    const dangling = [...graph.edges.values()].filter((e) => !graph.nodes.has(e.src) || !graph.nodes.has(e.dst));
    expect(dangling.map((e) => `${e.src}>${e.dst}`)).toEqual([]);
  });
  it('problem-map labels win over audience defaults, and extractors are recorded', () => {
    const p = graph.nodes.get('problem:stuck-start')!;
    expect(p.label).toBe("I'm stuck at the start");
    expect(p.props?.extractors).toEqual(['audience', 'problem-map']);
    expect(p.props?.quote_count).toBe(3);
  });
  it('plans embeddings from stored hashes', () => {
    const nodes = [...graph.nodes.values()];
    const first = planEmbeddings(nodes, new Map());
    expect(first.cached).toHaveLength(0);
    expect(first.toEmbed.every((n) => ['problem', 'claim', 'mechanism', 'note'].includes(n.type))).toBe(true);
    const hashes = new Map(first.toEmbed.map((n) => [n.id, n.props!.embed_hash_wanted as string]));
    const second = planEmbeddings(nodes, hashes);
    expect(second.toEmbed).toHaveLength(0);
    expect(second.costUsd).toBe(0);
    expect(contentHash('a')).toHaveLength(64);
  });
  it('median', () => {
    expect(median([0.5, 0.7, 0.6])).toBe(0.6);
    expect(median([0.5, 0.7])).toBeCloseTo(0.6);
    expect(median([])).toBeNull();
  });
});
