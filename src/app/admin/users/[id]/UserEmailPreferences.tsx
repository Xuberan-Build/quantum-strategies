'use client';

import { useState } from 'react';
import { EMAIL_TOPICS, TOPIC_INFO, type EmailPreferences, type EmailTopic } from '@/lib/progress-emails/topics';
import { errorMessage } from '@/lib/errors';

/** Admin view of a user's email preferences. Each toggle saves on change. */
export function UserEmailPreferences({ userId, initial }: { userId: string; initial: EmailPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function toggle(topic: EmailTopic) {
    const previous = prefs;
    setPrefs({ ...prefs, [topic]: !prefs[topic] });
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/email-preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [topic]: !previous[topic] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setPrefs(data.preferences);
    } catch (e) {
      setPrefs(previous);
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {EMAIL_TOPICS.map((topic) => (
        <label key={topic} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={prefs[topic]} disabled={saving} onChange={() => toggle(topic)} />
          {TOPIC_INFO[topic].label}
        </label>
      ))}
      {error && <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{error}</div>}
    </div>
  );
}
