'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import type { BrainSnapshot, PillarSlug, Rite } from '@/lib/brain/snapshot';
import { HEAT_RAMP, PILLAR_COLOR, PILLAR_ORDER, RITE_COLOR, RITE_NUMERAL, RITE_ORDER, heatColor, inkOn, titleFromSlug } from '@/lib/brain/viz';
import { ChartFrame } from './ChartFrame';
import styles from './brain.module.css';
import t from './taxonomy.module.css';

type Taxonomy = BrainSnapshot['taxonomy'];
type Topic = Taxonomy['topics'][number];

export function TaxonomyExplorer({ taxonomy, titles }: { taxonomy: Taxonomy; titles: Record<PillarSlug, string> }) {
  const [domain, setDomain] = useState<string | null>(null);
  const [includeProposed, setIncludeProposed] = useState(true);

  const domainTitle = useMemo(() => {
    const map = new Map(taxonomy.domains.map((d) => [d.slug, d.title]));
    return (slug: string) => map.get(slug) ?? titleFromSlug(slug);
  }, [taxonomy.domains]);

  // Domains in the snapshot, plus any slug used by a topic but missing from the list.
  const domains = useMemo(() => {
    const listed = taxonomy.domains.map((d) => d.slug);
    const extra = [...new Set(taxonomy.topics.map((tp) => tp.domain))].filter((s) => !listed.includes(s));
    return [...listed, ...extra];
  }, [taxonomy]);

  const pool = includeProposed ? taxonomy.topics : taxonomy.topics.filter((tp) => !tp.proposed);
  const filtered = domain ? pool.filter((tp) => tp.domain === domain) : pool;

  const pillarsByRite = useMemo(() => {
    const out = new Map<Rite, Taxonomy['pillars']>();
    for (const r of RITE_ORDER) out.set(r, []);
    const sorted = [...taxonomy.pillars].sort((a, b) => PILLAR_ORDER.indexOf(a.slug) - PILLAR_ORDER.indexOf(b.slug));
    for (const p of sorted) out.get(p.rite)?.push(p);
    return out;
  }, [taxonomy.pillars]);

  const riteOf = (pillar: PillarSlug): Rite | undefined => taxonomy.pillars.find((p) => p.slug === pillar)?.rite;
  const riteCounts = RITE_ORDER.map((r) => ({ rite: r, count: filtered.filter((tp) => riteOf(tp.pillar) === r).length }));
  const total = riteCounts.reduce((n, r) => n + r.count, 0);
  const proposedCount = taxonomy.topics.filter((tp) => tp.proposed).length;

  return (
    <div>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Domain</span>
        <div className={styles.segmented} role="group" aria-label="Filter by domain">
          <button type="button" className={`${styles.segment} ${domain === null ? styles.segmentActive : ''}`} aria-pressed={domain === null} onClick={() => setDomain(null)}>
            All <span className={styles.count}>{pool.length}</span>
          </button>
          {domains.map((d) => {
            const n = pool.filter((tp) => tp.domain === d).length;
            return (
              <button
                key={d}
                type="button"
                className={`${styles.segment} ${domain === d ? styles.segmentActive : ''}`}
                aria-pressed={domain === d}
                onClick={() => setDomain(domain === d ? null : d)}
              >
                {domainTitle(d)} <span className={styles.count}>{n}</span>
              </button>
            );
          })}
        </div>
        {proposedCount > 0 && (
          <label className={t.toggle}>
            <input type="checkbox" checked={includeProposed} onChange={(e) => setIncludeProposed(e.target.checked)} />
            Include {proposedCount} proposed
          </label>
        )}
      </div>

      <RiteBar counts={riteCounts} total={total} />

      <div className={t.tree} aria-label="Content tree: Rite, Pillar, Topic">
        {RITE_ORDER.map((rite) => {
          const meta = taxonomy.rites.find((r) => r.slug === rite);
          const pillars = pillarsByRite.get(rite) ?? [];
          const count = riteCounts.find((r) => r.rite === rite)?.count ?? 0;
          return (
            <section key={rite} className={t.riteCol} aria-labelledby={`rite-${rite}`}>
              <header className={t.riteHead}>
                <span className={t.riteNumeral} style={{ color: RITE_COLOR[rite] }} aria-hidden="true">
                  {RITE_NUMERAL[rite]}
                </span>
                <div>
                  <h2 id={`rite-${rite}`} className={t.riteTitle}>
                    {meta?.title ?? titleFromSlug(rite)}
                  </h2>
                  {meta?.move && <p className={t.riteMove}>{meta.move}</p>}
                </div>
                <span className={t.riteCount}>{count}</span>
              </header>
              {pillars.length === 0 && <p className={`${styles.small} ${styles.muted}`}>No pillars lead here.</p>}
              {pillars.map((p) => (
                <PillarNode
                  key={p.slug}
                  pillar={p}
                  title={titles[p.slug]}
                  topics={filtered.filter((tp) => tp.pillar === p.slug)}
                  domainTitle={domainTitle}
                  domainFilter={domain ? domainTitle(domain) : null}
                />
              ))}
            </section>
          );
        })}
      </div>

      <GapGrid
        taxonomy={taxonomy}
        topics={pool}
        domains={domains}
        titles={titles}
        domainTitle={domainTitle}
        selected={domain}
        onSelect={(d) => setDomain(domain === d ? null : d)}
      />
    </div>
  );
}

function RiteBar({ counts, total }: { counts: { rite: Rite; count: number }[]; total: number }) {
  const reduce = useReducedMotion();
  if (total === 0) return <p className={`${styles.small} ${styles.muted}`}>No topics match this filter.</p>;
  return (
    <figure className={t.riteBar} aria-label={`Topics per Rite: ${counts.map((c) => `${titleFromSlug(c.rite)} ${c.count}`).join(', ')}`}>
      <div className={t.riteBarTrack} aria-hidden="true">
        {counts
          .filter((c) => c.count > 0)
          .map((c) => {
            const pct = (c.count / total) * 100;
            return (
              <motion.div
                key={c.rite}
                className={t.riteSeg}
                style={{ background: RITE_COLOR[c.rite], color: inkOn(RITE_COLOR[c.rite]) }}
                initial={reduce ? false : { flexGrow: 0 }}
                animate={{ flexGrow: c.count }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {pct >= 9 && (
                  <span>
                    {RITE_NUMERAL[c.rite]} · {c.count}
                  </span>
                )}
              </motion.div>
            );
          })}
      </div>
      <figcaption className={t.riteLegend}>
        {counts.map((c) => (
          <span key={c.rite} className={t.legendItem}>
            <span className={t.legendSwatch} style={{ background: RITE_COLOR[c.rite] }} aria-hidden="true" />
            {titleFromSlug(c.rite)} <b>{c.count}</b>
            <span className={styles.count}>{Math.round((c.count / total) * 100)}%</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function PillarNode({
  pillar,
  title,
  topics,
  domainTitle,
  domainFilter,
}: {
  pillar: Taxonomy['pillars'][number];
  title: string;
  topics: Topic[];
  domainTitle: (slug: string) => string;
  domainFilter: string | null;
}) {
  const [open, setOpen] = useState(false);
  const listId = `topics-${pillar.slug}`;
  const shown = open || domainFilter ? topics : topics.slice(0, 4);
  return (
    <article className={t.pillar} style={{ borderLeftColor: PILLAR_COLOR[pillar.slug] }}>
      <div className={t.pillarHead}>
        <h3 className={t.pillarTitle}>{title}</h3>
        <span className={t.pillarCount}>{topics.length}</span>
      </div>
      <p className={t.belief}>{pillar.belief}</p>
      <p className={t.lazy}>
        <span className={styles.filterLabel}>Attacks</span> &ldquo;{pillar.lazyVersion}&rdquo;
      </p>
      {topics.length === 0 ? (
        <p className={t.gap}>
          <span aria-hidden="true">+</span> No {domainFilter ?? ''} topics yet: an opening.
        </p>
      ) : (
        <ul id={listId} className={t.topicList}>
          {shown.map((tp) => (
            <li key={tp.title} className={t.topic}>
              <span className={t.topicTitle}>{tp.title}</span>
              <span className={t.topicMeta}>
                {domainTitle(tp.domain)}
                {tp.angles > 0 ? ` · ${tp.angles} angles` : ''}
                {tp.proposed && <span className={t.proposed}>proposed</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!domainFilter && topics.length > 4 && (
        <button type="button" className={t.more} aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `Show all ${topics.length}`}
        </button>
      )}
    </article>
  );
}

function GapGrid({
  taxonomy,
  topics,
  domains,
  titles,
  domainTitle,
  selected,
  onSelect,
}: {
  taxonomy: Taxonomy;
  topics: Topic[];
  domains: string[];
  titles: Record<PillarSlug, string>;
  domainTitle: (slug: string) => string;
  selected: string | null;
  onSelect: (domain: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; pillar: PillarSlug; domain: string } | null>(null);
  const rows = [...taxonomy.pillars].sort((a, b) => RITE_ORDER.indexOf(a.rite) - RITE_ORDER.indexOf(b.rite) || PILLAR_ORDER.indexOf(a.slug) - PILLAR_ORDER.indexOf(b.slug));
  const cell = (p: PillarSlug, d: string) => topics.filter((tp) => tp.pillar === p && tp.domain === d);
  const max = Math.max(0, ...rows.flatMap((r) => domains.map((d) => cell(r.slug, d).length)));
  const empties = rows.reduce((n, r) => n + domains.filter((d) => cell(r.slug, d).length === 0).length, 0);

  const showTip = (el: HTMLElement, pillar: PillarSlug, domain: string) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (wrap) setTip({ x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top, pillar, domain });
  };

  const tipTopics = tip ? cell(tip.pillar, tip.domain) : [];

  return (
    <ChartFrame
      className={t.gapFrame}
      title="Pillar × domain gap grid"
      caption={`Topic counts per pillar and evidence domain. ${empties} empty cells are openings. Click a column's cell to filter the tree by that domain.`}
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Pillar</th>
              {domains.map((d) => (
                <th key={d} scope="col" className={styles.num}>
                  {domainTitle(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <th scope="row" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: '0.82rem', color: 'var(--ink)' }}>
                  {titles[r.slug]}
                </th>
                {domains.map((d) => (
                  <td key={d} className={styles.num}>
                    {cell(r.slug, d).length || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div ref={wrapRef} className={t.gridWrap}>
        <div className={t.grid} role="table" aria-label="Topic counts by pillar and domain" style={{ gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${domains.length}, minmax(64px, 1fr))` }}>
          <div role="row" style={{ display: 'contents' }}>
            <div role="columnheader" className={t.corner} />
            {domains.map((d) => (
              <div key={d} role="columnheader" className={`${t.colHead} ${selected === d ? t.colHeadActive : ''}`}>
                {domainTitle(d)}
              </div>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.slug} role="row" style={{ display: 'contents' }}>
              <div role="rowheader" className={t.rowHead}>
                <span className={styles.chipDot} style={{ background: PILLAR_COLOR[r.slug] }} aria-hidden="true" />
                <span>{titles[r.slug]}</span>
                <span className={t.rowRite} style={{ color: RITE_COLOR[r.rite] }}>
                  {RITE_NUMERAL[r.rite]}
                </span>
              </div>
              {domains.map((d) => {
                const items = cell(r.slug, d);
                const n = items.length;
                const fill = heatColor(n, max);
                const proposed = items.filter((tp) => tp.proposed).length;
                const dim = selected !== null && selected !== d;
                return (
                  <div key={d} role="cell" className={t.cellWrap}>
                    <button
                      type="button"
                      className={`${t.cell} ${n === 0 ? t.cellEmpty : ''}`}
                      style={{ background: fill ?? undefined, color: fill ? inkOn(fill) : undefined, opacity: dim ? 0.35 : 1 }}
                      aria-label={`${titles[r.slug]} × ${domainTitle(d)}: ${n === 0 ? 'no topics, an opening' : `${n} topic${n === 1 ? '' : 's'}${proposed ? `, ${proposed} proposed` : ''}`}`}
                      onPointerEnter={(e) => showTip(e.currentTarget, r.slug, d)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={(e) => showTip(e.currentTarget, r.slug, d)}
                      onBlur={() => setTip(null)}
                      onClick={() => onSelect(d)}
                    >
                      {n === 0 ? <span aria-hidden="true">+</span> : n}
                      {proposed > 0 && <span className={t.cellProposed} aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {tip && (
          <div className={styles.tooltip} style={{ left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)' }} aria-hidden="true">
            <span className={styles.tooltipValue}>
              {tipTopics.length === 0 ? 'Opening' : `${tipTopics.length} topic${tipTopics.length === 1 ? '' : 's'}`}
            </span>
            {titles[tip.pillar]} × {domainTitle(tip.domain)}
            {tipTopics.length > 0 && (
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1rem', color: 'var(--ink-3)' }}>
                {tipTopics.slice(0, 6).map((tp) => (
                  <li key={tp.title}>
                    {tp.title}
                    {tp.proposed ? ' (proposed)' : ''}
                  </li>
                ))}
                {tipTopics.length > 6 && <li>+{tipTopics.length - 6} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className={t.scale} aria-hidden="true">
        <span className={t.scaleEmpty}>+</span>
        <span>opening</span>
        <span style={{ marginLeft: '1rem' }}>fewer</span>
        {HEAT_RAMP.map((h) => (
          <span key={h} className={t.scaleStep} style={{ background: h }} />
        ))}
        <span>more topics</span>
        <span className={t.scaleProposed} />
        <span>includes proposed</span>
      </div>
    </ChartFrame>
  );
}
