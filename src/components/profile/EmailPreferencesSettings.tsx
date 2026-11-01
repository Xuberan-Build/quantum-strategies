'use client';

import { useState } from 'react';
import { EMAIL_TOPICS, TOPIC_INFO, type EmailPreferences, type EmailTopic } from '@/lib/progress-emails/topics';
import { errorMessage } from '@/lib/errors';

/** Each toggle saves on change. Account emails (receipts, sign-in) are not affected. */
export default function EmailPreferencesSettings({ initial }: { initial: EmailPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<EmailTopic | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(topic: EmailTopic) {
    const previous = prefs;
    const next = { ...prefs, [topic]: !prefs[topic] };
    setPrefs(next);
    setSaving(topic);
    setError(null);
    try {
      const res = await fetch('/api/profile/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [topic]: next[topic] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setPrefs(data.preferences);
    } catch (err) {
      setPrefs(previous);
      setError(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      style={{
        padding: '2rem',
        borderRadius: '20px',
        border: '1px solid rgba(206, 190, 255, 0.2)',
        background: 'linear-gradient(135deg, rgba(93, 63, 211, 0.12) 0%, rgba(20, 12, 40, 0.85) 100%)',
        marginBottom: '2rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>Email</h2>
      <p style={{ margin: '0 0 1.5rem 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
        Receipts and sign-in emails always arrive. Choose the rest.
      </p>

      {error && <p style={{ color: '#fca5a5', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {EMAIL_TOPICS.map((key) => (
          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={prefs[key]}
              disabled={saving !== null}
              onChange={() => toggle(key)}
              style={{ marginTop: '0.25rem', width: '1.1rem', height: '1.1rem', accentColor: '#7c3aed' }}
            />
            <span>
              <span style={{ display: 'block', color: '#ffffff', fontWeight: 600 }}>{TOPIC_INFO[key].label}</span>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>{TOPIC_INFO[key].description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
