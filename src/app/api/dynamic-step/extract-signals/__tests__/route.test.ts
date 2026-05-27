import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI before any imports
vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase/server');

// Mock rate-limit helper
vi.mock('@/lib/security/rate-limit');

// Mock input-validation — pass-through by default
vi.mock('@/lib/security/input-validation', () => ({
  validateUserInput: vi.fn((input: string) => ({
    isValid: true,
    sanitized: input,
    warnings: [],
  })),
}));

import { POST } from '../route';
import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase/server';
import { openai } from '@/lib/openai/client';
import { checkRateLimit } from '@/lib/security/rate-limit';

const SESSION_ROW = { user_id: 'user-abc' };

const VALID_BODY = {
  productSessionId: 'session-001',
  stepIndex: 1,
  response: 'I feel resistance but also deep purpose.',
  signalsToExtract: ['resistance', 'purpose', 'clarity'],
};

const OPENAI_SIGNALS = {
  signals: [
    { signal: 'resistance', confidence: 0.9, evidence: 'I feel resistance' },
    { signal: 'purpose', confidence: 0.8, evidence: 'deep purpose' },
  ],
};

describe('POST /api/dynamic-step/extract-signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: rate limit allows requests
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60000 });

    // Authenticated user for every test by default
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } }, error: null }),
      },
    } as any);

    // Default: session belongs to user-abc; session_signals insert succeeds
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSessionChain({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'session_signals') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
      }
      return {} as any;
    });

    // Default: OpenAI returns a valid signal JSON object
    vi.mocked(openai.chat.completions.create).mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify(OPENAI_SIGNALS) } },
      ],
    } as any);
  });

  it('returns 200 with extracted signals on success', async () => {
    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.extracted).toHaveLength(2);
    expect(data.extracted[0].signal).toBe('resistance');
    expect(data.extracted[0].confidence).toBe(0.9);
    expect(data.extracted[1].signal).toBe('purpose');
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify({ productSessionId: 'session-001' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/required/);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('returns 400 when signalsToExtract is an empty array', async () => {
    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, signalsToExtract: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when session belongs to a different user', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSessionChain({ data: { user_id: 'other-user' }, error: null }) as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/Unauthorized/);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('returns 429 when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain('Rate limit exceeded');
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('returns 502 when OpenAI call throws', async () => {
    vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(
      new Error('OpenAI rate limit exceeded')
    );

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe('Signal extraction failed');
    expect(data.detail).toContain('OpenAI rate limit');
  });

  it('returns 502 when OpenAI returns non-JSON content', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: 'not valid json {{{}' } }],
    } as any);

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe('Signal extraction failed');
  });

  it('drops signals not present in the allowed vocabulary', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signals: [
                { signal: 'resistance', confidence: 0.9, evidence: 'felt resistance' },
                { signal: 'UNLISTED_SIGNAL', confidence: 0.7, evidence: 'some text' },
              ],
            }),
          },
        },
      ],
    } as any);

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.extracted).toHaveLength(1);
    expect(data.extracted[0].signal).toBe('resistance');
  });

  it('inserts valid signals into session_signals with source=extraction', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSessionChain({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'session_signals') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    await POST(req);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          session_id: 'session-001',
          step_index: 1,
          source: 'extraction',
          signal: 'resistance',
        }),
      ])
    );
  });

  it('returns 200 even when session_signals insert fails', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'product_sessions') {
        return makeSessionChain({ data: SESSION_ROW, error: null }) as any;
      }
      if (table === 'session_signals') {
        return { insert: vi.fn().mockResolvedValue({ error: { message: 'DB write error' } }) } as any;
      }
      return {} as any;
    });

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.extracted).toBeDefined();
  });

  it('returns empty extracted array when model finds no signals', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ signals: [] }) } }],
    } as any);

    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.extracted).toEqual([]);
  });

  it('calls OpenAI with gpt-4o-mini, temperature 0, and json_object format', async () => {
    const req = new Request('http://localhost/api/dynamic-step/extract-signals', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    });

    await POST(req);

    expect(openai.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Helper — from().select().eq().maybeSingle() chain for product_sessions
// ---------------------------------------------------------------------------
function makeSessionChain(payload: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(payload);
  const eq1 = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}
