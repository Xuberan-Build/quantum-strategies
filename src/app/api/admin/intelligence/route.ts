import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET() {
  const { admin: _admin, error: authError } = await validateAdminApiRequest();
  if (!_admin) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const [
      sessionsResult,
      insightsResult,
      objectionsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('product_sessions')
        .select('product_slug, completed_at'),
      supabaseAdmin
        .from('session_insights')
        .select('product_slug, business_model, pain_points, themes, hd_type, sun_sign'),
      supabaseAdmin
        .from('complete_journey_feedback')
        .select('what_would_make_you_say_yes')
        .not('what_would_make_you_say_yes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const sessions = sessionsResult.data || [];
    const insights = insightsResult.data || [];

    // Product funnel
    const funnelMap = new Map<string, { started: number; completed: number }>();
    for (const s of sessions) {
      const slug = s.product_slug || 'unknown';
      if (!funnelMap.has(slug)) funnelMap.set(slug, { started: 0, completed: 0 });
      const entry = funnelMap.get(slug)!;
      entry.started++;
      if (s.completed_at) entry.completed++;
    }
    const funnel = Array.from(funnelMap.entries())
      .map(([product_slug, { started, completed }]) => ({
        product_slug,
        started,
        completed,
        completion_rate: started > 0 ? Math.round((completed / started) * 100) : 0,
      }))
      .sort((a, b) => b.started - a.started);

    // Theme aggregation
    const themeCount = new Map<string, number>();
    for (const i of insights) {
      for (const t of i.themes || []) {
        themeCount.set(t, (themeCount.get(t) || 0) + 1);
      }
    }
    const topThemes = Array.from(themeCount.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Pain point aggregation
    const painCount = new Map<string, number>();
    for (const i of insights) {
      for (const p of i.pain_points || []) {
        const key = p.trim().slice(0, 60);
        if (key) painCount.set(key, (painCount.get(key) || 0) + 1);
      }
    }
    const topPainPoints = Array.from(painCount.entries())
      .map(([pain_point, count]) => ({ pain_point, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // HD type distribution
    const hdCount = new Map<string, number>();
    for (const i of insights) {
      if (i.hd_type) hdCount.set(i.hd_type, (hdCount.get(i.hd_type) || 0) + 1);
    }
    const hdDistribution = Array.from(hdCount.entries())
      .map(([hd_type, count]) => ({ hd_type, count }))
      .sort((a, b) => b.count - a.count);

    // Sun sign distribution
    const sunCount = new Map<string, number>();
    for (const i of insights) {
      if (i.sun_sign) sunCount.set(i.sun_sign, (sunCount.get(i.sun_sign) || 0) + 1);
    }
    const sunDistribution = Array.from(sunCount.entries())
      .map(([sun_sign, count]) => ({ sun_sign, count }))
      .sort((a, b) => b.count - a.count);

    const recentObjections = (objectionsResult.data || [])
      .map((r: any) => r.what_would_make_you_say_yes as string)
      .filter(Boolean);

    return NextResponse.json({
      funnel,
      topThemes,
      topPainPoints,
      hdDistribution,
      sunDistribution,
      recentObjections,
      totalSessions: sessions.length,
      totalInsights: insights.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
