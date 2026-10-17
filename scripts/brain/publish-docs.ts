/**
 * Publish the brain docs listed in brain/docs.json → Storage `brain/docs/<slug>.md`,
 * immutable `docs/<slug>/<hash>.md` versions, and docs/index.json. Never deletes anything.
 * publish-snapshot.ts calls this automatically.
 *
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/publish-docs.ts \
 *     [--brain-dir <dir>] [--commit <sha>] [--no-upload]
 *
 * --brain-dir defaults to $BRAIN_DIR, else ./brain. Exit codes: 0 ok · 4 upload failed.
 */
import path from 'node:path';
import { publishDocs } from './lib/publish-docs';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const brainDir = path.resolve(opt('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');

publishDocs({ brainDir, upload: !args.includes('--no-upload'), commit: opt('--commit') })
  .then((r) => {
    if (r.index) for (const d of r.index.docs) console.log(`  ${d.hash}  ${d.path}  (${d.versions.length} version(s))`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('publish-docs failed:', e instanceof Error ? e.message : e);
    process.exit(4);
  });
