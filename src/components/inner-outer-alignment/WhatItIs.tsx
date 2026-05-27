"use client";

import SectionLabel from "./SectionLabel";
import { useReveal } from "@/hooks/useReveal";

const SCOPE_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["DOMAINS", "22"],
  ["SITUATIONS", "172"],
  ["VARIANTS", "516"],
  ["RESEARCH LAYERS", "07"],
  ["CORE STATES", "05"],
  ["WEEKLY HOURS COVERED", "168"],
];

const PILLARS = [
  {
    num: "01–02",
    title: "Identity + Submodality",
    body: "Who you are in this situation — the being, the Logical Levels profile, and the full submodality code that makes the state neurologically real and reproducible.",
  },
  {
    num: "03–04",
    title: "Language + FATE + BTE",
    body: "Internal predicates, re-entry phrase, FATE motivational analysis, BTE behavioral signature with confirming and conflicting signals, DIAMONDS depth map, and somatic depth layer — breath, arousal, facial signals, tension cascade, body language, internal voice, and gaze.",
  },
  {
    num: "05–07",
    title: "Variance + Protocol",
    body: "Situation-specific drift scenarios with re-entry routing, personalization scaffolding from the Three Rites, and a complete executable pre/during/post session protocol.",
  },
];

export default function WhatItIs() {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("what")}
      data-section="what"
      className="min-h-screen px-8 md:px-16 lg:px-24 py-32 border-t border-[#d4a574]/10"
    >
      <div className="max-w-6xl">
        <div className={`ioa-reveal ${isRevealed("what") ? "visible" : ""} mb-16`}>
          <SectionLabel number="01" label="WHAT IT IS" />
          <h2 className="ioa-serif text-5xl md:text-7xl leading-tight">
            A behavioral
            <br />
            operating manual.
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-8 mb-24">
          <div
            className={`md:col-span-7 ioa-reveal ioa-stagger-1 ${
              isRevealed("what") ? "visible" : ""
            }`}
          >
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              The Inner-Outer Alignment Method is a precision reference manual mapping{" "}
              <span className="text-[#d4a574]">172 life situations</span> across{" "}
              <span className="text-[#d4a574]">22 domains</span> — with{" "}
              <span className="text-[#d4a574]">516 encoded variants</span>.
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              Every situation receives a complete 7-layer profile: research-grounded identity frame, submodality encoding, internal language patterns, FATE motivational analysis, variance protocols, personalization scaffolding, and an executable anchor protocol.
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb] mb-6">
              Built on three integrated frameworks — the Behavioral Table of Elements (Chase Hughes), NLP submodality science and Dilts Logical Levels (Bandler, Grinder, Dilts), and the FATE influence system (Fear, Authority, Trust, Ego).
            </p>
            <p className="text-lg leading-relaxed text-[#c9c5bb]">
              Each situation includes a full somatic depth layer: breath signature, arousal calibration, facial signal map (lips, jaw, brow, symmetry), tension cascade sequence, body language encoding, internal voice patterns, and gaze — all internally observable, all situation-specific.
            </p>
          </div>

          <div
            className={`md:col-span-5 ioa-reveal ioa-stagger-2 ${
              isRevealed("what") ? "visible" : ""
            }`}
          >
            <div className="border border-[#d4a574]/30 p-8 bg-[#0f0d0b]">
              <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-6">
                // SCOPE
              </div>
              <div className="space-y-4 text-sm">
                {SCOPE_ROWS.map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between border-b border-[#d4a574]/10 pb-3"
                  >
                    <span className="text-[#888]">{label}</span>
                    <span className="ioa-serif text-2xl">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-3 ${
            isRevealed("what") ? "visible" : ""
          } grid md:grid-cols-3 gap-px bg-[#d4a574]/20 border border-[#d4a574]/20`}
        >
          {PILLARS.map((item) => (
            <div
              key={item.num}
              className="bg-[#0a0908] p-10 hover:bg-[#0f0d0b] transition-colors"
            >
              <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-6">
                {item.num}
              </div>
              <h3 className="ioa-serif text-3xl mb-4">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[#a8a49b]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
