import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { AIRequestService } from '@/lib/services/AIRequestService';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find sessions that already have insights so we can exclude them
  const { data: existing } = await supabaseAdmin
    .from('session_insights')
    .select('session_id');
  const existingIds = (existing || []).map((r: any) => r.session_id as string);

  // Fetch completed sessions without insights (limit 20 per run)
  let query = supabaseAdmin
    .from('product_sessions')
    .select('id, user_id, product_slug, placements, users(placements)')
    .not('completed_at', 'is', null)
    .limit(20);

  if (existingIds.length > 0) {
    query = query.not('id', 'in', `(${existingIds.map((id) => `"${id}"`).join(',')})`);
  }

  const { data: sessions, error: sessionsError } = await query;
  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  let processed = 0;

  for (const session of sessions || []) {
    try {
      // Fetch conversations for this session
      const { data: conversations } = await supabaseAdmin
        .from('conversations')
        .select('step_number, messages')
        .eq('session_id', session.id)
        .order('step_number', { ascending: true });

      const userResponses = (conversations || [])
        .filter((c: any) => c.step_number !== 999)
        .flatMap((c: any) =>
          ((c.messages as any[]) || [])
            .filter((m: any) => m.role === 'user')
            .map((m: any) => `Step ${c.step_number}: ${m.content}`)
        )
        .join('\n\n');

      if (!userResponses) continue;

      // Extract placements (session-level falls back to user-level)
      const rawPlacements: any =
        session.placements && Object.keys(session.placements).length > 0
          ? session.placements
          : (session.users as any)?.placements || {};

      const astro = rawPlacements?.astrology || {};
      const hd = rawPlacements?.human_design || {};
      const isKnown = (v: any) => v && v !== 'UNKNOWN';

      const hdType = isKnown(hd.type) ? hd.type : null;
      const hdAuthority = isKnown(hd.authority) ? hd.authority : null;
      const sunSign = isKnown(astro.sun) ? astro.sun : null;
      const moonSign = isKnown(astro.moon) ? astro.moon : null;

      // Regex-based business model extraction (free, no LLM)
      const lower = userResponses.toLowerCase();
      let businessModel = 'Multiple Streams';
      if (lower.match(/coach|coaching|mentor/)) businessModel = 'Coaching';
      else if (lower.match(/course|program|training/)) businessModel = 'Course Creator';
      else if (lower.match(/service|agency|consultant|freelance/)) businessModel = 'Service Provider';
      else if (lower.match(/saas|software|app/)) businessModel = 'SaaS';
      else if (lower.match(/membership|community|subscription/)) businessModel = 'Membership';

      const painWords = ['struggle', 'challenge', 'difficult', 'hard', 'problem', 'frustrat', 'stuck', 'overwhelm'];
      const painPoints = userResponses
        .split(/[.!?]/)
        .filter((s) => painWords.some((w) => s.toLowerCase().includes(w)))
        .slice(0, 3)
        .map((s) => s.trim())
        .filter(Boolean);

      const revenueMatch = userResponses.match(/\$[\d,]+(?:k|K)?(?:\s*(?:\/|per)\s*\w+)?/);
      const revenueGoal = revenueMatch ? revenueMatch[0] : null;

      // LLM theme extraction
      let themes: string[] = [];
      try {
        const themeResult = await AIRequestService.request({
          model: 'gpt-4o-mini',
          systemPrompt:
            'You are an insight extractor. Given user responses from a brand strategy session, return a JSON array of 3-5 short topic tags (1-3 words each) representing the main themes. Return only the JSON array, nothing else.',
          messages: [{ role: 'user', content: userResponses.slice(0, 3000) }],
          maxTokens: 100,
          context: 'extract-insights-themes',
          retries: 0,
        });
        themes = JSON.parse(themeResult.content);
        if (!Array.isArray(themes)) themes = [];
      } catch {
        // Skip themes if LLM fails
      }

      await supabaseAdmin.from('session_insights').upsert(
        {
          session_id: session.id,
          user_id: session.user_id,
          product_slug: session.product_slug,
          business_model: businessModel,
          pain_points: painPoints.length > 0 ? painPoints : null,
          revenue_goal: revenueGoal,
          themes: themes.length > 0 ? themes : null,
          hd_type: hdType,
          hd_authority: hdAuthority,
          sun_sign: sunSign,
          moon_sign: moonSign,
          extraction_model: 'gpt-4o-mini',
          extracted_at: new Date().toISOString(),
        },
        { onConflict: 'session_id', ignoreDuplicates: false }
      );

      processed++;
    } catch (err: any) {
      console.error(`[extract-insights] Failed for session ${session.id}:`, err.message);
    }
  }

  return NextResponse.json({ processed });
}

export const dynamic = 'force-dynamic';
