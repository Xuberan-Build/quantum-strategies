import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const claudeCreate = vi.fn();
const claudeStream = vi.fn();
const MODELS: Record<string, string> = { deep: 'claude-opus-5-5', standard: 'claude-sonnet-5-5', light: 'claude-haiku-5-5' };
const modelOverride: { light?: string } = {};
vi.mock('../claude', () => ({
  getClaude: () => ({ messages: { create: claudeCreate, stream: claudeStream } }),
  claudeModel: (tier: string) => (tier === 'light' && modelOverride.light) || MODELS[tier],
}));

const openaiCreate = vi.fn();
vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: openaiCreate } } },
  DEFAULT_MODEL: 'gpt-5',
}));

import {
  aiProvider,
  buildClaudeRequest,
  CONTINUE_TURN,
  CONVERSATION_START,
  extractJson,
  generateAIResponse,
  generateJSON,
  generateText,
  JSON_ONLY_INSTRUCTION,
  parseJsonReply,
  streamText,
} from '../generate';

function claudeReply(text: string, stop = 'end_turn') {
  return {
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }],
    stop_reason: stop,
    usage: { input_tokens: 12, output_tokens: 7 },
  };
}

describe('buildClaudeRequest (OpenAI -> Claude mapping)', () => {
  it('hoists system role messages into the system param, in order', () => {
    const req = buildClaudeRequest({ tier: 'standard',
      system: 'Base system',
      messages: [
        { role: 'system', content: 'Extra system' },
        { role: 'user', content: 'Hi' },
      ],
    });
    expect(req.system).toBe('Base system\n\nExtra system');
    expect(req.messages).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('keeps prompts byte-for-byte', () => {
    const prompt = '  Line one\n\n"quoted" — dash  ';
    const req = buildClaudeRequest({ tier: 'standard', system: prompt, messages: [{ role: 'user', content: prompt }] });
    expect(req.system).toBe(prompt);
    expect(req.messages[0].content).toBe(prompt);
  });

  it('requires an explicit tier', () => {
    expect(() => buildClaudeRequest({ messages: [{ role: 'user', content: 'x' }] } as never)).toThrow(/tier/);
  });

  it('deep tier: Opus, adaptive thinking (no thinking field), effort medium, always streams', () => {
    const req = buildClaudeRequest({ tier: 'deep', messages: [{ role: 'user', content: 'x' }], maxTokens: 15000 });
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.thinking).toBeUndefined();
    expect(req.output_config).toEqual({ effort: 'medium' });
    expect(req.max_tokens).toBe(15000 + 8192);
    expect(req.stream).toBe(true);
    expect(buildClaudeRequest({ tier: 'deep', messages: [{ role: 'user', content: 'x' }], maxTokens: 100 }).stream).toBe(true);
  });

  it('standard tier: Sonnet, adaptive thinking at low effort, thinking headroom', () => {
    const req = buildClaudeRequest({ tier: 'standard', messages: [{ role: 'user', content: 'x' }], maxTokens: 500 });
    expect(req.model).toBe('claude-sonnet-5-5');
    expect(req.thinking).toBeUndefined();
    expect(req.output_config).toEqual({ effort: 'low' });
    expect(req.max_tokens).toBe(500 + 4096);
    expect(req.stream).toBe(false);
    expect(buildClaudeRequest({ tier: 'standard', messages: [{ role: 'user', content: 'x' }] }).max_tokens).toBe(4096 + 4096);
  });

  it('light tier: Haiku with thinking disabled at low effort, tokenizer-scaled budget', () => {
    const req = buildClaudeRequest({ tier: 'light', messages: [{ role: 'user', content: 'x' }], maxTokens: 350 });
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req.thinking).toEqual({ type: 'disabled' });
    expect(req.output_config).toEqual({ effort: 'low' });
    expect(req.max_tokens).toBe(Math.ceil(350 * 1.3));
    expect(req.stream).toBe(false);
  });

  it('light tier on a non-Haiku override keeps adaptive thinking (disabled would 400)', () => {
    modelOverride.light = 'claude-sonnet-5-5';
    try {
      const req = buildClaudeRequest({ tier: 'light', messages: [{ role: 'user', content: 'x' }], maxTokens: 100 });
      expect(req.thinking).toBeUndefined();
      expect(req.max_tokens).toBe(130 + 2048);
    } finally {
      delete modelOverride.light;
    }
  });

  it('effort override wins over the tier default', () => {
    const req = buildClaudeRequest({ tier: 'standard', messages: [{ role: 'user', content: 'x' }], effort: 'medium' });
    expect(req.output_config).toEqual({ effort: 'medium' });
  });

  it('never sends temperature', () => {
    const req = buildClaudeRequest({ tier: 'standard', messages: [{ role: 'user', content: 'x' }], temperature: 0.7 });
    expect(req.output_config).toEqual({ effort: 'low' });
    expect(req).not.toHaveProperty('temperature');
  });

  it('json: true appends the JSON-only instruction', () => {
    const req = buildClaudeRequest({ tier: 'standard', system: 'S', messages: [{ role: 'user', content: 'x' }], json: true });
    expect(req.system).toBe(`S\n\n${JSON_ONLY_INSTRUCTION}`);
    expect(req.output_config.format).toBeUndefined();
  });

  it('json schema maps to structured outputs', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };
    const req = buildClaudeRequest({ tier: 'standard', messages: [{ role: 'user', content: 'x' }], json: { name: 's', schema } });
    expect(req.output_config.format).toEqual({ type: 'json_schema', schema });
    expect(req.system).toBeUndefined();
  });

  it('maps image_url parts to Claude image blocks', () => {
    const req = buildClaudeRequest({ tier: 'standard',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this chart' },
            { type: 'image_url', image_url: { url: 'https://x.test/chart.png' } },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
          ],
        },
      ],
    });
    expect(req.messages[0].content).toEqual([
      { type: 'text', text: 'Read this chart' },
      { type: 'image', source: { type: 'url', url: 'https://x.test/chart.png' } },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
    ]);
  });

  it('opens with a user turn and never ends on an assistant turn', () => {
    const req = buildClaudeRequest({ tier: 'standard',
      messages: [
        { role: 'assistant', content: 'Welcome!' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    });
    expect(req.messages[0]).toEqual({ role: 'user', content: CONVERSATION_START });
    expect(req.messages[req.messages.length - 1]).toEqual({ role: 'user', content: CONTINUE_TURN });
  });

  it('drops empty messages (Claude rejects empty text)', () => {
    const req = buildClaudeRequest({ tier: 'standard',
      messages: [
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'More' },
      ],
    });
    expect(req.messages).toEqual([
      { role: 'user', content: 'Q' },
      { role: 'user', content: 'More' },
    ]);
  });
});

describe('JSON parsing', () => {
  it('returns plain JSON unchanged', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
    expect(extractJson('[1,2]')).toBe('[1,2]');
  });

  it('strips code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('```\n["x"]\n```')).toBe('["x"]');
  });

  it('pulls JSON out of surrounding prose', () => {
    expect(extractJson('Here you go:\n{"a": {"b": [1]}}\nHope that helps')).toBe('{"a": {"b": [1]}}');
  });

  it('returns null when nothing parses', () => {
    expect(extractJson('not json')).toBeNull();
    expect(extractJson('')).toBeNull();
  });

  it('parseJsonReply throws on non-JSON', () => {
    expect(parseJsonReply<{ a: number }>('```json\n{"a":2}\n```').a).toBe(2);
    expect(() => parseJsonReply('nope')).toThrow(SyntaxError);
  });
});

describe('provider switch', () => {
  const saved = process.env.AI_PROVIDER;
  beforeEach(() => {
    claudeCreate.mockReset();
    claudeStream.mockReset();
    openaiCreate.mockReset();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = saved;
  });

  it('defaults to anthropic', () => {
    delete process.env.AI_PROVIDER;
    expect(aiProvider()).toBe('anthropic');
    process.env.AI_PROVIDER = 'something-else';
    expect(aiProvider()).toBe('anthropic');
    process.env.AI_PROVIDER = 'OpenAI';
    expect(aiProvider()).toBe('openai');
  });

  it('anthropic: calls Claude and maps the result', async () => {
    delete process.env.AI_PROVIDER;
    claudeCreate.mockResolvedValue(claudeReply('Hello'));
    const res = await generateText({ tier: 'standard',
      system: 'Sys',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 300,
      temperature: 0.2,
      openaiModel: 'gpt-4o',
    });
    expect(res).toEqual({
      text: 'Hello',
      finishReason: 'stop',
      usage: { prompt: 12, completion: 7, total: 19 },
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
    const [body] = claudeCreate.mock.calls[0];
    expect(body).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: 300 + 4096,
      system: 'Sys',
      messages: [{ role: 'user', content: 'Hi' }],
      output_config: { effort: 'low' },
    });
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it('anthropic: maps max_tokens and refusal stop reasons', async () => {
    delete process.env.AI_PROVIDER;
    claudeCreate.mockResolvedValueOnce(claudeReply('cut', 'max_tokens'));
    expect((await generateText({ tier: 'standard', messages: [{ role: 'user', content: 'x' }] })).finishReason).toBe('length');
    claudeCreate.mockResolvedValueOnce(claudeReply('', 'refusal'));
    expect((await generateText({ tier: 'standard', messages: [{ role: 'user', content: 'x' }] })).finishReason).toBe('content_filter');
  });

  it('anthropic: long outputs use the streaming endpoint', async () => {
    delete process.env.AI_PROVIDER;
    claudeStream.mockReturnValue({ finalMessage: () => Promise.resolve(claudeReply('Long briefing')) });
    const res = await generateText({ tier: 'deep', messages: [{ role: 'user', content: 'x' }], maxTokens: 15000 });
    expect(res.text).toBe('Long briefing');
    expect(res.model).toBe('claude-opus-5-5');
    expect(claudeCreate).not.toHaveBeenCalled();
    expect(claudeStream.mock.calls[0][0]).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 15000 + 8192, output_config: { effort: 'medium' } });
    expect(claudeStream.mock.calls[0][0]).not.toHaveProperty('thinking');
  });

  it('anthropic: light tier sends thinking disabled', async () => {
    delete process.env.AI_PROVIDER;
    claudeCreate.mockResolvedValue(claudeReply('{"a":1}'));
    await generateText({ tier: 'light', messages: [{ role: 'user', content: 'x' }], maxTokens: 400, json: true });
    expect(claudeCreate.mock.calls[0][0]).toMatchObject({
      model: 'claude-haiku-5-5',
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      max_tokens: 520,
    });
  });

  it('anthropic: json true returns clean JSON text even if fenced', async () => {
    delete process.env.AI_PROVIDER;
    claudeCreate.mockResolvedValue(claudeReply('```json\n{"signals": []}\n```'));
    const res = await generateText({ tier: 'standard', messages: [{ role: 'user', content: 'x' }], json: true });
    expect(JSON.parse(res.text)).toEqual({ signals: [] });
    const { data } = await generateJSON<{ signals: unknown[] }>({ tier: 'standard', messages: [{ role: 'user', content: 'x' }] });
    expect(data.signals).toEqual([]);
  });

  it('anthropic: passes signal, timeout and maxRetries through', async () => {
    delete process.env.AI_PROVIDER;
    claudeCreate.mockResolvedValue(claudeReply('ok'));
    const controller = new AbortController();
    await generateText({ tier: 'standard', messages: [{ role: 'user', content: 'x' }], signal: controller.signal, timeoutMs: 5000, maxRetries: 0 });
    expect(claudeCreate.mock.calls[0][1]).toEqual({ signal: controller.signal, timeout: 5000, maxRetries: 0 });
  });

  it('openai rollback: uses the existing client exactly as before', async () => {
    process.env.AI_PROVIDER = 'openai';
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    });
    const res = await generateText({ tier: 'standard',
      system: 'Sys',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 200,
      temperature: 0,
      json: true,
      openaiModel: 'gpt-4o-mini',
    });
    expect(openaiCreate).toHaveBeenCalledWith(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Sys' },
          { role: 'user', content: 'Hi' },
        ],
        max_completion_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
      },
      {},
    );
    expect(res).toEqual({
      text: '{"a":1}',
      finishReason: 'stop',
      usage: { prompt: 3, completion: 4, total: 7 },
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    expect(claudeCreate).not.toHaveBeenCalled();
  });

  it('openai rollback: defaults to DEFAULT_MODEL and maps json schema', async () => {
    process.env.AI_PROVIDER = 'openai';
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] });
    const schema = { type: 'object' };
    await generateText({ tier: 'standard', messages: [{ role: 'user', content: 'Hi' }], json: { name: 'n', schema } });
    expect(openaiCreate.mock.calls[0][0]).toMatchObject({
      model: 'gpt-5',
      response_format: { type: 'json_schema', json_schema: { name: 'n', strict: true, schema } },
    });
  });

  it('generateAIResponse keeps its signature and returns text', async () => {
    delete process.env.AI_PROVIDER;
    claudeCreate.mockResolvedValue(claudeReply('Answer'));
    const out = await generateAIResponse({ tier: 'standard', systemPrompt: 'S', messages: [{ role: 'user', content: 'Q' }] });
    expect(out).toBe('Answer');
    expect(claudeCreate.mock.calls[0][0].max_tokens).toBe(500 + 4096);
  });
});

describe('streamText', () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it('anthropic: yields text deltas only', async () => {
    delete process.env.AI_PROVIDER;
    claudeStream.mockReturnValue(
      (async function* () {
        yield { type: 'content_block_start', content_block: { type: 'thinking' } };
        yield { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } };
        yield { type: 'message_stop' };
      })(),
    );
    const parts: string[] = [];
    for await (const t of streamText({ tier: 'standard', system: 'S', messages: [{ role: 'user', content: 'x' }], maxTokens: 600 })) parts.push(t);
    expect(parts.join('')).toBe('Hello');
    expect(claudeStream.mock.calls[0][0]).toMatchObject({ system: 'S', max_tokens: 600 + 4096 });
  });

  it('openai rollback: yields delta content', async () => {
    process.env.AI_PROVIDER = 'openai';
    openaiCreate.mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: 'A' } }] };
        yield { choices: [{ delta: {} }] };
        yield { choices: [{ delta: { content: 'B' } }] };
      })(),
    );
    const parts: string[] = [];
    for await (const t of streamText({ tier: 'standard', messages: [{ role: 'user', content: 'x' }] })) parts.push(t);
    expect(parts).toEqual(['A', 'B']);
    expect(openaiCreate.mock.calls[0][0]).toMatchObject({ stream: true, model: 'gpt-5' });
  });
});
