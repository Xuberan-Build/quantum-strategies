'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReadPanel, { buttonClass, linkClass } from './ReadPanel';

export const READ_CHECKOUT_SLUG = 'perception-rite-bundle';

type State =
  | { kind: 'starting' }
  | { kind: 'owned' }
  | { kind: 'error'; message: string }
  | { kind: 'signin' }
  | { kind: 'sending' }
  | { kind: 'sent'; maskedEmail: string };

export interface ReadCheckoutClientProps {
  sessionId: string | null;
  signedIn: boolean;
  leadEmailMasked: string | null;
  signinFailed?: boolean;
  /** Test seam: defaults to window.location.assign. */
  navigate?: (url: string) => void;
}

export default function ReadCheckoutClient({ sessionId, signedIn, leadEmailMasked, signinFailed, navigate }: ReadCheckoutClientProps) {
  const [state, setState] = useState<State>(signedIn ? { kind: 'starting' } : { kind: 'signin' });
  const started = useRef(false);
  const go = navigate ?? ((url: string) => window.location.assign(url));
  const bridgePath = sessionId ? `/read/checkout/?session=${sessionId}` : "/read/checkout/";

  const startCheckout = useCallback(async () => {
    if (!sessionId) return;
    setState({ kind: 'starting' });
    try {
      // Link the lead and record read_checkout_started. Never blocks checkout.
      const pre = await fetch('/api/read/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => null);
      if (pre?.status === 401) {
        setState({ kind: 'signin' });
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSlug: READ_CHECKOUT_SLUG, readSessionId: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return setState({ kind: 'signin' });
      if (res.status === 409) return setState({ kind: 'owned' });
      if (!res.ok || !data?.url) {
        return setState({ kind: 'error', message: data?.error || 'Checkout could not start.' });
      }
      go(data.url);
    } catch {
      setState({ kind: 'error', message: 'Checkout could not start. Check your connection and try again.' });
    }
  }, [sessionId, go]);

  useEffect(() => {
    if (signedIn && sessionId && !started.current) {
      started.current = true;
      void startCheckout();
    }
  }, [signedIn, sessionId, startCheckout]);

  const sendLink = async () => {
    if (!sessionId) return;
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/read/checkout/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: 'error', message: data?.error || 'We could not send the link.' });
      setState({ kind: 'sent', maskedEmail: data.maskedEmail || leadEmailMasked || 'your inbox' });
    } catch {
      setState({ kind: 'error', message: 'We could not send the link. Check your connection and try again.' });
    }
  };

  const signInLinks = (
    <p className="text-sm text-white/60">
      Have a password already?{' '}
      <a className={linkClass} href={`/login?redirect=${encodeURIComponent(bridgePath)}`}>
        Sign in
      </a>
      {' · '}
      <a className={linkClass} href={`/signup?redirect=${encodeURIComponent(bridgePath)}`}>
        Use a different email
      </a>
    </p>
  );

  if (!sessionId) {
    return (
      <ReadPanel eyebrow="Rite I" title="This link is missing your Read">
        <p>Open the link from your result email, or take the Read again.</p>
        <a className={buttonClass} href="/read/">
          Go to the Perception Read
        </a>
      </ReadPanel>
    );
  }

  if (state.kind === 'starting') {
    return (
      <ReadPanel eyebrow="Rite I" title="Taking you to checkout">
        <p>One moment. You&apos;ll land on Stripe&apos;s secure checkout.</p>
      </ReadPanel>
    );
  }

  if (state.kind === 'owned') {
    return (
      <ReadPanel eyebrow="Rite I" title="You already own Rite I">
        <p>All five Perception scans are in your account.</p>
        <a className={buttonClass} href="/dashboard">
          Go to your dashboard
        </a>
      </ReadPanel>
    );
  }

  if (state.kind === 'sent') {
    return (
      <ReadPanel eyebrow="Rite I" title="Check your inbox">
        <p>
          We sent a sign-in link to <strong>{state.maskedEmail}</strong>. Open it on this device and checkout starts
          straight away.
        </p>
        <p className="text-sm text-white/60">It can take a minute. Check spam if it isn&apos;t there.</p>
        <button type="button" className={buttonClass} onClick={sendLink}>
          Send it again
        </button>
        {signInLinks}
      </ReadPanel>
    );
  }

  if (state.kind === 'error') {
    return (
      <ReadPanel eyebrow="Rite I" title="That didn't work">
        <p>{state.message}</p>
        <button type="button" className={buttonClass} onClick={signedIn ? startCheckout : sendLink}>
          Try again
        </button>
        {!signedIn && signInLinks}
      </ReadPanel>
    );
  }

  // signin / sending
  return (
    <ReadPanel eyebrow="Rite I" title="Get Rite I for $12">
      {signinFailed && (
        <p className="rounded-lg border border-amber-300/30 bg-amber-200/10 p-3 text-sm text-amber-100">
          That link opened in a different browser, or it expired. Send a new one and open it on this device.
        </p>
      )}
      <p>
        Rite I is all five Perception scans, starting with the one your Read pointed to. If you already own some of
        them, checkout charges you only for the rest.
      </p>
      <p>
        Your account is made at checkout.{' '}
        {leadEmailMasked ? (
          <>
            We&apos;ll email a sign-in link to <strong>{leadEmailMasked}</strong>, the address your Read went to.
          </>
        ) : (
          <>Sign in or create an account to continue.</>
        )}
      </p>
      {leadEmailMasked ? (
        <button type="button" className={buttonClass} onClick={sendLink} disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending…' : 'Email me the sign-in link'}
        </button>
      ) : (
        <a className={buttonClass} href={`/signup?redirect=${encodeURIComponent(bridgePath)}`}>
          Create an account
        </a>
      )}
      {signInLinks}
    </ReadPanel>
  );
}
