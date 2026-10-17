/**
 * Minimal PostgREST + OpenAI helpers for the graph builder (service role; local scripts only).
 * Plain fetch so vectors serialise predictably (see src/lib/corpus/vector-search.ts).
 */

export interface RestEnv {
  url: string;
  key: string;
  openaiKey?: string;
}

export function restEnv(): RestEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key, openaiKey: process.env.OPENAI_API_KEY };
}

const headers = (env: RestEnv, extra: Record<string, string> = {}) => ({
  apikey: env.key,
  Authorization: `Bearer ${env.key}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function retry<T>(f: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await f();
    } catch (e) {
      last = e;
      if (e instanceof Error && /\b4\d\d\b/.test(e.message) && !/\b429\b/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last;
}

export async function restGet<T>(env: RestEnv, pathAndQuery: string): Promise<T[]> {
  return retry(async () => {
    const res = await fetch(`${env.url}/rest/v1/${pathAndQuery}`, { headers: headers(env) });
    if (!res.ok) throw new Error(`GET ${pathAndQuery.split('?')[0]} ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T[];
  });
}

/** Page through a table with Range headers (PostgREST caps rows per request). */
export async function restGetAll<T>(env: RestEnv, pathAndQuery: string, page = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const rows = await retry(async () => {
      const res = await fetch(`${env.url}/rest/v1/${pathAndQuery}`, { headers: headers(env, { Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }) });
      if (!res.ok && res.status !== 416) throw new Error(`GET ${pathAndQuery.split('?')[0]} ${res.status} ${(await res.text()).slice(0, 200)}`);
      return res.status === 416 ? [] : ((await res.json()) as T[]);
    });
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export async function restUpsert(env: RestEnv, table: string, rows: Record<string, unknown>[], onConflict: string, batch = 250): Promise<void> {
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await retry(async () => {
      const res = await fetch(`${env.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: headers(env, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(`UPSERT ${table} ${res.status} ${(await res.text()).slice(0, 300)}`);
    });
  }
}

export async function restDelete(env: RestEnv, table: string, query: string): Promise<number> {
  return retry(async () => {
    const res = await fetch(`${env.url}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: headers(env, { Prefer: 'return=representation' }) });
    if (!res.ok) throw new Error(`DELETE ${table} ${res.status} ${(await res.text()).slice(0, 300)}`);
    const rows = (await res.json()) as unknown[];
    return rows.length;
  });
}

export async function restRpc<T>(env: RestEnv, fn: string, body: Record<string, unknown>): Promise<T> {
  return retry(async () => {
    const res = await fetch(`${env.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(env), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`RPC ${fn} ${res.status} ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  });
}

export const EMBED_MODEL = 'text-embedding-3-small';
/** USD per 1M input tokens for text-embedding-3-small. */
export const EMBED_PRICE_PER_M = 0.02;
/** Rough token estimate (~4 chars per token for English prose). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export async function embedTexts(env: RestEnv, texts: string[], batch = 96): Promise<{ vectors: number[][]; tokens: number }> {
  if (!env.openaiKey) throw new Error('OPENAI_API_KEY missing');
  const vectors: number[][] = [];
  let tokens = 0;
  for (let i = 0; i < texts.length; i += batch) {
    const input = texts.slice(i, i + batch);
    const j = await retry(async () => {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiKey}` },
        body: JSON.stringify({ model: EMBED_MODEL, input }),
      });
      if (!res.ok) throw new Error(`embeddings ${res.status} ${(await res.text()).slice(0, 200)}`);
      return (await res.json()) as { data: { embedding: number[]; index: number }[]; usage?: { total_tokens?: number } };
    });
    vectors.push(...j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    tokens += j.usage?.total_tokens ?? input.reduce((s, t) => s + estimateTokens(t), 0);
  }
  return { vectors, tokens };
}

export function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string' && v.startsWith('[')) return JSON.parse(v) as number[];
  return null;
}

export const vectorLiteral = (v: number[]) => `[${v.join(',')}]`;
