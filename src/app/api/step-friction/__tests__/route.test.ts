import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before any imports
vi.mock('@/lib/supabase/server');

import { POST } from '../route';
import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase/server';

const AUTHENTICATED_USER = { id: 'user-abc' };
const SESSION_ROW = { user_id: 'user-abc' };

const VALID_BODY = {
  productSessionId: '00000000-0000-0000-0000-000000000001',
  productSlug: 'quantum-initiation',
  stepIndex: 2,
  reason: 'unclear',
  note: 'Not sure what this step is asking',
  responseExcerpt: 'I was trying to say...',
};

describe('POST /api/step-friction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Authenticated user by default
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: AUTHENTICATED_USER }, error: null }),
      },
    } as any);

    // Default: session belongs to authenticated user, insert succeeds
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSelectEqMaybySingle({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'step_friction_log') {
        return makeInsertSelectSingle({ data: { id: 'friction-uuid-001' }, error: null }) as any;
      }
      return {} as any;
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it('returns 200 with ok and id on success', async () => {
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.id).toBe('friction-uuid-001');
  });

  it('accepts body without optional fields', async () => {
    const req = makeRequest({
      productSessionId: VALID_BODY.productSessionId,
      productSlug: VALID_BODY.productSlug,
      stepIndex: VALID_BODY.stepIndex,
      reason: 'tedious',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('accepts stepIndex of 0 (zero-based steps)', async () => {
    const req = makeRequest({ ...VALID_BODY, stepIndex: 0 });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Auth rejection
  // ---------------------------------------------------------------------------

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    const res = await POST(makeRequest(VALID_BODY));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when session belongs to a different user', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSelectEqMaybySingle({ data: { user_id: 'other-user' }, error: null }) as any;
      }
      return {} as any;
    });

    const res = await POST(makeRequest(VALID_BODY));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/Unauthorized/);
  });

  it('returns 403 when session does not exist', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSelectEqMaybySingle({ data: null, error: null }) as any;
      }
      return {} as any;
    });

    const res = await POST(makeRequest(VALID_BODY));
    const data = await res.json();

    expect(res.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // Validation errors
  // ---------------------------------------------------------------------------

  it('returns 400 when productSessionId is missing', async () => {
    const { productSessionId: _omit, ...rest } = VALID_BODY;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/);
  });

  it('returns 400 when stepIndex is not a number', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, stepIndex: 'two' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is an invalid value', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, reason: 'boring' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const { reason: _omit, ...rest } = VALID_BODY;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/step-friction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JSON/);
  });

  // ---------------------------------------------------------------------------
  // DB error propagation
  // ---------------------------------------------------------------------------

  it('returns 500 when insert fails', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSelectEqMaybySingle({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'step_friction_log') {
        return makeInsertSelectSingle({ data: null, error: { message: 'db error' } }) as any;
      }
      return {} as any;
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/log friction/);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/step-friction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Mocks from('table').select(...).eq(...).maybeSingle() */
function makeSelectEqMaybySingle(payload: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(payload);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

/** Mocks from('table').insert(...).select(...).single() */
function makeInsertSelectSingle(payload: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(payload);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert };
}
