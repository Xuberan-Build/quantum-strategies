'use client';

import type { ReadAnswer, ReadQuestion } from '@/lib/read/types';
import { needsText } from '../answers';
import styles from '../read.module.css';
import { ChoiceList } from './ChoiceList';

type Option = NonNullable<ReadQuestion['options']>[number];

interface MultiThenPickProps {
  question: ReadQuestion;
  options: Option[];
  answer: ReadAnswer;
  onChange: (answer: ReadAnswer) => void;
}

/**
 * Q2: pick up to three things you've said, then the loudest one.
 * The second step only appears once there's more than one pick.
 */
export function MultiThenPick({ question, options, answer, onChange }: MultiThenPickProps) {
  const picked = answer.choice ?? [];
  const loudest = typeof answer.parts?.loudest === 'string' ? answer.parts.loudest : undefined;
  const otherValue = picked.find(needsText);

  const setPicked = (next: string[]) => {
    const parts = { ...(answer.parts ?? {}) };
    // A single pick is the loudest by default; once there are two, they choose.
    if (!loudest || !next.includes(loudest) || (picked.length <= 1 && next.length > 1)) delete parts.loudest;
    if (next.length === 1) parts.loudest = next[0];
    onChange({
      ...answer,
      choice: next,
      parts,
      text: next.some(needsText) ? answer.text : undefined,
    });
  };

  const pickedOptions = options
    .filter((o) => picked.includes(o.value))
    .map((o) => (needsText(o.value) && answer.text?.trim() ? { ...o, label: answer.text.trim() } : o));

  return (
    <>
      <ChoiceList
        name={`${question.id}-picks`}
        legend={question.question}
        legendHidden
        options={options}
        multiple
        maxPicks={question.maxPicks ?? 3}
        value={picked}
        onChange={setPicked}
      />
      {otherValue && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${question.id}-other`}>
            In your words
          </label>
          <input
            id={`${question.id}-other`}
            className={styles.input}
            value={answer.text ?? ''}
            onChange={(e) => onChange({ ...answer, text: e.target.value })}
            maxLength={200}
            autoComplete="off"
          />
        </div>
      )}
      {picked.length > 1 && (
        <ChoiceList
          name={`${question.id}-loudest`}
          legend="Which one is loudest?"
          options={pickedOptions}
          value={loudest ? [loudest] : []}
          onChange={([v]) => onChange({ ...answer, parts: { ...(answer.parts ?? {}), loudest: v } })}
        />
      )}
    </>
  );
}
