import { supabaseAdmin } from '@/lib/supabase/server';
import StrategyDashboard from '@/components/admin/strategy/StrategyDashboard';
import styles from '../admin-layout.module.css';

const PLG_STAGES = ['awareness', 'interest', 'consideration', 'conversion', 'expansion'] as const;

export default async function StrategyPage() {
  const [pillarsRes, topicsRes, anglesRes, piecesRes, productsRes, suggestionsRes, postsRes] = await Promise.all([
    supabaseAdmin.from('content_pillars').select('*').order('created_at'),
    supabaseAdmin.from('content_topics').select('*'),
    supabaseAdmin.from('content_angles').select('id, title, status, topic_id, format'),
    supabaseAdmin.from('content_pieces').select('id, piece_type, status, angle_id'),
    supabaseAdmin.from('product_definitions')
      .select('id, product_slug, name, price, plg_stage, pillar_id, is_active, is_purchasable')
      .eq('is_active', true),
    supabaseAdmin.from('product_suggestions')
      .select('*, content_pillars(title)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin.from('content_posts')
      .select('id, pillar_id')
      .eq('is_published', true),
  ]);

  const pillars     = pillarsRes.data  ?? [];
  const topics      = topicsRes.data   ?? [];
  const angles      = anglesRes.data   ?? [];
  const pieces      = piecesRes.data   ?? [];
  const products    = productsRes.data ?? [];
  const suggestions = suggestionsRes.data ?? [];
  const posts       = postsRes.data    ?? [];

  // Published posts per pillar (for awareness coverage)
  const postsByPillar: Record<string, number> = {};
  for (const p of posts) {
    if (p.pillar_id) postsByPillar[p.pillar_id] = (postsByPillar[p.pillar_id] ?? 0) + 1;
  }

  // Build coverage matrix
  const topicsByPillar: Record<string, typeof topics> = {};
  for (const t of topics) {
    topicsByPillar[t.pillar_id] ??= [];
    topicsByPillar[t.pillar_id].push(t);
  }

  const anglesByTopic: Record<string, typeof angles> = {};
  for (const a of angles) {
    if (a.topic_id) {
      anglesByTopic[a.topic_id] ??= [];
      anglesByTopic[a.topic_id].push(a);
    }
  }

  const productsByPillarStage: Record<string, Record<string, typeof products>> = {};
  for (const p of products) {
    const pid = p.pillar_id ?? 'unlinked';
    const stage = p.plg_stage ?? 'unknown';
    productsByPillarStage[pid] ??= {};
    productsByPillarStage[pid][stage] ??= [];
    productsByPillarStage[pid][stage].push(p);
  }

  const matrix = pillars.map((pillar) => {
    const pts = topicsByPillar[pillar.id] ?? [];
    const hasTopics   = pts.length > 0;
    const hasPosts    = (postsByPillar[pillar.id] ?? 0) > 0;
    const postCount   = postsByPillar[pillar.id] ?? 0;
    const totalAngles = pts.reduce((n, t) => n + (anglesByTopic[t.id]?.length ?? 0), 0);
    const totalPieces = pieces.filter((p) =>
      angles.some((a) => a.id === p.angle_id && pts.some((t) => t.id === a.topic_id))
    ).length;

    const stages = PLG_STAGES.map((stage) => {
      const pillarProds = productsByPillarStage[pillar.id]?.[stage] ?? [];
      const unlinkedProds = productsByPillarStage['unlinked']?.[stage] ?? [];
      const hasProduct = pillarProds.length > 0 || unlinkedProds.length > 0;
      const productNames = [...pillarProds, ...unlinkedProds].map((p) => p.name);
      const hasPending = suggestions.some(
        (s) => s.pillar_id === pillar.id && s.funnel_stage === stage && s.status === 'pending'
      );
      // Awareness uses published post count; other stages use topic tree
      const hasContent = stage === 'awareness' ? (hasPosts || hasTopics) : hasTopics;
      return { stage, hasContent, hasProduct, productNames, hasPending, postCount: stage === 'awareness' ? postCount : 0 };
    });

    return { pillar, topics: pts, totalAngles, totalPieces, stages };
  });

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const totalGaps = matrix.reduce((n, row) =>
    n + row.stages.filter((s) => s.stage !== 'awareness' && s.hasContent && !s.hasProduct).length, 0
  );
  const linkedProducts = products.filter((p) => p.pillar_id).length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Strategy Intelligence</h1>
          <p className={styles.pageDescription}>
            PLG coverage matrix · product gap analysis · proactive recommendations
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Content Pillars</div>
          <div className={styles.statValue}>{pillars.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Topics Mapped</div>
          <div className={styles.statValue}>{topics.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>PLG Gaps</div>
          <div className={styles.statValue} style={{ color: totalGaps > 0 ? 'var(--admin-warning)' : 'var(--admin-success)' }}>
            {totalGaps}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Suggestions</div>
          <div className={styles.statValue} style={{ color: pendingSuggestions.length > 0 ? 'var(--admin-primary)' : undefined }}>
            {pendingSuggestions.length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Products Pillar-Linked</div>
          <div className={styles.statValue}>{linkedProducts}/{products.length}</div>
        </div>
      </div>

      <StrategyDashboard
        matrix={matrix}
        suggestions={suggestions}
        products={products}
      />
    </div>
  );
}
