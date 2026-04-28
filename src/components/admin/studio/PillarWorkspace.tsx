'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar, Section, Piece, CorpusLink } from './pillar-workspace/types';
import { TABS, FORMAT_META, type Tab } from './pillar-workspace/constants';
import { BriefTab } from './pillar-workspace/BriefTab';
import { ResearchTab } from './pillar-workspace/ResearchTab';
import { OutlineTab } from './pillar-workspace/OutlineTab';
import { DraftTab } from './pillar-workspace/DraftTab';
import { DistributeTab } from './pillar-workspace/DistributeTab';

export default function PillarWorkspace({
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
  const statusToTab: Record<string, Tab> = {
    brief: 'brief', research: 'research', outline: 'outline',
    draft: 'draft', review: 'draft', published: 'distribute',
  };

  const [tab, setTab]               = useState<Tab>(statusToTab[initialPillar.status] ?? 'brief');
  const [pillar, setPillar]         = useState(initialPillar);
  const [sections, setSections]     = useState(initialSections);
  const [pieces, setPieces]         = useState(initialPieces);
  const [corpusLinks, setCorpusLinks] = useState(initialCorpusLinks);

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

  return (
    <div>
      {/* Header */}
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
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--admin-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {t.label}
            {t.key === 'research' && corpusLinks.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {corpusLinks.filter((l) => l.curated).length}/{corpusLinks.length}
              </span>
            )}
            {t.key === 'outline' && sections.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {sections.length}
              </span>
            )}
            {t.key === 'draft' && sections.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {sections.filter((s) => s.body).length}/{sections.length}
              </span>
            )}
            {t.key === 'distribute' && pieces.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {pieces.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === 'brief' && (
        <BriefTab pillar={pillar} onSave={updatePillar} />
      )}
      {tab === 'research' && (
        <ResearchTab
          pillar={pillar}
          corpusLinks={corpusLinks}
          onLinksUpdate={setCorpusLinks}
          onPillarUpdate={setPillar}
        />
      )}
      {tab === 'outline' && (
        <OutlineTab
          pillar={pillar}
          sections={sections}
          onSectionsUpdate={setSections}
          onPillarUpdate={setPillar}
        />
      )}
      {tab === 'draft' && (
        <DraftTab
          sections={sections}
          onSectionsUpdate={setSections}
        />
      )}
      {tab === 'distribute' && (
        <DistributeTab
          pillar={pillar}
          sections={sections}
          pieces={pieces}
          onPiecesUpdate={setPieces}
        />
      )}
    </div>
  );
}
