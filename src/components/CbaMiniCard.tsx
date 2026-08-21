import React from "react";
import type { CbaButtonCoord, ChordDetail, ParsedChord } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { parseChord } from "../lib/capo/transposition.ts";
import { getNoteName } from "../lib/capo/enharmonics.ts";
import { getPitchClassAt } from "../lib/cba/grid.ts";

export interface CbaMiniCardProps {
  chord: ChordDetail | string;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  className?: string;
}

export const CbaMiniCard: React.FC<CbaMiniCardProps> = ({
  chord,
  onSelectChord,
  active = false,
  className = "",
}) => {
  const chordDetail: ChordDetail = typeof chord === "string" ? enrichChord(chord, 0) : chord;
  const soundingChord: ParsedChord = chordDetail.soundingChord ||
    chordDetail.originalChord ||
    parseChord(typeof chord === "string" ? chord : "C");

  const chordName = soundingChord.raw || (typeof chord === "string" ? chord : "Chord");
  const grip = chordDetail.cba || generateCbaGrip(soundingChord);
  const notes = grip.notes || [];
  const activeButtons: CbaButtonCoord[] = grip.buttonCoords || grip.buttons || [];

  // Determine column range to display around active buttons (4 columns)
  const cols = activeButtons.map((b) => b.column);
  const minCol = cols.length > 0 ? Math.max(1, Math.min(...cols)) : 3;
  const displayCols = [minCol - 1, minCol, minCol + 1, minCol + 2];

  // 5 Rows in top-to-bottom visual order with authentic 60-degree diagonal stagger
  // Row 5: Auxiliary 2 (Repeat of Row 2)
  // Row 4: Auxiliary 1 (Repeat of Row 1)
  // Row 3: Core (Bellows side)
  // Row 2: Core (Middle)
  // Row 1: Core (Edge)
  const rows = [
    { rowNum: 5, y: 6, xOffset: 12 },
    { rowNum: 4, y: 15, xOffset: 9 },
    { rowNum: 3, y: 24, xOffset: 6 },
    { rowNum: 2, y: 33, xOffset: 3 },
    { rowNum: 1, y: 42, xOffset: 0 },
  ];

  // Determine if note spelling should prefer flats
  const preferFlats = notes.some((n) => n.includes("b")) ||
    Boolean(soundingChord?.root && soundingChord.root.includes("b"));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectChord) {
      onSelectChord(chordDetail);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${chordName}: ${notes.join(" - ")} (5-Row CBA Grip)`}
      className={`flex flex-col items-center justify-between p-1.5 rounded-xl border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
        active
          ? "bg-emerald-950/90 border-emerald-400 shadow-md ring-1 ring-emerald-400"
          : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-emerald-600/60"
      } ${className}`}
      style={{ minWidth: "66px" }}
    >
      {/* Bold, Clear Chord Name Header */}
      <span className="text-xs font-bold text-emerald-400 font-mono tracking-tight leading-none mb-1">
        {chordName}
      </span>

      {/* Authentic Staggered 5-Row CBA Lattice with In-Button Notes */}
      <div className="bg-zinc-950/90 rounded-lg p-0.5 border border-zinc-800/80 shadow-inner flex items-center justify-center">
        <svg
          viewBox="0 0 54 48"
          className="w-[52px] h-[46px] overflow-visible"
          aria-hidden="true"
        >
          {rows.map(({ rowNum, y, xOffset }) => {
            return displayCols.map((col, colIdx) => {
              const pc = getPitchClassAt(rowNum, col);
              const noteName = getNoteName(pc, preferFlats);

              // Direct active button in primary grip
              const isDirectActive = activeButtons.some(
                (b) => b.row === rowNum && b.column === col,
              );

              // Two-way auxiliary duplicate highlighting
              const isAuxDuplicate = !isDirectActive && activeButtons.some((b) => {
                const bEff = ((b.row - 1) % 3) + 1;
                const curEff = ((rowNum - 1) % 3) + 1;
                return bEff === curEff && b.column === col;
              });

              // High-Contrast Root Note Beacon (Finger 1)
              const isRoot = isDirectActive && (
                (grip.rootButtonCoord && grip.rootButtonCoord.row === rowNum &&
                  grip.rootButtonCoord.column === col) ||
                activeButtons.find((b) => b.row === rowNum && b.column === col)?.finger === 1
              );

              const isLit = isDirectActive || isAuxDuplicate;
              const isPrimary = isDirectActive;
              const x = xOffset + 5 + colIdx * 9.5;

              return (
                <g key={`cba-dot-${rowNum}-${col}`}>
                  {/* Glowing ring for active primary buttons */}
                  {isPrimary && (
                    <circle
                      cx={x}
                      cy={y}
                      r={isRoot ? 5.2 : 4.8}
                      fill="none"
                      stroke={isRoot ? "#ffffff" : "#34d399"}
                      strokeWidth={isRoot ? 1.5 : 1.2}
                      opacity={0.9}
                    />
                  )}

                  {/* Button circle: Pearl-White for Root, Emerald for Chord Tones */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isRoot ? 4.4 : isPrimary ? 4.2 : isAuxDuplicate ? 3.6 : 2.0}
                    fill={isRoot
                      ? "#ffffff"
                      : isPrimary
                      ? "#10b981"
                      : isAuxDuplicate
                      ? "#065f46"
                      : "#27272a"}
                    stroke={isRoot
                      ? "#34d399"
                      : isPrimary
                      ? "#6ee7b7"
                      : isAuxDuplicate
                      ? "#10b981"
                      : "#3f3f46"}
                    strokeWidth={isLit ? (isRoot ? 1.0 : 0.75) : 0.4}
                  />

                  {/* Direct In-Button Note Initials on lit buttons */}
                  {isLit && noteName && (
                    <text
                      x={x}
                      y={y + (noteName.length > 2 ? 0.9 : 1.1)}
                      fontSize={isPrimary
                        ? (noteName.length > 2 ? "2.6" : "3.2")
                        : (noteName.length > 2 ? "2.3" : "2.7")}
                      fontWeight={isRoot ? "900" : "bold"}
                      fontFamily="monospace"
                      textAnchor="middle"
                      fill={isRoot ? "#022c22" : isPrimary ? "#042f2e" : "#a7f3d0"}
                      className="select-none pointer-events-none"
                    >
                      {noteName}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>
    </button>
  );
};
