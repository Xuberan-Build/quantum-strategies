'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BANNER_DISMISS_KEY,
  BANNER_DISMISS_MS,
  BANNER_HIDDEN_ATTR,
  buildReadHref,
  shouldShowBanner,
  slugForPath,
} from '@/lib/read/cta';
import { READ_CTA_COPY } from '@/lib/read/cta-copy';
import styles from './cta.module.css';

/**
 * The slim site strip. Server-rendered in flow (so it never shifts the page in), hidden
 * before paint for 14 days after a dismissal by the <head> script in the root layout.
 * The only client JS is the route check and the dismiss button.
 */
export function ReadBannerClient() {
  const pathname = usePathname();
  if (!shouldShowBanner(pathname)) return null;

  const copy = READ_CTA_COPY.banner;
  const href = buildReadHref({ medium: 'banner', content: slugForPath(pathname) });

  const dismiss = () => {
    document.documentElement.setAttribute(BANNER_HIDDEN_ATTR, 'off');
    try {
      window.localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now() + BANNER_DISMISS_MS));
    } catch {
      // Storage blocked (private mode, settings). It stays hidden for this page view.
    }
  };

  return (
    <aside className={styles.banner} aria-label={READ_CTA_COPY.name}>
      <div className={styles.bannerInner}>
        <p className={styles.bannerLine}>{copy.line}</p>
        <Link href={href} className={styles.bannerButton} prefetch={false}>
          {copy.button}
        </Link>
        <button type="button" className={styles.bannerClose} onClick={dismiss} aria-label={copy.dismissLabel}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
