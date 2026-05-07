import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../../admin-layout.module.css';
import AnglesBrowser from '@/components/admin/studio/AnglesBrowser';

export type AngleRow = {
  id: string;
  topic_id: string | null;
  title: string;
  format: string | null;
  status: string | null;
  corpus_query: string | null;
  corpusLinkCount: number;
};

export type TopicRow = {
  id: string;
  pillar_id: string | null;
  title: string;
  theme_tags: string[] | null;
  angles: AngleRow[];
};

export type PillarRow = {
  id: string;
  title: string;
  slug: string;
  topics: TopicRow[];
};

// Auth handled by middleware
export default async function AnglesPage() {
  const [pillarsRes, topicsRes, anglesRes, linksRes] = await Promise.all([
    supabaseAdmin.from('content_pillars').select('id, title, slug').order('title'),
    supabaseAdmin.from('content_topics').select('id, pillar_id, title, theme_tags').order('title'),
    supabaseAdmin
      .from('content_angles')
      .select('id, topic_id, title, format, status, corpus_query')
      .order('title'),
    supabaseAdmin.from('content_corpus_links').select('angle_id'),
  ]);

  const linkCountByAngle: Record<string, number> = {};
  for (const link of linksRes.data ?? []) {
    if (link.angle_id) {
      linkCountByAngle[link.angle_id] = (linkCountByAngle[link.angle_id] ?? 0) + 1;
    }
  }

  const pillars: PillarRow[] = (pillarsRes.data ?? [])
    .map((pillar) => ({
      ...pillar,
      topics: (topicsRes.data ?? [])
        .filter((t) => t.pillar_id === pillar.id)
        .map((topic) => ({
          ...topic,
          angles: (anglesRes.data ?? [])
            .filter((a) => a.topic_id === topic.id)
            .map((angle) => ({
              ...angle,
              corpusLinkCount: linkCountByAngle[angle.id] ?? 0,
            })),
        }))
        .filter((t) => t.angles.length > 0),
    }))
    .filter((p) => p.topics.length > 0);

  const allAngles = anglesRes.data ?? [];
  const stats = {
    total: allAngles.length,
    draft: allAngles.filter((a) => a.status === 'draft' || !a.status).length,
    research: allAngles.filter((a) => a.status === 'research').length,
    hasCorpus: Object.keys(linkCountByAngle).length,
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Content Angles</h1>
          <p className={styles.pageDescription}>
            {stats.total} angles across {pillars.length} pillars · click any angle to open its workspace
          </p>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Angles</div>
          <div className={styles.statValue}>{stats.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Draft</div>
          <div className={styles.statValue}>{stats.draft}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>In Research</div>
          <div className={styles.statValue}>{stats.research}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Corpus Linked</div>
          <div className={styles.statValue}>{stats.hasCorpus}</div>
        </div>
      </div>

      <AnglesBrowser pillars={pillars} />
    </div>
  );
}
