'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar, Section, Piece, CorpusLink } from './types';
import { FORMAT_META } from './constants';
import { BriefTab } from './BriefTab';
import { ResearchTab } from './ResearchTab';
import { OutlineTab } from './OutlineTab';
import { DraftTab } from './DraftTab';
import { DistributeTab } from './DistributeTab';
import { AISidebar } from '../AISidebar';

type DocSection = 'brief' | 'research' | 'outline' | 'draft' | 'distribute';

export function DocumentWorkspace({
  pillar: initialPillar,
  initialSections,
  initialPieces,
  initialCorpusLinks,
}: {
  pillar: Pillar;
  initialSections: Section[];
  initialPieces: Piece[];
  initialCorpusLinks: CorpusLink[];
}) {
  const [pillar, setPillar]             = useState(initialPillar);
  const [sections, setSections]         = useState(initialSections);
  const [pieces, setPieces]             = useState(initialPieces);
  const [corpusLinks, setCorpusLinks]   = useState(initialCorpusLinks);
  const [activeSection, setActiveSection] = useState<DocSection>('brief');
  const [draftSectionId, setDraftSectionId] = useState<string>(initialSections[0]?.id ?? '');
  const draftSection = sections.find((s) => s.id === draftSectionId) ?? sections[0] ?? null;

  /** Saves sidebar-writer output into a section (the PATCH route keeps version history). */
  async function applySectionContent(sectionId: string, body: string) {
    const res = await fetch(`/api/admin/studio/sections/${sectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, status: 'draft' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.section) throw new Error(data.error ?? 'Could not save the section');
    setSections((prev) => prev.map((s) => (s.id === sectionId ? (data.section as Section) : s)));
  }

  const sectionRefs = useRef<Partial<Record<DocSection, HTMLElement | null>>>({});

  // Track which section is in view via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const sections: DocSection[] = ['brief', 'research', 'outline', 'draft', 'distribute'];

    for (const key of sections) {
      const el = sectionRefs.current[key];
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(key); },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const fmt = FORMAT_META[pillar.format] ?? { label: pillar.format, color: '#6b7280' };

  async function updatePillar(updates: Partial<Pillar>) {
    const res = await fetch(`/api/admin/studio/pillars/${pillar.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.pillar) setPillar(data.pillar);
    return data;
  }

  function setRef(key: DocSection) {
    return (el: HTMLElement | null) => { sectionRefs.current[key] = el; };
  }

  return (
    <div className={styles.documentWorkspace}>
      {/* Main document column */}
      <div className={styles.documentMain}>
        {/* Angle header */}
        <header className={styles.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
                ← Studio
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
                <h1 className={styles.pageTitle} style={{ margin: 0 }}>{pillar.title}</h1>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: fmt.color }}>{fmt.label}</span>
              </div>
              {pillar.audience && (
                <p className={styles.pageDescription} style={{ marginTop: '0.25rem' }}>
                  {pillar.audience}
                </p>
              )}
            </div>
            {/* Section jump links */}
            <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
              {(['brief', 'research', 'outline', 'draft', 'distribute'] as DocSection[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    padding: '0.25rem 0.625rem',
                    fontSize: '0.75rem',
                    fontWeight: activeSection === key ? 600 : 400,
                    color: activeSection === key ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                    background: activeSection === key ? 'rgba(99,102,241,0.08)' : 'none',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {key}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* BRIEF */}
        <section ref={setRef('brief')} data-doc-section="brief">
          <div className={styles.docSectionDivider}><span>Brief</span></div>
          <BriefTab pillar={pillar} onSave={updatePillar} />
        </section>

        {/* RESEARCH */}
        <section ref={setRef('research')} data-doc-section="research">
          <div className={styles.docSectionDivider}>
            <span>Research</span>
            {corpusLinks.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 8px' }}>
                {corpusLinks.filter((l) => l.curated).length}/{corpusLinks.length} curated
              </span>
            )}
          </div>
          <ResearchTab
            pillar={pillar}
            corpusLinks={corpusLinks}
            onLinksUpdate={setCorpusLinks}
            onPillarUpdate={setPillar}
          />
        </section>

        {/* OUTLINE */}
        <section ref={setRef('outline')} data-doc-section="outline">
          <div className={styles.docSectionDivider}>
            <span>Outline</span>
            {sections.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 8px' }}>
                {sections.length} sections
              </span>
            )}
          </div>
          <OutlineTab
            pillar={pillar}
            sections={sections}
            onSectionsUpdate={setSections}
            onPillarUpdate={setPillar}
          />
        </section>

        {/* DRAFT */}
        <section ref={setRef('draft')} data-doc-section="draft">
          <div className={styles.docSectionDivider}>
            <span>Draft</span>
            {sections.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 8px' }}>
                {sections.filter((s) => s.body).length}/{sections.length} written
              </span>
            )}
          </div>
          <DraftTab
            sections={sections}
            onSectionsUpdate={setSections}
            selectedId={draftSection?.id}
            onSelect={setDraftSectionId}
          />
        </section>

        {/* DISTRIBUTE */}
        <section ref={setRef('distribute')} data-doc-section="distribute" style={{ paddingBottom: '4rem' }}>
          <div className={styles.docSectionDivider}>
            <span>Distribute</span>
            {pieces.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 8px' }}>
                {pieces.length} pieces
              </span>
            )}
          </div>
          <DistributeTab
            pillar={pillar}
            sections={sections}
            pieces={pieces}
            onPiecesUpdate={setPieces}
          />
        </section>
      </div>

      {/* Sticky AI sidebar */}
      <div className={styles.documentSidebar}>
        <AISidebar
          angleId={pillar.id}
          currentSection={activeSection}
          corpusLinks={corpusLinks}
          onLinksUpdate={setCorpusLinks}
          draftSection={draftSection}
          onApplySectionContent={applySectionContent}
        />
      </div>
    </div>
  );
}
