'use client';

import { useState } from 'react';

interface DiffSuggestionProps {
  original: string;
  proposed: string;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (content: string) => void;
  agentType: string;
  agentRunId?: string;
}

export function DiffSuggestion({
  original,
  proposed,
  onAccept,
  onReject,
  onEdit,
  agentType,
  agentRunId,
}: DiffSuggestionProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(proposed);

  function handleAccept() {
    if (agentRunId) {
      fetch(`/api/admin/studio/agent-runs/${agentRunId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_approved: true }),
      }).catch(() => {});
    }
    onAccept();
  }

  function handleEdit() {
    if (editing) {
      onEdit(editValue);
      setEditing(false);
    } else {
      setEditing(true);
    }
  }

  return (
    <div style={{
      border: '1px solid var(--admin-border)',
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: '0.75rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.875rem',
        background: 'var(--admin-bg)',
        borderBottom: '1px solid var(--admin-border)',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {agentType} suggestion
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleAccept}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px solid var(--admin-success)',
              background: 'var(--admin-success)',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleEdit}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px solid var(--admin-border)',
              background: editing ? 'var(--admin-primary)' : 'none',
              color: editing ? 'white' : 'var(--admin-text-muted)',
              cursor: 'pointer',
            }}
          >
            {editing ? 'Apply Edit' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={onReject}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px solid var(--admin-danger)',
              background: 'none',
              color: 'var(--admin-danger)',
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          style={{
            display: 'block',
            width: '100%',
            minHeight: 160,
            padding: '0.75rem',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            fontFamily: 'inherit',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Current */}
          <div style={{ borderRight: '1px solid var(--admin-border)' }}>
            <div style={{ padding: '0.375rem 0.75rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--admin-border)' }}>
              Current
            </div>
            <div
              style={{ padding: '0.75rem', fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--admin-text-muted)', opacity: 0.7 }}
              dangerouslySetInnerHTML={{ __html: original || '<em style="opacity:0.5">Empty</em>' }}
            />
          </div>

          {/* Proposed */}
          <div style={{ borderLeft: '3px solid var(--admin-success)' }}>
            <div style={{ padding: '0.375rem 0.75rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--admin-success)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--admin-border)' }}>
              Proposed
            </div>
            <div
              style={{ padding: '0.75rem', fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--admin-text)' }}
              dangerouslySetInnerHTML={{ __html: proposed }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
