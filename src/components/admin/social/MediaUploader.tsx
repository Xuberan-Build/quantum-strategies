'use client';

import { useRef, useState } from 'react';
import type { SocialMedia } from '@/lib/social/types';
import { errorMessage, putWithProgress, socialApi } from './api';
import s from './social.module.css';

/** One media slot in the composer. `media` is set once the upload finished (or for media loaded from a saved post). */
export interface MediaItem {
  key: string;
  previewUrl: string;
  type: 'image' | 'video';
  name: string;
  progress: number; // 0..1
  status: 'uploading' | 'done' | 'error';
  error?: string;
  media?: SocialMedia;
}

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

export function mediaItemFromSaved(m: SocialMedia, i: number): MediaItem {
  return {
    key: `saved-${i}-${m.url}`,
    previewUrl: m.thumbnailUrl && m.type === 'image' ? m.thumbnailUrl : m.url,
    type: m.type,
    name: m.path?.split('/').pop() ?? m.url.split('/').pop() ?? 'media',
    progress: 1,
    status: 'done',
    media: m,
  };
}

const IG_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Instagram only accepts JPEG images up to 8 MB, so every non-JPEG image (PNG, WebP, ...) and any JPEG over 8 MB is
 * re-encoded to JPEG in the browser before upload. Falls back to the original file if the browser cannot decode it.
 */
async function toInstagramSafeJpeg(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  if (isJpeg && file.size <= IG_MAX_IMAGE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff'; // flatten transparency (JPEG has no alpha)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    let blob: Blob | null = null;
    for (const q of [0.9, 0.8, 0.7, 0.6]) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= IG_MAX_IMAGE_BYTES) break;
    }
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

function readMetadata(file: File, url: string): Promise<Pick<SocialMedia, 'width' | 'height' | 'durationSec'>> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () =>
        resolve({ width: v.videoWidth, height: v.videoHeight, durationSec: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : undefined });
      v.onerror = () => resolve({});
      v.src = url;
    }
  });
}

export default function MediaUploader({ items, onChange }: { items: MediaItem[]; onChange: (update: (prev: MediaItem[]) => MediaItem[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const patch = (key: string, p: Partial<MediaItem>) => onChange((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function uploadOne(original: File, key: string, previewUrl: string) {
    try {
      const file = await toInstagramSafeJpeg(original);
      if (file.size > MAX_BYTES) throw new Error('File is larger than 1 GB');
      const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      const [meta, target] = await Promise.all([
        readMetadata(file, previewUrl),
        socialApi.uploadUrl({ filename: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size }),
      ]);
      await putWithProgress(target.signedUrl, file, (p) => patch(key, { progress: p }));
      patch(key, {
        status: 'done',
        progress: 1,
        media: { url: target.publicUrl, path: target.path, type, mime: file.type, sizeBytes: file.size, ...meta },
      });
    } catch (e) {
      patch(key, { status: 'error', error: errorMessage(e) });
    }
  }

  function addFiles(files: FileList | File[]) {
    const accepted = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const fresh = accepted.map((file) => ({
      file,
      item: {
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        previewUrl: URL.createObjectURL(file),
        type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
        name: file.name,
        progress: 0,
        status: 'uploading' as const,
      },
    }));
    if (!fresh.length) return;
    onChange((prev) => [...prev, ...fresh.map((f) => f.item)]);
    for (const f of fresh) void uploadOne(f.file, f.item.key, f.item.previewUrl);
  }

  function move(key: string, by: number) {
    onChange((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      const j = i + by;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function moveTo(key: string, targetKey: string) {
    onChange((prev) => {
      const from = prev.findIndex((x) => x.key === key);
      const to = prev.findIndex((x) => x.key === targetKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  }

  function remove(key: string) {
    onChange((prev) => {
      const it = prev.find((x) => x.key === key);
      if (it?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div
        className={`${s.dropZone} ${dragOver ? s.dropZoneActive : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Add images or videos. Drop files here or press Enter to browse."
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <strong>Drop images or videos</strong> or click to browse
        <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
          Multiple files make a carousel (2 to 20 for Instagram). Drag thumbnails to reorder. Images are converted to JPEG for Instagram.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className={s.mediaGrid} style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Attached media">
          {items.map((it, i) => (
            <li
              key={it.key}
              className={s.mediaItem}
              draggable
              onDragStart={(e) => {
                setDragKey(it.key);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragKey) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!dragKey) return;
                e.preventDefault();
                e.stopPropagation();
                moveTo(dragKey, it.key);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
            >
              <div className={s.mediaPreview} style={{ outline: dragKey === it.key ? '2px solid var(--admin-primary)' : undefined }}>
                {it.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob / storage preview
                  <img src={it.previewUrl} alt={`Media ${i + 1}: ${it.name}`} />
                ) : (
                  <video src={it.previewUrl} muted playsInline preload="metadata" controls={it.status === 'done'} aria-label={`Media ${i + 1}: ${it.name}`} />
                )}
                {it.status === 'uploading' && (
                  <div
                    className={s.progress}
                    role="progressbar"
                    aria-label={`Uploading ${it.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(it.progress * 100)}
                  >
                    <div className={s.progressBar} style={{ width: `${Math.round(it.progress * 100)}%` }} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.6875rem', color: it.status === 'error' ? 'var(--admin-danger)' : 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.error ?? it.name}>
                {it.status === 'uploading'
                  ? `Uploading ${Math.round(it.progress * 100)}%`
                  : it.status === 'error'
                    ? it.error
                    : [
                        it.media?.width && it.media?.height ? `${it.media.width}×${it.media.height}` : null,
                        it.media?.durationSec ? `${it.media.durationSec}s` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || it.name}
              </div>
              <div className={s.mediaControls}>
                <button type="button" className={s.iconBtn} onClick={() => move(it.key, -1)} disabled={i === 0} aria-label={`Move media ${i + 1} left`}>
                  ←
                </button>
                <button type="button" className={s.iconBtn} onClick={() => move(it.key, 1)} disabled={i === items.length - 1} aria-label={`Move media ${i + 1} right`}>
                  →
                </button>
                <button type="button" className={s.iconBtn} onClick={() => remove(it.key)} aria-label={`Remove media ${i + 1}`}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
