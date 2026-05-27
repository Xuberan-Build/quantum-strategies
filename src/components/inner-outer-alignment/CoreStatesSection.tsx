"use client";

import SectionLabel from "./SectionLabel";
import CoreStateViz from "./CoreStateViz";
import { CORE_STATES } from "@/data/coreStates";
import { useReveal } from "@/hooks/useReveal";

export default function CoreStatesSection() {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("states")}
      data-section="states"
      className="min-h-screen px-8 md:px-16 lg:px-24 py-32 border-t border-[#d4a574]/10"
    >
      <div className="max-w-6xl">
        <div className={`ioa-reveal ${isRevealed("states") ? "visible" : ""} mb-16`}>
          <SectionLabel number="04" label="THE FIVE CORE STATES" />
          <h2 className="ioa-serif text-5xl md:text-7xl leading-tight mb-8">
            Every value traces back
            <br />
            <span className="italic">to one of five states.</span>
          </h2>
          <p className="text-lg leading-relaxed text-[#c9c5bb] max-w-3xl mb-4">
            In 1989, Connirae and Tamara Andreas discovered through thousands of NLP sessions that when you ask any value chain &quot;what do you want through having that?&quot; repeatedly, every chain terminates in one of five universal states.
          </p>
          <p className="text-lg leading-relaxed text-[#c9c5bb] max-w-3xl">
            These are not strategies. They are the destination every strategy is reaching for. Click any state to explore it.
          </p>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-1 ${
            isRevealed("states") ? "visible" : ""
          } mb-16`}
        >
          <CoreStateViz />
        </div>

        <div
          className={`ioa-reveal ioa-stagger-2 ${
            isRevealed("states") ? "visible" : ""
          }`}
        >
          <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-4">
            // TIER I DISTRIBUTION
          </div>
          <p className="text-base leading-relaxed text-[#c9c5bb] mb-6 max-w-3xl">
            How the 13 priority situations distribute across the Five Core States. The pattern is diagnostic in itself.
          </p>
          <div className="space-y-px bg-[#d4a574]/20 border border-[#d4a574]/20">
            {CORE_STATES.map((cs, i) => (
              <div
                key={cs.id}
                className="bg-[#0a0908] p-6 grid md:grid-cols-12 gap-4 hover:bg-[#0f0d0b] transition-colors items-center"
              >
                <div className="md:col-span-3 flex items-center gap-4">
                  <span
                    className="ioa-serif text-3xl"
                    style={{ color: cs.color }}
                  >
                    {cs.glyph}
                  </span>
                  <span className="ioa-serif text-xl">{cs.name}</span>
                </div>
                <div className="md:col-span-1">
                  <span className="ioa-serif text-3xl text-[#d4a574]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-[#c9c5bb] mb-1">
                    {cs.situations.join(", ")}
                  </p>
                  <p className="text-xs text-[#888] italic">{cs.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
