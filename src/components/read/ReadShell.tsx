import type { ReactNode } from 'react';
import styles from './read.module.css';

/** Page frame for every /read screen: calm background, one readable column. */
export function ReadShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.container}>{children}</div>
    </div>
  );
}
