'use client';

import { useState } from 'react';
import { DiffSuggestion } from './DiffSuggestion';

interface CorpusLink {
  id: string;
  similarity: number | null;
  curated: boolean;
  knowledge_chunks: {
    id: string;
    tradition: string;
    text_name: string;
    author: string | null;
    content: string;
  };
}

interface AISidebarProps {
  angleId: string;
  currentSection: string;
  corpusLinks: CorpusLink[];
  onSectionContent?: string;
  onLinksUpdate?: (links: CorpusLink[]) => void;
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 14,
      height: 14,
      border: '2px solid var(--admin-border)',
      borderTopColor: 'var(--admin-primary)',
      borderRadius: '50%',
      animation: 'aispin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  );
}

// ── Section heading ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem',
      fontWeight: 700,
      color: 'var(--admin-text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: '0.625rem',
    }}>
      {children}
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────────────
function ActionBtn({
  onClick, loading, disabled, children, variant = 'primary',
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        borderRadius: 5,
        fontSize: '0.8125rem',
        fontWeight: 600,
        border: isPrimary ? 'none' : '1px solid var(--admin-border)',
        background: isPrimary ? 'var(--admin-primary)' : 'var(--admin-surface)',
        color: isPrimary ? 'white' : 'var(--admin-text)',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.65 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// ── Inline error ───────────────────────────────────────────────────────────────
function InlineError({ message }: { message: string }) {
  return (
    <div style={{
      marginTop: '0.5rem',
      padding: '0.5rem 0.625rem',
      borderRadius: 5,
      background: '#fef2f2',
      border: '1px solid var(--admin-danger)',
      color: 'var(--admin-danger)',
      fontSize: '0.8125rem',
    }}>
      {message}
    </div>
  );
}

// ── Voice score bar ────────────────────────────────────────────────────────────
function VoiceBar({ score }: { score: number }) {
  const color = score >= 75 ? 'var(--admin-success)' : score >= 50 ? 'var(--admin-warning)' : 'var(--admin-danger)';
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Voice score</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color }}>{score}/100</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--admin-border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── Brief section ──────────────────────────────────────────────────────────────
function BriefSection({ angleId }: { angleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    brief_prose: string;
    key_claims: string[];
    corpus_gaps: string[];
  } | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle_id: angleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionLabel>Brief Agent</SectionLabel>
      <ActionBtn onClick={generate} loading={loading}>
        {result ? 'Regenerate Brief' : 'Generate Brief'}
      </ActionBtn>
      {error && <InlineError message={error} />}
      {result && (
        <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--admin-text)', borderLeft: '3px solid var(--admin-primary)', paddingLeft: '0.75rem' }}>
            {result.brief_prose}
          </div>
          {result.key_claims.length > 0 && (
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Key Claims</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {result.key_claims.map((claim, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--admin-text)' }}>{claim}</li>
                ))}
              </ul>
            </div>
          )}
          {result.corpus_gaps.length > 0 && (
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--admin-warning)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Corpus Gaps</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {result.corpus_gaps.map((gap, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Research section ───────────────────────────────────────────────────────────
function ResearchSection({
  angleId, corpusLinks, onLinksUpdate,
}: {
  angleId: string;
  corpusLinks: CorpusLink[];
  onLinksUpdate?: (links: CorpusLink[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const curated = corpusLinks.filter((l) => l.curated);
  const uncurated = corpusLinks.filter((l) => !l.curated);
  const gaps = [...uncurated].sort((a, b) => (a.similarity ?? 0) - (b.similarity ?? 0)).slice(0, 5);
  const coveragePct = corpusLinks.length > 0 ? Math.round((curated.length / corpusLinks.length) * 100) : 0;

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/corpus-researcher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: [query.trim()], angle_id: angleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      if (data.links && onLinksUpdate) onLinksUpdate(data.links);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function curate(link: CorpusLink) {
    setToggling((s) => new Set(s).add(link.id));
    try {
      await fetch(`/api/admin/studio/corpus-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curated: true }),
      });
      if (onLinksUpdate) {
        onLinksUpdate(corpusLinks.map((l) => l.id === link.id ? { ...l, curated: true } : l));
      }
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(link.id); return n; });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Coverage */}
      <div>
        <SectionLabel>Corpus Coverage</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{curated.length}/{corpusLinks.length} curated</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: coveragePct >= 60 ? 'var(--admin-success)' : 'var(--admin-warning)' }}>{coveragePct}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 99, background: 'var(--admin-border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${coveragePct}%`, background: 'var(--admin-primary)', borderRadius: 99 }} />
        </div>
      </div>

      {/* Quick search */}
      <div>
        <SectionLabel>Quick Search</SectionLabel>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search corpus…"
            style={{
              flex: 1, padding: '0.375rem 0.625rem', borderRadius: 5, fontSize: '0.8125rem',
              border: '1px solid var(--admin-border)', background: 'var(--admin-surface)',
              color: 'var(--admin-text)', outline: 'none',
            }}
          />
          <ActionBtn onClick={search} loading={loading} disabled={!query.trim()}>Go</ActionBtn>
        </div>
        {error && <InlineError message={error} />}
      </div>

      {/* Gaps */}
      {gaps.length > 0 && (
        <div>
          <SectionLabel>Potential Gaps (low similarity)</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {gaps.map((link) => (
              <div key={link.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                padding: '0.375rem 0.5rem', borderRadius: 5, border: '1px solid var(--admin-border)',
              }}>
                <span style={{ fontSize: '0.75rem', flex: 1, color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {link.knowledge_chunks.text_name.replace(/_/g, ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => curate(link)}
                  disabled={toggling.has(link.id)}
                  style={{
                    flexShrink: 0, padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.6875rem',
                    fontWeight: 600, border: '1px solid var(--admin-success)', background: 'none',
                    color: 'var(--admin-success)', cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Draft section ──────────────────────────────────────────────────────────────
function DraftSection({ angleId, content }: { angleId: string; content: string }) {
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState<{
    score: number;
    violations: { type: string; excerpt: string; suggestion: string }[];
    overall_note: string;
  } | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [writeLoading, setWriteLoading] = useState(false);
  const [writeResult, setWriteResult] = useState<{ content: string; agentRunId?: string } | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function checkVoice() {
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/voice-calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, angle_id: angleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Voice check failed');
      setVoiceResult(data);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : 'Voice check failed');
    } finally {
      setVoiceLoading(false);
    }
  }

  async function writeSection() {
    setWriteLoading(true);
    setWriteError(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/section-writer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle_id: angleId, existing_content: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Write failed');
      setWriteResult({ content: data.content, agentRunId: data.agent_run_id });
      setAccepted(false);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : 'Write failed');
    } finally {
      setWriteLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Voice check */}
      <div>
        <SectionLabel>Voice Calibration</SectionLabel>
        <ActionBtn onClick={checkVoice} loading={voiceLoading} disabled={!content}>
          Check Voice
        </ActionBtn>
        {voiceError && <InlineError message={voiceError} />}
        {voiceResult && (
          <div style={{ marginTop: '0.75rem' }}>
            <VoiceBar score={voiceResult.score} />
            {voiceResult.overall_note && (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{voiceResult.overall_note}</p>
            )}
            {voiceResult.violations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {voiceResult.violations.map((v, i) => (
                  <div key={i} style={{ padding: '0.5rem 0.625rem', borderRadius: 5, background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--admin-danger)', marginBottom: '0.2rem' }}>{v.type}</div>
                    <div style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic', marginBottom: '0.25rem' }}>&ldquo;{v.excerpt}&rdquo;</div>
                    <div style={{ color: 'var(--admin-text)' }}>{v.suggestion}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section writer */}
      <div>
        <SectionLabel>Section Writer</SectionLabel>
        <ActionBtn onClick={writeSection} loading={writeLoading} variant="secondary">
          {content ? 'Improve Section' : 'Write Section'}
        </ActionBtn>
        {writeError && <InlineError message={writeError} />}
        {writeResult && !accepted && (
          <DiffSuggestion
            original={content}
            proposed={writeResult.content}
            agentType="section_writer"
            agentRunId={writeResult.agentRunId}
            onAccept={() => setAccepted(true)}
            onReject={() => setWriteResult(null)}
            onEdit={(edited) => { setWriteResult({ ...writeResult, content: edited }); setAccepted(true); }}
          />
        )}
        {accepted && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--admin-success)', fontWeight: 600 }}>
            ✓ Applied
          </div>
        )}
      </div>
    </div>
  );
}

// ── Outline section ────────────────────────────────────────────────────────────
function OutlineSection({ angleId }: { angleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<{ title: string; angle: string; word_count: number }[]>([]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle_id: angleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSections(data.sections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Outline generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionLabel>Outline Agent</SectionLabel>
      <ActionBtn onClick={generate} loading={loading}>
        Generate Outline
      </ActionBtn>
      {error && <InlineError message={error} />}
      {sections.length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ padding: '0.5rem 0.625rem', borderRadius: 5, border: '1px solid var(--admin-border)', fontSize: '0.8125rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{s.title}</div>
              <div style={{ color: 'var(--admin-text-muted)', marginTop: '0.2rem' }}>{s.angle}</div>
              <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.6875rem', marginTop: '0.2rem' }}>~{s.word_count} words</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Distribute section ─────────────────────────────────────────────────────────
function DistributeSection() {
  const formats = ['Blog post', 'Twitter thread', 'LinkedIn editorial', 'Instagram caption', 'Email', 'Email sequence', 'GPT product prompt'];
  return (
    <div>
      <SectionLabel>Distribution Formats</SectionLabel>
      <p style={{ margin: '0 0 0.625rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>
        Use the Distribute tab to generate and publish each format:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {formats.map((f) => (
          <div key={f} style={{ fontSize: '0.8125rem', color: 'var(--admin-text)', padding: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--admin-text-muted)' }}>→</span> {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ingest drawer ──────────────────────────────────────────────────────────────
function IngestDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [traditions, setTraditions] = useState('');
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<{ quality_score: number; recommendation: string; reasoning: string } | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function evaluate() {
    setEvalLoading(true);
    setEvalError(null);
    setEvalResult(null);
    try {
      const body: Record<string, unknown> = {
        tradition_tags: traditions.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (tab === 'url') body.source_url = url;
      else body.raw_text = text;

      const res = await fetch(`/api/admin/studio/agents/source-evaluator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Evaluation failed');
      setEvalResult(data);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setEvalLoading(false);
    }
  }

  async function submit() {
    setSubmitLoading(true);
    try {
      const body: Record<string, unknown> = {
        source_type: tab,
        tradition_tags: traditions.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (tab === 'url') body.source_url = url;
      else body.raw_text = text;

      const res = await fetch(`/api/admin/corpus/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
      setUrl('');
      setText('');
      setEvalResult(null);
    } catch {
      /* show nothing — drawer stays open */
    } finally {
      setSubmitLoading(false);
    }
  }

  const scoreColor = evalResult
    ? evalResult.quality_score >= 0.7 ? 'var(--admin-success)' : evalResult.quality_score >= 0.5 ? 'var(--admin-warning)' : 'var(--admin-danger)'
    : undefined;

  return (
    <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-primary)',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>{open ? '−' : '+'}</span> Ingest Source
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--admin-border)' }}>
            {(['url', 'text'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: tab === t ? 700 : 400,
                  border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: tab === t ? '2px solid var(--admin-primary)' : '2px solid transparent',
                  color: tab === t ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                  marginBottom: -1,
                }}
              >
                {t === 'url' ? 'URL' : 'Text paste'}
              </button>
            ))}
          </div>

          {tab === 'url' ? (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{
                padding: '0.375rem 0.625rem', borderRadius: 5, fontSize: '0.8125rem',
                border: '1px solid var(--admin-border)', background: 'var(--admin-surface)',
                color: 'var(--admin-text)', outline: 'none',
              }}
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text content here…"
              rows={4}
              style={{
                padding: '0.375rem 0.625rem', borderRadius: 5, fontSize: '0.8125rem',
                border: '1px solid var(--admin-border)', background: 'var(--admin-surface)',
                color: 'var(--admin-text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          )}

          <input
            value={traditions}
            onChange={(e) => setTraditions(e.target.value)}
            placeholder="Tradition tags (comma-separated, e.g. taoism, science)"
            style={{
              padding: '0.375rem 0.625rem', borderRadius: 5, fontSize: '0.8125rem',
              border: '1px solid var(--admin-border)', background: 'var(--admin-surface)',
              color: 'var(--admin-text)', outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <ActionBtn onClick={evaluate} loading={evalLoading} disabled={tab === 'url' ? !url : !text} variant="secondary">
              Evaluate
            </ActionBtn>
            {evalResult && (
              <ActionBtn onClick={submit} loading={submitLoading}>
                Submit for Ingestion
              </ActionBtn>
            )}
          </div>

          {evalError && <InlineError message={evalError} />}

          {evalResult && (
            <div style={{ padding: '0.5rem 0.625rem', borderRadius: 5, border: `1px solid ${scoreColor}`, fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, color: scoreColor }}>
                  {evalResult.recommendation === 'approve' ? '✓ Approved' : '✗ Rejected'}
                </span>
                <span style={{ color: 'var(--admin-text-muted)' }}>
                  Score: {Math.round(evalResult.quality_score * 100)}%
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>{evalResult.reasoning}</p>
            </div>
          )}

          {submitted && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--admin-success)', fontWeight: 600 }}>
              ✓ Queued for ingestion
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function AISidebar({ angleId, currentSection, corpusLinks, onSectionContent, onLinksUpdate }: AISidebarProps) {
  return (
    <>
      <style>{`
        @keyframes aispin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        width: 280,
        flexShrink: 0,
        borderLeft: '1px solid var(--admin-border)',
        background: 'var(--admin-surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--admin-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-primary)' }}>
            AI Assistant
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.6875rem',
            padding: '0.15rem 0.5rem',
            borderRadius: 99,
            background: 'var(--admin-bg)',
            border: '1px solid var(--admin-border)',
            color: 'var(--admin-text-muted)',
            textTransform: 'capitalize',
          }}>
            {currentSection}
          </span>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {currentSection === 'brief' && <BriefSection angleId={angleId} />}
          {currentSection === 'research' && (
            <ResearchSection angleId={angleId} corpusLinks={corpusLinks} onLinksUpdate={onLinksUpdate} />
          )}
          {currentSection === 'draft' && (
            <DraftSection angleId={angleId} content={onSectionContent ?? ''} />
          )}
          {currentSection === 'outline' && <OutlineSection angleId={angleId} />}
          {currentSection === 'distribute' && <DistributeSection />}
        </div>

        {/* Ingest drawer — always at the bottom */}
        <div style={{ padding: '0 1rem 1rem' }}>
          <IngestDrawer />
        </div>
      </div>
    </>
  );
}
