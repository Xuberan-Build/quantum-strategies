/**
 * AI Request Service
 * Centralized OpenAI API request handling with:
 * - Retry logic
 * - Error handling
 * - Token management
 * - Consistent logging
 */

import { openai } from '@/lib/openai/client';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface AIRequestOptions {
  model?: string;
  messages: ChatCompletionMessageParam[];
  maxTokens?: number;
  temperature?: number;
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
      model = this.DEFAULT_MODEL,
      messages,
      maxTokens = this.DEFAULT_MAX_TOKENS,
      temperature,
      systemPrompt,
      retries = this.DEFAULT_RETRIES,
      context = 'ai-request',
    } = options;

    // Build full messages array with system prompt if provided
    const fullMessages: ChatCompletionMessageParam[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[AIRequestService] ${context} - Attempt ${attempt + 1}/${retries + 1}`);
        console.log(`[AIRequestService] Model: ${model}, Max tokens: ${maxTokens}`);

        const startTime = Date.now();

        // Make the API call
        const completion = await openai.chat.completions.create({
          model,
          messages: fullMessages,
          max_completion_tokens: maxTokens,
          ...(temperature !== undefined && { temperature }),
        });

        const duration = Date.now() - startTime;

        const content = completion.choices[0]?.message?.content || '';
        const finishReason = completion.choices[0]?.finish_reason || 'unknown';

        // Log success
        console.log(`[AIRequestService] ${context} - Success in ${duration}ms`);
        console.log(`[AIRequestService] Finish reason: ${finishReason}`);
        console.log(
          `[AIRequestService] Tokens: ${completion.usage?.prompt_tokens || 0} prompt, ` +
            `${completion.usage?.completion_tokens || 0} completion, ` +
            `${completion.usage?.total_tokens || 0} total`
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
            prompt: completion.usage?.prompt_tokens || 0,
            completion: completion.usage?.completion_tokens || 0,
            total: completion.usage?.total_tokens || 0,
          },
        };
      } catch (error: any) {
        lastError = error;

        // Log the error
        console.error(`[AIRequestService] ${context} - Attempt ${attempt + 1} failed:`, error?.message || error);

        // Don't retry on certain errors
        if (error?.status === 401 || error?.status === 403) {
          throw new Error('Invalid API key. Check your OpenAI credentials.');
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
    options: Partial<AIRequestOptions> = {}
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
    options: Partial<AIRequestOptions> = {}
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
