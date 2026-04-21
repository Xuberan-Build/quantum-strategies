'use client';

import Link from 'next/link';
import { formatDateShort } from '@/lib/utils/date-helpers';
import type { DashboardData } from '@/lib/types/rite-iv';

interface DashboardViewProps {
  data: DashboardData;
}

export function DashboardView({ data }: DashboardViewProps) {
  const { thisWeekSubmitted, openCommitmentCount, lastProfileUpdate, subscription } = data;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* This Week's Check-in */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
            {thisWeekSubmitted ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✓ Submitted
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                Pending
              </span>
            )}
          </div>
          <p className="text-gray-600 mb-4">
            {thisWeekSubmitted
              ? "You've submitted this week's check-in."
              : "Submit your weekly accountability check-in."}
          </p>
          {!thisWeekSubmitted && (
            <Link
              href="/ledger/new"
              className="inline-block w-full text-center bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
            >
              Submit Check-in
            </Link>
          )}
        </div>

        {/* Open Commitments */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Commitments</h3>
            <span className="text-3xl font-bold text-blue-600">{openCommitmentCount}</span>
          </div>
          <p className="text-gray-600 mb-4">Open commitments requiring delivery</p>
          <Link
            href="/commitments"
            className="inline-block w-full text-center border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50"
          >
            View All
          </Link>
        </div>

        {/* Profile Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
          </div>
          <p className="text-gray-600 mb-2">
            Last updated: {lastProfileUpdate ? formatDateShort(lastProfileUpdate) : 'Never'}
          </p>
          <Link
            href="/profile"
            className="inline-block w-full text-center border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50"
          >
            View Profile
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/ledger"
            className="flex items-center justify-center border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium text-gray-900">View Ledger</div>
            </div>
          </Link>
          <Link
            href="/commitments"
            className="flex items-center justify-center border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">📝</div>
              <div className="font-medium text-gray-900">Commitments</div>
            </div>
          </Link>
          <Link
            href="/profile"
            className="flex items-center justify-center border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">⚙️</div>
              <div className="font-medium text-gray-900">Profile</div>
            </div>
          </Link>
          <Link
            href="/billing"
            className="flex items-center justify-center border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">💳</div>
              <div className="font-medium text-gray-900">Billing</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Subscription Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Status</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">
              Status:{' '}
              <span className={`font-medium ${
                subscription.status === 'active' ? 'text-green-600' :
                subscription.status === 'past_due' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {subscription.status.toUpperCase()}
              </span>
            </p>
            {subscription.current_period_end && (
              <p className="text-sm text-gray-500 mt-1">
                Next billing: {formatDateShort(subscription.current_period_end)}
              </p>
            )}
          </div>
          <Link
            href="/billing"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}
