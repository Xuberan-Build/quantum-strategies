import type { ReactNode } from 'react';
import type { BrainQuote, PillarSlug, Rite } from '@/lib/brain/snapshot';
import { PILLAR_COLOR, RITE_COLOR, RITE_NUMERAL, formatCompact, formatValue, riteTitle, titleFromSlug } from '@/lib/brain/viz';
import styles from './brain.module.css';

/* ---------- Icons ---------- */
export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 11v5m0-8h.01" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.8 5 21 8.3 19.5 11.8 17.5 16.4 12 21 12 21z" />
    </svg>
  );
}

/** Mycelial glyph used for empty states and the hero. Decorative only. */
export function MyceliumGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
      <path d="M36 66V40m0 0c0-8-6-12-12-16m12 16c0-8 6-12 12-16M24 24c-4-3-6-8-6-13m6 13c3-4 3-9 2-13m22 13c4-3 6-8 6-13m-6 13c-3-4-3-9-2-13M36 40c-6 2-12 6-16 12m16-12c6 2 12 6 16 12" />
      <circle cx="18" cy="11" r="2" fill="currentColor" />
      <circle cx="26" cy="11" r="1.5" fill="currentColor" />
      <circle cx="54" cy="11" r="2" fill="currentColor" />
      <circle cx="46" cy="11" r="1.5" fill="currentColor" />
      <circle cx="20" cy="52" r="1.5" fill="currentColor" />
      <circle cx="52" cy="52" r="1.5" fill="currentColor" />
    </svg>
  );
}

/* ---------- Chips ---------- */
export function PillarChip({ pillar, title }: { pillar: PillarSlug; title?: string }) {
  return (
    <span className={styles.chip}>
      <span className={styles.chipDot} style={{ background: PILLAR_COLOR[pillar] }} aria-hidden="true" />
      <span>
        <span className={styles.srOnly}>Pillar: </span>
        {title ?? titleFromSlug(pillar)}
      </span>
    </span>
  );
}

export function RiteChip({ rite }: { rite: Rite }) {
  return (
    <span className={styles.chip}>
      <span className={styles.chipDot} style={{ background: RITE_COLOR[rite] }} aria-hidden="true" />
      <span className={styles.chipNumeral} aria-hidden="true">
        {RITE_NUMERAL[rite]}
      </span>
      <span>
        <span className={styles.srOnly}>Rite: </span>
        {riteTitle(rite)}
      </span>
    </span>
  );
}

export function DomainChip({ label }: { label: string }) {
  return (
    <span className={styles.chip}>
      <span className={styles.srOnly}>Domain: </span>
      {label}
    </span>
  );
}

export function TagChips({
  tags,
  pillarTitle,
}: {
  tags?: { rite?: Rite; pillar?: PillarSlug; domain?: string };
  pillarTitle?: (slug: PillarSlug) => string;
}) {
  if (!tags || (!tags.rite && !tags.pillar && !tags.domain)) return null;
  return (
    <div className={styles.chipRow}>
      {tags.rite && <RiteChip rite={tags.rite} />}
      {tags.pillar && <PillarChip pillar={tags.pillar} title={pillarTitle?.(tags.pillar)} />}
      {tags.domain && <DomainChip label={titleFromSlug(tags.domain)} />}
    </div>
  );
}

/* ---------- Stat tile ---------- */
export interface StatTileProps {
  label: string;
  value: number | string;
  delta?: string;
  note?: string;
}

export function StatTile({ label, value, delta, note }: StatTileProps) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>
        {formatValue(value)}
        {delta && <span className={styles.statDelta}>{delta}</span>}
      </div>
      {note && <div className={styles.statNote}>{note}</div>}
    </div>
  );
}

/* ---------- Banner ---------- */
export function Banner({ label, tone = 'warning', children }: { label: string; tone?: 'warning' | 'info'; children: ReactNode }) {
  return (
    <div className={`${styles.banner} ${tone === 'info' ? styles.bannerInfo : ''}`} role={tone === 'warning' ? 'note' : undefined}>
      {tone === 'warning' ? <WarningIcon className={styles.bannerIcon} /> : <InfoIcon className={styles.bannerIcon} />}
      <div>
        <span className={styles.bannerLabel}>{label}</span>
        {children}
      </div>
    </div>
  );
}

/* ---------- Quotes ---------- */
export function QuoteCard({ quote, maxLikes }: { quote: BrainQuote; maxLikes?: number }) {
  const hasLikes = typeof quote.likes === 'number';
  const pct = hasLikes && maxLikes ? Math.max(2, Math.round(((quote.likes ?? 0) / maxLikes) * 100)) : 0;
  return (
    <figure className={styles.quote}>
      <blockquote className={styles.quoteText}>{quote.text}</blockquote>
      <figcaption className={styles.quoteMeta}>
        <span className={styles.quoteSource}>
          {quote.url ? (
            <a href={quote.url} target="_blank" rel="noreferrer noopener">
              {quote.source}
            </a>
          ) : (
            quote.source
          )}
        </span>
        {hasLikes && (
          <span className={styles.likes} aria-label={`${quote.likes} likes`}>
            {maxLikes ? (
              <span className={styles.likeMeter} aria-hidden="true">
                <span className={styles.likeMeterFill} style={{ width: `${pct}%`, display: 'block' }} />
              </span>
            ) : null}
            <HeartIcon />
            {formatCompact(quote.likes ?? 0)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export function sortByLikes<T extends { likes?: number }>(quotes: readonly T[]): T[] {
  return [...quotes].sort((a, b) => (b.likes ?? -1) - (a.likes ?? -1));
}

export function QuoteWall({ quotes }: { quotes: readonly BrainQuote[] }) {
  const sorted = sortByLikes(quotes);
  const maxLikes = sorted.reduce((m, q) => Math.max(m, q.likes ?? 0), 0);
  if (sorted.length === 0) return <p className={styles.muted}>No quotes captured yet.</p>;
  return (
    <div className={styles.quoteWall}>
      {sorted.map((q, i) => (
        <QuoteCard key={`${i}-${q.text.slice(0, 24)}`} quote={q} maxLikes={maxLikes || undefined} />
      ))}
    </div>
  );
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: ReactNode }) {
  return (
    <header className={styles.pageHead}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.pageTitle}>{title}</h1>
      {lede && <p className={styles.pageLede}>{lede}</p>}
    </header>
  );
}
