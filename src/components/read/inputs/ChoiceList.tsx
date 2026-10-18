'use client';

import type { ReadQuestion } from '@/lib/read/types';
import styles from '../read.module.css';

type Option = NonNullable<ReadQuestion['options']>[number];

interface ChoiceListProps {
  name: string;
  legend: string;
  /** Hide the legend visually when the question heading already says it. */
  legendHidden?: boolean;
  options: Option[];
  multiple?: boolean;
  maxPicks?: number;
  value: string[];
  onChange: (value: string[]) => void;
  inline?: boolean;
  describedBy?: string;
}

/**
 * Native radio or checkbox inputs inside tappable rows, so arrow keys, Space and
 * screen readers work without extra code. The Rites MixedInput uses buttons with
 * no selected state for assistive tech, so the Read keeps its own list.
 */
export function ChoiceList({
  name,
  legend,
  legendHidden,
  options,
  multiple,
  maxPicks,
  value,
  onChange,
  inline,
  describedBy,
}: ChoiceListProps) {
  const atMax = multiple && maxPicks !== undefined && value.length >= maxPicks;

  const toggle = (optionValue: string, checked: boolean) => {
    if (!multiple) {
      onChange([optionValue]);
      return;
    }
    if (checked) {
      if (atMax) return;
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((v) => v !== optionValue));
    }
  };

  return (
    <fieldset className={styles.fieldset} aria-describedby={describedBy}>
      <legend className={legendHidden ? styles.srOnly : styles.legend}>{legend}</legend>
      <div className={inline ? styles.optionsInline : styles.options}>
        {options.map((option) => {
          const selected = value.includes(option.value);
          const disabled = !selected && atMax;
          return (
            <label
              key={option.value}
              className={styles.option}
              data-selected={selected}
              data-disabled={disabled}
            >
              <input
                className={styles.optionInput}
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={(e) => toggle(option.value, e.target.checked)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {multiple && maxPicks !== undefined && (
        <p className={styles.pickHint} aria-live="polite">
          {value.length} of {maxPicks} picked
        </p>
      )}
    </fieldset>
  );
}
