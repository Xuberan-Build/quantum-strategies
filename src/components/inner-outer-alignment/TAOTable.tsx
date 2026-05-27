"use client";

import { useState, useEffect } from "react";
import {
  TAO_DOMAINS,
  FATE_COLORS,
  DOMAIN_COLORS,
  type FateDriver,
  type TaoSituation,
} from "@/data/tao";

interface TAOTableProps {
  situations?: TaoSituation[];
}

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: "#d4a574",
  2: "#888",
  3: "#555",
};
const FATE_DRIVERS: FateDriver[] = ["Fear", "Authority", "Trust", "Ego"];

type View = "situation" | "bte";
type DomainFilter = "ALL" | string;
type FateFilter = "ALL" | FateDriver;

interface SituationCardProps {
  s: TaoSituation;
  isSelected: boolean;
  view: View;
  onClick: () => void;
}

function SituationCard({ s, isSelected, view, onClick }: SituationCardProps) {
  const domainColor = DOMAIN_COLORS[s.domain] ?? "#666";
  const fateColor = s.fate ? FATE_COLORS[s.fate] : "#888";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer flex flex-col relative transition-all duration-150"
      style={{
        background: isSelected ? "#141210" : "#0f0d0b",
        border: isSelected ? `1px solid ${domainColor}80` : "1px solid #1e1c1a",
        borderLeft: isSelected ? `2px solid ${domainColor}` : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = `${domainColor}50`;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = "#1e1c1a";
      }}
    >
      <div className="p-3 flex-1">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] tracking-widest text-[#555]">{s.id}</span>
          <span
            className="text-[10px] tracking-widest"
            style={{ color: TIER_COLORS[s.tier] }}
          >
            T{s.tier}
          </span>
        </div>
        <p className="text-xs text-[#c9c5bb] leading-snug mb-3 line-clamp-2">
          {s.name}
        </p>
        {view === "bte" && s.bteConfirming?.[0] && (
          <p className="text-[9px] text-[#9ab8a3] truncate">
            ✓ {s.bteConfirming[0].substring(0, 45)}…
          </p>
        )}
      </div>
      <div
        className="flex items-center gap-1.5 px-3 py-1.5"
        style={{ borderTop: "1px solid #1e1c1a" }}
      >
        <div
          className="h-1 w-4 flex-shrink-0"
          style={{ backgroundColor: fateColor }}
        />
        <span
          className="text-[9px] tracking-widest"
          style={{ color: fateColor }}
        >
          {s.fate ?? "—"}
        </span>
      </div>
    </div>
  );
}

interface ModalProps {
  s: TaoSituation;
  onClose: () => void;
}

function Modal({ s, onClose }: ModalProps) {
  const domainColor = DOMAIN_COLORS[s.domain] ?? "#d4a574";
  const fateColor = s.fate ? FATE_COLORS[s.fate] : "#888";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8"
      style={{
        backgroundColor: "rgba(10,9,8,0.85)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0d0b0a] border"
        style={{ borderColor: `${domainColor}30` }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-[#0d0b0a] z-10"
          style={{ borderColor: `${domainColor}20` }}
        >
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] tracking-widest text-[#555]">
              {s.id}
            </span>
            <h3
              className="text-lg text-[#e8e6e0]"
              style={{ fontFamily: "var(--font-ioa-serif), 'Cormorant Garamond', Georgia, serif" }}
            >
              {s.name}
            </h3>
            <span
              className="text-[10px] tracking-widest hidden md:inline"
              style={{ color: domainColor }}
            >
              {s.domain}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#e8e6e0] text-lg tracking-widest transition-colors px-2"
            aria-label="Close detail"
          >
            ✕
          </button>
        </div>

        <div className="p-6 md:p-8">
          {/* Top row: Being + Re-entry + FATE */}
          <div
            className="grid md:grid-cols-3 gap-6 mb-8 pb-8 border-b"
            style={{ borderColor: `${domainColor}15` }}
          >
            <div>
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-2">
                // BEING
              </div>
              <p
                className="text-2xl text-[#e8e6e0] italic leading-tight"
                style={{ fontFamily: "var(--font-ioa-serif), 'Cormorant Garamond', Georgia, serif" }}
              >
                &ldquo;{s.beingName ?? "—"}&rdquo;
              </p>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-2">
                // RE-ENTRY PHRASE
              </div>
              <div
                className="border-l-2 pl-4"
                style={{ borderColor: domainColor }}
              >
                <p
                  className="text-sm text-[#c9c5bb]"
                  style={{ fontFamily: "var(--font-ioa-mono), 'JetBrains Mono', monospace" }}
                >
                  {s.reEntryPhrase ?? "—"}
                </p>
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-2">
                // FATE DRIVER
              </div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 border mb-3"
                style={{
                  borderColor: `${fateColor}40`,
                  color: fateColor,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: fateColor }}
                />
                <span className="text-xs tracking-widest">{s.fate ?? "—"}</span>
              </div>
              <div className="text-[10px] text-[#555]">
                Tier {s.tier} · {s.variantCount} variants
              </div>
            </div>
          </div>

          {/* BTE Elements active */}
          {s.bteElements && (
            <div className="mb-6">
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-2">
                // ACTIVE BTE ELEMENTS
              </div>
              <p
                className="text-xs text-[#888]"
                style={{ fontFamily: "var(--font-ioa-mono), 'JetBrains Mono', monospace" }}
              >
                {s.bteElements}
              </p>
            </div>
          )}

          {/* Confirming / Conflicting */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-[#9ab8a3] mb-4">
                // CONFIRMING SIGNALS — STATE ON
              </div>
              <div className="space-y-3">
                {s.bteConfirming?.map((signal, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[#9ab8a3] text-xs mt-0.5 flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-sm text-[#c9c5bb] leading-relaxed">
                      {signal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-[#c0392b]/70 mb-4">
                // CONFLICTING SIGNALS — STATE OFF
              </div>
              <div className="space-y-3">
                {s.bteConflicting?.map((signal, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[#c0392b]/60 text-xs mt-0.5 flex-shrink-0">
                      ✗
                    </span>
                    <span className="text-sm text-[#888] leading-relaxed">
                      {signal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BTE Intervention Levers */}
          {s.bteLevers && s.bteLevers.length > 0 && (
            <div
              className="bg-[#0a0908] p-5 border"
              style={{ borderColor: `${domainColor}15` }}
            >
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-4">
                // BTE INTERVENTION LEVERS — FASTEST RE-ENTRY
              </div>
              <div className="space-y-3">
                {s.bteLevers.map((lever, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span
                      className="text-[10px] tracking-widest flex-shrink-0 mt-0.5"
                      style={{ color: domainColor }}
                    >
                      ▸
                    </span>
                    <span className="text-sm text-[#c9c5bb] leading-relaxed">
                      {lever}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kinesthetic body state */}
          {s.kinesthetic && (
            <div
              className="mt-6 pt-6 border-t"
              style={{ borderColor: `${domainColor}15` }}
            >
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-2">
                // SOMATIC IDEAL STATE (Layer 2)
              </div>
              <p className="text-sm text-[#888] italic">{s.kinesthetic}</p>
            </div>
          )}

          {/* Somatic Depth Layer */}
          {((s.somaticBreathOn?.length ?? 0) > 0 ||
            s.somaticTensionMap ||
            s.somaticArousalOn) && (
            <div
              className="mt-8 pt-8 border-t"
              style={{ borderColor: `${domainColor}15` }}
            >
              <div className="text-[10px] tracking-[0.3em] text-[#555] mb-6">
                // SOMATIC DEPTH LAYER — INTERNAL OBSERVATION
              </div>

              {/* Breath */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {(s.somaticBreathOn?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#9ab8a3] mb-3">
                      BREATH — STATE ON
                    </div>
                    <div className="space-y-2">
                      {s.somaticBreathOn?.map((sig, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-[#9ab8a3] text-[9px] mt-1 flex-shrink-0">
                            ◆
                          </span>
                          <span className="text-xs text-[#c9c5bb] leading-relaxed">
                            {sig}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(s.somaticBreathOff?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#c0392b]/60 mb-3">
                      BREATH — STATE OFF
                    </div>
                    <div className="space-y-2">
                      {s.somaticBreathOff?.map((sig, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-[#c0392b]/50 text-[9px] mt-1 flex-shrink-0">
                            ◆
                          </span>
                          <span className="text-xs text-[#888] leading-relaxed">
                            {sig}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Arousal Level */}
              {(s.somaticArousalOn || s.somaticArousalOff) && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {s.somaticArousalOn && (
                    <div>
                      <div className="text-[9px] tracking-[0.25em] text-[#9ab8a3] mb-2">
                        AROUSAL — STATE ON
                      </div>
                      <p className="text-xs text-[#c9c5bb] leading-relaxed">
                        {s.somaticArousalOn}
                      </p>
                    </div>
                  )}
                  {s.somaticArousalOff && (
                    <div>
                      <div className="text-[9px] tracking-[0.25em] text-[#c0392b]/60 mb-2">
                        AROUSAL — STATE OFF
                      </div>
                      <p className="text-xs text-[#888] leading-relaxed">
                        {s.somaticArousalOff}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Facial Signals */}
              {(s.somaticLipsOn || s.somaticJawOn || s.somaticBrowOn) && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#9ab8a3] mb-3">
                      FACIAL — STATE ON
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          ["Lips", s.somaticLipsOn],
                          ["Jaw", s.somaticJawOn],
                          ["Brow", s.somaticBrowOn],
                          ["Symmetry", s.somaticSymmetryOn],
                        ] as const
                      )
                        .filter(([, v]) => Boolean(v))
                        .map(([label, val]) => (
                          <div key={label} className="flex gap-2">
                            <span className="text-[9px] tracking-widest text-[#555] w-14 flex-shrink-0 mt-0.5">
                              {label}
                            </span>
                            <span className="text-xs text-[#c9c5bb] leading-relaxed">
                              {val}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#c0392b]/60 mb-3">
                      FACIAL — STATE OFF
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          ["Lips", s.somaticLipsOff],
                          ["Jaw", s.somaticJawOff],
                          ["Brow", s.somaticBrowOff],
                          ["Symmetry", s.somaticSymmetryOff],
                        ] as const
                      )
                        .filter(([, v]) => Boolean(v))
                        .map(([label, val]) => (
                          <div key={label} className="flex gap-2">
                            <span className="text-[9px] tracking-widest text-[#555] w-14 flex-shrink-0 mt-0.5">
                              {label}
                            </span>
                            <span className="text-xs text-[#888] leading-relaxed">
                              {val}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tension Map */}
              {s.somaticTensionMap && (
                <div
                  className="mb-6 p-4 border-l-2"
                  style={{
                    borderColor: `${domainColor}40`,
                    backgroundColor: `${domainColor}05`,
                  }}
                >
                  <div className="text-[9px] tracking-[0.25em] text-[#555] mb-2">
                    TENSION MAP — DRIFT SEQUENCE
                  </div>
                  <p className="text-xs text-[#a8a49b] leading-relaxed italic">
                    {s.somaticTensionMap}
                  </p>
                </div>
              )}

              {/* Body Language */}
              {((s.somaticBodyOn?.length ?? 0) > 0 ||
                (s.somaticBodyOff?.length ?? 0) > 0) && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {(s.somaticBodyOn?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-[9px] tracking-[0.25em] text-[#9ab8a3] mb-3">
                        BODY LANGUAGE — STATE ON
                      </div>
                      <div className="space-y-2">
                        {s.somaticBodyOn?.map((sig, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className="text-[#9ab8a3] text-[9px] mt-1 flex-shrink-0">
                              ◆
                            </span>
                            <span className="text-xs text-[#c9c5bb] leading-relaxed">
                              {sig}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(s.somaticBodyOff?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-[9px] tracking-[0.25em] text-[#c0392b]/60 mb-3">
                        BODY LANGUAGE — STATE OFF
                      </div>
                      <div className="space-y-2">
                        {s.somaticBodyOff?.map((sig, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className="text-[#c0392b]/50 text-[9px] mt-1 flex-shrink-0">
                              ◆
                            </span>
                            <span className="text-xs text-[#888] leading-relaxed">
                              {sig}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Voice */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {s.somaticVoiceOn && (
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#9ab8a3] mb-2">
                      INTERNAL VOICE — STATE ON
                    </div>
                    <p className="text-xs text-[#c9c5bb] leading-relaxed">
                      {s.somaticVoiceOn}
                    </p>
                  </div>
                )}
                {s.somaticVoiceOff && (
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#c0392b]/60 mb-2">
                      INTERNAL VOICE — STATE OFF
                    </div>
                    <p className="text-xs text-[#888] leading-relaxed">
                      {s.somaticVoiceOff}
                    </p>
                  </div>
                )}
              </div>

              {/* Gaze */}
              <div className="grid md:grid-cols-2 gap-6">
                {s.somaticGazeOn && (
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#9ab8a3] mb-2">
                      GAZE — STATE ON
                    </div>
                    <p className="text-xs text-[#c9c5bb] leading-relaxed">
                      {s.somaticGazeOn}
                    </p>
                  </div>
                )}
                {s.somaticGazeOff && (
                  <div>
                    <div className="text-[9px] tracking-[0.25em] text-[#c0392b]/60 mb-2">
                      GAZE — STATE OFF
                    </div>
                    <p className="text-xs text-[#888] leading-relaxed">
                      {s.somaticGazeOff}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TAOTable({ situations = [] }: TAOTableProps) {
  const [view, setView] = useState<View>("situation");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("ALL");
  const [fateFilter, setFateFilter] = useState<FateFilter>("ALL");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = situations.filter((s) => {
    const domainMatch = domainFilter === "ALL" || s.domain === domainFilter;
    const fateMatch = fateFilter === "ALL" || s.fate === fateFilter;
    return domainMatch && fateMatch;
  });

  const selectedSituation = selected
    ? situations.find((s) => s.id === selected) ?? null
    : null;

  const hasSituations = situations.length > 0;

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-2 mb-6">
        {(
          [
            ["situation", "SITUATION VIEW"],
            ["bte", "BTE VIEW"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setSelected(null);
            }}
            className={`text-[10px] tracking-widest px-4 py-2 border transition-all ${
              view === v
                ? "border-[#d4a574] text-[#d4a574] bg-[#d4a574]/5"
                : "border-[#333] text-[#888] hover:border-[#d4a574]/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Domain filter */}
      <div className="overflow-x-auto mb-3">
        <div className="flex gap-1.5 flex-nowrap pb-2">
          <button
            onClick={() => {
              setDomainFilter("ALL");
              setSelected(null);
            }}
            className={`flex-shrink-0 text-[10px] tracking-widest px-3 py-1.5 border transition-all ${
              domainFilter === "ALL"
                ? "border-[#d4a574]/60 text-[#d4a574]"
                : "border-[#222] text-[#666] hover:border-[#444]"
            }`}
          >
            ALL
          </button>
          {TAO_DOMAINS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDomainFilter(d.name);
                setSelected(null);
              }}
              className="flex-shrink-0 text-[10px] tracking-widest px-3 py-1.5 border transition-all"
              style={
                domainFilter === d.name
                  ? {
                      borderColor: `${d.color}80`,
                      color: d.color,
                      backgroundColor: `${d.color}08`,
                    }
                  : { borderColor: "#222", color: "#666" }
              }
              onMouseEnter={(e) => {
                if (domainFilter !== d.name)
                  e.currentTarget.style.borderColor = "#444";
              }}
              onMouseLeave={(e) => {
                if (domainFilter !== d.name)
                  e.currentTarget.style.borderColor = "#222";
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* FATE filter */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        <button
          onClick={() => setFateFilter("ALL")}
          className={`text-[10px] tracking-widest px-3 py-1.5 border transition-all ${
            fateFilter === "ALL"
              ? "border-[#d4a574]/60 text-[#d4a574]"
              : "border-[#222] text-[#666] hover:border-[#444]"
          }`}
        >
          ALL DRIVERS
        </button>
        {FATE_DRIVERS.map((f) => (
          <button
            key={f}
            onClick={() => setFateFilter(f)}
            className="text-[10px] tracking-widest px-3 py-1.5 border transition-all flex items-center gap-1.5"
            style={
              fateFilter === f
                ? {
                    borderColor: `${FATE_COLORS[f]}60`,
                    color: FATE_COLORS[f],
                    backgroundColor: `${FATE_COLORS[f]}08`,
                  }
                : { borderColor: "#222", color: "#666" }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: FATE_COLORS[f] }}
            />
            {f}
          </button>
        ))}
      </div>

      <p className="text-[10px] tracking-widest text-[#555] mb-4">
        {filtered.length} of {situations.length} situations
      </p>

      {/* Grid or empty state */}
      {hasSituations ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-[#111]">
          {filtered.map((s) => (
            <SituationCard
              key={s.id}
              s={s}
              isSelected={selected === s.id}
              view={view}
              onClick={() =>
                setSelected((prev) => (prev === s.id ? null : s.id))
              }
            />
          ))}
        </div>
      ) : (
        <div className="border border-[#d4a574]/20 bg-[#0f0d0b] p-12 text-center">
          <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-4">
            // CORPUS LOADING
          </div>
          <p className="ioa-serif text-2xl md:text-3xl text-[#e8e6e0] mb-4 max-w-2xl mx-auto">
            The 172-situation corpus is being prepared for the portal.
          </p>
          <p className="text-sm leading-relaxed text-[#a8a49b] max-w-xl mx-auto">
            Domain and FATE filters are live above. Situation entries will populate from the methodology database as the corpus is encoded.
          </p>
        </div>
      )}

      {/* Fixed overlay modal */}
      {selectedSituation && (
        <Modal s={selectedSituation} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
