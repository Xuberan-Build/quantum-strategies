"use client";

import SectionLabel from "./SectionLabel";
import { useReveal } from "@/hooks/useReveal";

interface ResearchEntry {
  code: string;
  name: string;
  authors: string;
  layer: string;
  body: string;
}

const RESEARCH: ResearchEntry[] = [
  {
    code: "IAB",
    name: "Identity-Behavior Automaticity",
    authors: "Graybiel · Wood & Neal",
    layer: "Layer 1",
    body: "The nervous system automates behavior at the identity level, not the habit level. Installing the correct identity encoding for a situation is the highest-leverage intervention point — the behavior cascade follows without requiring willpower at each step.",
  },
  {
    code: "PVT",
    name: "Polyvagal Theory",
    authors: "Stephen Porges",
    layer: "Tier Structure",
    body: "The three-tier structure maps directly to vagal tone. Tier I situations run on the ventral vagal (safe/social) circuit. Tier II activates sympathetic mobilization edges. Tier III approaches dorsal vagal collapse states. Protocol intensity scales with the nervous system load the situation actually produces.",
  },
  {
    code: "INT",
    name: "Interoception",
    authors: "Craig · Damasio",
    layer: "Layer 2",
    body: "The felt sense of body state is not metaphor — it is the primary mechanism of state change. Interoceptive accuracy predicts emotional regulation capacity. Layer 2 kinesthetic encoding installs the correct somatic prior, not a description of it.",
  },
  {
    code: "SBT",
    name: "Social Baseline Theory",
    authors: "James Coan",
    layer: "Domains 08–09 · 14 · 18–19",
    body: "The nervous system treats social proximity as its default resource state. Every relational domain entry is calibrated to restore co-regulation rather than perform connection. The somatic baseline for relational situations is physiologically different from solo situations — the protocol reflects this.",
  },
  {
    code: "PP",
    name: "Predictive Processing",
    authors: "Friston · Clark",
    layer: "Submodality Encoding",
    body: "The brain runs continuous forward models and updates on prediction error. Submodality encoding installs priors that shape perception before sensory input arrives. This is the neuroscientific basis for why anchoring and identity-frame installation work — they load the prediction, not the response.",
  },
  {
    code: "UR",
    name: "Ultradian Rhythms",
    authors: "Kleitman · Rossi",
    layer: "Layer 7",
    body: "Biological performance cycles run at approximately 90-minute intervals throughout the day. Layer 7 protocol timing is not arbitrary — it is calibrated to sync pre/during/post session sequencing with natural ultradian windows. Installation during the ascending phase of a cycle produces deeper encoding.",
  },
  {
    code: "AL",
    name: "Allostatic Load",
    authors: "McEwen · Sterling & Eyer",
    layer: "Layer 4C — BTE",
    body: "Chronic state drift accumulates measurable biological cost across cardiovascular, neuroendocrine, and immune systems. BTE element mapping connects to allostatic load contributors — making re-entry not just behavioral but metabolic. State management at this level is health intervention, not self-help.",
  },
  {
    code: "NDX",
    name: "ND + CNM Research",
    authors: "Diverse literature",
    layer: "Inline Flags",
    body: "Neurodivergent processing differences (ADHD, autism-spectrum) and consensual non-monogamy relational structures receive inline notation in relevant situations. Standard protocol sequencing may require modification — these flags mark where the default encoding assumption breaks and an alternate route is needed.",
  },
];

export default function ResearchFoundation() {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("research")}
      data-section="research"
      className="min-h-screen px-8 md:px-16 lg:px-24 py-32 border-t border-[#d4a574]/10"
    >
      <div className="max-w-6xl">
        <div className={`ioa-reveal ${isRevealed("research") ? "visible" : ""} mb-16`}>
          <SectionLabel number="03" label="RESEARCH FOUNDATION" />
          <h2 className="ioa-serif text-5xl md:text-7xl leading-tight">
            Every claim
            <br />
            <span className="italic">has a mechanism.</span>
          </h2>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-1 ${
            isRevealed("research") ? "visible" : ""
          } mb-16`}
        >
          <p className="text-lg leading-relaxed text-[#c9c5bb] max-w-3xl">
            The method is built on eight research frameworks, each assigned a specific structural role. Not cited for credibility — each one explains a different mechanical layer of why the protocol works.
          </p>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-2 ${
            isRevealed("research") ? "visible" : ""
          } space-y-px bg-[#d4a574]/10`}
        >
          {RESEARCH.map((r) => (
            <div
              key={r.code}
              className="bg-[#0a0908] grid md:grid-cols-12 gap-0 group hover:bg-[#0f0d0b] transition-colors"
            >
              <div className="md:col-span-2 p-6 border-r border-[#d4a574]/10 flex flex-col justify-between">
                <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-2">
                  {r.code}
                </div>
                <div className="text-[9px] tracking-widest text-[#555] mt-auto">
                  {r.layer}
                </div>
              </div>

              <div className="md:col-span-3 p-6 border-r border-[#d4a574]/10 flex flex-col justify-between">
                <p className="ioa-serif text-xl leading-snug text-[#e8e6e0] mb-2">
                  {r.name}
                </p>
                <p className="text-[9px] tracking-widest text-[#666]">{r.authors}</p>
              </div>

              <div className="md:col-span-7 p-6">
                <p className="text-sm leading-relaxed text-[#a8a49b]">{r.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`ioa-reveal ioa-stagger-3 ${
            isRevealed("research") ? "visible" : ""
          } mt-16 pt-8 border-t border-[#d4a574]/10`}
        >
          <p className="text-sm leading-relaxed text-[#666] max-w-3xl">
            These frameworks are integrated across all 172 situations and 516 variants — not applied generically, but calibrated to the specific nervous system demand each situation produces. The result is a protocol stack that is simultaneously behavioral, neurological, and somatic.
          </p>
        </div>
      </div>
    </section>
  );
}
