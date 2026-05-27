"use client";

import { useReveal } from "@/hooks/useReveal";

export default function Hero() {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("hero")}
      data-section="hero"
      className="min-h-screen relative flex items-center px-8 md:px-16 lg:px-24 ioa-classified-grid"
    >
      <div
        className={`ioa-reveal ${isRevealed("hero") ? "visible" : ""} max-w-6xl relative z-20 pt-24`}
      >
        <div className="mb-12 flex items-center gap-4 text-[10px] tracking-[0.3em] text-[#888]">
          <div className="w-12 h-px bg-[#d4a574]"></div>
          <span>QUANTUM STRATEGIES — METHODOLOGY DOCUMENT</span>
        </div>

        <h1
          className="ioa-serif leading-[0.95] mb-8 tracking-tight"
          style={{ fontSize: "clamp(56px, 8vw, 128px)" }}
        >
          The Inner-Outer
          <br />
          <span className="italic text-[#d4a574]">Alignment Method</span>
        </h1>

        <div className="grid md:grid-cols-2 gap-12 mt-16 max-w-4xl">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-3">
              // PREMISE
            </div>
            <p className="ioa-serif text-2xl md:text-3xl leading-snug text-[#e8e6e0]">
              Every internal state has a precise external signature. Every external posture installs a corresponding internal state.
            </p>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-3">
              // CONSEQUENCE
            </div>
            <p className="ioa-serif text-2xl md:text-3xl leading-snug text-[#e8e6e0]">
              Map both. Anchor the loop. You can program the human operating system on demand, situation by situation.
            </p>
          </div>
        </div>

        <div className="mt-24 flex items-center gap-6 text-[11px] tracking-widest text-[#666]">
          <span>↓</span>
          <span>SCROLL TO ENTER THE SYSTEM</span>
        </div>
      </div>
    </section>
  );
}
