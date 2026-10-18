'use client';

import { useEffect, useRef, useState } from 'react';
import { SUPPORT } from './copy';
import styles from './read.module.css';

interface SupportScreenProps {
  /** Plain question/answer rows from this device, for "Show me my answers anyway". */
  answers?: { question: string; answer: string }[];
}

/**
 * Spec v3 §6 tier 1. No week mirror, no pattern, no email gate, no offer.
 * One button shows their own answers back, with nothing to sell.
 */
export function SupportScreen({ answers }: SupportScreenProps) {
  const [showAnswers, setShowAnswers] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="read-support-title" data-testid="read-support">
      <h2 id="read-support-title" className={styles.patternName} ref={headingRef} tabIndex={-1}>
        {SUPPORT.title}
      </h2>
      <div className={styles.body}>
        <p>{SUPPORT.body}</p>
      </div>
      <ul className={styles.supportLines}>
        {SUPPORT.lines.map((line) => (
          <li key={line.where}>
            <span className={styles.supportWhere}>{line.where}</span>
            <a href={line.href} {...(line.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {line.how}
            </a>
          </li>
        ))}
      </ul>
      <p>{SUPPORT.emergency}</p>

      <div className={styles.section}>
        {!showAnswers ? (
          <button type="button" className={styles.secondaryButton} onClick={() => setShowAnswers(true)}>
            {SUPPORT.showAnswers}
          </button>
        ) : (
          <div>
            <h3 className={styles.sectionTitle}>{SUPPORT.answersTitle}</h3>
            {answers && answers.length ? (
              <dl className={styles.answerTable}>
                {answers.map((row) => (
                  <div key={row.question}>
                    <dt>{row.question}</dt>
                    <dd>{row.answer}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>{SUPPORT.noAnswers}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
