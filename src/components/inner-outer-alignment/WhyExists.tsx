"use client";

import SectionLabel from "./SectionLabel";
import { useReveal } from "@/hooks/useReveal";

const ALIGNMENT_PILLARS = [
  {
    glyph: "∇",
    label: "INNER",
    body: "Self as Signal. Identity, values, neurological state. The transmitter.",
  },
  {
    glyph: "≈",
    label: "OUTER",
    body: "Body as Architecture. Gesture, posture, voice, expression. The signal made physical.",
  },
  {
    glyph: "⊕",
    label: "ALIGNMENT",
    body: "The closed loop. When inner and outer are coherent, output amplifies. When they diverge, signal degrades.",
  },
];

export default function WhyExists() {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("why")}
      data-section="why"
      className="min-h-screen px-8 md:px-16 lg:px-24 py-32 border-t border-[#d4a574]/10"
    >
      <div className="max-w-6xl">
        <div className={`ioa-reveal ${isRevealed("why") ? "visible" : ""} mb-16`}>
          <SectionLabel number="02" label="WHY IT NEEDS TO EXIST" />
          <h2 className="ioa-serif text-5xl md:text-7xl leading-tight">
            Behavior becomes automatic.
            <br />
            <span className="italic">This is how you decide what gets automated.</span>
          </h2>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-1 ${
            isRevealed("why") ? "visible" : ""
          } grid md:grid-cols-2 gap-16 mb-24`}
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-4">
              // THE MECHANISM
            </div>
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              The nervous system automates everything it repeats. That is not a flaw — it is the architecture. Conscious effort installs the pattern. The body runs it without you.
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              The phone reaches your hand before your feet hit the floor. You walk into a meeting carrying the residue of the last one. These are not failures of willpower. They are automated programs running exactly as designed — programs you never consciously chose.
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb]">
              The question is never whether your behavior will automate. It will. The question is whether you did the installation, or your environment did it for you.
            </p>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-4">
              // THE GAP
            </div>
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              Self-help teaches mindset. Behavioral science explains the patterns. Body language guides decode others. NLP installs anchors. None of these systems hand you a complete situational map.
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              None connect the ideal internal state to its external signature to the precise installation protocol — for every situation you actually encounter across your 120 weekly hours.
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb]">
              That is the gap. This manual closes it — situation by situation, domain by domain, until the right states run automatically.
            </p>
          </div>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-2 ${
            isRevealed("why") ? "visible" : ""
          } border-t border-[#d4a574]/30 pt-16`}
        >
          <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-4">
            // THE QUANTUM STRATEGIES POSITION
          </div>
          <h3 className="ioa-serif text-4xl md:text-5xl leading-tight mb-8 max-w-4xl">
            Inner-outer alignment is not a metaphor.
            <br />
            <span className="italic text-[#d4a574]">It is the methodology.</span>
          </h3>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {ALIGNMENT_PILLARS.map((item) => (
              <div key={item.label} className="border-l border-[#d4a574]/30 pl-6">
                <div className="ioa-serif text-5xl mb-3 text-[#d4a574]">
                  {item.glyph}
                </div>
                <div className="text-[10px] tracking-[0.3em] text-[#888] mb-2">
                  {item.label}
                </div>
                <p className="text-sm leading-relaxed text-[#c9c5bb]">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="text-lg leading-relaxed text-[#c9c5bb] mt-12 max-w-3xl">
            Quantum Strategies&apos; work is alignment work. The Three Rites diagnose where alignment has broken. The 15 Laws rebuild the architecture. The Inner-Outer Alignment Method is the operating manual that runs on top — situation by situation, across the 120 weekly hours of a human life.
          </p>
        </div>
      </div>
    </section>
  );
}
