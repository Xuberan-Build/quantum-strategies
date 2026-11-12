/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory supabase fake */
/** In-memory fake of the supabase query builder: just what the any-to-any modules use. */
type Row = Record<string, any>;
let seq = 0;
export const uuid = (n?: number) => `00000000-0000-4000-8000-${String(n ?? ++seq + 100000).padStart(12, '0')}`;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  calls: { table: string; op: string; args?: unknown }[] = [];
  from(name: string) {
    this.tables[name] ??= [];
    return new Query(this, name, this.tables[name]);
  }
}

const likeToRe = (pattern: string) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');

class Query implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] = {};
  private conflict: string[] = [];
  private max = Infinity;
  private returning = false;
  private mode: 'one' | 'maybe' | null = null;
  constructor(private db: FakeDb, private table: string, private rows: Row[]) {}
  select() { if (this.op !== 'select') this.returning = true; return this; }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; this.db.calls.push({ table: this.table, op: 'insert', args: p }); return this; }
  upsert(p: Row, opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflict = (opts?.onConflict ?? 'id').split(','); this.db.calls.push({ table: this.table, op: 'upsert', args: p }); return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; this.db.calls.push({ table: this.table, op: 'update', args: p }); return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  ilike(c: string, p: string) { const re = likeToRe(p); this.filters.push((r) => re.test(String(r[c] ?? ''))); return this; }
  or(expr: string) {
    const parts = expr.split(',').map((p) => { const [c, , ...rest] = p.split('.'); return { c, re: likeToRe(rest.join('.')) }; });
    this.filters.push((r) => parts.some(({ c, re }) => re.test(String(r[c] ?? ''))));
    return this;
  }
  /** Rough websearch: "quoted phrase" must appear as written; otherwise every word must appear. */
  textSearch(c: string, q: string) {
    const col = c === 'fts_content' ? 'content' : c;
    const phrase = q.match(/^"(.+)"$/)?.[1];
    const words = phrase ? [phrase] : q.split(/\s+/).filter(Boolean);
    this.filters.push((r) => words.every((w) => String(r[col] ?? '').toLowerCase().includes(w.toLowerCase())));
    this.db.calls.push({ table: this.table, op: 'textSearch', args: q });
    return this;
  }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  single() { this.mode = 'one'; return this; }
  private async run(): Promise<{ data: any; error: any }> {
    let out: Row[] | null;
    if (this.op === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) => ({ id: uuid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'active', tags: [], ...r }));
      this.rows.push(...list);
      out = this.returning ? list.map((r) => ({ ...r })) : null;
    } else if (this.op === 'upsert') {
      const p = this.payload as Row;
      const existing = this.rows.find((r) => this.conflict.every((k) => r[k] === p[k]));
      if (existing) Object.assign(existing, p);
      const row = existing ?? { id: uuid(), created_at: new Date().toISOString(), insight_id: null, note: null, ...p };
      if (!existing) this.rows.push(row);
      out = [{ ...row }];
    } else {
      const matched = this.rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'update') {
        matched.forEach((r) => Object.assign(r, this.payload));
        out = this.returning ? matched.map((r) => ({ ...r })) : null;
      } else if (this.op === 'delete') {
        for (const r of matched) this.rows.splice(this.rows.indexOf(r), 1);
        out = this.returning ? matched.map((r) => ({ ...r })) : null;
      } else {
        out = matched.slice(0, this.max).map((r) => ({ ...r }));
      }
    }
    if (this.mode) {
      const first = out?.[0] ?? null;
      if (this.mode === 'one' && !first) return { data: null, error: { message: 'no rows' } };
      return { data: first, error: null };
    }
    return { data: out, error: null };
  }
  then<T, U = never>(res?: (v: any) => T | PromiseLike<T>, rej?: (e: any) => U | PromiseLike<U>) { return this.run().then(res, rej); }
}
