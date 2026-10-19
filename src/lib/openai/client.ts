import OpenAI from 'openai';

/**
 * OpenAI client. Text generation no longer uses this directly: it goes through
 * src/lib/ai/generate.ts (Claude by default; this client only when AI_PROVIDER=openai).
 * Embeddings (text-embedding-3-small) still use it until they move to Voyage.
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Used for embeddings-adjacent code and the AI_PROVIDER=openai rollback path only.
export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

// Kept for backwards compatibility; now provider-neutral (Claude by default).
export { generateAIResponse } from '@/lib/ai/generate';
