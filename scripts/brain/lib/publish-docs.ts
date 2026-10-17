/**
 * Publish the brain docs named in brain/docs.json to the private `brain` bucket:
 *   docs/<slug>.json          latest version (overwritten)
 *   docs/<slug>/<hash>.json   every version ever published (never overwritten or deleted)
 *   docs/index.json           title, path, hash, updatedAt, brainCommit, versions
 * Each doc file is a JSON envelope { slug, path, hash, brainCommit, markdown } because the
 * bucket only accepts application/json.
 *
 * brain/docs.json: { "docs": ["gtm/free-quiz-spec.md", "research/language/*.md", ...] }
 * `*` matches file names within one folder. Missing files are skipped quietly, so a doc
 * can be listed before it exists.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { docSlug, docTitle, isSafeId, matchManifestPattern, mergeDocIndex } from '../../../src/lib/brain/archive';
import { BRAIN_DOC_INDEX_PATH, DocIndexSchema, docLatestPath, docVersionPath, type DocFile, type DocIndex, type DocIndexEntry } from '../../../src/lib/brain/snapshot';
import { downloadText, ensurePrivateBucket, serviceClient, uploadText } from './storage';

export const DOCS_MANIFEST = 'docs.json';

const ManifestSchema = z.object({ docs: z.array(z.string().min(1)) });

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function brainGit(brainDir: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', ['-C', brainDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Resolve manifest patterns to existing brain-relative .md paths. */
export function resolveManifest(brainDir: string, patterns: string[]): string[] {
  const out = new Set<string>();
  for (const raw of patterns) {
    const pattern = raw.replace(/^\/+/, '').replace(/^brain\//, '');
    if (pattern.includes('..')) continue;
    const folder = path.posix.dirname(pattern);
    const abs = path.join(brainDir, folder);
    if (!existsSync(abs)) continue;
    const candidates = readdirSync(abs)
      .filter((n) => n.endsWith('.md'))
      .map((n) => (folder === '.' ? n : `${folder}/${n}`));
    for (const p of matchManifestPattern(pattern, candidates)) out.add(p);
  }
  return [...out];
}

export interface PublishDocsResult {
  published: number;
  newVersions: number;
  skipped: string[];
  index: DocIndex | null;
}

export async function publishDocs(opts: {
  brainDir: string;
  upload: boolean;
  commit?: string;
  log?: (msg: string) => void;
}): Promise<PublishDocsResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const manifestPath = path.join(opts.brainDir, DOCS_MANIFEST);
  if (!existsSync(manifestPath)) {
    log(`docs: no ${DOCS_MANIFEST} in ${opts.brainDir}; nothing to publish`);
    return { published: 0, newVersions: 0, skipped: [], index: null };
  }
  const manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const paths = resolveManifest(opts.brainDir, manifest.docs);
  const commit = opts.commit ?? brainGit(opts.brainDir, ['rev-parse', 'HEAD']);
  const now = new Date().toISOString();

  const skipped: string[] = [];
  const fresh: (Omit<DocIndexEntry, 'versions'> & { markdown: string })[] = [];
  const slugs = new Set<string>();
  for (const rel of paths) {
    const slug = docSlug(rel);
    if (!isSafeId(slug) || slugs.has(slug)) {
      skipped.push(`${rel}: slug "${slug}" is unsafe or duplicated`);
      continue;
    }
    slugs.add(slug);
    const abs = path.join(opts.brainDir, rel);
    const markdown = readFileSync(abs, 'utf8');
    const updatedAt = brainGit(opts.brainDir, ['log', '-1', '--format=%cI', '--', rel]) ?? statSync(abs).mtime.toISOString();
    fresh.push({
      slug,
      title: docTitle(markdown, rel),
      path: rel,
      hash: contentHash(markdown),
      updatedAt,
      publishedAt: now,
      ...(commit ? { brainCommit: commit } : {}),
      bytes: Buffer.byteLength(markdown),
      markdown,
    });
  }
  for (const s of skipped) log(`doc skipped: ${s}`);
  log(`docs: ${fresh.length} to publish from ${manifest.docs.length} manifest pattern(s)`);

  const strip = (d: (typeof fresh)[number]) => {
    const { markdown: _markdown, ...rest } = d;
    void _markdown;
    return rest;
  };

  if (!opts.upload) return { published: 0, newVersions: 0, skipped, index: mergeDocIndex(null, fresh.map(strip), now) };

  const sb = serviceClient();
  await ensurePrivateBucket(sb);
  let remote: DocIndex | null = null;
  const remoteText = await downloadText(sb, BRAIN_DOC_INDEX_PATH);
  if (remoteText) {
    const parsed = DocIndexSchema.safeParse(JSON.parse(remoteText));
    if (parsed.success) remote = parsed.data;
    else throw new Error('remote docs/index.json failed validation; refusing to overwrite it');
  }

  // The bucket only accepts application/json, so each version is a small JSON envelope.
  let newVersions = 0;
  for (const doc of fresh) {
    const envelope = JSON.stringify({ slug: doc.slug, path: doc.path, hash: doc.hash, brainCommit: doc.brainCommit, markdown: doc.markdown } satisfies DocFile);
    const res = await uploadText(sb, docVersionPath(doc.slug, doc.hash), envelope, 'application/json', false);
    if (res === 'uploaded') newVersions++;
    await uploadText(sb, docLatestPath(doc.slug), envelope, 'application/json');
  }
  const index = mergeDocIndex(remote, fresh.map(strip), now);
  await uploadText(sb, BRAIN_DOC_INDEX_PATH, JSON.stringify(index, null, 2), 'application/json');
  log(`uploaded ${fresh.length} doc(s), ${newVersions} new version(s) + ${BRAIN_DOC_INDEX_PATH} (${index.docs.length} in index)`);
  return { published: fresh.length, newVersions, skipped, index };
}
