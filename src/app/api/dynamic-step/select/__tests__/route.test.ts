import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before any imports
vi.mock('@/lib/supabase/server');

import { POST } from '../route';
import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase/server';

// A minimal session row where user_id matches the authenticated user
const SESSION_ROW = { user_id: 'user-abc', audience_track: 'founder' };

// A minimal question_pool row
const QUESTION_ROW = {
  id: 'q-001',
  prompt_text: 'What drew you to this moment?',
  followup_text: 'Can you say more?',
  prompt_variants: null,
  question_role: 'anchor',
  audience_tracks: ['founder', 'all'],
  signals_extracted: ['clarity', 'resistance'],
};

describe('POST /api/dynamic-step/select', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Authenticated user for every test by default
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } }, error: null }),
      },
    } as any);

    // Default supabaseAdmin table dispatch
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeMaybySingleChain({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'question_pool') {
        return makeSelectEqEqEq({ data: [QUESTION_ROW], error: null }) as any;
      }
      return {} as any;
    });
  });

  it('returns 200 with resolved question on success', async () => {
    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 1,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.questionId).toBe('q-001');
    expect(data.promptText).toBe('What drew you to this moment?');
    expect(data.followupText).toBe('Can you say more?');
    expect(data.audienceTrack).toBe('founder');
    expect(data.signalsToExtract).toEqual(['clarity', 'resistance']);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as any);

    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 1,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when body fields are missing', async () => {
    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({ productSlug: 'quantum-initiation' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/required/);
  });

  it('returns 400 when stepIndex is not a positive integer', async () => {
    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 0,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when session belongs to a different user', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeMaybySingleChain({ data: { user_id: 'other-user', audience_track: null }, error: null }) as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 1,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/Unauthorized/);
  });

  it('returns 404 when no question_pool rows match', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeMaybySingleChain({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'question_pool') {
        return makeSelectEqEqEq({ data: [], error: null }) as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 1,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/No matching question/);
  });

  it('uses prompt_variants when a track key matches', async () => {
    const rowWithVariant = {
      ...QUESTION_ROW,
      prompt_variants: { founder: 'Founder-specific prompt text' },
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeMaybySingleChain({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'question_pool') {
        return makeSelectEqEqEq({ data: [rowWithVariant], error: null }) as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 1,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.promptText).toBe('Founder-specific prompt text');
  });

  it('defaults audienceTrack to "unknown" when session.audience_track is null', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeMaybySingleChain({ data: { user_id: 'user-abc', audience_track: null }, error: null }) as any;
      }
      if (table === 'question_pool') {
        const rowForAll = { ...QUESTION_ROW, audience_tracks: ['all'] };
        return makeSelectEqEqEq({ data: [rowForAll], error: null }) as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/select', {
      method: 'POST',
      body: JSON.stringify({
        productSessionId: 'session-001',
        productSlug: 'quantum-initiation',
        stepIndex: 1,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.audienceTrack).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Helpers — build chainable Supabase query mocks
// ---------------------------------------------------------------------------

/**
 * Mocks from().select().eq().maybeSingle()
 * Used for product_sessions: single .eq() then .maybeSingle().
 */
function makeMaybySingleChain(payload: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(payload);
  const eq1 = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

/**
 * Mocks from().select().eq().eq().eq()
 * Used for question_pool: three chained .eq() calls, last one awaited directly.
 */
function makeSelectEqEqEq(payload: { data: unknown; error: unknown }) {
  const eq3 = vi.fn().mockResolvedValue(payload);
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}
