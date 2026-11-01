'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ReadPanel, { linkClass } from '../../read/checkout/ReadPanel';

type State = { kind: 'working' } | { kind: 'done'; topic: string } | { kind: 'error'; message: string };

const TOPIC_LABEL: Record<string, string> = {
  progress: 'progress emails about the Rites',
  newsletter: 'the newsletter',
};

export default function OptOutClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { kind: 'working' } : { kind: 'error', message: 'This link is incomplete.' });
  const posted = useRef(false);

  useEffect(() => {
    if (!token || posted.current) return;
    posted.current = true;
    fetch('/api/email/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        setState(res.ok ? { kind: 'done', topic: data?.topic } : { kind: 'error', message: data?.error || 'We could not update your settings.' });
      })
      .catch(() => setState({ kind: 'error', message: 'We could not update your settings. Check your connection and try again.' }));
  }, [token]);

  const settings = (
    <p>
      Change any email setting in your{' '}
      <Link className={linkClass} href="/dashboard/profile?tab=settings">
        dashboard settings
      </Link>
      .
    </p>
  );

  if (state.kind === 'working') {
    return (
      <ReadPanel eyebrow="Email settings" title="Updating">
        <p>One moment.</p>
      </ReadPanel>
    );
  }
  if (state.kind === 'error') {
    return (
      <ReadPanel eyebrow="Email settings" title="That didn't work">
        <p>{state.message}</p>
        <p>Reply to any of the emails with &quot;stop&quot; and I&apos;ll take you off by hand.</p>
        {settings}
      </ReadPanel>
    );
  }
  return (
    <ReadPanel eyebrow="Email settings" title="Done">
      <p>You won&apos;t get {TOPIC_LABEL[state.topic] ?? 'these emails'} anymore. Your access to the Rites doesn&apos;t change.</p>
      {settings}
    </ReadPanel>
  );
}
