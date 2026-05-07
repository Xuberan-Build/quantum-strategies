'use client';

import { useState } from 'react';

type Note = { id: string; author: string; content: string; created_at: string };

export function UserNotes({ userId, initialNotes }: { userId: string; initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), author: 'admin' }),
      });
      if (!res.ok) throw new Error('Failed to save note');
      const note: Note = await res.json();
      setNotes([note, ...notes]);
      setContent('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return;
    await fetch(`/api/admin/users/${userId}/notes/${noteId}`, { method: 'DELETE' });
    setNotes(notes.filter((n) => n.id !== noteId));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note about this user..."
        rows={3}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          fontSize: '0.8125rem',
          background: 'var(--admin-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: '0.375rem',
          color: 'var(--admin-text)',
          resize: 'vertical',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {error && <span style={{ fontSize: '0.75rem', color: 'var(--admin-danger)' }}>{error}</span>}
        <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginLeft: 'auto', marginRight: '0.5rem' }}>⌘↵ to save</span>
        <button
          onClick={handleAdd}
          disabled={saving || !content.trim()}
          style={{
            padding: '0.375rem 0.875rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            background: 'var(--admin-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: saving || !content.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !content.trim() ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {notes.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>No notes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {notes.map((note) => (
            <div key={note.id} style={{
              background: 'var(--admin-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: '0.375rem',
              padding: '0.625rem 0.75rem',
            }}>
              <div style={{ fontSize: '0.8125rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note.content}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.375rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                  {note.author} · {new Date(note.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => handleDelete(note.id)}
                  style={{ fontSize: '0.7rem', color: 'var(--admin-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
