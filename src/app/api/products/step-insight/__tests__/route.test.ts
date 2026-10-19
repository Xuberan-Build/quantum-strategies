import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider-neutral AI layer. `completionsCreate` receives the generateText options
// and returns OpenAI-shaped fixtures, which the adapter maps to the GenerateResult shape.
const { completionsCreate } = vi.hoisted(() => ({ completionsCreate: vi.fn() }));
vi.mock('@/lib/ai/generate', () => ({
  generateText: vi.fn(async (opts: unknown) => {
    const r = (await completionsCreate(opts)) as
      | { choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>; usage?: Record<string, number> }
      | undefined;
    return {
      text: r?.choices?.[0]?.message?.content ?? '',
      finishReason: r?.choices?.[0]?.finish_reason ?? 'stop',
      usage: { prompt: r?.usage?.prompt_tokens ?? 0, completion: r?.usage?.completion_tokens ?? 0, total: r?.usage?.total_tokens ?? 0 },
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    };
  }),
  activeModelLabel: (m?: string) => m ?? 'claude-opus-5-5',
  parseJsonReply: (raw: string) => JSON.parse(raw),
  extractJson: (raw: string) => raw,
}));

// Mock all dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/security/rate-limit');
vi.mock('@/lib/security/input-validation');
vi.mock('@/lib/services/PromptService');
vi.mock('@/lib/services/AIRequestService');

import { POST } from '../route';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { validateUserInput, validateSessionOwnership } from '@/lib/security/input-validation';
import { PromptService } from '@/lib/services/PromptService';
import { AIRequestService } from '@/lib/services/AIRequestService';

describe('POST /api/products/step-insight', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29 });
    vi.mocked(validateUserInput).mockReturnValue({
      isValid: true,
      sanitized: 'User response',
      warnings: [],
    });
    vi.mocked(validateSessionOwnership).mockResolvedValue(true);
    vi.mocked(PromptService.getPrompt).mockResolvedValue('System prompt from DB');
    vi.mocked(AIRequestService.request).mockResolvedValue({
      content: 'AI generated insight',
      finishReason: 'stop',
      tokensUsed: { total: 100, prompt: 50, completion: 50 },
    });
  });

  it('should successfully generate step insight', async () => {
    const requestBody = {
      stepNumber: 1,
      stepData: { title: 'Step 1', question: 'What is your goal?' },
      mainResponse: 'My main goal is to grow my business',
      placements: {
        astrology: {
          sun: 'Aries',
          moon: 'Taurus',
          rising: 'Gemini',
        },
        human_design: {
          type: 'Generator',
          strategy: 'Respond',
          authority: 'Sacral',
        },
      },
      productSlug: 'quantum-initiation',
      sessionId: 'session-123',
      userId: 'user-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aiResponse).toBe('AI generated insight');
    expect(AIRequestService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'standard',
        model: 'gpt-4o',
        maxTokens: 10000,
        context: 'step-insight',
        retries: 2,
      })
    );
  });

  it('should reject request when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0 });

    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Rate limit exceeded');
    expect(AIRequestService.request).not.toHaveBeenCalled();
  });

  it('should reject request when session ownership validation fails', async () => {
    vi.mocked(validateSessionOwnership).mockResolvedValue(false);

    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      sessionId: 'session-123',
      userId: 'user-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Unauthorized');
    expect(AIRequestService.request).not.toHaveBeenCalled();
  });

  it('should sanitize user input', async () => {
    const maliciousInput = '<script>alert("xss")</script>My response';
    const sanitizedInput = 'My response';

    vi.mocked(validateUserInput).mockReturnValue({
      isValid: true,
      sanitized: sanitizedInput,
      warnings: ['Removed potentially dangerous content'],
    });

    const requestBody = {
      stepNumber: 1,
      mainResponse: maliciousInput,
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    await response.json();

    expect(validateUserInput).toHaveBeenCalledWith(maliciousInput, { maxLength: 3000 });
  });

  it('should handle AI request failure', async () => {
    vi.mocked(AIRequestService.request).mockRejectedValue(new Error('OpenAI API error'));

    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('AI generation failed');
    expect(data.detail).toBe('OpenAI API error');
  });

  it('should load prompt from PromptService', async () => {
    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      productSlug: 'quantum-initiation',
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(PromptService.getPrompt).toHaveBeenCalledWith({
      productSlug: 'quantum-initiation',
      scope: 'step_insight',
      fallback: expect.stringContaining('Respond after the user answers a step'),
    });
  });

  it('should include placements in context', async () => {
    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      placements: {
        astrology: {
          sun: 'Leo 5th house',
          moon: 'Cancer 4th house',
          rising: 'Aries',
        },
        human_design: {
          type: 'Manifestor',
          strategy: 'Inform',
          authority: 'Emotional',
        },
      },
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(AIRequestService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Sun Leo 5th house'),
      })
    );
    expect(AIRequestService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Type Manifestor'),
      })
    );
  });

  it('should handle missing placements gracefully', async () => {
    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      placements: null,
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aiResponse).toBeDefined();
    expect(AIRequestService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('UNKNOWN'),
      })
    );
  });

  it('should save conversation to database', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { messages: [{ role: 'user', content: 'Previous message' }] },
            error: null,
          }),
        }),
      }),
    });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: mockSelect,
          upsert: mockUpsert,
        } as any;
      }
      return {} as any;
    });

    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'session-123',
        step_number: 1,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'assistant', content: 'AI generated insight' }),
        ]),
      }),
      { onConflict: 'session_id,step_number' }
    );
  });

  it('should continue even if conversation logging fails', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      }),
    });

    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: mockSelect,
    } as any);

    const requestBody = {
      stepNumber: 1,
      mainResponse: 'Test response',
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should still succeed even though logging failed
    expect(response.status).toBe(200);
    expect(data.aiResponse).toBe('AI generated insight');
  });

  it('should handle prior messages in conversation', async () => {
    // Mock validateUserInput to return the actual message
    vi.mocked(validateUserInput).mockReturnValue({
      isValid: true,
      sanitized: 'Second message',
      warnings: [],
    });

    const priorMessages = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
    ];

    const requestBody = {
      stepNumber: 2,
      mainResponse: 'Second message',
      priorMessages,
      sessionId: 'session-123',
    };

    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(AIRequestService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ]),
      })
    );
  });

  it('should handle general errors', async () => {
    const request = new Request('http://localhost/api/products/step-insight', {
      method: 'POST',
      body: 'invalid json{',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
