import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase and the worker before any imports resolve.
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/portraits/worker');

import { GET } from '../route';
import { supabaseAdmin } from '@/lib/supabase/server';
import { processPortraitUpdate } from '@/lib/portraits/worker';

const CRON_SECRET = 'test-cron-secret';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/cron/portrait-extraction-queue', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

/**
 * Build the minimal supabaseAdmin mock chain for the cron route.
 *
 * The route does these Supabase calls in order:
 *   1. select stuck rows    (.from('portrait_update_queue').select(...).eq('status','processing').lt(...))
 *   2. update stuck rows    (.from('portrait_update_queue').update(...).in(...))           [only if stuck rows exist]
 *   3. select pending rows  (.from('portrait_update_queue').select(...).eq('status','pending').order(...).limit(...))
 *   4. update each row      (.from('portrait_update_queue').update(...).eq(...).eq(...))   [per pending row]
 *   5. count remaining      (.from('portrait_update_queue').select('id',{count:'exact',head:true}).eq('status','pending'))
 *
 * fromMocks is a map of call-index -> mock return value so tests can
 * control each call independently.
 */
function makeSupabaseMock({
  stuckRows = [] as Array<{ id: string }>,
  pendingRows = [] as Array<{
    id: string;
    briefing_id: string;
    user_id: string;
    status: string;
    attempts: number;
    max_attempts: number;
    processing_started_at: string | null;
  }>,
  remainingPending = 0,
} = {}) {
  let callIndex = 0;

  vi.mocked(supabaseAdmin.from).mockImplementation((_table: string) => {
    const idx = callIndex++;

    // Call 0: fetch stuck rows
    if (idx === 0) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ data: stuckRows, error: null }),
          }),
        }),
      } as any;
    }

    // Call 1 (only when stuckRows.length > 0): update stuck -> pending
    if (idx === 1 && stuckRows.length > 0) {
      return {
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any;
    }

    // Call for fetching pending rows (index 1 when no stuck, 2 when stuck)
    const pendingFetchIdx = stuckRows.length > 0 ? 2 : 1;
    if (idx === pendingFetchIdx) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: pendingRows, error: null }),
            }),
          }),
        }),
      } as any;
    }

    // Calls for claiming each pending row (one UPDATE per row)
    const claimStartIdx = pendingFetchIdx + 1;
    const claimEndIdx = claimStartIdx + pendingRows.length - 1;
    if (idx >= claimStartIdx && idx <= claimEndIdx) {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      } as any;
    }

    // Last call: count remaining pending
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: remainingPending, error: null }),
      }),
    } as any;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/portrait-extraction-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    vi.mocked(processPortraitUpdate).mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when bearer token is wrong', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret') as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as any);
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Empty queue
  // -------------------------------------------------------------------------

  it('returns { claimed: 0, completed: 0, failed: 0, stuck_reset: 0, remaining_pending: 0 } when queue is empty', async () => {
    makeSupabaseMock({ stuckRows: [], pendingRows: [], remainingPending: 0 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      claimed: 0,
      completed: 0,
      failed: 0,
      stuck_reset: 0,
      remaining_pending: 0,
    });
    expect(processPortraitUpdate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Normal processing
  // -------------------------------------------------------------------------

  it('claims a pending row, calls processPortraitUpdate, returns completed=1', async () => {
    const pendingRow = {
      id: 'queue-row-001',
      briefing_id: 'briefing-001',
      user_id: 'user-001',
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      processing_started_at: null,
    };

    makeSupabaseMock({ pendingRows: [pendingRow], remainingPending: 0 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.claimed).toBe(1);
    expect(body.completed).toBe(1);
    expect(body.failed).toBe(0);
    expect(processPortraitUpdate).toHaveBeenCalledOnce();
    expect(processPortraitUpdate).toHaveBeenCalledWith('queue-row-001');
  });

  // -------------------------------------------------------------------------
  // max_attempts exhausted — worker should NOT be called
  // -------------------------------------------------------------------------

  it('marks row failed without calling worker when attempts >= max_attempts', async () => {
    const exhaustedRow = {
      id: 'queue-row-002',
      briefing_id: 'briefing-002',
      user_id: 'user-002',
      status: 'pending',
      attempts: 3,
      max_attempts: 3,
      processing_started_at: null,
    };

    // For this test we need a slightly different mock because the route issues
    // an UPDATE (fail) instead of UPDATE (claim) + worker call.
    let callIndex = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation((_table: string) => {
      const idx = callIndex++;

      if (idx === 0) {
        // stuck rows fetch
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        } as any;
      }
      if (idx === 1) {
        // pending rows fetch
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [exhaustedRow], error: null }),
              }),
            }),
          }),
        } as any;
      }
      if (idx === 2) {
        // UPDATE to failed
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }
      // count remaining
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      } as any;
    });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.claimed).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.completed).toBe(0);
    expect(processPortraitUpdate).not.toHaveBeenCalled();
  });
});
