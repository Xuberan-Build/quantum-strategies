"use client";

import SectionLabel from "./SectionLabel";
import { useReveal } from "@/hooks/useReveal";

interface Phase {
  phase: string;
  title: string;
  duration: string;
  body: string;
}

const PHASES: Phase[] = [
  {
    phase: "Phase 01",
    title: "Install",
    duration: "30 — 60 days",
    body: "Deploy Tier I protocols across actual life. Document outputs, others' responses, internal experience. Refine based on real-world feedback.",
  },
  {
    phase: "Phase 02",
    title: "Validate",
    duration: "60 — 90 days",
    body: "Expand to Tier II. Test transferability — does the methodology work for others? Run small group pilot through Quantum Strategies channels.",
  },
  {
    phase: "Phase 03",
    title: "Scale",
    duration: "90+ days",
    body: "Productize: reference manual, Claude-powered diagnostic drilldown, structured curriculum. Position within Quantum Strategies state management vertical.",
  },
];

export default function ProofPhase() {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("proof")}
      data-section="proof"
      className="min-h-screen px-8 md:px-16 lg:px-24 py-32 border-t border-[#d4a574]/10"
    >
      <div className="max-w-6xl">
        <div className={`ioa-reveal ${isRevealed("proof") ? "visible" : ""} mb-16`}>
          <SectionLabel number="06" label="THE WORK" />
          <h2 className="ioa-serif text-5xl md:text-7xl leading-tight">
            Personal proof first.
            <br />
            <span className="italic">Productization second.</span>
          </h2>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-1 ${
            isRevealed("proof") ? "visible" : ""
          } grid md:grid-cols-3 gap-8`}
        >
          {PHASES.map((p) => (
            <div
              key={p.phase}
              className="border border-[#d4a574]/20 p-8 hover:border-[#d4a574]/50 transition-colors bg-[#0f0d0b]"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="text-[10px] tracking-[0.3em] text-[#d4a574]">
                  {p.phase}
                </div>
                <div className="text-[10px] tracking-widest text-[#666]">
                  {p.duration}
                </div>
              </div>
              <h3 className="ioa-serif text-4xl mb-4">{p.title}</h3>
              <p className="text-sm leading-relaxed text-[#c9c5bb]">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#d4a574]/10 mt-24 pt-8 grid md:grid-cols-2 gap-8">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[#888] mb-2">
              QUANTUM STRATEGIES
            </div>
            <p className="ioa-serif text-xl text-[#c9c5bb]">
              Inner-Outer Alignment Method — Methodology Document v2.1
            </p>
          </div>
          <div className="md:text-right">
            <div className="text-[10px] tracking-[0.3em] text-[#888] mb-2">
              PREPARED BY
            </div>
            <p className="ioa-serif text-xl text-[#c9c5bb]">
              Austin Santos / Initiator
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
