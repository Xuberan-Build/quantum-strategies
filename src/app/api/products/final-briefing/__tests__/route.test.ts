import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI client before any imports
vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

// Mock all dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/services/PromptService');
vi.mock('@/lib/services/AIRequestService');
vi.mock('@/lib/services/EmailSequenceService');
vi.mock('@/lib/services/EmailTemplateService');

import { POST } from '../route';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PromptService } from '@/lib/services/PromptService';
import { AIRequestService } from '@/lib/services/AIRequestService';
import { EmailSequenceService } from '@/lib/services/EmailSequenceService';
import { EmailTemplateService } from '@/lib/services/EmailTemplateService';

describe('POST /api/products/final-briefing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(PromptService.getPrompt).mockResolvedValue('System prompt for final briefing');
    vi.mocked(AIRequestService.request).mockResolvedValue({
      content: 'Generated briefing content',
      finishReason: 'stop',
      generationMs: 1200,
      tokensUsed: { total: 500, prompt: 250, completion: 250 },
    });
    vi.mocked(EmailTemplateService.getDeliverablePreview).mockReturnValue('Brief preview...');
    vi.mocked(EmailTemplateService.getFirstName).mockReturnValue('Test');
    vi.mocked(EmailSequenceService.scheduleEmail).mockResolvedValue({
      id: 'email-123',
      user_id: 'user-123',
      sequence_type: 'affiliate_invitation',
      trigger_event: 'deliverable_completed',
    } as any);
  });

  it('should require sessionId', async () => {
    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('sessionId is required');
  });

  it('should successfully generate final briefing', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [
          { role: 'user', content: 'My goal is to grow my business' },
          { role: 'assistant', content: 'Great insight!', type: 'step_insight' },
        ],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockProduct = {
      name: 'Quantum Initiation',
      final_deliverable_prompt: 'Custom deliverable prompt',
    };

    const mockSession = {
      user_id: 'user-123',
      product_slug: 'quantum-initiation',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      is_affiliate: false,
      affiliate_opted_out: false,
    };

    // Mock Supabase query chains
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        if (vi.mocked(supabaseAdmin.from).mock.calls.length === 1) {
          // First call - fetch conversations
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockConversations,
                  error: null,
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        } else {
          // Second call - log briefing
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProduct, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      } else if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const requestBody = {
      sessionId: 'session-123',
      placements: {
        astrology: {
          sun: 'Leo 5th house',
          moon: 'Cancer',
        },
        human_design: {
          type: 'Generator',
          strategy: 'Respond',
        },
      },
      productSlug: 'quantum-initiation',
    };

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.briefing).toBe('Generated briefing content');
    expect(AIRequestService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        maxTokens: 15000,
        context: 'final-briefing',
        retries: 2,
      })
    );
  });

  it('should filter out UNKNOWN placements', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'Test' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {} as any;
    });

    const requestBody = {
      sessionId: 'session-123',
      placements: {
        astrology: {
          sun: 'Leo',
          moon: 'UNKNOWN',
          rising: 'UNKNOWN',
        },
      },
    };

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Check that the system prompt doesn't include UNKNOWN values
    const callArgs = vi.mocked(AIRequestService.request).mock.calls[0][0];
    expect(callArgs.messages[0].content).not.toContain('UNKNOWN');
    expect(callArgs.messages[0].content).toContain('Sun: Leo');
    expect(callArgs.messages[0].content).not.toContain('Moon');
  });

  it('should extract user responses from conversations', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [
          { role: 'user', content: 'First user message' },
          { role: 'assistant', content: 'Response' },
        ],
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        step_number: 2,
        messages: [{ role: 'user', content: 'Second user message' }],
        created_at: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    await POST(request);

    const callArgs = vi.mocked(AIRequestService.request).mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('Step 1: First user message');
    expect(callArgs.messages[1].content).toContain('Step 2: Second user message');
  });

  it('should extract wizard nudges from conversations', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [
          { role: 'user', content: 'User message' },
          { role: 'assistant', content: 'Actionable nudge here', type: 'step_insight' },
        ],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123', productSlug: 'quantum-initiation' }),
    });

    await POST(request);

    const callArgs = vi.mocked(AIRequestService.request).mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('QBF WIZARD');
    expect(callArgs.messages[1].content).toContain('Step 1 Insight: Actionable nudge here');
  });

  it('should extract money-related notes for quantum-initiation', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [
          { role: 'user', content: 'I want to hit $10k MRR this year' },
          { role: 'assistant', content: 'Great goal!' },
        ],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123', productSlug: 'quantum-initiation' }),
    });

    await POST(request);

    const callArgs = vi.mocked(AIRequestService.request).mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('MONEY/REVENUE GOALS');
    expect(callArgs.messages[1].content).toContain('$10k MRR');
  });

  it('should NOT include money notes for personal-alignment product', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'I want to hit $10k MRR' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123', productSlug: 'personal-alignment' }),
    });

    await POST(request);

    const callArgs = vi.mocked(AIRequestService.request).mock.calls[0][0];
    expect(callArgs.messages[1].content).not.toContain('MONEY/REVENUE GOALS');
    expect(callArgs.messages[1].content).toContain('PERSONAL ALIGNMENT GUIDE');
  });

  it('should save deliverable to product_sessions', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'Test' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockSession = {
      user_id: 'user-123',
      product_slug: 'quantum-initiation',
    };

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: mockUpdateEq,
          }),
        } as any;
      } else if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    await POST(request);

    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'session-123');
  });

  it('should schedule affiliate email for non-affiliate users', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'Test' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockSession = {
      user_id: 'user-123',
      product_slug: 'quantum-initiation',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      is_affiliate: false,
      affiliate_opted_out: false,
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      } else if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    await POST(request);

    expect(EmailSequenceService.scheduleEmail).toHaveBeenCalledWith(
      'user-123',
      'affiliate_invitation',
      'deliverable_completed',
      expect.objectContaining({
        user_email: 'test@example.com',
      }),
      30
    );
  });

  it('should NOT schedule email for existing affiliates', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'Test' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockSession = {
      user_id: 'user-123',
      product_slug: 'quantum-initiation',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      is_affiliate: true, // Already an affiliate
      affiliate_opted_out: false,
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      } else if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    await POST(request);

    expect(EmailSequenceService.scheduleEmail).not.toHaveBeenCalled();
  });

  it('should handle AI request failure', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'Test' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    vi.mocked(AIRequestService.request).mockRejectedValue(new Error('OpenAI API error'));

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('AI generation failed');
  });

  it('should handle database conversation fetch error', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Database error');
  });

  it('should use product-specific deliverable prompt when available', async () => {
    const mockConversations = [
      {
        step_number: 1,
        messages: [{ role: 'user', content: 'Test' }],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockProduct = {
      name: 'Custom Product',
      final_deliverable_prompt: 'Custom instruction prompt for deliverable',
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConversations,
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      } else if (table === 'product_definitions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProduct, error: null }),
            }),
          }),
        } as any;
      } else if (table === 'product_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {} as any;
    });

    const request = new Request('http://localhost/api/products/final-briefing', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-123' }),
    });

    await POST(request);

    const callArgs = vi.mocked(AIRequestService.request).mock.calls[0][0];
    expect(callArgs.messages[2].content).toContain('Custom instruction prompt for deliverable');
  });
});
