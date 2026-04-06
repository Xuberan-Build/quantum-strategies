import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { validateUserInput, validateSessionOwnership } from '@/lib/security/input-validation';
import { PromptService } from '@/lib/services/PromptService';
import { AIRequestService } from '@/lib/services/AIRequestService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      stepNumber,
      stepData,
      mainResponse,
      placements,
      systemPrompt,
      productName,
      priorMessages = [],
      productSlug = 'business-alignment',
      sessionId,
      userId,
    } = body || {};

    // Rate limiting check
    const rateLimitKey = sessionId || 'anonymous';
    const rateLimit = checkRateLimit(rateLimitKey, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before making more requests.' },
        { status: 429 }
      );
    }

    // Validate session ownership if sessionId provided
    if (sessionId && userId) {
      const isOwner = await validateSessionOwnership(sessionId, userId, supabaseAdmin);
      if (!isOwner) {
        return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
      }
    }

    // Validate and sanitize user input
    const inputValidation = validateUserInput(mainResponse || '', { maxLength: 3000 });
    if (!inputValidation.isValid) {
      console.warn('[step-insight] Input validation warnings:', inputValidation.warnings);
    }
    const sanitizedResponse = inputValidation.sanitized;

    const astro = placements?.astrology || {};
    const hd = placements?.human_design || {};

    console.log('[step-insight] Placements from Supabase:', placements ? 'Present' : 'MISSING');
    console.log('[step-insight] Astrology data:', Object.keys(astro).length, 'fields');
    console.log('[step-insight] HD data:', Object.keys(hd).length, 'fields');

    const placementSummary = `
Astrology: Sun ${astro.sun || 'UNKNOWN'}, Moon ${astro.moon || 'UNKNOWN'}, Rising ${astro.rising || 'UNKNOWN'}, Houses ${astro.houses || 'UNKNOWN'} (if 2nd house is empty, note its sign/ruler), Mercury ${astro.mercury || 'UNKNOWN'}, Venus ${astro.venus || 'UNKNOWN'}, Mars ${astro.mars || 'UNKNOWN'}, Jupiter ${astro.jupiter || 'UNKNOWN'}, Saturn ${astro.saturn || 'UNKNOWN'}, Uranus ${astro.uranus || 'UNKNOWN'}, Neptune ${astro.neptune || 'UNKNOWN'}, Pluto ${astro.pluto || 'UNKNOWN'}
Human Design: Type ${hd.type || 'UNKNOWN'}, Strategy ${hd.strategy || 'UNKNOWN'}, Authority ${hd.authority || 'UNKNOWN'}, Profile ${hd.profile || 'UNKNOWN'}, Centers ${hd.centers || 'UNKNOWN'}, Gifts ${hd.gifts || 'UNKNOWN'}
`.trim();

    // Load prompt from database with fallback
    const basePrompt = await PromptService.getPrompt({
      productSlug: productSlug,
      scope: 'step_insight',
      fallback: `Respond after the user answers a step. Keep it to 1–3 short paragraphs. Ground in placements (Sun/Moon/Rising, Venus/Mars/Mercury/Saturn/Pluto, HD type/strategy/authority/centers/gifts, relevant houses). Include one actionable nudge relevant to the step and product focus.`,
    });

    const context = `
${basePrompt}

Step ${stepNumber}: ${stepData?.title || ''}
Question: ${stepData?.question || 'N/A'}
User response: ${mainResponse || 'N/A'}
Placements:
${placementSummary}
Product: ${productName || 'Business Alignment Orientation'}
`.trim();

    // Build conversation history
    const messages = [
      ...priorMessages,
      { role: 'user', content: sanitizedResponse || '' },
    ];

    // Use AIRequestService for cleaner, more reliable AI requests
    let content = '';
    let aiResponse: Awaited<ReturnType<typeof AIRequestService.request>> | null = null;
    try {
      aiResponse = await AIRequestService.request({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        systemPrompt: `${systemPrompt || ''}\n\n${context}`,
        messages: messages as any[],
        maxTokens: 10000,
        context: 'step-insight',
        retries: 2,
      });

      content = aiResponse.content;

      console.log('[step-insight] AI response successful');
      console.log(`[step-insight] Tokens used: ${aiResponse.tokensUsed.total} (${aiResponse.tokensUsed.prompt} prompt, ${aiResponse.tokensUsed.completion} completion)`);
    } catch (err: any) {
      console.error('[step-insight] AI request failed:', err?.message || err);
      return NextResponse.json(
        { error: 'AI generation failed', detail: err?.message || 'Unknown error' },
        { status: 500 }
      );
    }

    // Log AI response to conversations and generation_log
    try {
      if (body?.sessionId) {
        const { data: convo } = await supabaseAdmin
          .from('conversations')
          .select('messages')
          .eq('session_id', body.sessionId)
          .eq('step_number', stepNumber)
          .maybeSingle();
        const existing = (convo?.messages as any[]) || [];
        const updated = [
          ...existing,
          { role: 'assistant', content, created_at: new Date().toISOString(), type: 'step_insight' },
        ];
        await supabaseAdmin
          .from('conversations')
          .upsert(
            {
              session_id: body.sessionId,
              step_number: stepNumber,
              messages: updated,
              model: body.model || process.env.OPENAI_MODEL || 'gpt-4o',
              total_input_tokens: (convo as any)?.total_input_tokens
                ? ((convo as any).total_input_tokens + (aiResponse?.tokensUsed.prompt || 0))
                : (aiResponse?.tokensUsed.prompt || 0),
              total_output_tokens: (convo as any)?.total_output_tokens
                ? ((convo as any).total_output_tokens + (aiResponse?.tokensUsed.completion || 0))
                : (aiResponse?.tokensUsed.completion || 0),
            },
            { onConflict: 'session_id,step_number' }
          );

        // Fire-and-forget: log to generation_log
        supabaseAdmin.from('generation_log').insert({
          user_id: userId || null,
          session_id: body.sessionId,
          product_slug: productSlug,
          event_type: 'step_insight',
          step_number: stepNumber,
          model: body.model || process.env.OPENAI_MODEL || 'gpt-4o',
          input_tokens: aiResponse?.tokensUsed.prompt ?? null,
          output_tokens: aiResponse?.tokensUsed.completion ?? null,
          generation_ms: aiResponse?.generationMs ?? null,
          user_input: {
            step_number: stepNumber,
            step_title: stepData?.title || null,
            user_answer: sanitizedResponse,
          },
          ai_output: content,
        }).then(() => {}, () => {});
      }
    } catch (e) {
      // ignore logging errors
    }

    return NextResponse.json({ aiResponse: content });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to generate insight' }, { status: 500 });
  }
}
