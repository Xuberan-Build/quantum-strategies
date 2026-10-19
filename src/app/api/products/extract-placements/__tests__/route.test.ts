import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdf-parse before any imports
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

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

// Mock models
vi.mock('@/lib/ai/models', () => ({
  chartAnalysisModel: 'gpt-4o',
}));

// Mock Supabase
vi.mock('@/lib/supabase/server');

import { POST } from '../route';
import { supabaseAdmin } from '@/lib/supabase/server';
import pdfParse from 'pdf-parse';

describe('POST /api/products/extract-placements', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for OpenAI
    completionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              astrology: {
                sun: 'Leo 5th house',
                moon: 'Cancer 4th house',
                rising: 'Aries',
              },
            }),
          },
        },
      ],
    } as any);
  });

  it('should require storagePaths array', async () => {
    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No files provided for extraction');
  });

  it('should process image files and create signed URLs', async () => {
    const mockSignedUrl = 'https://signed-url.com/astro-chart.png';

    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: ['astro-chart.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('user-uploads');
    expect(completionsCreate).toHaveBeenCalled();
  });

  it('should categorize files as astrology based on filename', async () => {
    const mockSignedUrl = 'https://signed-url.com/birth-chart.png';

    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: ['birth-chart.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    const callArgs = completionsCreate.mock.calls;
    // Should call OpenAI for astrology
    expect(callArgs[0][0].messages[0].content).toContainEqual({
      type: 'image_url',
      image_url: { url: mockSignedUrl },
    });
  });

  it('should categorize files as human design based on filename', async () => {
    const mockSignedUrl = 'https://signed-url.com/humandesign-chart.png';

    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      }),
    } as any);

    completionsCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ astrology: {} }) } }],
      } as any)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                human_design: {
                  type: 'Generator',
                  strategy: 'Respond',
                },
              }),
            },
          },
        ],
      } as any);

    const requestBody = {
      storagePaths: ['humandesign-chart.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Should make 2 calls (astro + HD)
    expect(completionsCreate).toHaveBeenCalledTimes(2);
  });

  it('should process PDF files and extract text', async () => {
    const mockPdfText = 'Sun: Leo 5th house\nMoon: Cancer';
    const mockBuffer = Buffer.from('pdf-content');

    vi.mocked(pdfParse).mockResolvedValue({
      text: mockPdfText,
      numpages: 1,
      info: {},
      metadata: null,
      version: '1.0',
    });

    // Create a mock Blob with arrayBuffer method
    const mockBlob = {
      arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
    };

    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: ['astro-chart.pdf'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(pdfParse).toHaveBeenCalled();
    const callArgs = completionsCreate.mock.calls[0][0];
    const pdfTextContent = callArgs.messages[0].content.find(
      (c: any) => c.type === 'text' && c.text.includes('PDF extracted text')
    );
    expect(pdfTextContent.text).toContain(mockPdfText);
  });

  it('should limit to first 6 files', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/chart.png' },
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: [
        'file1.png',
        'file2.png',
        'file3.png',
        'file4.png',
        'file5.png',
        'file6.png',
        'file7.png', // Should be ignored
        'file8.png', // Should be ignored
      ],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Should only process 6 files
    const createSignedUrlMock = vi.mocked(supabaseAdmin.storage.from).mock.results[0].value
      .createSignedUrl;
    expect(createSignedUrlMock).toHaveBeenCalledTimes(6);
  });

  it('should return merged astrology and human design results', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/chart.png' },
        error: null,
      }),
    } as any);

    completionsCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                astrology: {
                  sun: 'Leo 5th house',
                  moon: 'Cancer 4th house',
                  rising: 'Aries',
                },
              }),
            },
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                human_design: {
                  type: 'Generator',
                  strategy: 'Respond',
                  authority: 'Sacral',
                },
              }),
            },
          },
        ],
      } as any);

    const requestBody = {
      storagePaths: ['astro.png', 'hd.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.placements.astrology.sun).toBe('Leo 5th house');
    expect(data.placements.human_design.type).toBe('Generator');
  });

  it('should use UNKNOWN for missing fields', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/chart.png' },
        error: null,
      }),
    } as any);

    // Return empty results so fallback UNKNOWN values are used
    completionsCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({}), // No astrology data
            },
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({}), // No HD data
            },
          },
        ],
      } as any);

    const requestBody = {
      storagePaths: ['chart.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.placements.astrology.sun).toBe('UNKNOWN');
    expect(data.placements.astrology.moon).toBe('UNKNOWN');
    expect(data.placements.human_design.type).toBe('UNKNOWN');
  });

  it('should handle file download errors', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      }),
    } as any);

    const requestBody = {
      storagePaths: ['missing-file.pdf'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Could not download PDF');
  });

  it('should handle signed URL creation errors', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' },
      }),
    } as any);

    const requestBody = {
      storagePaths: ['restricted-file.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Could not sign file');
  });

  it('should handle OpenAI API errors', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/chart.png' },
        error: null,
      }),
    } as any);

    completionsCreate.mockRejectedValue(new Error('OpenAI rate limit'));

    const requestBody = {
      storagePaths: ['chart.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('OpenAI rate limit');
  });

  it('should use JSON response format for OpenAI', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/chart.png' },
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: ['chart.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    expect(completionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        temperature: 0,
      })
    );
  });

  it('should limit image URLs to 3 per extraction', async () => {
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/chart.png' },
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: ['astro1.png', 'astro2.png', 'astro3.png', 'astro4.png'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    const callArgs = completionsCreate.mock.calls[0][0];
    const imageUrls = callArgs.messages[0].content.filter((c: any) => c.type === 'image_url');
    expect(imageUrls.length).toBeLessThanOrEqual(3);
  });

  it('should truncate PDF text to 8000 characters', async () => {
    const longText = 'x'.repeat(10000);

    vi.mocked(pdfParse).mockResolvedValue({
      text: longText,
      numpages: 1,
      info: {},
      metadata: null,
      version: '1.0',
    });

    // Create a mock Blob with arrayBuffer method
    const mockBlob = {
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('pdf-content')),
    };

    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      }),
    } as any);

    const requestBody = {
      storagePaths: ['large-chart.pdf'],
    };

    const request = new Request('http://localhost/api/products/extract-placements', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    const callArgs = completionsCreate.mock.calls[0][0];
    const pdfTextContent = callArgs.messages[0].content.find(
      (c: any) => c.type === 'text' && c.text.includes('PDF extracted text')
    );
    expect(pdfTextContent.text.length).toBeLessThan(8100); // Account for prefix text
  });
});
