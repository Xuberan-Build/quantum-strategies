'use client';

import { getWeekRangeDisplay, isCurrentWeek } from '@/lib/utils/date-helpers';
import type { AlignmentLedgerEntry } from '@/lib/types/rite-iv';

interface LedgerListProps {
  entries: AlignmentLedgerEntry[];
}

export function LedgerList({ entries }: LedgerListProps) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">No check-ins yet. Submit your first weekly check-in to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`bg-white rounded-lg shadow p-6 ${
            isCurrentWeek(entry.week_start) ? 'border-2 border-blue-500' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {getWeekRangeDisplay(entry.week_start)}
            </h3>
            {isCurrentWeek(entry.week_start) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                This Week
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Decisions Made</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{entry.decisions_made}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Actions Shipped</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{entry.actions_shipped}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Signal Logged</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{entry.signal_logged}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Drift Detected</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{entry.drift_detected}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
