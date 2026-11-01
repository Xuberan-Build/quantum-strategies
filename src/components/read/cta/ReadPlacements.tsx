/**
 * The Perception Read placements on the public site. Server components: plain links,
 * no client JS (the banner's dismiss button is the one exception, in ReadBannerClient).
 *
 * The one CTA after each article is ArticleCta (src/components/content), not a block here.
 *
 * Every placement checks the launch gate (isReadLive) itself, so none of them can show
 * before launch. The gate is cached, so several placements on one page cost one lookup.
 * Copy: src/lib/read/cta-copy.ts.
 */
import Link from 'next/link';
import { buildReadHref } from '@/lib/read/cta';
import { READ_CTA_COPY } from '@/lib/read/cta-copy';
import { isReadLive } from '@/lib/read/live';
import { ReadBannerClient } from './ReadBannerClient';
import styles from './cta.module.css';

/** Site strip under the navbar. Route rules live in shouldShowBanner. */
export async function ReadBanner() {
  if (!(await isReadLive())) return null;
  return <ReadBannerClient />;
}

interface ArticleCtaProps {
  /** Article slug (utm_content). */
  slug: string;
  /** Pillar and topic tags (utm_term). */
  tags?: readonly (string | null | undefined)[];
}

/**
 * Article card. `variant="sidebar"` is the sticky desktop card (hidden under 1100px);
 * `variant="inline"` is the same card dropped into the body on smaller screens.
 * Both report utm_medium=sidebar, so the card is one placement in the numbers.
 */
export async function ReadSidebarCard({ slug, tags, variant }: ArticleCtaProps & { variant: 'sidebar' | 'inline' }) {
  if (!(await isReadLive())) return null;
  const copy = READ_CTA_COPY.sidebar;
  const href = buildReadHref({ medium: 'sidebar', content: slug, terms: tags });
  return (
    <aside
      className={variant === 'sidebar' ? styles.sideCard : `${styles.sideCard} ${styles.sideCardInline}`}
      aria-label={READ_CTA_COPY.name}
    >
      <p className={styles.kicker}>{copy.kicker}</p>
      <p className={styles.cardTitle}>{copy.title}</p>
      <p className={styles.cardLine}>{copy.line}</p>
      <Link href={href} className={styles.cardButton} prefetch={false}>
        {copy.button}
      </Link>
      <p className={styles.cardNote}>{copy.note}</p>
    </aside>
  );
}

/** Secondary line in the homepage hero, under the existing buttons. */
export async function ReadHomeCta() {
  if (!(await isReadLive())) return null;
  const copy = READ_CTA_COPY.home;
  return (
    <p className={styles.home}>
      <Link href={buildReadHref({ medium: 'home', content: 'home' })} className={styles.homeLink} prefetch={false}>
        {copy.label}
        <span aria-hidden="true"> →</span>
      </Link>
      <span className={styles.homeLine}>{copy.line}</span>
    </p>
  );
}

/** Footer list item. Pass the list's own link class so it matches its neighbours. */
export async function ReadFooterLink({ className }: { className?: string }) {
  if (!(await isReadLive())) return null;
  return (
    <li>
      <Link href={buildReadHref({ medium: 'footer', content: 'footer' })} className={className} prefetch={false}>
        {READ_CTA_COPY.footerLink}
      </Link>
    </li>
  );
}
