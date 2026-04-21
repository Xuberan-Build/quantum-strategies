'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getISOWeekMonday } from '@/lib/utils/date-helpers';
import type { AlignmentLedgerFormData } from '@/lib/types/rite-iv';

interface NewCheckinFormProps {
  userId: string;
}

export function NewCheckinForm({ userId }: NewCheckinFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<AlignmentLedgerFormData>({
    decisions_made: '',
    actions_shipped: '',
    signal_logged: '',
    drift_detected: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('alignment_ledger')
        .insert({
          user_id: userId,
          week_start: getISOWeekMonday(),
          ...formData,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('You have already submitted a check-in for this week');
        }
        throw insertError;
      }

      router.push('/ledger');
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit check-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Decisions Made
          <span className="text-red-500 ml-1">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">
          What decisions closed a door this week? Not tasks — choices.
        </p>
        <textarea
          value={formData.decisions_made}
          onChange={(e) => setFormData({ ...formData, decisions_made: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Actions Shipped
          <span className="text-red-500 ml-1">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">
          What was delivered, sent, published, or closed? Binary outcomes only.
        </p>
        <textarea
          value={formData.actions_shipped}
          onChange={(e) => setFormData({ ...formData, actions_shipped: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Signal Logged
          <span className="text-red-500 ml-1">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">
          What did reality return? Market response, numbers, patterns.
        </p>
        <textarea
          value={formData.signal_logged}
          onChange={(e) => setFormData({ ...formData, signal_logged: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Drift Detected
          <span className="text-red-500 ml-1">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">
          Where did you act outside your declared configuration?
        </p>
        <textarea
          value={formData.drift_detected}
          onChange={(e) => setFormData({ ...formData, drift_detected: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          rows={4}
          required
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Check-in'}
        </button>
      </div>
    </form>
  );
}
