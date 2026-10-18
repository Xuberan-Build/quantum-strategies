'use client';

import { useEffect, useRef } from 'react';
import type { ReadAnswer, ReadQuestion, Segment } from '@/lib/read/types';
import { FOLLOW_UP_PROMPTS, groupOptions, isNoneValue, needsText, visibleOptions } from './answers';
import { FLOW } from './copy';
import { ChoiceList } from './inputs/ChoiceList';
import { MultiThenPick } from './inputs/MultiThenPick';
import { ScaleInput } from './inputs/ScaleInput';
import { TextAnswer } from './inputs/TextAnswer';
import { WeekMirrorInput } from './inputs/WeekMirrorInput';
import styles from './read.module.css';

interface QuestionScreenProps {
  question: ReadQuestion;
  position: number; // 1-based
  total: number;
  answer: ReadAnswer;
  segment?: Segment;
  variant?: string;
  saving: boolean;
  error: string | null;
  onChange: (answer: ReadAnswer) => void;
  onNext: () => void;
  onBack?: () => void;
}

export function QuestionScreen({
  question,
  position,
  total,
  answer,
  segment,
  variant,
  saving,
  error,
  onChange,
  onNext,
  onBack,
}: QuestionScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorId = `${question.id}-error`;
  const helperId = `${question.id}-helper`;

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      // jsdom and old browsers
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [question.id]);

  const options = visibleOptions(question, segment, variant);
  const isLast = position === total;

  const renderInput = () => {
    switch (question.kind) {
      case 'week_mirror':
        return <WeekMirrorInput question={question} answer={answer} onChange={onChange} onEnter={onNext} />;
      case 'multi_then_pick':
        return <MultiThenPick question={question} options={options} answer={answer} onChange={onChange} />;
      case 'text':
        return <TextAnswer question={question} answer={answer} onChange={onChange} onEnter={onNext} />;
      case 'scale':
        return <ScaleInput question={question} value={answer.number} onChange={(n) => onChange({ ...answer, number: n })} />;
      case 'single':
      case 'multi':
      default: {
        const { main, followUps } = groupOptions(options);
        const multiple = question.kind === 'multi';
        const picked = (answer.choice ?? []).filter((v) => main.some((o) => o.value === v));
        const textValue = picked.find(needsText);
        const onlyNone = picked.length > 0 && picked.every(isNoneValue);
        return (
          <>
            <ChoiceList
              name={question.id}
              legend={question.question}
              legendHidden
              options={main}
              multiple={multiple}
              maxPicks={multiple ? question.maxPicks : undefined}
              value={picked}
              describedBy={question.helper ? helperId : undefined}
              onChange={(next) => {
                // "Nothing yet" clears the rest, and picking anything else clears "Nothing yet".
                let value = next;
                if (multiple) {
                  const added = next.find((v) => !picked.includes(v));
                  if (added && isNoneValue(added)) value = [added];
                  else if (added) value = next.filter((v) => !isNoneValue(v));
                }
                const parts = { ...(answer.parts ?? {}) };
                if (value.length && value.every(isNoneValue)) for (const f of followUps) delete parts[f.prefix];
                onChange({ ...answer, choice: value, parts, text: value.some(needsText) ? answer.text : undefined });
              }}
            />
            {textValue && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={`${question.id}-text`}>
                  {/:skill$/.test(textValue) ? 'Name the skill' : 'In your words'}
                </label>
                <input
                  id={`${question.id}-text`}
                  className={styles.input}
                  value={answer.text ?? ''}
                  maxLength={200}
                  autoComplete="off"
                  onChange={(e) => onChange({ ...answer, text: e.target.value })}
                />
              </div>
            )}
            {!onlyNone &&
              picked.length > 0 &&
              followUps.map((group) => {
                const current = answer.parts?.[group.prefix];
                return (
                  <ChoiceList
                    key={group.prefix}
                    name={`${question.id}-${group.prefix}`}
                    legend={FOLLOW_UP_PROMPTS[group.prefix] ?? 'And then?'}
                    options={group.options}
                    value={typeof current === 'string' ? [current] : []}
                    onChange={([v]) => onChange({ ...answer, parts: { ...(answer.parts ?? {}), [group.prefix]: v } })}
                  />
                );
              })}
          </>
        );
      }
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onNext();
        }
      }}
      aria-describedby={error ? errorId : undefined}
    >
      <div className={styles.progress}>
        <span className={styles.progressLabel} id={`${question.id}-progress`}>
          {position} of {total}
        </span>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-labelledby={`${question.id}-progress`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={position}
        >
          <div className={styles.progressFill} style={{ width: `${Math.round((position / total) * 100)}%` }} />
        </div>
      </div>

      {question.title && <p className={styles.questionTitle}>{question.title}</p>}
      <h2 className={styles.questionText} ref={headingRef} tabIndex={-1}>
        {question.question}
      </h2>
      {question.helper && (
        <p className={styles.helper} id={helperId}>
          {question.helper}
        </p>
      )}
      {!question.required && <p className={styles.helper}>Optional.</p>}

      {renderInput()}

      <p id={errorId} className={styles.error} role="alert" aria-live="assertive">
        {error ?? ''}
      </p>

      <div className={styles.actions}>
        {onBack && (
          <button type="button" className={styles.secondaryButton} onClick={onBack} disabled={saving}>
            {FLOW.back}
          </button>
        )}
        <button type="submit" className={styles.primaryButton} disabled={saving} aria-busy={saving}>
          {saving ? FLOW.saving : isLast ? FLOW.finish : FLOW.next}
        </button>
      </div>
      <p className={styles.keyboardHint}>Press Enter to go on. Ctrl or ⌘ + Enter works from anywhere on the page.</p>
    </form>
  );
}
