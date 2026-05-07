'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';
import styles from '@/app/admin/admin-layout.module.css';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
  showCharCount?: boolean;
}

export default function TiptapEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '150px',
  showCharCount = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CharacterCount,
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

  const handleLinkToggle = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={styles.tiptapWrapper}>
      <div className={styles.tiptapToolbar}>
        {/* Text style */}
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
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('underline') ? styles.tiptapBtnActive : ''}`}
          title="Underline"
        >
          <UnderlineIcon />
        </button>

        <span className={styles.tiptapDivider} />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`${styles.tiptapBtn} ${editor.isActive('heading', { level: 1 }) ? styles.tiptapBtnActive : ''}`}
          title="Heading 1"
          style={{ fontSize: '0.75rem', fontWeight: 700 }}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${styles.tiptapBtn} ${editor.isActive('heading', { level: 2 }) ? styles.tiptapBtnActive : ''}`}
          title="Heading 2"
          style={{ fontSize: '0.75rem', fontWeight: 700 }}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${styles.tiptapBtn} ${editor.isActive('heading', { level: 3 }) ? styles.tiptapBtnActive : ''}`}
          title="Heading 3"
          style={{ fontSize: '0.75rem', fontWeight: 700 }}
        >
          H3
        </button>

        <span className={styles.tiptapDivider} />

        {/* Lists & blocks */}
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
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${styles.tiptapBtn} ${editor.isActive('blockquote') ? styles.tiptapBtnActive : ''}`}
          title="Quote"
        >
          <QuoteIcon />
        </button>

        <span className={styles.tiptapDivider} />

        {/* Link */}
        <button
          type="button"
          onClick={handleLinkToggle}
          className={`${styles.tiptapBtn} ${editor.isActive('link') ? styles.tiptapBtnActive : ''}`}
          title={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
        >
          <LinkIcon />
        </button>

        <span className={styles.tiptapDivider} />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`${styles.tiptapBtn} ${editor.isActive({ textAlign: 'left' }) ? styles.tiptapBtnActive : ''}`}
          title="Align Left"
        >
          <AlignLeftIcon />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`${styles.tiptapBtn} ${editor.isActive({ textAlign: 'center' }) ? styles.tiptapBtnActive : ''}`}
          title="Align Center"
        >
          <AlignCenterIcon />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`${styles.tiptapBtn} ${editor.isActive({ textAlign: 'right' }) ? styles.tiptapBtnActive : ''}`}
          title="Align Right"
        >
          <AlignRightIcon />
        </button>
      </div>

      <EditorContent editor={editor} className={styles.tiptapContent} />

      {showCharCount && (
        <div className={styles.tiptapCharCount}>
          {editor.storage.characterCount.characters()} characters · {editor.storage.characterCount.words()} words
        </div>
      )}
    </div>
  );
}

function UnderlineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3v7a6 6 0 0012 0V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="15" y1="12" x2="3" y2="12" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="18" y1="12" x2="6" y2="12" />
      <line x1="21" y1="18" x2="3" y2="18" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="12" x2="9" y2="12" />
      <line x1="21" y1="18" x2="7" y2="18" />
    </svg>
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
