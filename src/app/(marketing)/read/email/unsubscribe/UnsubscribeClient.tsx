'use client';

import { useEffect, useRef, useState } from 'react';
import ReadPanel from '../../checkout/ReadPanel';

type State = { kind: 'working' } | { kind: 'done' } | { kind: 'error'; message: string };

export default function UnsubscribeClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { kind: 'working' } : { kind: 'error', message: 'This link is incomplete.' });
  const posted = useRef(false);

  useEffect(() => {
    if (!token || posted.current) return;
    posted.current = true;
    fetch('/api/read/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        setState(res.ok ? { kind: 'done' } : { kind: 'error', message: data?.error || 'We could not unsubscribe you.' });
      })
      .catch(() => setState({ kind: 'error', message: 'We could not unsubscribe you. Check your connection and try again.' }));
  }, [token]);

  if (state.kind === 'working') {
    return (
      <ReadPanel eyebrow="The Perception Read" title="Unsubscribing">
        <p>One moment.</p>
      </ReadPanel>
    );
  }
  if (state.kind === 'error') {
    return (
      <ReadPanel eyebrow="The Perception Read" title="That didn't work">
        <p>{state.message}</p>
        <p>Reply to any of the emails with &quot;unsubscribe&quot; and I&apos;ll take you off by hand.</p>
      </ReadPanel>
    );
  }
  return (
    <ReadPanel eyebrow="The Perception Read" title="You're unsubscribed">
      <p>You won&apos;t get any more emails about your Read. Your result link still works.</p>
    </ReadPanel>
  );
}
