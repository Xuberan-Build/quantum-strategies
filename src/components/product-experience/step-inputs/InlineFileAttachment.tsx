'use client';

import { useRef } from 'react';

interface InlineFileAttachmentProps {
  prompt: string;
  uploadedFiles: string[];
  onFileUpload: (files: File[]) => void;
  onRemoveFile?: (path: string) => void;
}

export function InlineFileAttachment({
  prompt,
  uploadedFiles,
  onFileUpload,
  onRemoveFile,
}: InlineFileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-4 p-4 bg-gray-900/30 border border-gray-700/30 rounded-xl">
      <p className="text-gray-400 text-sm mb-2">{prompt}</p>
      <button
        onClick={() => fileInputRef.current?.click()}
        type="button"
        className="text-teal-400 hover:text-teal-300 text-sm font-medium flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        Attach files (optional)
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) {
            onFileUpload(Array.from(files));
          }
        }}
      />
      {uploadedFiles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {uploadedFiles.map((file, idx) => (
            <div
              key={`uploaded-file-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white"
            >
              <span className="max-w-[140px] truncate">{file.split('/').pop()}</span>
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file)}
                  className="text-slate-300 hover:text-red-300"
                  title="Remove file"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
