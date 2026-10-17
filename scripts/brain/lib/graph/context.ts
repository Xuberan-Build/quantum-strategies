/** Shared extractor context: brain dir, config, and small file helpers. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { GraphConfig } from './config';

export interface ExtractContext {
  brainDir: string;
  config: GraphConfig;
}

export function readBrain(ctx: ExtractContext, rel: string): string | null {
  const p = path.join(ctx.brainDir, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function readBrainJson<T = unknown>(ctx: ExtractContext, rel: string): T | null {
  const raw = readBrain(ctx, rel);
  return raw === null ? null : (JSON.parse(raw) as T);
}

/** All files under the brain with the given extension, brain-relative, sorted. Skips dot-dirs and config.skip_dirs. */
export function listBrainFiles(ctx: ExtractContext, ext: string, sub = ''): string[] {
  const skip = new Set(ctx.config.skip_dirs.map((d) => d.replace(/\/+$/, '')));
  const out: string[] = [];
  const walk = (relDir: string) => {
    const abs = path.join(ctx.brainDir, relDir);
    if (!existsSync(abs)) return;
    for (const name of readdirSync(abs).sort()) {
      if (name.startsWith('.')) continue;
      const rel = relDir ? `${relDir}/${name}` : name;
      if (skip.has(rel) || skip.has(name)) continue;
      const st = statSync(path.join(abs, name));
      if (st.isDirectory()) walk(rel);
      else if (name.toLowerCase().endsWith(ext)) out.push(rel);
    }
  };
  walk(sub);
  return out;
}
