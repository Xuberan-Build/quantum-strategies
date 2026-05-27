"use client";

import SectionLabel from "./SectionLabel";
import TAOTable from "./TAOTable";
import { useReveal } from "@/hooks/useReveal";
import type { TaoSituation } from "@/data/tao";

interface TAOTableSectionProps {
  situations?: TaoSituation[];
}

export default function TAOTableSection({ situations = [] }: TAOTableSectionProps) {
  const [setRef, isRevealed] = useReveal();

  return (
    <section
      ref={setRef("tao-table")}
      data-section="tao-table"
      className="min-h-screen px-8 md:px-16 lg:px-24 py-32 border-t border-[#d4a574]/10"
    >
      <div className="max-w-7xl">
        <div
          className={`ioa-reveal ${isRevealed("tao-table") ? "visible" : ""} mb-12`}
        >
          <SectionLabel number="05" label="172 SITUATIONS · 22 DOMAINS" />
          <h2
            className="ioa-serif text-5xl md:text-7xl leading-tight mb-6"
            style={{ fontFamily: "var(--font-ioa-serif), 'Cormorant Garamond', Georgia, serif" }}
          >
            The full map,
            <br />
            <span className="italic">in practice.</span>
          </h2>
          <p className="text-lg leading-relaxed text-[#c9c5bb] max-w-2xl">
            172 life situations encoded across 22 domains. Filter by domain or FATE driver. Click any situation to expand the full TAO entry.
          </p>
        </div>

        <div
          className={`ioa-reveal ioa-stagger-1 ${
            isRevealed("tao-table") ? "visible" : ""
          }`}
        >
          <TAOTable situations={situations} />
        </div>
      </div>
    </section>
  );
}
