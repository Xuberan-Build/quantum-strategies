'use client';

import { useState } from 'react';
import { DiffSuggestion } from './DiffSuggestion';
import { evidenceStrength } from '@/lib/corpus/evidence';

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

/** The draft section the sidebar's writer and voice check act on. */
export interface SidebarDraftSection {
  id: string;
  title: string;
  description: string | null;
  body: string | null;
}

interface AISidebarProps<L extends CorpusLink = CorpusLink> {
  angleId: string;
  currentSection: string;
  corpusLinks: L[];
  onLinksUpdate?: (links: L[]) => void;
  draftSection?: SidebarDraftSection | null;
  /** Persist accepted writer output into the section. Throw to surface an error. */
  onApplySectionContent?: (sectionId: string, body: string) => Promise<void>;
}

function isWeak(similarity: number | null): boolean {
  return evidenceStrength(similarity) === 'weak';
}

interface Brief {
  hook?: string;
  thesis?: string;
  key_claims?: string[];
  target_reader?: string;
  voice_notes?: string;
  corpus_gaps?: string[];
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
  const [result, setResult] = useState<Brief | null>(null);

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
      setResult((data.brief ?? {}) as Brief);
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
          {result.hook && (
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--admin-text)', borderLeft: '3px solid var(--admin-primary)', paddingLeft: '0.75rem', fontWeight: 600 }}>
              {result.hook}
            </div>
          )}
          {result.thesis && (
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--admin-text)' }}>{result.thesis}</div>
          )}
          {result.target_reader && (
            <div style={{ fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--admin-text-muted)' }}>
              <strong>Reader:</strong> {result.target_reader}
            </div>
          )}
          {result.voice_notes && (
            <div style={{ fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--admin-text-muted)' }}>
              <strong>Voice:</strong> {result.voice_notes}
            </div>
          )}
          {result.key_claims && result.key_claims.length > 0 && (
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Key Claims</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {result.key_claims.map((claim, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--admin-text)' }}>{claim}</li>
                ))}
              </ul>
            </div>
          )}
          {result.corpus_gaps && result.corpus_gaps.length > 0 && (
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
function ResearchSection<L extends CorpusLink>({
  angleId, corpusLinks, onLinksUpdate,
}: {
  angleId: string;
  corpusLinks: L[];
  onLinksUpdate?: (links: L[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const curated = corpusLinks.filter((l) => l.curated);
  const uncurated = corpusLinks.filter((l) => !l.curated);
  const gaps = [...uncurated].sort((a, b) => (a.similarity ?? 0) - (b.similarity ?? 0)).slice(0, 5);
  const coveragePct = corpusLinks.length > 0 ? Math.round((curated.length / corpusLinks.length) * 100) : 0;

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/corpus-researcher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: [query.trim()], angle_id: angleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      if (Array.isArray(data.links) && onLinksUpdate) onLinksUpdate(data.links as L[]);
      const found = typeof data.count === 'number' ? data.count : 0;
      const weak = typeof data.weak_count === 'number' ? data.weak_count : 0;
      setNotice(data.message ?? `${found} passage${found === 1 ? '' : 's'} found${weak ? `, ${weak} weak` : ''}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function curate(link: L) {
    setToggling((s) => new Set(s).add(link.id));
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/corpus-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curated: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Curate failed');
      }
      if (onLinksUpdate) {
        onLinksUpdate(corpusLinks.map((l) => l.id === link.id ? { ...l, curated: true } : l));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Curate failed');
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
        {notice && !error && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{notice}</div>
        )}
      </div>

      {/* Gaps */}
      {gaps.length > 0 && (
        <div>
          <SectionLabel>Uncurated (lowest similarity first)</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {gaps.map((link) => (
              <div key={link.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                padding: '0.375rem 0.5rem', borderRadius: 5, border: '1px solid var(--admin-border)',
              }}>
                <span style={{ fontSize: '0.75rem', flex: 1, color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {link.knowledge_chunks.text_name.replace(/_/g, ' ')}
                </span>
                {isWeak(link.similarity) && (
                  <span title="Below the evidence floor: resonance only, not evidence" style={{ flexShrink: 0, fontSize: '0.625rem', fontWeight: 700, color: 'var(--admin-warning)', textTransform: 'uppercase' }}>
                    Weak
                  </span>
                )}
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
function DraftSection({
  angleId, section, curatedChunkIds, onApply,
}: {
  angleId: string;
  section: SidebarDraftSection | null;
  curatedChunkIds: string[];
  onApply?: (sectionId: string, body: string) => Promise<void>;
}) {
  const content = section?.body ?? '';
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState<{
    score: number;
    violations: { type: string; excerpt: string; suggestion: string }[];
    overall_note: string;
  } | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [writeLoading, setWriteLoading] = useState(false);
  const [writeResult, setWriteResult] = useState<{
    sectionId: string;
    content: string;
    agentRunId?: string;
    unsupportedClaims: string[];
  } | null>(null);
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
    if (!section) return;
    setWriteLoading(true);
    setWriteError(null);
    try {
      const res = await fetch(`/api/admin/studio/agents/section-writer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angle_id: angleId,
          section_title: section.title,
          section_angle: section.description?.trim() || section.title,
          chunk_ids: curatedChunkIds,
          existing_content: content || undefined,
          mode: content ? 'improve' : 'write',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Write failed');
      setWriteResult({
        sectionId: section.id,
        content: data.content ?? '',
        agentRunId: data.run_id ?? undefined,
        unsupportedClaims: Array.isArray(data.unsupported_claims) ? data.unsupported_claims : [],
      });
      setAccepted(false);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : 'Write failed');
    } finally {
      setWriteLoading(false);
    }
  }

  async function apply(body: string) {
    if (!writeResult) return;
    setWriteError(null);
    try {
      if (onApply) await onApply(writeResult.sectionId, body);
      setAccepted(true);
      setWriteResult(null);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : 'Could not save the section');
    }
  }

  if (!section) {
    return (
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>
        Generate an outline, then pick a section in the Draft list to write or check it here.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text)' }}>{section.title}</div>

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
        {curatedChunkIds.length === 0 && (
          <div style={{ marginTop: '0.375rem', fontSize: '0.6875rem', color: 'var(--admin-warning)' }}>
            No curated passages: the writer will flag every claim as unsupported.
          </div>
        )}
        {writeError && <InlineError message={writeError} />}
        {writeResult && writeResult.sectionId === section.id && !accepted && (
          <>
            {writeResult.unsupportedClaims.length > 0 && (
              <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.625rem', borderRadius: 5, border: '1px solid var(--admin-warning)', fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--admin-warning)', marginBottom: '0.25rem' }}>Unsupported claims</div>
                <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                  {writeResult.unsupportedClaims.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            <DiffSuggestion
              original={content}
              proposed={writeResult.content}
              agentType="section_writer"
              agentRunId={writeResult.agentRunId}
              onAccept={() => apply(writeResult.content)}
              onReject={() => setWriteResult(null)}
              onEdit={(edited) => apply(edited)}
            />
          </>
        )}
        {accepted && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--admin-success)', fontWeight: 600 }}>
            ✓ Applied to the section
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
      <p style={{ margin: '0 0 0.625rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>
        Preview only: it uses the brief and maps passages to sections. Nothing is saved; edit sections in the Outline tab.
      </p>
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
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    setSubmitError(null);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Submission failed');
      }
      setSubmitted(true);
      setUrl('');
      setText('');
      setEvalResult(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed');
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
          {submitError && <InlineError message={submitError} />}

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
export function AISidebar<L extends CorpusLink>({
  angleId, currentSection, corpusLinks, onLinksUpdate, draftSection = null, onApplySectionContent,
}: AISidebarProps<L>) {
  const curatedChunkIds = corpusLinks.filter((l) => l.curated).map((l) => l.knowledge_chunks.id).slice(0, 6);
  return (
    <>
      <style>{`
        @keyframes aispin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        width: '100%',
        background: 'var(--admin-surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
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
            <DraftSection
              key={draftSection?.id ?? 'none'}
              angleId={angleId}
              section={draftSection}
              curatedChunkIds={curatedChunkIds}
              onApply={onApplySectionContent}
            />
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
