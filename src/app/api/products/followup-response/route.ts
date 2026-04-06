import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { validateUserInput, validateSessionOwnership } from '@/lib/security/input-validation';
import { PromptService } from '@/lib/services/PromptService';
import { AIRequestService } from '@/lib/services/AIRequestService';

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      stepNumber,
      stepData,
      systemPrompt,
      mainResponse,
      followUpQuestion,
      conversationHistory,
      placements = {},
      productSlug = 'business-alignment',
      userId,
    } = await request.json();

    // Rate limiting check
    const rateLimitKey = sessionId || 'anonymous';
    const rateLimit = checkRateLimit(rateLimitKey, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before making more requests.' },
        { status: 429 }
      );
    }

    // Validate session ownership
    if (sessionId && userId) {
      const isOwner = await validateSessionOwnership(sessionId, userId, supabaseAdmin);
      if (!isOwner) {
        return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
      }
    }

    // Validate and sanitize user input
    const inputValidation = validateUserInput(followUpQuestion || '', { maxLength: 2000 });
    if (!inputValidation.isValid) {
      console.warn('[followup] Input validation warnings:', inputValidation.warnings);
    }
    const sanitizedQuestion = inputValidation.sanitized;

    const astro = placements?.astrology || {};
    const hd = placements?.human_design || {};
    const placementSummary = `
Astrology: Sun ${astro.sun || 'UNKNOWN'}, Moon ${astro.moon || 'UNKNOWN'}, Rising ${astro.rising || 'UNKNOWN'}, 2nd house ${astro.houses || 'UNKNOWN'}, Mars ${astro.mars || 'UNKNOWN'}, Venus ${astro.venus || 'UNKNOWN'}, Mercury ${astro.mercury || 'UNKNOWN'}, Saturn ${astro.saturn || 'UNKNOWN'}, Pluto ${astro.pluto || 'UNKNOWN'}
Human Design: Type ${hd.type || 'UNKNOWN'}, Strategy ${hd.strategy || 'UNKNOWN'}, Authority ${hd.authority || 'UNKNOWN'}, Profile ${hd.profile || 'UNKNOWN'}, Centers ${hd.centers || 'UNKNOWN'}, Gifts ${hd.gifts || 'UNKNOWN'}
`.trim();

    // Load prompt from database with fallback
    const basePrompt = await PromptService.getPrompt({
      productSlug: (productSlug || stepData?.product_slug || 'quantum-initiation'),
      scope: 'followup',
      fallback: 'Answer follow-ups concisely (2–3 paragraphs max). Use placements (money/identity houses 2/8/10/11, Sun/Moon/Rising, Mars/Venus/Mercury/Saturn/Pluto, HD type/strategy/authority/centers/gifts). If key data is missing (e.g., 2nd-house ruler/location), ask briefly and give one micro-action anyway. If the user mentions revenue/price goals, align your micro-action to that target.',
    });

    // Build context for AI
    const contextPrompt = `
You are helping a user with step ${stepNumber} of their journey.
Step Title: ${stepData.title}
Step Question: ${stepData.question}
Main response: "${mainResponse}"

Their follow-up:
- ${basePrompt}
Placements: ${placementSummary}
    `.trim();

    // Convert conversation history to message format
    const previousMessages = conversationHistory
      .slice(1) // Skip the welcome message
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // Generate AI response using AIRequestService
    let aiResponseText = '';
    let aiResult: Awaited<ReturnType<typeof AIRequestService.request>> | null = null;
    try {
      aiResult = await AIRequestService.request({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        systemPrompt: `${systemPrompt}\n\n${contextPrompt}`,
        messages: [...previousMessages, { role: 'user', content: sanitizedQuestion }],
        maxTokens: 10000,
        context: 'followup-response',
        retries: 2,
      });

      aiResponseText = aiResult.content;

      console.log('[followup-response] AI response successful');
      console.log(`[followup-response] Tokens used: ${aiResult.tokensUsed.total} (${aiResult.tokensUsed.prompt} prompt, ${aiResult.tokensUsed.completion} completion)`);
    } catch (err: any) {
      console.error('[followup-response] AI request failed:', err?.message || err);
      return NextResponse.json({ error: 'AI generation failed', detail: err?.message || 'Unknown error' }, { status: 500 });
    }

    const aiResponse = aiResponseText;

    // Log follow-up exchange to conversations and generation_log
    try {
      const { data: convo } = await supabaseAdmin
        .from('conversations')
        .select('messages, total_input_tokens, total_output_tokens')
        .eq('session_id', sessionId)
        .eq('step_number', stepNumber)
        .maybeSingle();
      const existing = (convo?.messages as any[]) || [];
      const updated = [
        ...existing,
        { role: 'user', content: followUpQuestion, created_at: new Date().toISOString(), type: 'followup_question' },
        { role: 'assistant', content: aiResponse, created_at: new Date().toISOString(), type: 'followup_response' },
      ];
      await supabaseAdmin
        .from('conversations')
        .upsert(
          {
            session_id: sessionId,
            step_number: stepNumber,
            messages: updated,
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            total_input_tokens: ((convo as any)?.total_input_tokens || 0) + (aiResult?.tokensUsed.prompt || 0),
            total_output_tokens: ((convo as any)?.total_output_tokens || 0) + (aiResult?.tokensUsed.completion || 0),
          },
          { onConflict: 'session_id,step_number' }
        );

      // Fire-and-forget: log to generation_log
      supabaseAdmin.from('generation_log').insert({
        user_id: userId || null,
        session_id: sessionId,
        product_slug: productSlug,
        event_type: 'follow_up',
        step_number: stepNumber,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        input_tokens: aiResult?.tokensUsed.prompt ?? null,
        output_tokens: aiResult?.tokensUsed.completion ?? null,
        generation_ms: aiResult?.generationMs ?? null,
        user_input: {
          step_number: stepNumber,
          follow_up_question: followUpQuestion,
        },
        ai_output: aiResponse,
      }).then(() => {}, () => {});
    } catch (e) {
      // ignore logging errors
    }

    return NextResponse.json({ aiResponse });
  } catch (error: any) {
    console.error('Error generating follow-up response:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', details: error.message },
      { status: 500 }
    );
  }
}
