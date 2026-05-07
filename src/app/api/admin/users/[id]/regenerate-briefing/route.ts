import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { AIRequestService } from '@/lib/services/AIRequestService';
import { PromptService } from '@/lib/services/PromptService';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (authError || !admin) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: authError === 'Not authenticated' ? 401 : 403 });

  try {
    const { id: userId } = await params;
    const body = await _req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Fetch session + user in parallel
    const [sessionResult, userResult] = await Promise.all([
      supabaseAdmin
        .from('product_sessions')
        .select('id, product_slug, placements, user_id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single(),
      supabaseAdmin
        .from('users')
        .select('placements, placements_confirmed, name')
        .eq('id', userId)
        .single(),
    ]);

    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessionResult.data;

    // Use session placements; fall back to user profile placements
    const placements =
      session.placements && Object.keys(session.placements).length > 0
        ? session.placements
        : userResult.data?.placements || {};

    // Fetch conversations for this session
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('step_number, messages')
      .eq('session_id', sessionId)
      .order('step_number', { ascending: true });

    const userResponses = (conversations || [])
      .filter((c) => c.step_number !== 999)
      .flatMap((c: any) =>
        ((c.messages as any[]) || [])
          .filter((m: any) => m.role === 'user')
          .map((m: any) => `Step ${c.step_number}: ${m.content}`)
      )
      .join('\n\n');

    const wizardNudges = (conversations || [])
      .flatMap((c: any) =>
        ((c.messages as any[]) || [])
          .filter((m: any) => m.role === 'assistant' && m.type === 'step_insight')
          .map((m: any) => (m.content ? `Step ${c.step_number} Insight:\n${m.content}` : null))
          .filter(Boolean)
      )
      .join('\n\n---\n\n');

    // Build placement summary
    const astro = (placements as any)?.astrology || {};
    const hd = (placements as any)?.human_design || {};
    const isKnown = (v: any) => v && v !== 'UNKNOWN';
    const astroLines: string[] = [];
    const hdLines: string[] = [];

    if (isKnown(astro.sun)) astroLines.push(`Sun: ${astro.sun}`);
    if (isKnown(astro.moon)) astroLines.push(`Moon: ${astro.moon}`);
    if (isKnown(astro.rising)) astroLines.push(`Rising: ${astro.rising}`);
    if (isKnown(hd.type)) hdLines.push(`Type: ${hd.type}`);
    if (isKnown(hd.profile)) hdLines.push(`Profile: ${hd.profile}`);
    if (isKnown(hd.authority)) hdLines.push(`Authority: ${hd.authority}`);
    if (isKnown(hd.strategy)) hdLines.push(`Strategy: ${hd.strategy}`);

    const placementSummary = [
      astroLines.length ? `ASTROLOGY:\n${astroLines.join('\n')}` : '',
      hdLines.length ? `HUMAN DESIGN:\n${hdLines.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const { data: product } = await supabaseAdmin
      .from('product_definitions')
      .select('final_deliverable_prompt, name')
      .eq('product_slug', session.product_slug)
      .single();

    const systemPrompt = await PromptService.getPrompt({
      productSlug: session.product_slug,
      scope: 'final_briefing',
      fallback: 'You are the Quantum Brand Architect AI. Produce a premium-grade blueprint worth $700 of clarity.',
    });

    const result = await AIRequestService.request({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      systemPrompt,
      messages: [
        { role: 'user', content: placementSummary ? `MY CHART DATA:\n\n${placementSummary}` : 'Limited chart data available.' },
        { role: 'user', content: `MY RESPONSES:\n\n${userResponses || 'No responses found.'}${wizardNudges ? `\n\nINSIGHTS:\n${wizardNudges}` : ''}` },
        { role: 'user', content: product?.final_deliverable_prompt || 'Generate the full blueprint deliverable.' },
      ],
      maxTokens: 15000,
      context: 'admin-regenerate-briefing',
      retries: 1,
    });

    const briefing = result.content;

    await supabaseAdmin
      .from('product_sessions')
      .update({
        deliverable_content: briefing,
        deliverable_model: process.env.OPENAI_MODEL || 'gpt-4o',
        deliverable_input_tokens: result.tokensUsed.prompt,
        deliverable_output_tokens: result.tokensUsed.completion,
      })
      .eq('id', sessionId);

    return NextResponse.json({ success: true, preview: briefing.slice(0, 300) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
