'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReadLeadInput, ReadPreview, ReadResult } from '@/lib/read/types';
import { ReadApiError } from './api';
import { useReadApi } from './ReadApiContext';
import { answerSummary, loudestQuote } from './answers';
import { RESULT } from './copy';
import { EmailGate } from './EmailGate';
import { PreviewView } from './PreviewView';
import { loadPreview, loadProgressFor, savePreview } from './progress';
import { ResultBlocks } from './ResultBlocks';
import { SupportScreen } from './SupportScreen';
import styles from './read.module.css';

type View =
  | { kind: 'loading' }
  | { kind: 'preview'; preview: ReadPreview }
  | { kind: 'support' }
  | { kind: 'result'; result: ReadResult }
  | { kind: 'missing' };

interface ReadResultViewProps {
  sessionId: string;
  /** Signed link token from the result email (`?t=`). */
  token?: string;
}

const LOCKED = new Set([401, 402, 403, 404, 409, 423]);

/**
 * /read/result/[sessionId]: preview → email gate → full result, all on one URL so
 * the page is the shareable link. Loads the full result first when it can (cookie or
 * `?t=`), and falls back to the preview when the Read hasn't been unlocked yet.
 */
export function ReadResultView({ sessionId, token }: ReadResultViewProps) {
  const api = useReadApi();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const sentPreviewView = useRef(false);
  const sentResultView = useRef(false);
  const booted = useRef(false);

  const progress = typeof window !== 'undefined' ? loadProgressFor(sessionId) : null;

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const showPreview = (preview: ReadPreview) => {
      if (preview.safety.tier === 'crisis') setView({ kind: 'support' });
      else setView({ kind: 'preview', preview });
    };

    (async () => {
      try {
        const result = await api.getResult(sessionId, token);
        setView({ kind: 'result', result });
        return;
      } catch (err) {
        if (!(err instanceof ReadApiError) || !LOCKED.has(err.status) || token) {
          setView({ kind: 'missing' });
          return;
        }
      }
      // Not unlocked yet: the preview from the flow, or ask the server for it again.
      const stashed = loadPreview(sessionId);
      if (stashed) {
        showPreview(stashed);
        return;
      }
      try {
        const preview = await api.complete(sessionId);
        savePreview(preview);
        showPreview(preview);
      } catch {
        setView({ kind: 'missing' });
      }
    })();
  }, [api, sessionId, token]);

  // Funnel events, once each.
  useEffect(() => {
    if (view.kind === 'preview' && !sentPreviewView.current) {
      sentPreviewView.current = true;
      const m = view.preview.mirror;
      void api.event({
        sessionId,
        event: 'read_preview_view',
        props: {
          pattern: view.preview.pattern?.id ?? null,
          gap: m ? m.showsGap : null,
          own: m?.wantOrShould ?? null,
          tier: view.preview.safety.tier,
        },
      });
    }
    if (view.kind === 'result' && !sentResultView.current) {
      sentResultView.current = true;
      void api.event({
        sessionId,
        event: 'read_result_view',
        props: { pattern: view.result.pattern, usedFallback: view.result.usedFallback, viaLink: Boolean(token) },
      });
    }
  }, [api, sessionId, token, view]);

  const unlock = async (lead: Omit<ReadLeadInput, 'utm'>) => {
    void api.event({ sessionId, event: 'read_email_submit', props: { consentMarketing: lead.consentMarketing } });
    const result = await api.unlock(sessionId, { ...lead, utm: progress?.utm });
    setView({ kind: 'result', result });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  switch (view.kind) {
    case 'loading':
      return (
        <p className={styles.status} role="status" aria-live="polite">
          {RESULT.loading}
        </p>
      );
    case 'missing':
      return (
        <div className={styles.status}>
          <p role="alert">{RESULT.notFound}</p>
          <a className={styles.primaryButton} href="/read/">
            {RESULT.startOver}
          </a>
        </div>
      );
    case 'support':
      return <SupportScreen answers={progress?.questions ? answerSummary(progress.questions, progress.answers) : undefined} />;
    case 'preview': {
      const youSaid = progress?.questions ? loudestQuote(progress.questions, progress.answers) : null;
      return (
        <>
          <PreviewView preview={view.preview} youSaid={youSaid} />
          <EmailGate onSubmit={unlock} />
        </>
      );
    }
    case 'result':
      return <ResultBlocks result={view.result} />;
  }
}
