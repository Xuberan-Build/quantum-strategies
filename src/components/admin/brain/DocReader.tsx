'use client';

import Link from 'next/link';
import { memo, useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { locateAnchor, type AnchorMatch, type DocBlock } from '@/lib/brain/doc-sections';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import type { DocIndexEntry } from '@/lib/brain/snapshot';
import { formatDate, formatDateTime } from '@/lib/brain/viz';
import { FeedbackComposer, FeedbackThread } from './Feedback';
import base from './brain.module.css';
import styles from './doc.module.css';

interface DocReaderProps {
  entry: DocIndexEntry;
  /** Version being shown. */
  hash: string;
  blocks: DocBlock[];
  feedback: BrainFeedbackRow[];
  feedbackError?: string;
}

interface Selection {
  blockId: string;
  quote?: string;
}

const MAX_QUOTE = 1500;

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ) : (
      <span className={styles.localLink} title={href}>
        {children}
      </span>
    ),
};

const BlockBody = memo(function BlockBody({ block }: { block: DocBlock }) {
  return (
    <div className={`${styles.md} ${block.type === 'tableRow' && !block.firstRow ? styles.rowOnly : ''} ${block.type === 'listItem' ? styles.listItem : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {block.markdown}
      </ReactMarkdown>
    </div>
  );
});

function blockIdFromNode(node: Node | null): string | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return el?.closest<HTMLElement>('[data-block-id]')?.dataset.blockId ?? null;
}

export function DocReader({ entry, hash, blocks, feedback, feedbackError }: DocReaderProps) {
  const [notes, setNotes] = useState<BrainFeedbackRow[]>(feedback);
  const [selected, setSelected] = useState<Selection | null>(null);
  const isCurrent = hash === entry.hash;

  const placements = useMemo(() => {
    const byBlock = new Map<string, BrainFeedbackRow[]>();
    const how = new Map<string, AnchorMatch['how']>();
    const orphaned: BrainFeedbackRow[] = [];
    for (const n of notes) {
      const match = n.anchor ? locateAnchor(blocks, n.anchor, hash) : ({ blockId: null, how: 'orphaned' } as const);
      how.set(n.id, match.how);
      if (match.blockId) byBlock.set(match.blockId, [...(byBlock.get(match.blockId) ?? []), n]);
      else orphaned.push(n);
    }
    return { byBlock, how, orphaned };
  }, [notes, blocks, hash]);

  const openCount = notes.filter((n) => n.status === 'open').length;

  const driftNote = useCallback(
    (row: BrainFeedbackRow) => {
      const how = placements.how.get(row.id);
      if (how === 'heading') return 'The quoted text changed; shown at its section.';
      if (row.anchor?.versionHash && row.anchor.versionHash !== hash) return `Left on version #${row.anchor.versionHash.slice(0, 8)}.`;
      return null;
    },
    [placements, hash],
  );

  const onMouseUp = useCallback(() => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? '';
    if (!sel || text.length < 3) return;
    const blockId = blockIdFromNode(sel.anchorNode) ?? blockIdFromNode(sel.focusNode);
    if (!blockId) return;
    setSelected({ blockId, quote: text.slice(0, MAX_QUOTE) });
  }, []);

  const anchorFor = (block: DocBlock, quote?: string) => ({
    headingPath: block.headingPath,
    quote: quote ?? (block.type === 'heading' ? undefined : block.text.slice(0, 160) || undefined),
    versionHash: hash,
    blockId: block.id,
    docPath: entry.path,
  });

  return (
    <div className={base.content}>
      <header className={styles.head}>
        <Link href="/admin/brain/docs" className={styles.back}>
          ← Docs
        </Link>
        <div className={base.eyebrow}>brain/{entry.path}</div>
        <div className={styles.meta}>
          <span>Updated {formatDate(entry.updatedAt)}</span>
          <span>
            Version #{hash.slice(0, 8)}
            {isCurrent ? ' (current)' : ''}
          </span>
          {entry.brainCommit && <span>@{entry.brainCommit.slice(0, 7)}</span>}
          <span>
            {openCount} open · {notes.length} note{notes.length === 1 ? '' : 's'}
          </span>
        </div>
        {entry.versions.length > 1 && (
          <details className={styles.versions}>
            <summary>{entry.versions.length} versions</summary>
            <ul>
              {entry.versions.map((v, i) => (
                <li key={v.hash}>
                  <Link href={i === 0 ? `/admin/brain/docs/${entry.slug}` : `/admin/brain/docs/${entry.slug}?v=${v.hash}`} aria-current={v.hash === hash ? 'page' : undefined}>
                    #{v.hash.slice(0, 8)}
                  </Link>{' '}
                  <span>{formatDateTime(v.publishedAt)}</span>
                  {i === 0 && <span> · current</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className={styles.howto}>Highlight text, or use the + beside a section, to leave a note.</p>
        {!isCurrent && (
          <p className={styles.oldVersion}>
            You are reading an older version. <Link href={`/admin/brain/docs/${entry.slug}`}>Read the current one</Link>.
          </p>
        )}
        {feedbackError && <p className={styles.oldVersion}>Notes could not be loaded ({feedbackError}).</p>}
      </header>

      {placements.orphaned.length > 0 && (
        <section className={styles.orphans} aria-label="Notes that could not be placed">
          <div className={base.eyebrow}>Notes whose text is no longer in this version</div>
          <FeedbackThread rows={placements.orphaned} driftNote={driftNote} compact />
        </section>
      )}

      <article className={styles.doc} onMouseUp={onMouseUp}>
        {blocks.map((block) => {
          const blockNotes = placements.byBlock.get(block.id) ?? [];
          const isSelected = selected?.blockId === block.id;
          return (
            <div
              key={block.id}
              id={block.id}
              className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${blockNotes.length ? styles.rowHasNotes : ''} ${styles[`row_${block.type}`] ?? ''}`}
            >
              <div className={styles.block} data-block-id={block.id}>
                <BlockBody block={block} />
              </div>
              <aside className={styles.margin} aria-label={`Notes on ${block.text.slice(0, 40) || block.type}`}>
                {!isSelected && block.type !== 'rule' && (
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => setSelected({ blockId: block.id })}
                    aria-label={`Comment on: ${block.text.slice(0, 60)}`}
                    title="Comment on this section"
                  >
                    +
                  </button>
                )}
                {blockNotes.length > 0 && <FeedbackThread rows={blockNotes} driftNote={driftNote} compact />}
                {isSelected && (
                  <FeedbackComposer
                    key={`${block.id}-${selected?.quote ?? ''}`}
                    target={{ target_type: 'doc', target_id: entry.slug, anchor: anchorFor(block, selected?.quote) }}
                    context={selected?.quote ? `“${selected.quote.slice(0, 80)}${selected.quote.length > 80 ? '…' : ''}”` : block.headingPath.join(' › ') || 'Top of doc'}
                    autoFocus
                    onCancel={() => setSelected(null)}
                    onSaved={(row) => {
                      setNotes((prev) => [...prev, row]);
                      setSelected(null);
                      window.getSelection()?.removeAllRanges();
                    }}
                  />
                )}
              </aside>
            </div>
          );
        })}
      </article>
    </div>
  );
}
