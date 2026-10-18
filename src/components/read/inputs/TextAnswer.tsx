'use client';

import type { ReadAnswer, ReadQuestion } from '@/lib/read/types';
import { MULTI_LINE_TEXT } from '../answers';
import styles from '../read.module.css';

interface TextAnswerProps {
  question: ReadQuestion;
  answer: ReadAnswer;
  onChange: (answer: ReadAnswer) => void;
  onEnter: () => void;
}

/**
 * Short text. No minimum length. Enter moves on (Shift+Enter for a new line).
 * Q8 ("finish this three times") gets three single-line boxes.
 */
export function TextAnswer({ question, answer, onChange, onEnter }: TextAnswerProps) {
  const lines = MULTI_LINE_TEXT[question.id] ?? 1;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    }
  };

  if (lines > 1) {
    const values = Array.from({ length: lines }, (_, i) => {
      const v = answer.parts?.[`line${i + 1}`];
      return typeof v === 'string' ? v : '';
    });
    const setLine = (index: number, value: string) => {
      const next = [...values];
      next[index] = value;
      const parts = Object.fromEntries(next.map((v, i) => [`line${i + 1}`, v]));
      onChange({ ...answer, parts, text: next.map((v) => v.trim()).filter(Boolean).join('\n') });
    };
    return (
      <div>
        {values.map((v, i) => (
          <div className={styles.field} key={i}>
            <label className={styles.fieldLabel} htmlFor={`${question.id}-line${i + 1}`}>
              {`I'm the kind of person who… (${i + 1} of ${lines})`}
            </label>
            <input
              id={`${question.id}-line${i + 1}`}
              className={styles.input}
              value={v}
              maxLength={200}
              autoComplete="off"
              placeholder={i === 0 ? question.placeholder : undefined}
              onChange={(e) => setLine(i, e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.srOnly} htmlFor={`${question.id}-text`}>
        {question.question}
      </label>
      <textarea
        id={`${question.id}-text`}
        className={styles.textarea}
        value={answer.text ?? ''}
        placeholder={question.placeholder}
        maxLength={1000}
        rows={3}
        onChange={(e) => onChange({ ...answer, text: e.target.value })}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
