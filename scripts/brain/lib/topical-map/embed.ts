/**
 * Embedding cache for the topical map: text-embedding-3-small vectors keyed by sha256(model + text), stored as
 * base64 float32 in scripts/research/.cache/topical-map/embeddings.jsonl (gitignored, append-only).
 * A rebuild only embeds text it hasn't seen.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EMBED_MODEL, EMBED_PRICE_PER_M, embedTexts, type RestEnv } from '../graph/rest';

export const textHash = (text: string) => createHash('sha256').update(`${EMBED_MODEL}\n${text}`).digest('hex').slice(0, 32);

const encode = (v: number[]) => Buffer.from(Float32Array.from(v).buffer).toString('base64');
const decode = (s: string) => {
  const b = Buffer.from(s, 'base64');
  return Array.from(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4));
};

export class EmbedCache {
  private vectors = new Map<string, number[]>();
  tokens = 0;
  embedded = 0;
  hits = 0;

  constructor(readonly file: string) {
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line) as { h: string; v: string };
          this.vectors.set(j.h, decode(j.v));
        } catch {
          /* skip a torn line */
        }
      }
    }
  }

  get(text: string): number[] | undefined {
    return this.vectors.get(textHash(text));
  }

  /** Embed every text not cached yet (needs env.openaiKey). Returns text -> vector for all inputs. */
  async ensure(env: RestEnv, texts: string[]): Promise<Map<string, number[]>> {
    const uniq = [...new Set(texts.filter((t) => t.trim()))];
    const missing = uniq.filter((t) => !this.vectors.has(textHash(t)));
    this.hits += uniq.length - missing.length;
    if (missing.length) {
      const { vectors, tokens } = await embedTexts(env, missing);
      mkdirSync(path.dirname(this.file), { recursive: true });
      const lines: string[] = [];
      missing.forEach((t, i) => {
        const h = textHash(t);
        this.vectors.set(h, vectors[i]);
        lines.push(JSON.stringify({ h, v: encode(vectors[i]) }));
      });
      appendFileSync(this.file, `${lines.join('\n')}\n`);
      this.tokens += tokens;
      this.embedded += missing.length;
    }
    const out = new Map<string, number[]>();
    for (const t of uniq) {
      const v = this.vectors.get(textHash(t));
      if (v) out.set(t, v);
    }
    return out;
  }

  get costUsd(): number {
    return (this.tokens / 1e6) * EMBED_PRICE_PER_M;
  }
}

/** Unit-normalise in place (cosine becomes a dot product). */
export function unit(v: number[]): Float32Array {
  const f = Float32Array.from(v);
  let n = 0;
  for (let i = 0; i < f.length; i++) n += f[i] * f[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < f.length; i++) f[i] /= n;
  return f;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
