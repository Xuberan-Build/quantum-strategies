/**
 * Provider-neutral text generation (server only).
 *
 * Every text-generation call site in src/ goes through this module. AI_PROVIDER selects the
 * backend: `anthropic` (default) or `openai` (rollback only; uses the existing OpenAI client
 * exactly as before). Embeddings are NOT handled here; they still use src/lib/openai/client.ts.
 *
 * Mapping from the OpenAI chat-completions shape to the Claude Messages API:
 *   - `system` role messages        -> the top-level `system` param (joined in order)
 *   - model                         -> the call site's explicit tier (deep / standard / light),
 *                                      see TIER_SETTINGS and src/lib/ai/claude.ts
 *   - max tokens                    -> `max_tokens` plus the tier's thinking headroom (Claude
 *                                      counts adaptive thinking against max_tokens)
 *   - temperature                   -> dropped on Claude (Opus 5.5, Sonnet 5.5 and Haiku 5.5
 *                                      reject non-default sampling params)
 *   - response_format json_object   -> a JSON-only instruction appended to the system prompt,
 *                                      then a tolerant extraction of the JSON from the reply
 *   - response_format json_schema   -> Claude structured outputs (output_config.format)
 *   - image_url content parts       -> Claude image blocks (URL or base64 data URL)
 *   - stream: true                  -> streamText() yielding text deltas
 *   - finish_reason                 -> 'stop' | 'length' | 'content_filter' (from stop_reason)
 */
import type Anthropic from '@anthropic-ai/sdk';
import { claudeModel, getClaude, type AITier } from './claude';

export type { AITier } from './claude';

export type AIProvider = 'anthropic' | 'openai';

export function aiProvider(): AIProvider {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === 'openai' ? 'openai' : 'anthropic';
}

export type AITextPart = { type: 'text'; text: string };
export type AIImagePart = { type: 'image_url'; image_url: { url: string } };
export type AIContentPart = AITextPart | AIImagePart;

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIContentPart[];
}

/** Claude effort level (overrides the tier default; ignored on the OpenAI rollback path). */
export type AIEffort = 'low' | 'medium' | 'high';

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface GenerateOptions {
  /** Required: which Claude model tier serves this call. No silent default. */
  tier: AITier;
  /** System prompt. Combined with any `system` role messages. */
  system?: string;
  messages: AIMessage[];
  /** Visible-output budget, as callers passed to OpenAI. */
  maxTokens?: number;
  /** OpenAI branch only. Claude rejects sampling params on the default model. */
  temperature?: number;
  /** `true`: reply must be JSON (json_object on OpenAI). Object: a strict JSON schema. */
  json?: boolean | JsonSchemaFormat;
  effort?: AIEffort;
  /** OpenAI branch only: the model the call site used before. */
  openaiModel?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** SDK retries. Defaults to the SDK default (2). */
  maxRetries?: number;
}

export interface GenerateResult {
  text: string;
  /** OpenAI-style: 'stop' | 'length' | 'content_filter' | other provider value. */
  finishReason: string;
  usage: { prompt: number; completion: number; total: number };
  provider: AIProvider;
  model: string;
}

const DEFAULT_MAX_TOKENS = 4096;
/** Above this, use the streaming endpoint so long generations don't hit non-streaming limits. */
const STREAM_THRESHOLD = 16000;
const CLAUDE_MAX_OUTPUT = 128000;

/**
 * Per-tier request settings (from the claude-api skill model notes):
 *   deep     claude-opus-5-5: thinking is always on (adaptive; `disabled` 400s), effort is the
 *            control, default `medium`. Long outputs, so it always streams.
 *   standard claude-sonnet-5-5: adaptive thinking at `low` effort (the skill's preferred
 *            low-latency setting; the model's own default is `high`).
 *   light    claude-haiku-5-5: thinking `disabled` (accepted at effort high or below), effort
 *            `low`. If CLAUDE_MODEL_LIGHT points at a non-Haiku model, thinking is left
 *            adaptive instead, since `disabled` 400s on Opus 5.5 and Sonnet 5.5.
 * No tier sends temperature/top_p/top_k. Haiku 5.5's tokenizer counts ~30% more tokens than
 * the OpenAI budgets assumed, so the light tier scales the budget by 1.3.
 */
export const TIER_SETTINGS: Record<
  AITier,
  { effort: AIEffort; headroom: number; scale: number; alwaysStream: boolean; disableThinking: boolean }
> = {
  deep: { effort: 'medium', headroom: 8192, scale: 1, alwaysStream: true, disableThinking: false },
  standard: { effort: 'low', headroom: 4096, scale: 1, alwaysStream: false, disableThinking: false },
  light: { effort: 'low', headroom: 0, scale: 1.3, alwaysStream: false, disableThinking: true },
};

/** Light-tier thinking-off fallback headroom when the light model is not a Haiku. */
const LIGHT_ADAPTIVE_HEADROOM = 2048;

export const JSON_ONLY_INSTRUCTION =
  'Respond with valid JSON only: no code fences, no commentary before or after the JSON.';
export const CONVERSATION_START = '(Conversation start.)';
export const CONTINUE_TURN = '(Continue.)';

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/**
 * Pull the JSON value out of a model reply: strips code fences and any prose around the
 * first top-level object or array. Returns the JSON text, or null if nothing parses.
 */
export function extractJson(raw: string): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const tryParse = (s: string) => {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  };
  if (tryParse(text)) return text;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && tryParse(fence[1].trim())) return fence[1].trim();

  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      if (tryParse(slice)) return slice;
    }
  }
  return null;
}

/** Parse a model reply as JSON, tolerating fences and surrounding prose. Throws if impossible. */
export function parseJsonReply<T = unknown>(raw: string): T {
  const json = extractJson(raw);
  if (json === null) throw new SyntaxError('Model reply was not valid JSON');
  return JSON.parse(json) as T;
}

// ---------------------------------------------------------------------------
// Claude request mapping
// ---------------------------------------------------------------------------

function mapFinishReason(stop: string | null | undefined): string {
  switch (stop) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'length';
    case 'refusal':
      return 'content_filter';
    default:
      return stop ?? 'unknown';
  }
}

function imageBlock(url: string): Anthropic.ImageBlockParam {
  const data = url.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/i);
  if (data) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: data[1].toLowerCase() as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        data: data[2],
      },
    };
  }
  return { type: 'image', source: { type: 'url', url } };
}

function toClaudeContent(content: AIMessage['content']): string | Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') return content;
  return content.map((part) =>
    part.type === 'text' ? ({ type: 'text', text: part.text } as const) : imageBlock(part.image_url.url),
  );
}

function contentAsText(content: AIMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map((p) => (p.type === 'text' ? p.text : '')).filter(Boolean).join('\n\n');
}

export interface ClaudeRequestParts {
  model: string;
  system: string | undefined;
  messages: Anthropic.MessageParam[];
  max_tokens: number;
  output_config: Anthropic.OutputConfig;
  thinking: Anthropic.ThinkingConfigParam | undefined;
  stream: boolean;
}

/** Pure mapping from the neutral options to Claude request fields. Exported for tests. */
export function buildClaudeRequest(opts: GenerateOptions): ClaudeRequestParts {
  const systemParts: string[] = [];
  if (opts.system) systemParts.push(opts.system);
  const messages: Anthropic.MessageParam[] = [];
  for (const m of opts.messages) {
    if (m.role === 'system') {
      const text = contentAsText(m.content);
      if (text.trim()) systemParts.push(text);
    } else if (typeof m.content === 'string' ? m.content.trim() : m.content.length) {
      // Claude rejects empty text blocks; OpenAI tolerated them, so drop them here.
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: toClaudeContent(m.content) });
    }
  }
  // Claude needs the conversation to open with a user turn and rejects a trailing
  // assistant turn (prefill) on claude-opus-5-5. Chat histories that start with the
  // product's welcome message, or end on an assistant turn, get a neutral user turn.
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: CONVERSATION_START });
  }
  if (messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: CONTINUE_TURN });
  }
  if (opts.json === true) systemParts.push(JSON_ONLY_INSTRUCTION);

  if (!opts.tier || !(opts.tier in TIER_SETTINGS)) {
    throw new Error(`generateText: a model tier (deep | standard | light) is required, got ${String(opts.tier)}`);
  }
  const tier = TIER_SETTINGS[opts.tier];
  const model = claudeModel(opts.tier);
  const effort = opts.effort ?? tier.effort;
  const thinkingOff = tier.disableThinking && /haiku/i.test(model);
  const headroom = tier.disableThinking && !thinkingOff ? LIGHT_ADAPTIVE_HEADROOM : tier.headroom;
  const visible = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const max_tokens = Math.min(Math.ceil(visible * tier.scale) + headroom, CLAUDE_MAX_OUTPUT);

  const output_config: Anthropic.OutputConfig = { effort };
  if (opts.json && typeof opts.json === 'object') {
    output_config.format = { type: 'json_schema', schema: opts.json.schema };
  }

  return {
    model,
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    messages,
    max_tokens,
    output_config,
    thinking: thinkingOff ? { type: 'disabled' } : undefined,
    stream: tier.alwaysStream || max_tokens > STREAM_THRESHOLD,
  };
}

function claudeBody(parts: ClaudeRequestParts): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: parts.model,
    max_tokens: parts.max_tokens,
    messages: parts.messages,
    output_config: parts.output_config,
    ...(parts.system ? { system: parts.system } : {}),
    ...(parts.thinking ? { thinking: parts.thinking } : {}),
  };
}

function claudeText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function generateWithClaude(opts: GenerateOptions): Promise<GenerateResult> {
  const parts = buildClaudeRequest(opts);
  const client = getClaude();
  const model = parts.model;
  const body = claudeBody(parts);
  const reqOpts = {
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.timeoutMs ? { timeout: opts.timeoutMs } : {}),
    ...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
  };

  const message = parts.stream
      ? await client.messages.stream(body, reqOpts).finalMessage()
      : await client.messages.create(body, reqOpts);

  let text = claudeText(message);
  if (opts.json === true) text = extractJson(text) ?? text;
  const input = message.usage?.input_tokens ?? 0;
  const output = message.usage?.output_tokens ?? 0;
  return {
    text,
    finishReason: mapFinishReason(message.stop_reason),
    usage: { prompt: input, completion: output, total: input + output },
    provider: 'anthropic',
    model,
  };
}

// ---------------------------------------------------------------------------
// OpenAI rollback branch (unchanged behaviour)
// ---------------------------------------------------------------------------

async function openaiClient() {
  const mod = await import('@/lib/openai/client');
  return mod;
}

function toOpenAIMessages(opts: GenerateOptions) {
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: AIMessage['content'] }> = [];
  if (opts.system) msgs.push({ role: 'system', content: opts.system });
  for (const m of opts.messages) msgs.push(m);
  return msgs;
}

async function generateWithOpenAI(opts: GenerateOptions): Promise<GenerateResult> {
  const { openai, DEFAULT_MODEL } = await openaiClient();
  const model = opts.openaiModel ?? DEFAULT_MODEL;
  const responseFormat =
    opts.json === true
      ? { type: 'json_object' as const }
      : opts.json
        ? { type: 'json_schema' as const, json_schema: { name: opts.json.name, strict: true, schema: opts.json.schema } }
        : undefined;
  const completion = await openai.chat.completions.create(
    {
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: toOpenAIMessages(opts) as any,
      ...(opts.maxTokens !== undefined ? { max_completion_tokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
    },
    {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.timeoutMs ? { timeout: opts.timeoutMs } : {}),
      ...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
    },
  );
  return {
    text: completion.choices?.[0]?.message?.content ?? '',
    finishReason: completion.choices?.[0]?.finish_reason ?? 'unknown',
    usage: {
      prompt: completion.usage?.prompt_tokens ?? 0,
      completion: completion.usage?.completion_tokens ?? 0,
      total: completion.usage?.total_tokens ?? 0,
    },
    provider: 'openai',
    model,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** One non-streaming generation. */
export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  return aiProvider() === 'openai' ? generateWithOpenAI(opts) : generateWithClaude(opts);
}

/** Generate and parse JSON. Throws SyntaxError if the reply is not JSON. */
export async function generateJSON<T = unknown>(
  opts: Omit<GenerateOptions, 'json'> & { json?: true | JsonSchemaFormat },
): Promise<{ data: T; result: GenerateResult }> {
  const result = await generateText({ ...opts, json: opts.json ?? true });
  return { data: parseJsonReply<T>(result.text), result };
}

/** Stream text deltas. */
export async function* streamText(opts: GenerateOptions): AsyncGenerator<string> {
  if (aiProvider() === 'openai') {
    const { openai, DEFAULT_MODEL } = await openaiClient();
    const stream = await openai.chat.completions.create({
      model: opts.openaiModel ?? DEFAULT_MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: toOpenAIMessages(opts) as any,
      stream: true,
      ...(opts.maxTokens !== undefined ? { max_completion_tokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) yield text;
    }
    return;
  }

  const parts = buildClaudeRequest(opts);
  const stream = getClaude().messages.stream(claudeBody(parts), opts.signal ? { signal: opts.signal } : undefined);
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

/**
 * Backwards-compatible helper (was in src/lib/openai/client.ts). Same signature and return.
 */
export async function generateAIResponse({
  tier,
  systemPrompt,
  messages,
  maxTokens = 500,
  temperature = 0.7,
}: {
  tier: AITier;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const { text } = await generateText({ tier, system: systemPrompt, messages, maxTokens, temperature });
  return text || '';
}

/** Model label for logs and stored metadata. */
export function activeModelLabel(tier: AITier, openaiModel?: string): string {
  if (aiProvider() === 'openai') return openaiModel ?? process.env.OPENAI_MODEL ?? 'gpt-5';
  return claudeModel(tier);
}
