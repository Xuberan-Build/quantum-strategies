"use client";

import { useState } from "react";
import { CORE_STATES } from "@/data/coreStates";

const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [80, 180],
  [220, 140],
  [360, 120],
  [500, 140],
  [640, 180],
];

export default function CoreStateViz() {
  const [activeState, setActiveState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const active = CORE_STATES.find((s) => s.id === activeState) ?? null;

  const toggleState = (id: string) =>
    setActiveState((prev) => (prev === id ? null : id));

  return (
    <div className="relative">
      <svg width="100%" viewBox="0 0 700 280" className="overflow-visible">
        {CORE_STATES.map((s, i) => {
          if (i < CORE_STATES.length - 1) {
            const [x1, y1] = POSITIONS[i];
            const [x2, y2] = POSITIONS[i + 1];
            return (
              <line
                key={`line-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={s.color}
                strokeOpacity="0.15"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            );
          }
          return null;
        })}

        {CORE_STATES.map((s, i) => {
          const [cx, cy] = POSITIONS[i];
          const isActive = activeState === s.id;
          const isHovered = hoveredState === s.id;
          return (
            <g
              key={s.id}
              onClick={() => toggleState(s.id)}
              onMouseEnter={() => setHoveredState(s.id)}
              onMouseLeave={() => setHoveredState(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={52}
                fill={s.color}
                fillOpacity={isActive ? 0.25 : isHovered ? 0.2 : 0.12}
                stroke={s.color}
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="ioa-serif"
                fontSize="28"
                fill={s.color}
                style={{
                  fontFamily:
                    "var(--font-ioa-serif), 'Cormorant Garamond', Georgia, serif",
                  pointerEvents: "none",
                }}
              >
                {s.glyph}
              </text>
              <text
                x={cx}
                y={cy + 68}
                textAnchor="middle"
                fontSize="9"
                fill="#888"
                letterSpacing="3"
                style={{
                  fontFamily:
                    "var(--font-ioa-mono), 'JetBrains Mono', monospace",
                  pointerEvents: "none",
                }}
              >
                {s.name.toUpperCase()}
              </text>
              <circle
                cx={cx + 38}
                cy={cy - 38}
                r={14}
                fill="#0a0908"
                stroke={s.color}
                strokeOpacity="0.6"
                strokeWidth="1"
              />
              <text
                x={cx + 38}
                y={cy - 38}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fill={s.color}
                style={{
                  fontFamily:
                    "var(--font-ioa-mono), 'JetBrains Mono', monospace",
                  pointerEvents: "none",
                }}
              >
                {s.count}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Distribution bar */}
      <div className="w-full h-2 flex mt-4 rounded overflow-hidden gap-px">
        {CORE_STATES.map((s) => (
          <div
            key={s.id}
            style={{
              flexGrow: s.count,
              backgroundColor: s.color,
              opacity: activeState === s.id ? 1 : 0.5,
            }}
            className="cursor-pointer transition-opacity hover:opacity-100"
            title={s.name}
            onClick={() => toggleState(s.id)}
          />
        ))}
      </div>

      {/* Active state detail */}
      {active && (
        <div className="ioa-entry-expand mt-8 border border-[#d4a574]/20 bg-[#0f0d0b] p-8">
          <div className="flex items-start gap-8">
            <span
              className="ioa-serif text-7xl leading-none"
              style={{ color: active.color }}
            >
              {active.glyph}
            </span>
            <div className="flex-1">
              <h3
                className="ioa-serif text-4xl mb-2"
                style={{ color: "#d4a574" }}
              >
                {active.name}
              </h3>
              <p className="text-base text-[#c9c5bb] mt-2 mb-4 max-w-2xl">
                {active.definition}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {active.situations.map((sit) => (
                  <span
                    key={sit}
                    className="text-xs tracking-widest px-3 py-1 border"
                    style={{
                      borderColor: `${active.color}40`,
                      color: active.color,
                    }}
                  >
                    {sit}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#888] italic mt-4">{active.why}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
