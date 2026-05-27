import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../admin-layout.module.css';
import PortraitsList, { type PortraitsListRow } from '@/components/admin/PortraitsList';
import { SECTION_NAMES, type PortraitSection } from '@/lib/portraits/schema';

// Auth handled by middleware.ts + admin layout

interface UserPortraitRow {
  user_id: string;
  sections: Record<string, PortraitSection | undefined> | null;
  opt_out: boolean;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  products_completed: string[] | null;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  portrait_opt_out: boolean | null;
}

export default async function AdminPortraitsPage() {
  // Pull all portraits, plus users without a portrait (to surface "has portrait = no").
  // We bound the user fetch to 1000 to avoid an unbounded scan; admins searching
  // for users without a portrait will typically filter further from there.
  const [
    { data: portraits, error: portraitsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabaseAdmin
      .from('user_portraits')
      .select('user_id, sections, opt_out, last_extracted_at, last_reviewed_at, products_completed')
      .order('last_extracted_at', { ascending: false, nullsFirst: false })
      .limit(1000),
    supabaseAdmin
      .from('users')
      .select('id, email, created_at, portrait_opt_out')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  if (portraitsError) {
    console.error('[Admin] user_portraits fetch error:', portraitsError);
  }
  if (usersError) {
    console.error('[Admin] users fetch error:', usersError);
  }

  const portraitsByUserId = new Map<string, UserPortraitRow>();
  (portraits ?? []).forEach((p) => {
    portraitsByUserId.set(p.user_id, p as UserPortraitRow);
  });

  const rows: PortraitsListRow[] = (users ?? []).map((u) => {
    const typedUser = u as UserRow;
    const portrait = portraitsByUserId.get(typedUser.id);

    let sectionsWithCurrent = 0;
    if (portrait?.sections) {
      for (const name of SECTION_NAMES) {
        const section = portrait.sections[name];
        if (section?.current) sectionsWithCurrent += 1;
      }
    }

    return {
      user_id: typedUser.id,
      email: typedUser.email,
      created_at: typedUser.created_at,
      has_portrait: !!portrait,
      opt_out: !!(portrait?.opt_out ?? typedUser.portrait_opt_out),
      last_extracted_at: portrait?.last_extracted_at ?? null,
      last_reviewed_at: portrait?.last_reviewed_at ?? null,
      sections_with_current: sectionsWithCurrent,
      products_completed_count: portrait?.products_completed?.length ?? 0,
    };
  });

  // Sort: has portrait + most recently extracted first; users without portrait at bottom by created_at desc.
  rows.sort((a, b) => {
    if (a.has_portrait && !b.has_portrait) return -1;
    if (!a.has_portrait && b.has_portrait) return 1;
    if (a.has_portrait && b.has_portrait) {
      const aT = a.last_extracted_at ? new Date(a.last_extracted_at).getTime() : 0;
      const bT = b.last_extracted_at ? new Date(b.last_extracted_at).getTime() : 0;
      return bT - aT;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalUsers = rows.length;
  const withPortrait = rows.filter((r) => r.has_portrait).length;
  const optedOut = rows.filter((r) => r.opt_out).length;
  const extractedLast7d = rows.filter((r) => {
    if (!r.last_extracted_at) return false;
    return Date.now() - new Date(r.last_extracted_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Portraits</h1>
          <p className={styles.pageDescription}>
            Inspect, audit, and override user portraits. Portraits accumulate identity signals
            extracted from product briefings.
          </p>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Users (recent)</div>
          <div className={styles.statValue}>{totalUsers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>With portrait</div>
          <div className={styles.statValue}>{withPortrait}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Opted out</div>
          <div
            className={styles.statValue}
            style={{ color: optedOut > 0 ? 'var(--admin-warning)' : undefined }}
          >
            {optedOut}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Extracted last 7d</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {extractedLast7d}
          </div>
        </div>
      </div>

      <PortraitsList initialRows={rows} />
    </div>
  );
}
