'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { ReadUtm } from '@/lib/read/types';
import { useReadApi } from './ReadApiContext';
import { LANDING, landingLine } from './copy';
import { MANIFESTATION_VARIANT } from './utm';
import styles from './read.module.css';

interface ReadLandingProps {
  utm: ReadUtm;
  variant?: string;
  /** Query string to carry to /read/start (UTMs and ?v=). */
  carry: string;
}

export function ReadLanding({ utm, variant, carry }: ReadLandingProps) {
  const api = useReadApi();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void api.event({ event: 'read_view_landing', props: { variant: variant ?? null, utm } });
  }, [api, utm, variant]);

  const startHref = `/read/start/${carry}`;

  return (
    <>
      <h1 className={styles.kicker}>{LANDING.name}</h1>
      <p className={styles.headline}>{landingLine(utm.content, variant)}</p>
      <p className={styles.sub}>{LANDING.sub}</p>
      {variant === MANIFESTATION_VARIANT && <p className={styles.sub}>{LANDING.manifestationNote}</p>}

      <ul className={styles.facts} aria-label="At a glance">
        {LANDING.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className={styles.note}>{LANDING.emailNote}</p>

      <Link href={startHref} className={styles.primaryButton} prefetch={false}>
        {LANDING.start}
      </Link>

      <section className={styles.section} aria-labelledby="read-get">
        <h2 id="read-get" className={styles.sectionTitle}>
          {LANDING.getTitle}
        </h2>
        <ul className={styles.list}>
          {LANDING.get.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="read-what">
        <h2 id="read-what" className={styles.sectionTitle}>
          {LANDING.whatTitle}
        </h2>
        <div className={styles.card}>
          <p style={{ margin: 0 }}>{LANDING.screen0}</p>
          <p className={styles.scope}>{LANDING.scope}</p>
        </div>
      </section>

      <div className={styles.section}>
        <Link href={startHref} className={`${styles.primaryButton} ${styles.fullWidth}`} prefetch={false}>
          {LANDING.start}
        </Link>
      </div>
    </>
  );
}
