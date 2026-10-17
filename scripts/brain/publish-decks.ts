/**
 * Publish the deck archive: brain/decks/*.json → Storage `brain/decks/<id>.json` + decks/index.json.
 * Never deletes remote decks (retention). publish-snapshot.ts calls this automatically.
 *
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/publish-decks.ts \
 *     [--brain-dir <dir>] [--no-upload]
 *
 * --brain-dir defaults to $BRAIN_DIR, else ./brain. Exit codes: 0 ok · 3 some deck files invalid
 * (valid ones are still published) · 4 upload failed.
 */
import path from 'node:path';
import { publishDecks } from './lib/publish-decks';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const brainDir = path.resolve(opt('--brain-dir') ?? process.env.BRAIN_DIR ?? 'brain');

publishDecks({ dir: path.join(brainDir, 'decks'), upload: !args.includes('--no-upload') })
  .then((r) => {
    if (r.index) for (const d of r.index.decks) console.log(`  ${d.createdAt}  ${d.status.padEnd(10)} ${d.id}  (${d.slideCount} slides)`);
    process.exit(r.invalid.length ? 3 : 0);
  })
  .catch((e) => {
    console.error('publish-decks failed:', e instanceof Error ? e.message : e);
    process.exit(4);
  });
