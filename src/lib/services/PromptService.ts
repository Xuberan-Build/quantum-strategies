/**
 * Prompt Service
 * Centralized prompt loading with fallback hierarchy:
 * 1. Database (prompts table) - product-specific, versioned
 * 2. Product config (if defined)
 * 3. Default fallback prompts
 */

import { supabaseAdmin } from '@/lib/supabase/server';

export type PromptScope = 'system' | 'step_insight' | 'followup' | 'final_briefing';

interface PromptOptions {
  productSlug: string;
  scope: PromptScope;
  fallback?: string;
}

export class PromptService {
  /**
   * Load a product's system prompt server-side (service role).
   * Never accept this from the client: product_definitions prompt columns are
   * not readable by anon/authenticated roles.
   */
  static async getProductSystemPrompt(productSlug: string): Promise<string> {
    try {
      const { data } = await supabaseAdmin
        .from('product_definitions')
        .select('system_prompt')
        .eq('product_slug', productSlug)
        .maybeSingle();
      return data?.system_prompt ?? '';
    } catch (err) {
      console.error('[PromptService] Failed to load product system prompt:', err);
      return '';
    }
  }

  /**
   * Load prompt from database with fallback support
   */
  static async getPrompt(options: PromptOptions): Promise<string> {
    const { productSlug, scope, fallback } = options;

    try {
      // Try to load from database first
      const { data, error } = await supabaseAdmin
        .from('prompts')
        .select('content')
        .eq('product_slug', productSlug)
        .eq('scope', scope)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.content) {
        console.log(`[PromptService] Loaded ${scope} prompt from database for ${productSlug}`);
        return data.content;
      }

      // Fall back to provided default
      if (fallback) {
        console.log(`[PromptService] Using fallback ${scope} prompt for ${productSlug}`);
        return fallback;
      }

      // Fall back to built-in defaults
      const defaultPrompt = this.getDefaultPrompt(scope, productSlug);
      console.log(`[PromptService] Using default ${scope} prompt for ${productSlug}`);
      return defaultPrompt;

    } catch (error) {
      console.error(`[PromptService] Error loading ${scope} prompt:`, error);

      // Always return something, never fail
      return fallback || this.getDefaultPrompt(scope, productSlug);
    }
  }

  /**
   * Get default prompts (last resort fallback)
   */
  private static getDefaultPrompt(scope: PromptScope, productSlug: string): string {
    const productName = this.getProductName(productSlug);

    switch (scope) {
      case 'system':
        return `You are an AI assistant helping users with ${productName}. Provide clear, helpful, and accurate responses.`;

      case 'step_insight':
        return `You are a strategic advisor for ${productName}. Analyze the user's input and provide actionable insights based on their unique situation. Be specific, practical, and encouraging.`;

      case 'followup':
        return `Continue the conversation naturally. Answer the user's question with clarity and depth. Reference previous context when relevant. Keep responses concise but thorough.`;

      case 'final_briefing':
        return `Generate a comprehensive strategic briefing based on all the information provided. Create a clear, actionable plan that synthesizes the user's goals, challenges, and the insights discussed. Format with clear sections and specific next steps.`;

      default:
        return `You are a helpful AI assistant for ${productName}.`;
    }
  }

  /**
   * Get product display name from slug
   */
  private static getProductName(productSlug: string): string {
    const productNames: Record<string, string> = {
      'business-alignment': 'Business Alignment Orientation',
      'quantum-structure-profit-scale': 'Quantum Structure, Profit & Scale',
    };

    return productNames[productSlug] || 'this product';
  }

  /**
   * Load multiple prompts at once
   */
  static async getPrompts(
    productSlug: string,
    scopes: PromptScope[]
  ): Promise<Record<PromptScope, string>> {
    const prompts: Record<string, string> = {};

    await Promise.all(
      scopes.map(async (scope) => {
        prompts[scope] = await this.getPrompt({ productSlug, scope });
      })
    );

    return prompts as Record<PromptScope, string>;
  }

  /**
   * Validate prompt content (check for common issues)
   */
  static validatePrompt(prompt: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!prompt || prompt.trim().length === 0) {
      issues.push('Prompt is empty');
    }

    if (prompt.length > 10000) {
      issues.push('Prompt exceeds 10,000 characters');
    }

    // Check for placeholder text that wasn't replaced
    if (prompt.includes('[REPLACE]') || prompt.includes('TODO')) {
      issues.push('Prompt contains placeholder text');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
