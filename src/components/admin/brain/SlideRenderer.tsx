import type { BrainSlide, PillarSlug } from '@/lib/brain/snapshot';
import { formatCompact, formatValue, titleFromSlug } from '@/lib/brain/viz';
import { BarChart } from './BarChart';
import { HeartIcon, MyceliumGlyph, TagChips, sortByLikes } from './primitives';
import styles from './deck.module.css';

export const SLIDE_KIND_LABEL: Record<BrainSlide['kind'], string> = {
  headline: 'Headline',
  stats: 'Figures',
  quotes: 'In their words',
  bars: 'Chart',
  list: 'Moves',
  comparison: 'Contrast',
};

interface SlideRendererProps {
  slide: BrainSlide;
  index: number;
  total: number;
  pillarTitle?: (slug: PillarSlug) => string;
  /** Animate chart marks on entry. */
  animate?: boolean;
}

/** Renders one slide of any kind. Pure: no state, safe to use in tests and thumbnails. */
export function SlideRenderer({ slide, index, total, pillarTitle, animate = true }: SlideRendererProps) {
  const isHeadline = slide.kind === 'headline';
  return (
    <article
      className={`${styles.slide} ${isHeadline ? styles.headline : ''}`}
      data-kind={slide.kind}
      aria-roledescription="slide"
      aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
    >
      <MyceliumGlyph className={styles.slideOrnament} />
      <div className={styles.slideTop}>
        <div className={styles.slideEyebrow}>
          <b>{String(index + 1).padStart(2, '0')}</b> / {String(total).padStart(2, '0')} · {SLIDE_KIND_LABEL[slide.kind]}
        </div>
        <TagChips tags={slide.tags} pillarTitle={pillarTitle} />
      </div>

      <header>
        <h2 className={styles.slideTitle}>{slide.title}</h2>
        {slide.subtitle && <p className={styles.slideSubtitle}>{slide.subtitle}</p>}
      </header>

      <div className={styles.slideBody}>
        <SlideContent slide={slide} animate={animate} />
      </div>

      {!isHeadline && slide.body && <p className={styles.takeaway}>{slide.body}</p>}
    </article>
  );
}

function SlideContent({ slide, animate }: { slide: BrainSlide; animate: boolean }) {
  switch (slide.kind) {
    case 'headline':
      return slide.body ? <p className={styles.headlineBody}>{slide.body}</p> : null;

    case 'stats':
      if (!slide.stats?.length) return <EmptyKind kind="figures" />;
      return (
        <div className={styles.statRow}>
          {slide.stats.map((s, i) => (
            <div key={`${s.label}-${i}`} className={styles.slideStat}>
              <div className={styles.slideStatValue}>
                {formatValue(s.value)}
                {s.delta && <span className={styles.slideStatDelta}>{s.delta}</span>}
              </div>
              <div className={styles.slideStatLabel}>{s.label}</div>
              {s.note && <div className={styles.slideStatNote}>{s.note}</div>}
            </div>
          ))}
        </div>
      );

    case 'quotes': {
      const quotes = sortByLikes(slide.quotes ?? []);
      if (quotes.length === 0) return <EmptyKind kind="quotes" />;
      const [featured, ...rest] = quotes;
      const maxLikes = Math.max(0, ...quotes.map((q) => q.likes ?? 0));
      return (
        <div className={styles.quoteGrid} style={rest.length === 0 ? { gridTemplateColumns: '1fr' } : undefined}>
          <figure className={styles.featured}>
            <blockquote className={styles.featuredText}>{featured.text}</blockquote>
            <QuoteFoot source={featured.source} url={featured.url} likes={featured.likes} maxLikes={maxLikes} />
          </figure>
          {rest.length > 0 && (
            <div className={styles.quoteStack}>
              {rest.slice(0, 5).map((q, i) => (
                <figure key={`${i}-${q.text.slice(0, 20)}`} className={styles.miniQuote}>
                  <blockquote className={styles.miniQuoteText}>{q.text}</blockquote>
                  <QuoteFoot source={q.source} url={q.url} likes={q.likes} maxLikes={maxLikes} />
                </figure>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'bars':
      if (!slide.bars?.length) return <EmptyKind kind="bars" />;
      return (
        <div className={styles.slideBars}>
          <BarChart data={slide.bars} ariaLabel={slide.title} size="lg" animate={animate} />
        </div>
      );

    case 'list':
      if (!slide.bullets?.length) return <EmptyKind kind="items" />;
      return (
        <ol className={`${styles.slideList} ${slide.bullets.length > 6 ? styles.listDense : ''}`}>
          {slide.bullets.map((b, i) => (
            <li key={`${i}-${b.slice(0, 16)}`}>{b}</li>
          ))}
        </ol>
      );

    case 'comparison': {
      const c = slide.comparison;
      if (!c) return <EmptyKind kind="comparison" />;
      return (
        <div className={styles.comparison}>
          <section className={styles.side} aria-label={c.left.heading}>
            <h3>{c.left.heading}</h3>
            <ul>
              {c.left.points.map((p, i) => (
                <li key={`l-${i}`}>{p}</li>
              ))}
            </ul>
          </section>
          <span className={styles.versus} aria-hidden="true">
            vs.
          </span>
          <section className={`${styles.side} ${styles.sideRight}`} aria-label={c.right.heading}>
            <h3>{c.right.heading}</h3>
            <ul>
              {c.right.points.map((p, i) => (
                <li key={`r-${i}`}>{p}</li>
              ))}
            </ul>
          </section>
        </div>
      );
    }

    default: {
      const exhaustive: never = slide.kind;
      return <EmptyKind kind={titleFromSlug(String(exhaustive))} />;
    }
  }
}

function QuoteFoot({ source, url, likes, maxLikes }: { source: string; url?: string; likes?: number; maxLikes: number }) {
  const pct = typeof likes === 'number' && maxLikes > 0 ? Math.max(3, (likes / maxLikes) * 100) : 0;
  return (
    <figcaption className={styles.quoteFoot}>
      {typeof likes === 'number' && (
        <span className={styles.likeBadge} aria-label={`${likes} likes`}>
          <HeartIcon />
          {formatCompact(likes)}
          <span className={styles.likeTrack} aria-hidden="true">
            <span className={styles.likeTrackFill} style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}
      <span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer noopener">
            {source}
          </a>
        ) : (
          source
        )}
      </span>
    </figcaption>
  );
}

function EmptyKind({ kind }: { kind: string }) {
  return <p className={styles.slideSubtitle}>This slide has no {kind} in the snapshot.</p>;
}
