'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ReadResult, ResultBlock } from '@/lib/read/types';
import { useReadApi } from './ReadApiContext';
import { RESULT } from './copy';
import styles from './read.module.css';

const ALLOWED = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'br'];

/** Light markdown from the server, limited to text-level elements. */
export function BlockBody({ body }: { body: string }) {
  return (
    <div className={styles.body}>
      <ReactMarkdown
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {/* the server writes one line per sentence group; keep those breaks as paragraphs */}
        {body.replace(/([^\n])\n(?!\n|\s*[-*\d])/g, '$1\n\n')}
      </ReactMarkdown>
    </div>
  );
}

function SourceLine({ source }: { source: NonNullable<ResultBlock['source']> }) {
  return (
    <p className={styles.source}>
      Source:{' '}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {source.label}
        </a>
      ) : (
        source.label
      )}
      {source.tier ? ` · ${source.tier}` : ''}
    </p>
  );
}

export const offerHref = (sessionId: string) => `/read/checkout/?session=${encodeURIComponent(sessionId)}`;

function MoveCommit({ sessionId }: { sessionId: string }) {
  const api = useReadApi();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const commit = async () => {
    setState('busy');
    try {
      await api.feedback({ sessionId, moveCommitted: true });
      setState('done');
    } catch {
      setState('error');
    }
  };
  if (state === 'done') {
    return (
      <p className={styles.thanks} role="status">
        {RESULT.moveCommitted}
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        className={styles.primaryButton}
        style={{ marginTop: 16 }}
        onClick={() => void commit()}
        disabled={state === 'busy'}
      >
        {RESULT.moveCommit}
      </button>
      <p className={styles.error} role="alert">
        {state === 'error' ? RESULT.feedbackError : ''}
      </p>
    </>
  );
}

function OfferCta({ result }: { result: ReadResult }) {
  const api = useReadApi();
  const offer = result.offer!;
  return (
    <>
      <span className={styles.price}>{RESULT.offerPrice}</span>
      <a
        className={`${styles.primaryButton} ${styles.fullWidth}`}
        href={offerHref(result.sessionId)}
        onClick={() => {
          void api.event({
            sessionId: result.sessionId,
            event: 'read_offer_click',
            props: { pattern: result.pattern, scanSlug: offer.scanSlug, priceUsd: offer.priceUsd },
          });
        }}
      >
        {RESULT.offerButton(offer.scanName)}
      </a>
      <p className={styles.source}>{RESULT.offerNote}</p>
    </>
  );
}

function AccuracyForm({ sessionId }: { sessionId: string }) {
  const api = useReadApi();
  const [rating, setRating] = useState<number | null>(null);
  const [hardest, setHardest] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setError(RESULT.feedbackNeedsRating);
      return;
    }
    setState('busy');
    setError(null);
    try {
      await api.feedback({ sessionId, accuracy: rating, hardestPart: hardest ?? undefined });
      setState('done');
    } catch {
      setState('idle');
      setError(RESULT.feedbackError);
    }
  };

  if (state === 'done') {
    return (
      <p className={styles.thanks} role="status">
        {RESULT.feedbackThanks}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={submit}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{RESULT.accuracyQuestion}</legend>
        <div className={styles.scaleGrid}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={styles.option} data-selected={rating === n}>
              <input
                className={styles.optionInput}
                type="radio"
                name="read-accuracy"
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  setError(null);
                }}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <p className={styles.scaleLabels}>
          <span>1 = {RESULT.accuracyLow}</span>
          <span>5 = {RESULT.accuracyHigh}</span>
        </p>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{RESULT.hardestQuestion}</legend>
        <div className={styles.options}>
          {RESULT.hardestOptions.map((o) => (
            <label key={o.value} className={styles.option} data-selected={hardest === o.value}>
              <input
                className={styles.optionInput}
                type="radio"
                name="read-hardest"
                value={o.value}
                checked={hardest === o.value}
                onChange={() => setHardest(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.error} role="alert" aria-live="assertive">
        {error ?? ''}
      </p>
      <button type="submit" className={styles.secondaryButton} style={{ marginTop: 16 }} disabled={state === 'busy'}>
        {RESULT.feedbackSubmit}
      </button>
    </form>
  );
}

const BLOCK_CLASS: Partial<Record<ResultBlock['id'], string>> = {
  their_words: styles.theirWords,
  not_alone: styles.card,
  permission: styles.permission,
  move: styles.highlight,
  offer: styles.highlight,
  scope: styles.quiet,
  support: styles.highlight,
};

export function ResultBlockView({ block, result }: { block: ResultBlock; result: ReadResult }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isPattern = block.id === 'pattern';

  useEffect(() => {
    if (isPattern) headingRef.current?.focus();
  }, [isPattern]);

  if (block.id === 'offer' && !result.offer) return null;

  const headingId = `read-block-${block.id}`;
  const classes = [styles.block, BLOCK_CLASS[block.id]].filter(Boolean).join(' ');

  if (block.id === 'mirror') {
    return (
      <section className={styles.block} aria-labelledby={headingId} data-block="mirror">
        <h2 id={headingId} className={styles.blockTitle}>
          {block.title ?? 'Your week'}
        </h2>
        <div className={styles.mirror}>
          <BlockBody body={block.body} />
        </div>
      </section>
    );
  }

  if (isPattern) {
    return (
      <section className={styles.block} aria-labelledby={headingId} data-block="pattern">
        <span className={styles.patternLabel}>Your pattern</span>
        <h1 id={headingId} className={styles.patternName} ref={headingRef} tabIndex={-1}>
          {block.title ?? result.patternName}
        </h1>
        <BlockBody body={block.body} />
        {block.source && <SourceLine source={block.source} />}
      </section>
    );
  }

  return (
    <section className={classes} aria-labelledby={block.title ? headingId : undefined} data-block={block.id}>
      {block.title && (
        <h2 id={headingId} className={styles.blockHeading}>
          {block.title}
        </h2>
      )}
      {block.body && <BlockBody body={block.body} />}
      {block.source && <SourceLine source={block.source} />}
      {block.id === 'move' && <MoveCommit sessionId={result.sessionId} />}
      {block.id === 'offer' && <OfferCta result={result} />}
      {block.id === 'accuracy' && <AccuracyForm sessionId={result.sessionId} />}
    </section>
  );
}

/** If the server sent an offer but no offer block, put the CTA before the accuracy block. */
function withOffer(result: ReadResult): ResultBlock[] {
  const blocks = result.blocks;
  if (!result.offer || blocks.some((b) => b.id === 'offer')) return blocks;
  const offerBlock: ResultBlock = { id: 'offer', title: 'Rite I: Perception', body: '' };
  const at = blocks.findIndex((b) => b.id === 'accuracy');
  return at === -1 ? [...blocks, offerBlock] : [...blocks.slice(0, at), offerBlock, ...blocks.slice(at)];
}

export function ResultBlocks({ result }: { result: ReadResult }) {
  return (
    <div data-testid="read-result">
      {withOffer(result).map((block, i) => (
        <ResultBlockView key={`${block.id}-${i}`} block={block} result={result} />
      ))}
    </div>
  );
}
