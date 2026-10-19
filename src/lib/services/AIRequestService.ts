/**
 * AI Request Service
 * Centralized AI request handling (Claude by default; see src/lib/ai/generate.ts) with:
 * - Retry logic
 * - Error handling
 * - Token management
 * - Consistent logging
 */

import { activeModelLabel, generateText, type AIEffort, type AIMessage, type AITier } from '@/lib/ai/generate';

export interface AIRequestOptions {
  /** Required: Claude model tier (deep | standard | light). */
  tier: AITier;
  /** OpenAI model, used only when AI_PROVIDER=openai (rollback). Claude uses CLAUDE_MODEL. */
  model?: string;
  messages: AIMessage[];
  maxTokens?: number;
  /** Honoured on the OpenAI rollback path only; Claude rejects sampling params. */
  temperature?: number;
  /** Claude effort override. Defaults to the tier's setting. */
  effort?: AIEffort;
  systemPrompt?: string;
  retries?: number;
  context?: string; // For logging (e.g., 'step-insight', 'final-briefing')
}

export interface AIResponse {
  content: string;
  finishReason: string;
  generationMs: number;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class AIRequestService {
  private static readonly DEFAULT_MODEL = 'gpt-4o';
  private static readonly DEFAULT_MAX_TOKENS = 2000;
  private static readonly DEFAULT_RETRIES = 2;

  /**
   * Make an AI request with automatic retry logic
   */
  static async request(options: AIRequestOptions): Promise<AIResponse> {
    const {
      tier,
      model = this.DEFAULT_MODEL,
      messages,
      maxTokens = this.DEFAULT_MAX_TOKENS,
      temperature,
      systemPrompt,
      effort,
      retries = this.DEFAULT_RETRIES,
      context = 'ai-request',
    } = options;

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[AIRequestService] ${context} - Attempt ${attempt + 1}/${retries + 1}`);
        console.log(`[AIRequestService] Model: ${activeModelLabel(tier, model)}, Max tokens: ${maxTokens}`);

        const startTime = Date.now();

        // Make the API call. The SDK's own retries are off: this loop is the retry policy.
        const result = await generateText({
          tier,
          system: systemPrompt,
          messages,
          maxTokens,
          temperature,
          effort,
          openaiModel: model,
          maxRetries: 0,
        });

        const duration = Date.now() - startTime;

        const content = result.text || '';
        const finishReason = result.finishReason || 'unknown';

        // Log success
        console.log(`[AIRequestService] ${context} - Success in ${duration}ms`);
        console.log(`[AIRequestService] Finish reason: ${finishReason}`);
        console.log(
          `[AIRequestService] Tokens: ${result.usage.prompt} prompt, ` +
            `${result.usage.completion} completion, ` +
            `${result.usage.total} total`
        );

        // Check for empty content
        if (!content && finishReason === 'length') {
          throw new Error('Response truncated due to token limit. Increase maxTokens.');
        }

        if (!content) {
          throw new Error(`Empty response with finish_reason: ${finishReason}`);
        }

        return {
          content,
          finishReason,
          generationMs: duration,
          tokensUsed: {
            prompt: result.usage.prompt,
            completion: result.usage.completion,
            total: result.usage.total,
          },
        };
      } catch (error: any) {
        lastError = error;

        // Log the error
        console.error(`[AIRequestService] ${context} - Attempt ${attempt + 1} failed:`, error?.message || error);

        // Don't retry on certain errors
        if (error?.status === 401 || error?.status === 403) {
          throw new Error('Invalid API key or AI credentials. Check the Claude workload identity federation settings (or ANTHROPIC_API_KEY locally).');
        }

        if (error?.status === 400) {
          throw new Error(`Invalid request: ${error?.message || 'Bad request'}`);
        }

        // If this was the last attempt, throw
        if (attempt === retries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`[AIRequestService] Retrying in ${waitTime}ms...`);
        await this.sleep(waitTime);
      }
    }

    // All retries failed
    throw new Error(
      `AI request failed after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Make a simple text completion request
   */
  static async complete(
    prompt: string,
    options: Partial<AIRequestOptions> & { tier: AITier }
  ): Promise<string> {
    const response = await this.request({
      messages: [{ role: 'user', content: prompt }],
      ...options,
    });

    return response.content;
  }

  /**
   * Make a request with chat history
   */
  static async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    options: Partial<AIRequestOptions> & { tier: AITier }
  ): Promise<string> {
    const response = await this.request({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...options,
    });

    return response.content;
  }

  /**
   * Helper to sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Estimate token count (rough approximation)
   * More accurate counting would require tiktoken library
   */
  static estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text will fit within token limit
   */
  static willFitInTokenLimit(text: string, maxTokens: number): boolean {
    return this.estimateTokens(text) <= maxTokens;
  }
}
