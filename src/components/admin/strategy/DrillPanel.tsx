'use client';

import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';
import { STAGE_META, type SelectedCell } from './strategy.types';

export function DrillPanel({ selected, onClose }: { selected: SelectedCell; onClose: () => void }) {
  const { pillarTitle, stage, cell, topicCount } = selected;
  const stageMeta = STAGE_META[stage];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40,
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--admin-bg, #fff)',
        borderLeft: '1px solid var(--admin-border)',
        zIndex: 50, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--admin-border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: stageMeta.color, marginBottom: 4 }}>
              {stageMeta.label} · {stageMeta.desc}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{pillarTitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.25rem', color: 'var(--admin-text-muted)', lineHeight: 1, padding: 4,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', flex: 1 }}>

          {/* Awareness — posts */}
          {stage === 'awareness' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>
                  Published Articles ({cell.posts.length})
                </h3>
                <Link
                  href="/admin/content/new"
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                >
                  + New
                </Link>
              </div>
              {cell.posts.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                  No published articles for this pillar yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cell.posts.map((post) => (
                    <div key={post.id} style={{
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.title ?? post.slug}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                          /{post.slug}
                        </div>
                      </div>
                      <Link
                        href={`/admin/content/${post.slug}`}
                        style={{
                          fontSize: '0.75rem', color: 'var(--admin-primary)', textDecoration: 'none',
                          fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        Edit →
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {topicCount > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--admin-bg-subtle, #f8fafc)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    {topicCount} topic{topicCount !== 1 ? 's' : ''} mapped in topic tree
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Non-awareness — products */}
          {stage !== 'awareness' && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>
                  Products ({cell.products.length})
                </h3>
                <Link
                  href="/admin/products"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                >
                  All products
                </Link>
              </div>

              {cell.products.length === 0 ? (
                <div style={{
                  padding: '1rem', border: '1px dashed var(--admin-border)',
                  borderRadius: 6, textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                    No product at this stage for this pillar.
                  </div>
                  {cell.hasContent && (
                    <div style={{ fontSize: '0.8125rem', color: '#d97706' }}>
                      ⚡ Content exists — this is a revenue gap.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cell.products.map((prod) => (
                    <div key={prod.id} style={{
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                          {prod.price != null ? `$${prod.price}` : 'No price'} · {prod.slug}
                        </div>
                      </div>
                      <Link
                        href={`/admin/products/${prod.slug}`}
                        style={{
                          fontSize: '0.75rem', color: 'var(--admin-primary)', textDecoration: 'none',
                          fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        Edit →
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {topicCount > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--admin-bg-subtle, #f8fafc)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    {topicCount} topic{topicCount !== 1 ? 's' : ''} available as content foundation
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--admin-border)' }}>
          <Link
            href={`/pillars/${selected.pillarTitle.toLowerCase().replace(/\s+/g, '-').replace(/['']/g, '')}`}
            style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}
            target="_blank"
          >
            View pillar page ↗
          </Link>
        </div>
      </div>
    </>
  );
}
