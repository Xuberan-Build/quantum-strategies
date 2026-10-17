'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './brain.module.css';

export const BRAIN_SECTIONS = [
  { href: '/admin/brain', label: 'Overview', exact: true },
  { href: '/admin/brain/decks', label: 'Decks' },
  { href: '/admin/brain/docs', label: 'Docs' },
  { href: '/admin/brain/graph', label: 'Graph' },
  { href: '/admin/brain/market', label: 'Market voice' },
  { href: '/admin/brain/creators', label: 'Creators' },
  { href: '/admin/brain/taxonomy', label: 'Taxonomy' },
  { href: '/admin/brain/customers', label: 'Customers' },
  { href: '/admin/brain/hooks', label: 'Hooks' },
  { href: '/admin/brain/journey', label: 'Journey' },
] as const;

export function BrainSubNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav className={styles.subnav} aria-label="Brain sections">
      {BRAIN_SECTIONS.map((s) => {
        const active = 'exact' in s && s.exact ? pathname === s.href : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`${styles.subnavLink} ${active ? styles.subnavLinkActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
