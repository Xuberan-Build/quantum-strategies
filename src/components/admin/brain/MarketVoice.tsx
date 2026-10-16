'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { BrainSnapshot, PillarSlug } from '@/lib/brain/snapshot';
import { PILLAR_COLOR, PILLAR_ORDER } from '@/lib/brain/viz';
import { QuoteWall, StatTile } from './primitives';
import styles from './brain.module.css';
import m from './market.module.css';

type PillarVoice = BrainSnapshot['marketVoice']['pillars'][number];

interface MarketVoiceProps {
  pillars: PillarVoice[];
  titles: Record<PillarSlug, string>;
  rites: Partial<Record<PillarSlug, string>>;
}

export function MarketVoice({ pillars, titles, rites }: MarketVoiceProps) {
  const ordered = [...pillars].sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar));
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  if (ordered.length === 0) return <p className={styles.muted}>No pillar evidence in this snapshot.</p>;
  const current = ordered[Math.min(active, ordered.length - 1)];
  const maxItems = Math.max(1, ...ordered.map((p) => p.evidence.items));

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (active + 1) % ordered.length;
    if (e.key === 'ArrowLeft') next = (active - 1 + ordered.length) % ordered.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = ordered.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div className={m.tabs} role="tablist" aria-label="Pillars">
        {ordered.map((p, i) => {
          const selected = i === active;
          return (
            <button
              key={p.pillar}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${baseId}-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${m.tab} ${selected ? m.tabActive : ''}`}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
            >
              <span className={m.tabTop}>
                <span className={styles.chipDot} style={{ background: PILLAR_COLOR[p.pillar] }} aria-hidden="true" />
                <span className={m.tabTitle}>{titles[p.pillar]}</span>
              </span>
              <span className={m.tabMeter} aria-hidden="true">
                <span style={{ width: `${(p.evidence.items / maxItems) * 100}%`, background: PILLAR_COLOR[p.pillar] }} />
              </span>
              <span className={m.tabMeta}>
                {p.evidence.items} items · {p.evidence.sources} sources
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.pillar}
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduce ? 0.1 : 0.25 }}
        >
          <div className={m.panelHead}>
            <div>
              <div className={styles.eyebrow}>{rites[current.pillar] ? `Rite · ${rites[current.pillar]}` : 'Pillar'}</div>
              <h2 className={styles.sectionTitle} style={{ marginTop: '0.3rem' }}>
                {titles[current.pillar]}
              </h2>
            </div>
            <div className={m.evidenceRow}>
              <StatTile label="Evidence items" value={current.evidence.items} />
              <StatTile label="Distinct sources" value={current.evidence.sources} />
              <StatTile label="Quotes" value={current.quotes.length} />
            </div>
          </div>

          <div className={styles.grid3}>
            <VoiceColumn title="Pains" items={current.pains} accent="var(--bronze)" />
            <VoiceColumn title="Desires" items={current.desires} accent="var(--jewel)" />
            <VoiceColumn title="Objections" items={current.objections} accent="var(--ink-3)" />
          </div>

          <div className={styles.section} style={{ marginTop: '2rem' }}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle} style={{ fontSize: '1.35rem' }}>
                Quote wall
              </h3>
              <span className={styles.count}>sorted by likes · likes show attention, not representativeness</span>
            </div>
            <QuoteWall quotes={current.quotes} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function VoiceColumn({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <section className={m.voiceCol} aria-label={title}>
      <h3 className={m.voiceTitle}>
        <span className={m.voiceRule} style={{ background: accent }} aria-hidden="true" />
        {title}
        <span className={styles.count}>{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className={`${styles.small} ${styles.muted}`}>Nothing recorded.</p>
      ) : (
        <ul className={styles.plainList}>
          {items.map((t, i) => (
            <li key={`${i}-${t.slice(0, 16)}`}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
