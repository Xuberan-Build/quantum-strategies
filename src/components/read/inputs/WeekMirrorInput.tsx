'use client';

import type { ReadAnswer, ReadQuestion } from '@/lib/read/types';
import { hoursNumber, WEEK_MIRROR_DEFAULTS, wantOrShouldFromTag, weekMirrorOptions } from '../answers';
import styles from '../read.module.css';
import { ChoiceList } from './ChoiceList';

interface WeekMirrorInputProps {
  question: ReadQuestion;
  answer: ReadAnswer;
  onChange: (answer: ReadAnswer) => void;
  onEnter: () => void;
}

/**
 * Q7, the source of the week mirror: the thing, the hours it got, what got the
 * hours instead (optional) and want or supposed to. One screen, four parts.
 */
export function WeekMirrorInput({ question, answer, onChange, onEnter }: WeekMirrorInputProps) {
  const opts = weekMirrorOptions(question);
  const parts = answer.parts ?? {};
  const thing = typeof parts.thing === 'string' ? parts.thing : '';
  const hours = typeof parts.hours === 'string' ? parts.hours : undefined;
  const instead = typeof parts.instead === 'string' ? parts.instead : undefined;
  const want = typeof parts.wantOrShould === 'string' ? `own:${parts.wantOrShould}` : undefined;

  const set = (patch: Record<string, string | null>) => {
    const nextParts = { ...parts, ...patch };
    const hoursTag = typeof nextParts.hours === 'string' ? nextParts.hours : undefined;
    onChange({
      ...answer,
      parts: nextParts,
      text: typeof nextParts.thing === 'string' ? nextParts.thing : undefined,
      number: hoursNumber(hoursTag),
    });
  };

  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${question.id}-thing`}>
          The thing, in a few words
        </label>
        <input
          id={`${question.id}-thing`}
          className={styles.input}
          value={thing}
          placeholder={question.placeholder ?? 'For example, writing again'}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => set({ thing: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
        />
      </div>
      <ChoiceList
        name={`${question.id}-hours`}
        legend={WEEK_MIRROR_DEFAULTS.hoursPrompt}
        options={opts.hours}
        value={hours ? [hours] : []}
        onChange={([v]) => set({ hours: v })}
        inline
      />
      <ChoiceList
        name={`${question.id}-instead`}
        legend={`${WEEK_MIRROR_DEFAULTS.insteadPrompt} (optional)`}
        options={opts.instead}
        value={instead ? [instead] : []}
        onChange={([v]) => set({ instead: v })}
      />
      <ChoiceList
        name={`${question.id}-own`}
        legend={WEEK_MIRROR_DEFAULTS.ownPrompt}
        options={opts.own}
        value={want ? [want] : []}
        onChange={([v]) => set({ wantOrShould: wantOrShouldFromTag(v) })}
        inline
      />
    </>
  );
}
