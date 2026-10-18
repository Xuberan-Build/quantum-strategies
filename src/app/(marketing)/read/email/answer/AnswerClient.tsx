'use client';

import { useEffect, useRef, useState } from 'react';
import ReadPanel, { buttonClass } from '../../checkout/ReadPanel';

type State =
  | { kind: 'saving' }
  | { kind: 'saved'; followup: boolean }
  | { kind: 'followup_sending' }
  | { kind: 'followup_done' }
  | { kind: 'error'; message: string };

const textareaClass =
  'mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-3 text-[15px] text-white placeholder-white/40 focus:border-[#6C5CE7] focus:outline-none';

export default function AnswerClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { kind: 'saving' } : { kind: 'error', message: 'This link is incomplete.' });
  const [mainThing, setMainThing] = useState('');
  const [whoHelps, setWhoHelps] = useState('');
  const [followupError, setFollowupError] = useState('');
  const posted = useRef(false);

  useEffect(() => {
    if (!token || posted.current) return;
    posted.current = true;
    fetch('/api/read/email/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setState({ kind: 'error', message: data?.error || 'We could not save your answer.' });
        else setState({ kind: 'saved', followup: Boolean(data.followup) });
      })
      .catch(() => setState({ kind: 'error', message: 'We could not save your answer. Check your connection and try again.' }));
  }, [token]);

  const submitFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainThing.trim() && !whoHelps.trim()) {
      setFollowupError('Write an answer to at least one question.');
      return;
    }
    setFollowupError('');
    setState({ kind: 'followup_sending' });
    try {
      const res = await fetch('/api/read/email/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, mainThing, whoHelps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFollowupError(data?.error || 'We could not save that.');
        setState({ kind: 'saved', followup: true });
        return;
      }
      setState({ kind: 'followup_done' });
    } catch {
      setFollowupError('We could not save that. Check your connection and try again.');
      setState({ kind: 'saved', followup: true });
    }
  };

  if (state.kind === 'saving') {
    return (
      <ReadPanel eyebrow="The Perception Read" title="Saving your answer">
        <p>One moment.</p>
      </ReadPanel>
    );
  }

  if (state.kind === 'error') {
    return (
      <ReadPanel eyebrow="The Perception Read" title="That didn't save">
        <p>{state.message}</p>
        <p>You can also reply to the email with your answer. It comes straight to me.</p>
      </ReadPanel>
    );
  }

  if (state.kind === 'followup_done') {
    return (
      <ReadPanel eyebrow="The Perception Read" title="Thank you">
        <p>That&apos;s exactly what I needed. I read every one of these, and they shape what I build next.</p>
        <p className="text-white/60">Austin</p>
      </ReadPanel>
    );
  }

  if (state.kind === 'saved' && !state.followup) {
    return (
      <ReadPanel eyebrow="The Perception Read" title="Got it, thank you">
        <p>Your answer is saved. If there are other questions in the email, each one is a single click.</p>
        <p className="text-white/60">Austin</p>
      </ReadPanel>
    );
  }

  // saved with follow-up, or sending it
  return (
    <ReadPanel eyebrow="The Perception Read" title="Got it. Two short questions, if you have a minute">
      <form onSubmit={submitFollowup} className="space-y-4">
        <label className="block">
          <span className="font-medium text-white">What&apos;s the main thing you got from the Read?</span>
          <textarea className={textareaClass} rows={3} maxLength={1000} value={mainThing} onChange={(e) => setMainThing(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-medium text-white">Who do you think this would help most?</span>
          <textarea className={textareaClass} rows={3} maxLength={1000} value={whoHelps} onChange={(e) => setWhoHelps(e.target.value)} />
        </label>
        {followupError && <p className="text-sm text-amber-200">{followupError}</p>}
        <button type="submit" className={buttonClass} disabled={state.kind === 'followup_sending'}>
          {state.kind === 'followup_sending' ? 'Sending…' : 'Send'}
        </button>
        <p className="text-sm text-white/60">Your first answer is already saved. These two are optional.</p>
      </form>
    </ReadPanel>
  );
}
