/**
 * Write brain/content/topical-map-queue.md: the next pieces to make, from brain/content/topical-map.json.
 * Pure file I/O (no database, no network). Run after build-topical-map.ts.
 *
 * Flags: --brain-dir <dir> (default $BRAIN_DIR, else ./brain) · --n <count> (default 20) · --stdout
 *
 * Usage: NODE_PATH=$PWD/node_modules node --import tsx scripts/brain/topical-map-queue.ts --brain-dir brain
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { TopicalMap } from '../../src/lib/brain/topical-map-types';
import { loadGraphConfig } from './lib/graph/config';
import { nodeId } from './lib/graph/ids';
import { buildQueue, renderQueueMd, type ProductInfo } from './lib/topical-map/queue';

const args = process.argv.slice(2);
const val = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

function main() {
  const brainDir = path.resolve(val('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');
  const mapPath = path.join(brainDir, 'content/topical-map.json');
  if (!existsSync(mapPath)) throw new Error(`${mapPath} not found: run scripts/brain/build-topical-map.ts first`);
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as TopicalMap;
  const { config } = loadGraphConfig(brainDir);
  const products = new Map<string, ProductInfo>(config.products.map((p) => [nodeId('product', p.slug), { label: p.name, status: p.status ?? 'status unverified' }]));
  const items = buildQueue(map, products, Number(val('--n') ?? 20));
  const md = renderQueueMd(items, map);
  if (args.includes('--stdout')) {
    process.stdout.write(md);
    return;
  }
  const out = path.join(brainDir, 'content/topical-map-queue.md');
  writeFileSync(out, md);
  console.log(`wrote ${out}: ${items.length} pieces`);
  for (const it of items.slice(0, 5)) console.log(`  ${it.rank}. [${it.node.scores.priority}] ${it.node.label} · ${it.format.split(/[.(]/)[0]}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
