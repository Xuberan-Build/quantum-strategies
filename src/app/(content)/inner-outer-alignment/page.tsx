import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/navigation/Navbar";
import DossierShell from "@/components/inner-outer-alignment/DossierShell";
import Hero from "@/components/inner-outer-alignment/Hero";
import WhatItIs from "@/components/inner-outer-alignment/WhatItIs";
import WhyExists from "@/components/inner-outer-alignment/WhyExists";
import ResearchFoundation from "@/components/inner-outer-alignment/ResearchFoundation";
import CoreStatesSection from "@/components/inner-outer-alignment/CoreStatesSection";
import TAOTableSection from "@/components/inner-outer-alignment/TAOTableSection";
import ProofPhase from "@/components/inner-outer-alignment/ProofPhase";
import { getActiveSituations } from "@/lib/tao/fetch";
import styles from "./inner-outer-alignment.module.css";

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-ioa-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-ioa-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "Inner-Outer Alignment Method — A behavioral operating manual | Quantum Strategies",
  description:
    "The Inner-Outer Alignment Method maps 172 life situations across 22 domains with 516 encoded variants. Every situation receives a 7-layer profile — identity, submodality, language, FATE, BTE, variance, and protocol — grounded in polyvagal theory, interoception, predictive processing, and ultradian rhythms.",
  alternates: {
    canonical: "https://quantumstrategies.online/inner-outer-alignment/",
  },
};

export default async function InnerOuterAlignmentPage() {
  const situations = await getActiveSituations();

  return (
    <div
      className={`${styles.page} ${cormorantGaramond.variable} ${jetbrainsMono.variable}`}
    >
      <Navbar />

      <DossierShell>
        <Hero />
        <WhatItIs />
        <WhyExists />
        <ResearchFoundation />
        <CoreStatesSection />
        <TAOTableSection situations={situations} />
        <ProofPhase />

        <footer className="px-8 md:px-16 lg:px-24 py-8 border-t border-[#d4a574]/10 flex flex-col md:flex-row justify-between gap-4 text-[10px] tracking-[0.3em] text-[#666]">
          <div>© QUANTUM STRATEGIES / 2026</div>
          <div className="flex gap-8">
            <span>DOSSIER 001</span>
            <span>THE ASCENDING OPERATOR</span>
            <span>RESEARCH-GROUNDED</span>
          </div>
        </footer>
      </DossierShell>
    </div>
  );
}
