import React from "react";
import type { ChordDetail } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";

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

  const chordName = chordDetail.soundingChord?.raw ||
    chordDetail.originalChord?.raw ||
    (typeof chord === "string" ? chord : "Chord");

  const notes = chordDetail.cba?.notes || [];
  const activeButtons = chordDetail.cba?.buttonCoords || chordDetail.cba?.buttons || [];

  // Determine active columns (relative span across 3 columns)
  const cols = activeButtons.map((b) => b.column);
  const minCol = cols.length > 0 ? Math.min(...cols) : 3;
  const displayCols = [minCol, minCol + 1, minCol + 2];

  // 5 Rows in top-to-bottom visual order:
  // Row 5: Auxiliary 2 (Repeat of Row 2)
  // Row 4: Auxiliary 1 (Repeat of Row 1)
  // Row 3: Core (Bellows side)
  // Row 2: Core (Middle)
  // Row 1: Core (Edge)
  const rows = [5, 4, 3, 2, 1];

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
      title={`${chordName}: ${notes.join("-")} (5-Row CBA Grip)`}
      className={`flex flex-col items-center justify-between p-1.5 rounded-lg border transition-all cursor-pointer select-none active:scale-95 ${
        active
          ? "bg-emerald-950/90 border-emerald-400 shadow-md ring-1 ring-emerald-400"
          : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-emerald-700/60"
      } ${className}`}
    >
      {/* Chord Name Header */}
      <span className="text-[11px] font-bold text-emerald-400 font-mono tracking-tight leading-none mb-0.5">
        {chordName}
      </span>

      {/* Notes summary */}
      <span className="text-[8px] text-zinc-400 font-mono leading-none mb-1 truncate max-w-[54px]">
        {notes.slice(0, 3).join(" ")}
      </span>

      {/* 5-Row Mini Dot Grid */}
      <div className="flex flex-col gap-0.5 p-1 bg-zinc-950/80 rounded border border-zinc-800/80">
        {rows.map((rowNum) => {
          // Normalize row for 5-row mapping (Row 4 mirrors Row 1, Row 5 mirrors Row 2)
          const coreRowEquivalent = rowNum === 4 ? 1 : rowNum === 5 ? 2 : rowNum;

          return (
            <div key={`mini-row-${rowNum}`} className="flex items-center gap-1 justify-center">
              {displayCols.map((col) => {
                // Check if button is active on this row & column (or its auxiliary equivalent)
                const isDirectActive = activeButtons.some(
                  (b) => b.row === rowNum && b.column === col,
                );
                const isCoreActive = activeButtons.some(
                  (b) => b.row === coreRowEquivalent && b.column === col,
                );
                const isLit = isDirectActive || isCoreActive;

                return (
                  <div
                    key={`dot-${rowNum}-${col}`}
                    className={`flex items-center justify-center transition-all ${
                      isLit
                        ? "w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]"
                        : "w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/40"
                    }`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </button>
  );
};
