'use client';

import type { ReadQuestion } from '@/lib/read/types';
import styles from '../read.module.css';

interface ScaleInputProps {
  question: ReadQuestion;
  value: number | undefined;
  onChange: (value: number) => void;
}

/** A row of numbers as radio buttons. Arrow keys move along it. */
export function ScaleInput({ question, value, onChange }: ScaleInputProps) {
  const scale = question.scale ?? { min: 1, max: 10, minLabel: 'Almost none of it', maxLabel: 'All of it' };
  const numbers = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
  const hintId = `${question.id}-scale-hint`;

  return (
    <fieldset className={styles.fieldset} aria-describedby={hintId}>
      <legend className={styles.srOnly}>{question.question}</legend>
      <div className={styles.scaleGrid}>
        {numbers.map((n) => (
          <label key={n} className={styles.option} data-selected={value === n}>
            <input
              className={styles.optionInput}
              type="radio"
              name={`${question.id}-scale`}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <p id={hintId} className={styles.scaleLabels}>
        <span>
          {scale.min} = {scale.minLabel}
        </span>
        {scale.midLabel && (
          <span>
            {Math.floor((scale.min + scale.max) / 2)} = {scale.midLabel}
          </span>
        )}
        <span>
          {scale.max} = {scale.maxLabel}
        </span>
      </p>
    </fieldset>
  );
}
