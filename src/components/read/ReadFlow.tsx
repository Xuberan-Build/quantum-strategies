'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReadAnswer, ReadAnswers, ReadQuestion, ReadUtm, Segment } from '@/lib/read/types';
import { ReadApiError } from './api';
import { useReadApi } from './ReadApiContext';
import { answerSummary, normaliseAnswer, segmentFromAnswers, validateAnswer, visibleQuestions } from './answers';
import { FLOW } from './copy';
import { clearProgress, loadProgress, readSessionCookie, saveProgress, savePreview } from './progress';
import { QuestionScreen } from './QuestionScreen';
import { SupportScreen } from './SupportScreen';
import styles from './read.module.css';

type Phase = 'starting' | 'question' | 'completing' | 'support' | 'error';

interface ReadFlowProps {
  utm: ReadUtm;
  variant?: string;
}

export const resultPath = (sessionId: string) => `/read/result/${encodeURIComponent(sessionId)}/`;

export function ReadFlow({ utm, variant: variantProp }: ReadFlowProps) {
  const api = useReadApi();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('starting');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | undefined>(variantProp);
  const [segment, setSegment] = useState<Segment | undefined>();
  const [questions, setQuestions] = useState<ReadQuestion[]>([]);
  const [answers, setAnswers] = useState<ReadAnswers>({});
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewed = useRef<Set<string>>(new Set());
  const booted = useRef(false);

  const visible = useMemo(() => visibleQuestions(questions, segment, variant), [questions, segment, variant]);
  const index = Math.max(0, visible.findIndex((q) => q.id === currentId));
  const question = visible[index];

  // Start (or resume) the session, then load the questions.
  const boot = useCallback(async () => {
    setPhase('starting');
    setError(null);
    try {
      const saved = loadProgress();
      let sid = saved?.sessionId ?? null;
      const v = saved?.variant ?? variantProp;
      if (!sid) {
        // A session cookie without local answers (new tab): reuse the session, start at Q1.
        sid = readSessionCookie();
      }
      if (!sid) {
        const started = await api.start({ utm: { ...utm, variant: v }, variant: v });
        sid = started.sessionId;
        void api.event({ sessionId: sid, event: 'read_start', props: { variant: v ?? null, utm } });
      }
      const seg = saved?.segment;
      const qs = await api.getQuestions({ segment: seg, variant: v });
      setSessionId(sid);
      setVariant(v);
      setSegment(seg);
      setQuestions(qs);
      setAnswers(saved?.answers ?? {});
      const first = visibleQuestions(qs, seg, v)[0];
      setCurrentId(saved?.currentId && qs.some((q) => q.id === saved.currentId) ? saved.currentId : first?.id);
      setPhase('question');
    } catch {
      setPhase('error');
      setError(FLOW.startError);
    }
  }, [api, utm, variantProp]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void boot();
  }, [boot]);

  // Keep the place in sessionStorage.
  useEffect(() => {
    if (!sessionId || phase !== 'question') return;
    saveProgress({ sessionId, variant, utm, segment, answers, currentId, questions });
  }, [sessionId, variant, utm, segment, answers, currentId, questions, phase]);

  // One step view per question per visit.
  useEffect(() => {
    if (phase !== 'question' || !question || !sessionId) return;
    if (viewed.current.has(question.id)) return;
    viewed.current.add(question.id);
    void api.event({ sessionId, event: 'read_step_view', step: question.order, props: { questionId: question.id } });
  }, [api, phase, question, sessionId]);

  const answer: ReadAnswer = (question && answers[question.id]) || { questionId: question?.id ?? '' };

  const onChange = (next: ReadAnswer) => {
    if (!question) return;
    setError(null);
    setAnswers((prev) => ({ ...prev, [question.id]: { ...next, questionId: question.id } }));
  };

  const finish = async (sid: string) => {
    setPhase('completing');
    try {
      const preview = await api.complete(sid);
      void api.event({ sessionId: sid, event: 'read_complete', props: { tier: preview.safety.tier } });
      if (preview.safety.tier === 'crisis') {
        void api.event({ sessionId: sid, event: 'read_safety_triggered', props: { tier: 'crisis', at: 'complete' } });
        setPhase('support');
        return;
      }
      savePreview(preview);
      router.push(resultPath(sid));
    } catch {
      setPhase('question');
      setError(FLOW.saveError);
    }
  };

  const onNext = async () => {
    if (!question || !sessionId || saving) return;
    const problem = validateAnswer(question, answers[question.id]);
    if (problem) {
      setError(problem);
      return;
    }
    const raw = answers[question.id];
    setSaving(true);
    setError(null);
    try {
      if (raw) {
        const payload = normaliseAnswer(question, raw);
        const res = await api.saveAnswer(sessionId, payload);
        void api.event({ sessionId, event: 'read_step_submit', step: question.order, props: { questionId: question.id } });
        if (res?.safety?.tier === 'crisis') {
          void api.event({ sessionId, event: 'read_safety_triggered', step: question.order, props: { tier: 'crisis' } });
          setPhase('support');
          return;
        }
      } else {
        void api.event({ sessionId, event: 'read_step_submit', step: question.order, props: { questionId: question.id, skipped: true } });
      }

      // After Q1 the rest of the questions depend on the segment.
      let list = visible;
      if (question.order === 1) {
        const seg = segmentFromAnswers(questions, answers);
        if (seg !== segment) {
          const qs = await api.getQuestions({ segment: seg, variant });
          setQuestions(qs);
          setSegment(seg);
          list = visibleQuestions(qs, seg, variant);
        }
      }
      const pos = list.findIndex((q) => q.id === question.id);
      const nextQ = list[pos + 1];
      if (nextQ) {
        setCurrentId(nextQ.id);
      } else {
        await finish(sessionId);
      }
    } catch (err) {
      if (err instanceof ReadApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        clearProgress();
      }
      setError(FLOW.saveError);
    } finally {
      setSaving(false);
    }
  };

  const onBack = index > 0 ? () => { setError(null); setCurrentId(visible[index - 1].id); } : undefined;

  if (phase === 'support') {
    return <SupportScreen answers={answerSummary(questions, answers)} />;
  }

  if (phase === 'error') {
    return (
      <div className={styles.status}>
        <p role="alert">{error}</p>
        <button type="button" className={styles.primaryButton} onClick={() => void boot()}>
          {FLOW.retry}
        </button>
      </div>
    );
  }

  if (phase === 'starting' || phase === 'completing' || !question) {
    return (
      <p className={styles.status} role="status" aria-live="polite">
        {phase === 'completing' ? FLOW.completing : FLOW.starting}
      </p>
    );
  }

  return (
    <QuestionScreen
      key={question.id}
      question={question}
      position={index + 1}
      total={visible.length}
      answer={answer}
      segment={segment}
      variant={variant}
      saving={saving}
      error={error}
      onChange={onChange}
      onNext={() => void onNext()}
      onBack={onBack}
    />
  );
}
