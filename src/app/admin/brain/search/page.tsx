import { PageHead } from '@/components/admin/brain/primitives';
import { SearchConsoleView } from '@/components/admin/brain/search/SearchConsoleView';
import styles from '@/components/admin/brain/brain.module.css';
import { loadSearchReport, type SearchReport } from '@/lib/seo/search-report';

export const metadata = {
  title: 'Search - Brain - Quantum Strategies Admin',
};

export const dynamic = 'force-dynamic';

export default async function BrainSearchPage() {
  let report: SearchReport | null = null;
  let error: string | null = null;
  try {
    report = await loadSearchReport();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error('[brain search] load failed:', error);
  }

  return (
    <div className={styles.content}>
      <PageHead
        eyebrow="Search"
        title="Where Google shows us, by topic"
        lede="Google Search Console, synced daily and read against the topical map: what we rank for, where each topic's head term sits, and which pages Google has indexed. Positions are averages, 1 is the top result."
      />
      {report ? (
        <SearchConsoleView report={report} />
      ) : (
        <div className={styles.banner} role="alert">
          <div>
            <span className={styles.bannerLabel}>Could not load</span>
            {/does not exist|schema cache|Could not find the function/i.test(error ?? '')
              ? 'The Search Console tables are not in the database yet. The migration 20261018120000_search_console.sql is waiting for a push.'
              : `The report failed to load: ${error}`}
          </div>
        </div>
      )}
    </div>
  );
}
