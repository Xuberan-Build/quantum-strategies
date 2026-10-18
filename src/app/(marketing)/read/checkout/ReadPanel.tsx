import type { ReactNode } from 'react';

/** Plain centred card for the Read's utility pages (checkout bridge, email answers, unsubscribe). */
export default function ReadPanel({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <div className="min-h-[70vh] bg-[#0b000f] text-[#F8F5FF] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 shadow-xl">
        {eyebrow && <p className="mb-2 text-xs uppercase tracking-widest text-[#b9adff]">{eyebrow}</p>}
        <h1 className="mb-4 text-2xl font-semibold leading-snug">{title}</h1>
        <div className="space-y-4 text-[15px] leading-relaxed text-white/85">{children}</div>
      </div>
    </div>
  );
}

export const buttonClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-[#6C5CE7] px-5 py-3 font-semibold text-white transition hover:bg-[#5b4bd6] disabled:opacity-60';
export const linkClass = 'text-[#b9adff] underline underline-offset-2 hover:text-white';
