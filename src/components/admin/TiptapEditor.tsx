'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import styles from '@/app/admin/admin-layout.module.css';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function TiptapEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '150px',
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}; outline: none;`,
      },
    },
  });

  if (!editor) {
    return <div className={styles.editorLoading}>Loading editor...</div>;
  }

  return (
    <div className={styles.tiptapWrapper}>
      <div className={styles.tiptapToolbar}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('bold') ? styles.tiptapBtnActive : ''}`}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('italic') ? styles.tiptapBtnActive : ''}`}
          title="Italic"
        >
          <em>I</em>
        </button>
        <span className={styles.tiptapDivider} />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('bulletList') ? styles.tiptapBtnActive : ''}`}
          title="Bullet List"
        >
          <ListIcon />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('orderedList') ? styles.tiptapBtnActive : ''}`}
          title="Numbered List"
        >
          <OrderedListIcon />
        </button>
        <span className={styles.tiptapDivider} />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${styles.tiptapBtn} ${editor.isActive('heading', { level: 3 }) ? styles.tiptapBtnActive : ''}`}
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('blockquote') ? styles.tiptapBtnActive : ''}`}
          title="Quote"
        >
          <QuoteIcon />
        </button>
      </div>
      <EditorContent editor={editor} className={styles.tiptapContent} />
    </div>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="8" fontSize="8" fill="currentColor" stroke="none">1</text>
      <text x="3" y="14" fontSize="8" fill="currentColor" stroke="none">2</text>
      <text x="3" y="20" fontSize="8" fill="currentColor" stroke="none">3</text>
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
    </svg>
  );
}
