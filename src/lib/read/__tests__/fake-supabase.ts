/**
 * Minimal chainable Supabase fake for store tests. Each table has a queue of responses;
 * every terminal (await / single / maybeSingle) pops the next one. All calls are recorded.
 */
export interface FakeResp {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export function createFakeSupabase() {
  const queues: Record<string, FakeResp[]> = {};
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const rpcQueue: FakeResp[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const resolve = () => Promise.resolve(queues[table]?.shift() ?? { data: null, error: null });
    for (const op of ['select', 'insert', 'update', 'upsert', 'eq', 'neq', 'not', 'in', 'order', 'limit']) {
      b[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return b;
      };
    }
    b.single = resolve;
    b.maybeSingle = resolve;
    b.then = (res: (v: FakeResp) => unknown, rej: (e: unknown) => unknown) => resolve().then(res, rej);
    return b;
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcQueue.shift() ?? { data: null, error: null });
    },
  };

  return {
    client,
    calls,
    rpcCalls,
    queue(table: string, ...resps: FakeResp[]) {
      (queues[table] ??= []).push(...resps);
    },
    queueRpc(...resps: FakeResp[]) {
      rpcQueue.push(...resps);
    },
    reset() {
      for (const k of Object.keys(queues)) delete queues[k];
      calls.length = 0;
      rpcQueue.length = 0;
      rpcCalls.length = 0;
    },
    callsFor(table: string, op?: string) {
      return calls.filter((c) => c.table === table && (!op || c.op === op));
    },
  };
}
