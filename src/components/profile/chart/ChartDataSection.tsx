import React, { Suspense } from 'react';
import type { Placements } from '@/lib/utils/placements';
import type { StoredBirthData } from '@/lib/calculator/compute';
import { getCachedChart } from '@/lib/calculator/compute';
import ChartSidebar from './ChartSidebar';
import BirthDataPanel from './BirthDataPanel';
import WesternPanel from './WesternPanel';
import HumanDesignPanel from './HumanDesignPanel';
import VedicPanel from './VedicPanel';
import ProfileEditor from '@/components/profile/ProfileEditor';
import styles from './chart.module.css';

type ChartSection = 'birth-data' | 'western' | 'human-design' | 'vedic' | 'confirmed';

interface Props {
  section: ChartSection;
  birthData: StoredBirthData | null;
  placements: Placements | null;
  placementsConfirmed: boolean;
  placementsUpdatedAt: string | null;
  userId: string;
}

async function ComputedChartPanel({
  section,
  birthData,
  userId,
}: {
  section: 'western' | 'human-design' | 'vedic';
  birthData: StoredBirthData;
  userId: string;
}) {
  const timeUnknown = !!birthData.timeUnknown;
  try {
    const result = await getCachedChart(userId, birthData);

    let panel: React.ReactNode;
    if (section === 'western') {
      panel = <WesternPanel chart={result.western} designDate={result.humanDesign.designDate} timeUnknown={timeUnknown} />;
    } else if (section === 'human-design') {
      panel = <HumanDesignPanel chart={result.humanDesign} timeUnknown={timeUnknown} />;
    } else {
      panel = <VedicPanel chart={result.vedic} birthUtc={result.utcBirthDatetime} timeUnknown={timeUnknown} />;
    }

    return <>{panel}</>;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div className={styles.errorBanner}>
        Chart computation failed: {message}
      </div>
    );
  }
}

function EmptyChartState({ section }: { section: string }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>✦</span>
      <p className={styles.emptyText}>
        Enter your birth data first to compute your {section} chart.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} style={{ animation: 'pulse 1.5s infinite' }}>◌</span>
      <p className={styles.emptyText}>Computing your chart…</p>
    </div>
  );
}

export default function ChartDataSection({
  section,
  birthData,
  placements,
  placementsConfirmed,
  placementsUpdatedAt,
  userId,
}: Props) {
  const isCalculatedSection = section === 'western' || section === 'human-design' || section === 'vedic';

  return (
    <div className={styles.layout}>
      <ChartSidebar section={section} hasBirthData={!!birthData} />

      <div className={styles.panel}>
        {section === 'birth-data' && (
          <BirthDataPanel initialData={birthData} />
        )}

        {isCalculatedSection && !birthData && (
          <EmptyChartState section={section.replace('-', ' ')} />
        )}

        {isCalculatedSection && birthData && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ComputedChartPanel section={section} birthData={birthData} userId={userId} />
          </Suspense>
        )}

        {section === 'confirmed' && (
          <ProfileEditor
            initialPlacements={placements}
            placementsConfirmed={placementsConfirmed}
            placementsUpdatedAt={placementsUpdatedAt}
            userId={userId}
          />
        )}
      </div>
    </div>
  );
}
