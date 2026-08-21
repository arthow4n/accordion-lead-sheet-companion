import React from "react";
import type { CbaButtonCoord, ChordDetail, ParsedChord } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { parseChord } from "../lib/capo/transposition.ts";

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
    { rowNum: 5, y: 7, xOffset: 12 },
    { rowNum: 4, y: 16, xOffset: 9 },
    { rowNum: 3, y: 25, xOffset: 6 },
    { rowNum: 2, y: 34, xOffset: 3 },
    { rowNum: 1, y: 43, xOffset: 0 },
  ];

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
      className={`flex flex-col items-center justify-between px-2 py-1.5 rounded-xl border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
        active
          ? "bg-emerald-950/90 border-emerald-400 shadow-md ring-1 ring-emerald-400"
          : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-emerald-600/60"
      } ${className}`}
      style={{ minWidth: "70px" }}
    >
      {/* Chord Name Header */}
      <span className="text-[11px] font-bold text-emerald-400 font-mono tracking-tight leading-none mb-0.5">
        {chordName}
      </span>

      {/* Notes summary */}
      <span className="text-[8px] text-zinc-400 font-mono leading-none mb-1 text-center whitespace-nowrap">
        {notes.join(" ")}
      </span>

      {/* Authentic Staggered 5-Row CBA Diagonal Lattice */}
      <div className="bg-zinc-950/90 rounded-lg p-1 border border-zinc-800/80 shadow-inner flex items-center justify-center">
        <svg
          viewBox="0 0 54 50"
          className="w-[50px] h-[46px] overflow-visible"
          aria-hidden="true"
        >
          {rows.map(({ rowNum, y, xOffset }) => {
            return displayCols.map((col, colIdx) => {
              // Direct active button in primary grip
              const isDirectActive = activeButtons.some(
                (b) => b.row === rowNum && b.column === col,
              );

              // Auxiliary duplicate on Row 4 (mirrors Row 1) or Row 5 (mirrors Row 2)
              const coreRow = rowNum === 4 ? 1 : rowNum === 5 ? 2 : 0;
              const isAuxDuplicate = coreRow > 0 &&
                activeButtons.some((b) => b.row === coreRow && b.column === col);

              const isLit = isDirectActive || isAuxDuplicate;
              const isPrimary = isDirectActive;
              const x = xOffset + 4 + colIdx * 9.5;

              return (
                <g key={`cba-dot-${rowNum}-${col}`}>
                  {/* Glowing ring for active primary buttons */}
                  {isPrimary && (
                    <circle
                      cx={x}
                      cy={y}
                      r={4.2}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth={1.2}
                      opacity={0.85}
                    />
                  )}
                  {/* Button circle: all buttons have identical 3.0px radius */}
                  <circle
                    cx={x}
                    cy={y}
                    r={3.0}
                    fill={isPrimary ? "#10b981" : isAuxDuplicate ? "#065f46" : "#27272a"}
                    stroke={isPrimary ? "#6ee7b7" : isAuxDuplicate ? "#10b981" : "#3f3f46"}
                    strokeWidth={isLit ? 0.75 : 0.5}
                  />
                </g>
              );
            });
          })}
        </svg>
      </div>
    </button>
  );
};
