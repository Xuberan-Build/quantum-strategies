'use client';

import { useState } from 'react';
import { FEEDBACK_SYNC_COMMAND } from '@/lib/brain/deck-reads';
import styles from './review.module.css';

/**
 * How notes get into the brain. The brain is a local git repo, so the website never writes
 * to it: the brain tick (after every Claude Code session, and Sundays 21:00) runs
 * pull-feedback.ts, which appends notes to brain/feedback/inbox/ and marks them synced; the
 * same tick's feedback stage then folds them into feedback/log.md.
 */
export function SyncHint({ waiting, compact }: { waiting?: number; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(FEEDBACK_SYNC_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable: the command is visible to select */
    }
  }

  return (
    <div className={`${styles.syncHint} ${compact ? styles.syncHintCompact : ''}`} role="note" aria-label="Sync notes to the brain">
      <div className={styles.syncHintHead}>
        {waiting ? (
          <>
            <strong>
              {waiting} note{waiting === 1 ? '' : 's'}
            </strong>{' '}
            waiting for sync
          </>
        ) : (
          'Sync to the brain'
        )}
      </div>
      <p className={styles.syncHintText}>
        Notes reach <code>brain/feedback/</code> on the next brain tick (after each Claude Code session, and Sundays 21:00). To pull them now,
        run this on the studio Mac from the app repo:
      </p>
      <div className={styles.syncCommand}>
        <code>{FEEDBACK_SYNC_COMMAND}</code>
        <button type="button" className={styles.copyButton} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
