'use client';

import { useEffect, useRef } from 'react';
import type { ReadPreview } from '@/lib/read/types';
import { PREVIEW } from './copy';
import styles from './read.module.css';

/** Plain text lines, split on new lines. The mirror is static text from the server. */
export function Lines({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return (
    <>
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </>
  );
}

interface PreviewViewProps {
  preview: ReadPreview;
  /** The Q2 loudest pick, from this device. Omitted when we don't have it. */
  youSaid?: string | null;
}

/** Spec v3 §8.1: block 0 (the week mirror) and block 1 (you said, the pattern, the read). */
export function PreviewView({ preview, youSaid }: PreviewViewProps) {
  const nameRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  return (
    <>
      {preview.mirror && (
        <section className={styles.block} aria-labelledby="read-week-title" data-block="mirror">
          <h2 id="read-week-title" className={styles.blockTitle}>
            {PREVIEW.weekTitle}
          </h2>
          <div className={styles.mirror}>
            <Lines text={preview.mirror.line} />
          </div>
        </section>
      )}
      {preview.pattern && (
        <section className={styles.block} aria-labelledby="read-pattern-name" data-block="pattern">
          {youSaid && (
            <p className={styles.quote}>
              {PREVIEW.youSaid}: “{youSaid}”
            </p>
          )}
          <span className={styles.patternLabel}>{PREVIEW.patternLabel}</span>
          <h1 id="read-pattern-name" className={styles.patternName} ref={nameRef} tabIndex={-1}>
            {preview.pattern.name}
          </h1>
          <div className={styles.body}>
            <p>{preview.pattern.read}</p>
            <p>{PREVIEW.fullReadLine}</p>
          </div>
        </section>
      )}
    </>
  );
}
