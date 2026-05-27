'use client';

import { useEffect, useRef, useState } from 'react';

type Reason = 'tedious' | 'unclear' | 'other';

interface FrictionFlagProps {
  productSessionId: string;
  productSlug: string;
  stepIndex: number;
  /** Optional current draft response — only the first 200 chars are sent. */
  draftResponse?: string;
}

const REASON_OPTIONS: { value: Reason; label: string; description: string }[] = [
  { value: 'tedious', label: 'Too tedious', description: 'This step takes too long or feels like busywork.' },
  { value: 'unclear', label: 'Unclear', description: 'The question or instructions are confusing.' },
  { value: 'other', label: 'Something else', description: 'A different friction I want to share.' },
];

/**
 * Small, unobtrusive flag-this-step button. Opens a popover with three reasons,
 * an optional note, and submits to POST /api/step-friction. After a successful
 * submit, shows a tiny "Flagged" confirmation for 5 seconds, then resets so the
 * user can flag again if needed.
 *
 * Purely additive UI — does not alter step rendering, AI follow-ups, or
 * deliverable generation.
 */
export function FrictionFlag({
  productSessionId,
  productSlug,
  stepIndex,
  draftResponse,
}: FrictionFlagProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('tedious');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Auto-reset the "Flagged" pill after 5s
  useEffect(() => {
    if (!flagged) return;
    const timer = setTimeout(() => setFlagged(false), 5000);
    return () => clearTimeout(timer);
  }, [flagged]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const responseExcerpt =
        typeof draftResponse === 'string' && draftResponse.trim().length > 0
          ? draftResponse.trim().slice(0, 200)
          : undefined;

      const res = await fetch('/api/step-friction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSessionId,
          productSlug,
          stepIndex,
          reason,
          note: note.trim().length > 0 ? note.trim() : undefined,
          responseExcerpt,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed to flag (${res.status})`);
      }

      // Reset form state and confirm
      setNote('');
      setReason('tedious');
      setOpen(false);
      setFlagged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (flagged) return;
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-gray-600"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Flag friction with this step"
      >
        {flagged ? (
          <>
            <CheckIcon />
            <span>Flagged</span>
          </>
        ) : (
          <>
            <FlagIcon />
            <span>Flag this step</span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Flag this step"
          className="absolute right-0 bottom-full mb-2 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-4 text-left"
        >
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">What's the friction?</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Helps us improve this step for the next person.
            </p>
          </div>

          <fieldset className="space-y-2 mb-3">
            <legend className="sr-only">Reason</legend>
            {REASON_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  reason === opt.value
                    ? 'border-teal-500/50 bg-teal-500/5'
                    : 'border-gray-700/60 hover:border-gray-600 hover:bg-white/5'
                }`}
              >
                <input
                  type="radio"
                  name="friction-reason"
                  value={opt.value}
                  checked={reason === opt.value}
                  onChange={() => setReason(opt.value)}
                  className="mt-0.5 accent-teal-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-200">{opt.label}</div>
                  <div className="text-[11px] text-gray-500 leading-snug">{opt.description}</div>
                </div>
              </label>
            ))}
          </fieldset>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="friction-note">
              Note <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="friction-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anything specific you'd like us to know?"
              className="w-full text-xs bg-gray-800/80 border border-gray-700 rounded-md px-2 py-1.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 resize-none"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-md text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlagIcon() {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21V5a2 2 0 012-2h11l-1.5 4L16 11H5v10"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
      className="text-teal-400"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default FrictionFlag;
