'use client';

import { useState } from 'react';
import type { ChartResult } from '@/lib/calculator/types';
import { chartResultToPlacements } from '@/lib/calculator/toPlacementsMapper';
import styles from './chart.module.css';

// When ChartResult is passed from a server component to a client component in
// Next.js App Router, Date fields are automatically serialized to ISO strings.
// We accept the serialized form here; the mapper only touches western.planets,
// western.houses, and humanDesign (excluding designDate), so it is safe.
type SerializedChartResult = Omit<ChartResult, 'utcBirthDatetime' | 'vedic' | 'humanDesign'> & {
  utcBirthDatetime: Date | string;
  vedic: ChartResult['vedic'];
  humanDesign: Omit<ChartResult['humanDesign'], 'designDate'> & {
    designDate: Date | string;
  };
};

interface Props {
  chartResult: SerializedChartResult;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function SyncToConfirmedButton({ chartResult }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function handleSync() {
    setStatus('loading');
    setErrorMsg('');

    try {
      // Cast to ChartResult — the mapper only accesses fields that are not Dates
      const placements = chartResultToPlacements(chartResult as unknown as ChartResult);

      const res = await fetch('/api/profile/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placements, confirmed: true }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  return (
    <div>
      <button
        className={styles.btnPrimary}
        onClick={handleSync}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Syncing…' : 'Sync to Confirmed'}
      </button>

      {status === 'success' && (
        <span
          style={{
            marginLeft: '1rem',
            fontSize: '0.875rem',
            color: '#86efac',
            fontWeight: 500,
          }}
        >
          Synced to Confirmed!
        </span>
      )}

      {status === 'error' && (
        <span
          style={{
            marginLeft: '1rem',
            fontSize: '0.875rem',
            color: '#fca5a5',
            fontWeight: 500,
          }}
        >
          {errorMsg}
        </span>
      )}
    </div>
  );
}
