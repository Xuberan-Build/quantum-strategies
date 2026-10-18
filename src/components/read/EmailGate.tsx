'use client';

import { useId, useState } from 'react';
import type { ReadLeadInput } from '@/lib/read/types';
import { GATE } from './copy';
import styles from './read.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

interface EmailGateProps {
  onSubmit: (lead: Omit<ReadLeadInput, 'utm'>) => Promise<void>;
}

/**
 * Spec v3 §8.2. One field, no password. Marketing consent is its own unticked box;
 * the result email is transactional and goes to everyone who enters an email.
 */
export function EmailGate({ onSubmit }: EmailGateProps) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) {
      setError(GATE.invalidEmail);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ email: email.trim(), consentMarketing: consent });
    } catch {
      setError(GATE.unlockError);
    } finally {
      setBusy(false);
    }
  };

  const emailId = `${id}-email`;
  const errorId = `${id}-error`;

  return (
    <section className={styles.gate} aria-labelledby={`${id}-title`} data-block="gate">
      <h2 id={`${id}-title`} className={styles.blockHeading}>
        {GATE.title}
      </h2>
      <div className={styles.body}>
        <p>{GATE.intro}</p>
      </div>
      <h3 className={styles.legend} style={{ marginTop: 16 }}>
        {GATE.getTitle}
      </h3>
      <ul className={styles.list}>
        {GATE.get.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <form noValidate onSubmit={submit} style={{ marginTop: 24 }}>
        <label className={styles.fieldLabel} htmlFor={emailId}>
          {GATE.emailLabel}
        </label>
        <input
          id={emailId}
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={GATE.emailPlaceholder}
          value={email}
          required
          aria-invalid={error === GATE.invalidEmail}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{GATE.consent}</span>
        </label>
        <p className={styles.privacy}>
          {GATE.privacy}{' '}
          <a href="/privacy/" target="_blank" rel="noopener noreferrer">
            {GATE.privacyLink}
          </a>
        </p>
        <p id={errorId} className={styles.error} role="alert" aria-live="assertive">
          {error ?? ''}
        </p>
        <button type="submit" className={`${styles.primaryButton} ${styles.fullWidth}`} disabled={busy} aria-busy={busy}>
          {busy ? GATE.submitting : GATE.submit}
        </button>
      </form>
    </section>
  );
}
