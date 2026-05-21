'use client';

import { useCallback, useRef, useState } from 'react';

interface ChatWindowProps {
  title: string;
  description?: string;
  instructions?: string;
  onFileUpload: (files: File[]) => void;
  uploadedFiles: string[];
  uploadError?: string | null;
  onContinue: () => void;
  isSubmitting: boolean;
  onRemoveFile?: (path: string) => void;
}

export function ChatWindow({
  title,
  description,
  instructions,
  onFileUpload,
  uploadedFiles,
  uploadError,
  onContinue,
  isSubmitting,
  onRemoveFile,
}: ChatWindowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localFiles, setLocalFiles] = useState<string[]>([]);

  const processFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files);
      setLocalFiles((prev) => [...prev, ...arr.map((f) => f.name)]);
      onFileUpload(arr);
    },
    [onFileUpload]
  );

  const handleFileSelect = (files: FileList | null) => processFiles(files);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    processFiles(e.dataTransfer.files);
  };

  const cleanInstructions = (instructions || '').replace(/\*\*/g, '').trim();
  const hasInstructions = cleanInstructions.length > 0;
  const instructionSections = hasInstructions ? cleanInstructions.split('\n\n') : [];
  const allFiles = [...uploadedFiles, ...localFiles];
  const visibleFiles = allFiles.slice(0, 3);
  const extraCount = allFiles.length - visibleFiles.length;

  const renderLine = (line: string, key: number) => {
    const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      return (
        <p key={key} className="text-slate-200/90">
          {line}
        </p>
      );
    }
    const [url] = urlMatch;
    const [before, after] = line.split(url);
    return (
      <p key={key} className="text-slate-200/90">
        {before}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-300 underline decoration-teal-500/60 underline-offset-4 transition-colors hover:text-teal-200"
        >
          {url}
        </a>
        {after}
      </p>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04060d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-[-45%] bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.2),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_50%_75%,rgba(16,185,129,0.16),transparent_32%)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-6 md:px-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-teal-100/80">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />
            <span>Quantum Intake</span>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-teal-100/70">Upload • Secure • Guided</p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
            {description && (
              <p className="max-w-3xl text-lg text-slate-200/85">
                {description}
              </p>
            )}
          </div>
        </header>

        <div className="grid items-start gap-6 md:grid-cols-[1.15fr_0.85fr] md:gap-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 md:p-8 shadow-[0_25px_120px_-40px_rgba(0,0,0,0.75)]">
            {hasInstructions && (
              <div className="rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-transparent p-5 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-teal-200">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l3 3" />
                    </svg>
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-semibold text-teal-100">Files we need to craft your blueprint</p>
                    {instructionSections.map((section, idx) => {
                      const lines = section.split('\n');
                      const heading = lines[0]?.trim() || '';
                      const content = lines.slice(1);
                      return (
                        <div key={idx} className="space-y-2">
                          {heading && (
                            <p className="text-sm font-semibold text-white/90">
                              {heading.replace(/\*\*/g, '')}
                            </p>
                          )}
                          <div className="space-y-1.5">
                            {content.map((line, i) => renderLine(line, i))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div
              className={`mt-5 rounded-2xl border bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-5 md:p-6 transition ${
                dragActive ? 'border-teal-400/70 bg-teal-500/10' : 'border-white/10'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1 space-y-1">
                  <p className="text-base font-semibold text-white">Drag & drop or browse</p>
                  <p className="text-sm text-slate-400">PDF, PNG, or JPG • You can upload multiple files</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12l2 2 6-6" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4 4 12-12" />
                    </svg>
                    Attach file
                  </button>
                  <button
                    onClick={onContinue}
                    disabled={(uploadedFiles.length === 0 && localFiles.length === 0) || isSubmitting}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white shadow-[0_15px_45px_-18px_rgba(20,184,166,0.75)] transition hover:scale-105 hover:shadow-[0_18px_50px_-16px_rgba(20,184,166,0.85)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {isSubmitting ? (
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="sr-only"
              />
            </div>

            {uploadError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {uploadError}
              </div>
            )}

            {allFiles.length > 0 && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-300/80">
                  <span>Files ready</span>
                  <span>{allFiles.length}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                  {visibleFiles.map((file, i) => {
                    const isUploaded = uploadedFiles.includes(file);
                    return (
                      <div
                        key={i}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-white whitespace-nowrap"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 12l4 4L19 6" />
                          </svg>
                        </span>
                        <span className="max-w-[180px] truncate">{file.split('/').pop()}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isUploaded && onRemoveFile) {
                              onRemoveFile(file);
                            } else {
                              setLocalFiles((prev) => prev.filter((f) => f !== file));
                            }
                          }}
                          className="text-slate-200/80 hover:text-red-300"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  {extraCount > 0 && (
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-slate-200/80">
                      +{extraCount} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-teal-500/20 bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent p-6 md:p-7 backdrop-blur-2xl shadow-[0_18px_80px_-32px_rgba(16,185,129,0.45)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-teal-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-teal-100/70">Blueprint Context</p>
                <p className="text-base font-semibold text-white">Upload both charts</p>
              </div>
            </div>
            <p className="text-sm text-slate-100/90">
              We’ll extract placements and human design attributes directly from your charts to personalize your Quantum Brand Identity blueprint.
            </p>
            <div className="flex items-center gap-3 text-sm text-slate-200/85">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-emerald-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-white">Secure & private</p>
                <p className="text-xs text-slate-300/80">Files stay within your workspace and are only used to generate your blueprint.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
