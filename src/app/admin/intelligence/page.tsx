import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../admin-layout.module.css';

async function getIntelligence() {
  const [sessionsResult, insightsResult, objectionsResult] = await Promise.all([
    supabaseAdmin.from('product_sessions').select('product_slug, completed_at'),
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
    .map(([slug, { started, completed }]) => ({
      slug,
      started,
      completed,
      rate: started > 0 ? Math.round((completed / started) * 100) : 0,
    }))
    .sort((a, b) => b.started - a.started);

  // Themes
  const themeCount = new Map<string, number>();
  for (const i of insights) {
    for (const t of i.themes || []) themeCount.set(t, (themeCount.get(t) || 0) + 1);
  }
  const topThemes = Array.from(themeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Pain points
  const painCount = new Map<string, number>();
  for (const i of insights) {
    for (const p of i.pain_points || []) {
      const key = p.trim().slice(0, 60);
      if (key) painCount.set(key, (painCount.get(key) || 0) + 1);
    }
  }
  const topPainPoints = Array.from(painCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // HD type distribution
  const hdCount = new Map<string, number>();
  for (const i of insights) {
    if (i.hd_type) hdCount.set(i.hd_type, (hdCount.get(i.hd_type) || 0) + 1);
  }
  const hdDistribution = Array.from(hdCount.entries()).sort((a, b) => b[1] - a[1]);

  // Sun sign distribution
  const sunCount = new Map<string, number>();
  for (const i of insights) {
    if (i.sun_sign) sunCount.set(i.sun_sign, (sunCount.get(i.sun_sign) || 0) + 1);
  }
  const sunDistribution = Array.from(sunCount.entries()).sort((a, b) => b[1] - a[1]);

  const objections = (objectionsResult.data || [])
    .map((r: any) => r.what_would_make_you_say_yes as string)
    .filter(Boolean);

  return {
    funnel,
    topThemes,
    topPainPoints,
    hdDistribution,
    sunDistribution,
    objections,
    totalSessions: sessions.length,
    totalInsights: insights.length,
  };
}

export default async function IntelligencePage() {
  const data = await getIntelligence();

  const cardStyle: React.CSSProperties = {
    background: 'var(--admin-surface)',
    border: '1px solid var(--admin-border)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--admin-text-muted)',
    marginBottom: '1rem',
    marginTop: 0,
  };

  return (
    <div className={styles.pageContent}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Product Intelligence</h1>
          <p className={styles.pageDescription}>
            {data.totalSessions} sessions · {data.totalInsights} analyzed
            {data.totalInsights < data.totalSessions && (
              <span style={{ color: 'var(--admin-text-muted)', marginLeft: '0.5rem' }}>
                ({data.totalSessions - data.totalInsights} pending extraction)
              </span>
            )}
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Product Funnel */}
        <div style={cardStyle}>
          <p style={sectionTitleStyle}>Product Funnel</p>
          {data.funnel.length === 0 ? (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No session data yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  {['Product', 'Started', 'Completed', 'Rate'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--admin-text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((row) => (
                  <tr key={row.slug} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--admin-text)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{row.slug}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>{row.started}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>{row.completed}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--admin-border)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${row.rate}%`, background: 'var(--admin-accent)', borderRadius: '9999px' }} />
                        </div>
                        <span style={{ minWidth: '2.5rem', color: row.rate < 30 ? '#ef4444' : 'var(--admin-text)' }}>{row.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Themes + Pain Points */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Top Themes</p>
            {data.topThemes.length === 0 ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>Run the extract-insights cron to populate themes.</p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.topThemes.map(([theme, count]) => (
                  <li key={theme} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                    <span>{theme}</span>
                    <span style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '9999px', padding: '0.125rem 0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Top Pain Points</p>
            {data.topPainPoints.length === 0 ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No pain points extracted yet.</p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.topPainPoints.map(([pain, count]) => (
                  <li key={pain} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span style={{ flex: 1, color: 'var(--admin-text)' }}>{pain}</span>
                    <span style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '9999px', padding: '0.125rem 0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', flexShrink: 0 }}>{count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Chart Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Human Design Types</p>
            {data.hdDistribution.length === 0 ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No HD data extracted yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  {data.hdDistribution.map(([type, count]) => (
                    <tr key={type} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <td style={{ padding: '0.5rem 0', color: 'var(--admin-text)' }}>{type}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--admin-text-muted)' }}>{count}</td>
                      <td style={{ padding: '0.5rem 0 0.5rem 0.75rem', width: '40%' }}>
                        <div style={{ height: '6px', background: 'var(--admin-border)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round((count / data.totalInsights) * 100)}%`, background: 'var(--admin-accent)', borderRadius: '9999px' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Sun Signs</p>
            {data.sunDistribution.length === 0 ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No sun sign data extracted yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  {data.sunDistribution.slice(0, 8).map(([sign, count]) => (
                    <tr key={sign} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <td style={{ padding: '0.5rem 0', color: 'var(--admin-text)' }}>{sign}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: 'var(--admin-text-muted)' }}>{count}</td>
                      <td style={{ padding: '0.5rem 0 0.5rem 0.75rem', width: '40%' }}>
                        <div style={{ height: '6px', background: 'var(--admin-border)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round((count / data.totalInsights) * 100)}%`, background: 'var(--admin-accent)', borderRadius: '9999px' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Beta Objections */}
        {data.objections.length > 0 && (
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Recent Objections — "What would make you say yes?"</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.objections.map((obj, i) => (
                <blockquote
                  key={i}
                  style={{
                    margin: 0,
                    padding: '0.75rem 1rem',
                    borderLeft: '3px solid var(--admin-accent)',
                    background: 'var(--admin-bg)',
                    borderRadius: '0 0.375rem 0.375rem 0',
                    fontSize: '0.875rem',
                    color: 'var(--admin-text)',
                    fontStyle: 'italic',
                  }}
                >
                  {obj}
                </blockquote>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
