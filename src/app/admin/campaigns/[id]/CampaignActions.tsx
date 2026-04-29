'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin-layout.module.css';

interface List {
  id: string;
  name: string;
  list_type: string;
}

interface Props {
  campaignId: string;
  lists: List[];
  mode: 'step' | 'enroll' | 'status';
  currentStatus?: string;
}

export default function CampaignActions({ campaignId, lists, mode, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- Add Step ---
  const [stepForm, setStepForm] = useState({
    delay_hours: '0',
    subject: '',
    html_body: '',
    text_body: '',
  });

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepForm.subject.trim() || !stepForm.html_body.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delay_hours: parseInt(stepForm.delay_hours, 10) || 0,
          subject: stepForm.subject.trim(),
          html_body: stepForm.html_body.trim(),
          text_body: stepForm.text_body.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add step');
      setStepForm({ delay_hours: '0', subject: '', html_body: '', text_body: '' });
      setSuccess('Step added');
      setTimeout(() => setSuccess(''), 2000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Enroll ---
  const [selectedList, setSelectedList] = useState('');
  const [enrollResult, setEnrollResult] = useState('');

  const handleEnroll = async () => {
    if (!selectedList) return;
    setLoading(true);
    setError('');
    setEnrollResult('');
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: selectedList }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to enroll');
      setEnrollResult(`${json.enrolled} user${json.enrolled === 1 ? '' : 's'} enrolled`);
      setSelectedList('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Status toggle ---
  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to update status');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: '0.5rem',
    color: 'var(--admin-text)',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.375rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--admin-text-muted)',
  };

  if (mode === 'step') {
    return (
      <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.25rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Add Step</h3>
        <form onSubmit={handleAddStep} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Delay (hours after previous)</label>
              <input
                type="number"
                min="0"
                value={stepForm.delay_hours}
                onChange={(e) => setStepForm((f) => ({ ...f, delay_hours: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input
                type="text"
                value={stepForm.subject}
                onChange={(e) => setStepForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Email subject line"
                required
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Plain Text Body *</label>
            <textarea
              value={stepForm.text_body}
              onChange={(e) => setStepForm((f) => ({ ...f, text_body: e.target.value }))}
              placeholder="Plain text version of the email..."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8125rem' }}
            />
          </div>
          <div>
            <label style={labelStyle}>HTML Body *</label>
            <textarea
              value={stepForm.html_body}
              onChange={(e) => setStepForm((f) => ({ ...f, html_body: e.target.value }))}
              placeholder="<p>Hi {{name}},</p>..."
              rows={8}
              required
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8125rem' }}
            />
          </div>
          {error && <div style={{ fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>{error}</div>}
          {success && <div style={{ fontSize: '0.8125rem', color: 'var(--admin-success)' }}>{success}</div>}
          <button
            type="submit"
            disabled={loading || !stepForm.subject.trim() || !stepForm.html_body.trim()}
            className={`${styles.btn} ${styles.btnPrimary}`}
            style={{ alignSelf: 'flex-start' }}
          >
            {loading ? 'Adding...' : 'Add Step'}
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'enroll') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <select
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
          style={{ ...inputStyle }}
        >
          <option value="">Select a list...</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button
          onClick={handleEnroll}
          disabled={loading || !selectedList}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          {loading ? 'Enrolling...' : 'Enroll List'}
        </button>
        {enrollResult && <div style={{ fontSize: '0.8125rem', color: 'var(--admin-success)' }}>{enrollResult}</div>}
        {error && <div style={{ fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>{error}</div>}
        <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
          Users already enrolled will be skipped.
        </p>
      </div>
    );
  }

  if (mode === 'status') {
    const transitions: Record<string, { label: string; next: string; style: string }[]> = {
      draft: [{ label: 'Activate', next: 'active', style: styles.btnPrimary }],
      active: [
        { label: 'Pause', next: 'paused', style: styles.btnSecondary },
        { label: 'Archive', next: 'archived', style: styles.btnSecondary },
      ],
      paused: [
        { label: 'Resume', next: 'active', style: styles.btnPrimary },
        { label: 'Archive', next: 'archived', style: styles.btnSecondary },
      ],
      archived: [{ label: 'Reactivate', next: 'draft', style: styles.btnSecondary }],
    };
    const available = transitions[currentStatus || 'draft'] || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {available.map(({ label, next, style }) => (
          <button
            key={next}
            onClick={() => handleStatusChange(next)}
            disabled={loading}
            className={`${styles.btn} ${style}`}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? '...' : label}
          </button>
        ))}
        {error && <div style={{ fontSize: '0.75rem', color: 'var(--admin-danger)', marginTop: '0.25rem' }}>{error}</div>}
      </div>
    );
  }

  return null;
}
