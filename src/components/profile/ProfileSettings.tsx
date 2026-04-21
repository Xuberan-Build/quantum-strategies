'use client';

import { useState } from 'react';

interface ProfileSettingsProps {
  initialName: string | null;
  initialEmail: string;
  initialCompanyName: string | null;
  initialIgHandle: string | null;
}

export default function ProfileSettings({
  initialName,
  initialEmail,
  initialCompanyName,
  initialIgHandle,
}: ProfileSettingsProps) {
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail);
  const [companyName, setCompanyName] = useState(initialCompanyName || '');
  const [igHandle, setIgHandle] = useState(initialIgHandle || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim(),
          company_name: companyName.trim() || null,
          ig_handle: igHandle.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      if (data.emailPending) {
        setMessage({
          type: 'success',
          text: 'Settings saved. Check your new email address to confirm the change.',
        });
      } else {
        setMessage({ type: 'success', text: 'Settings saved.' });
      }

      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '2rem',
        borderRadius: '20px',
        border: '1px solid rgba(206, 190, 255, 0.2)',
        background: 'linear-gradient(135deg, rgba(93, 63, 211, 0.12) 0%, rgba(20, 12, 40, 0.85) 100%)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        marginBottom: '2rem',
      }}
    >
      <h2
        style={{
          margin: '0 0 1.5rem 0',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.01em',
        }}
      >
        Account Settings
      </h2>

      {message && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.875rem 1.25rem',
            borderRadius: '12px',
            background:
              message.type === 'success'
                ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08))',
            border:
              message.type === 'success'
                ? '1px solid rgba(110,231,183,0.3)'
                : '1px solid rgba(252,165,165,0.3)',
            color: message.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <Field label="Display Name" htmlFor="name">
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </Field>

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </Field>

          <Field label="Company / Brand" htmlFor="company_name">
            <input
              id="company_name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company or brand name"
              style={inputStyle}
            />
          </Field>

          <Field label="Instagram Handle" htmlFor="ig_handle">
            <input
              id="ig_handle"
              type="text"
              value={igHandle}
              onChange={(e) => setIgHandle(e.target.value)}
              placeholder="@yourhandle"
              style={inputStyle}
            />
          </Field>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.65rem 1.5rem',
              borderRadius: '12px',
              background: loading
                ? 'rgba(93,63,211,0.35)'
                : 'linear-gradient(135deg, #5d3fd3 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: loading ? 'none' : '0 6px 18px rgba(93,63,211,0.4)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s ease',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label
        htmlFor={htmlFor}
        style={{
          color: 'rgba(206,190,255,0.75)',
          fontSize: '0.8rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.9rem',
  borderRadius: '10px',
  border: '1px solid rgba(206,190,255,0.2)',
  background: 'rgba(10,5,24,0.6)',
  color: '#ffffff',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
};
