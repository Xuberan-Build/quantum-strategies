import { Cormorant_Garamond, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrainSubNav } from '@/components/admin/brain/BrainSubNav';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';
import { relativeAge } from '@/lib/brain/viz';

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-brain-serif',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-brain-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Brain - Quantum Strategies Admin',
};

export default async function BrainLayout({ children }: { children: ReactNode }) {
  const { snapshot, source } = await getBrainSnapshot();
  const age = snapshot ? relativeAge(snapshot.generatedAt) : null;

  return (
    <div className={`${styles.root} ${serif.variable} ${mono.variable}`}>
      <header className={styles.shellHeader}>
        <Link href="/admin/brain" className={styles.wordmark}>
          <span className={styles.wordmarkTitle}>The Brain</span>
          <span className={styles.eyebrow}>Insight decks</span>
        </Link>
        <BrainSubNav />
        {snapshot && age && (
          <span className={styles.freshnessCompact} title={snapshot.generatedAt}>
            {source === 'local' ? 'local · ' : ''}
            ticked {age.label}
            {snapshot.brainCommit ? ` · @${snapshot.brainCommit.slice(0, 7)}` : ''}
          </span>
        )}
      </header>
      {children}
    </div>
  );
}
