'use client';

import { useEffect, useState } from 'react';
import admin from '@/app/admin/admin-layout.module.css';
import s from './insights.module.css';
import { extractFromArticle, listPublishedArticles, saveInsightsBulk, type ArticleOption, type InsightCandidate } from './api';

type Row = InsightCandidate & { keep: boolean };

/** Pick a published article, let Claude lift candidate lines, review and save the kept ones. */
export default function ExtractFromArticle({ onSaved, onClose }: { onSaved: (count: number) => void; onClose: () => void }) {
  const [articles, setArticles] = useState<ArticleOption[] | null>(null);
  const [postId, setPostId] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<'extract' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublishedArticles().then(setArticles).catch((e) => setError(e.message));
  }, []);

  async function extract() {
    if (!postId) return;
    setBusy('extract');
    setError(null);
    setRows(null);
    try {
      const { candidates } = await extractFromArticle(postId);
      setRows(candidates.map((c) => ({ ...c, keep: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!rows) return;
    const kept = rows.filter((r) => r.keep && r.line.trim());
    if (!kept.length) return setError('Tick at least one line to save');
    setBusy('save');
    setError(null);
    try {
      const saved = await saveInsightsBulk(postId, kept.map((r) => ({
        line: r.line.trim(),
        source_kind: 'article',
        source_ref: r.source_ref?.trim() || null,
        claim: r.claim?.trim() || null,
      })));
      onSaved(saved.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev && prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const keptCount = rows?.filter((r) => r.keep).length ?? 0;

  return (
    <div className={s.panel}>
      <h2 className={s.panelTitle}>Extract from article</h2>
      <div className={s.toolbar}>
        <select className={s.select} value={postId} onChange={(e) => { setPostId(e.target.value); setRows(null); }} aria-label="Published article" style={{ flex: '1 1 18rem', minWidth: 0 }}>
          <option value="">{articles ? 'Pick a published article' : 'Loading articles…'}</option>
          {articles?.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <button type="button" className={`${admin.btn} ${admin.btnPrimary} ${admin.btnSmall}`} onClick={extract} disabled={!postId || busy !== null}>
          {busy === 'extract' ? 'Reading the article…' : rows ? 'Extract again' : 'Extract lines'}
        </button>
        <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={onClose}>Close</button>
      </div>
      <p className={s.muted}>Claude lifts 5 to 12 lines from the article in Austin&apos;s words. Lines that aren&apos;t in the article are dropped. Nothing saves until you press save.</p>
      {error && <p className={s.error} role="alert">{error}</p>}
      {rows && rows.length === 0 && <p className={s.muted}>No lines came back that match the article text. Try again or add insights by hand.</p>}
      {rows && rows.length > 0 && (
        <>
          <div className={s.list} style={{ marginTop: '0.75rem' }}>
            {rows.map((r, i) => (
              <div key={i} className={`${s.candidate} ${r.keep ? '' : s.candidateOff}`}>
                <input type="checkbox" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Keep line ${i + 1}`} style={{ marginTop: '0.375rem' }} />
                <div>
                  <textarea className={admin.formInput} value={r.line} onChange={(e) => update(i, { line: e.target.value })} aria-label={`Line ${i + 1}`} maxLength={600} />
                  <div className={s.grid2} style={{ marginTop: '0.375rem' }}>
                    <input className={admin.formInput} value={r.source_ref ?? ''} onChange={(e) => update(i, { source_ref: e.target.value })} placeholder="Section" aria-label={`Section for line ${i + 1}`} />
                    <input className={admin.formInput} value={r.claim ?? ''} onChange={(e) => update(i, { claim: e.target.value })} placeholder="Claim and source (if any)" aria-label={`Claim for line ${i + 1}`} />
                  </div>
                  <div className={s.meta}>Match with the article: {Math.round(r.grounding * 100)}%</div>
                </div>
              </div>
            ))}
          </div>
          <div className={s.actions}>
            <button type="button" className={`${admin.btn} ${admin.btnSuccess} ${admin.btnSmall}`} onClick={save} disabled={busy !== null || keptCount === 0}>
              {busy === 'save' ? 'Saving…' : `Save ${keptCount} insight${keptCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
