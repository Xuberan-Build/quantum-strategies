"use client";

import { useState, useEffect, type ReactNode } from "react";

interface DossierShellProps {
  children: ReactNode;
}

/**
 * Dossier shell — film-grain overlay, scan-line, and a sticky status bar
 * with a live scroll-percentage indicator. Mirrors the source project's
 * Layout.jsx but sits below the portal's fixed Navbar.
 */
export default function DossierShell({ children }: DossierShellProps) {
  const [scrollY, setScrollY] = useState(0);
  const [scrollMax, setScrollMax] = useState(1);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleResize = () => {
      setScrollMax(
        Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      );
    };

    handleResize();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const scrollPct = String(
    Math.min(99, Math.floor((scrollY / scrollMax) * 100))
  ).padStart(2, "0");

  return (
    <div className="ioa-grain">
      {/* Sticky dossier status bar — offset below portal Navbar (~64px). */}
      <div
        className="sticky z-30 px-8 py-3 flex justify-between items-center text-[10px] tracking-[0.3em] text-[#666] border-b border-[#d4a574]/10 bg-[#0a0908]/80 backdrop-blur-sm"
        style={{ top: "64px" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-[#d4a574] ioa-pulse-line"></div>
          <span>QS / DOSSIER 001</span>
        </div>
        <div className="flex gap-8">
          <span className="hidden md:inline">CLASSIFICATION : INTERNAL</span>
          <span>{scrollPct}%</span>
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="ioa-scan-line absolute w-full h-32 bg-gradient-to-b from-transparent via-[#d4a574]/[0.015] to-transparent"></div>
      </div>

      {children}
    </div>
  );
}
