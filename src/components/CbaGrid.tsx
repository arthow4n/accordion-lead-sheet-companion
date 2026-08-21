import React from "react";
import type { CbaButtonCoord, CbaGrip, ParsedChord } from "../types/index.ts";
import { getNoteName } from "../lib/capo/enharmonics.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { PITCH_CLASS_POSITIONS } from "../lib/cba/grid.ts";

export interface CbaGridProps {
  cba?: CbaGrip;
  soundingChord?: ParsedChord;
  className?: string;
}

/**
 * Lookup pitch class at (row, col) from the CBA C-System grid definition
 */
function getPitchClassAt(row: number, col: number): number | null {
  const coreRow = row === 4 ? 1 : row === 5 ? 2 : row;
  for (const [pcStr, positions] of Object.entries(PITCH_CLASS_POSITIONS)) {
    if (positions.some((p) => p.row === coreRow && p.column === col)) {
      return parseInt(pcStr, 10);
    }
  }
  return null;
}

export const CbaGrid: React.FC<CbaGridProps> = ({
  cba,
  soundingChord,
  className = "",
}) => {
  const chordName = cba?.chordName || cba?.chord || soundingChord?.raw || "Chord";
  const grip = cba || (soundingChord ? generateCbaGrip(soundingChord) : null);
  const notes = grip?.notes || [];
  const activeButtons: CbaButtonCoord[] = grip?.buttonCoords || grip?.buttons || [];

  // Determine column range to display around active buttons (5 to 6 columns)
  const cols = activeButtons.map((b) => b.column);
  const minCol = cols.length > 0 ? Math.max(1, Math.min(...cols) - 1) : 2;
  const maxCol = cols.length > 0 ? Math.max(minCol + 4, Math.max(...cols) + 1) : 7;

  const displayCols: number[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    displayCols.push(c);
  }

  // 5 Rows in top-to-bottom visual order with authentic 60-degree diagonal stagger:
  // Row 5: Auxiliary 2 (Repeat of Row 2)
  // Row 4: Auxiliary 1 (Repeat of Row 1)
  // Row 3: Core (Bellows side)
  // Row 2: Core (Middle)
  // Row 1: Core (Edge)
  const rows = [
    { rowNumber: 5, name: "Row 5 (Aux 2)", indentPx: 36 },
    { rowNumber: 4, name: "Row 4 (Aux 1)", indentPx: 27 },
    { rowNumber: 3, name: "Row 3 (Bellows)", indentPx: 18 },
    { rowNumber: 2, name: "Row 2 (Middle)", indentPx: 9 },
    { rowNumber: 1, name: "Row 1 (Edge)", indentPx: 0 },
  ];

  // Determine if note spelling should prefer flats
  const preferFlats = notes.some((n) => n.includes("b")) ||
    Boolean(soundingChord?.root && soundingChord.root.includes("b"));

  return (
    <div
      className={`flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 ${className}`}
    >
      {/* Header with Grip info */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
        <div>
          <span className="text-[11px] font-bold text-zinc-300 font-mono">
            5-Row CBA Treble Grip:
          </span>
          <span className="ml-2 text-[11px] font-bold text-emerald-400 font-mono">
            {chordName} [{notes.join(" - ")}]
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono font-bold">
          5-Row C-System
        </span>
      </div>

      {/* Visual Staggered Button Keyboard */}
      <div className="overflow-x-auto pb-0.5">
        <div className="min-w-[290px] py-0.5">
          {/* Rows */}
          <div className="space-y-1">
            {rows.map((rowInfo) => (
              <div key={`cba-row-${rowInfo.rowNumber}`} className="flex items-center">
                {/* Row label */}
                <div className="w-24 text-[10px] font-mono font-medium text-zinc-400 truncate pl-1 select-none">
                  {rowInfo.name}
                </div>

                {/* Staggered buttons container */}
                <div
                  className="flex items-center gap-1.5"
                  style={{ marginLeft: `${rowInfo.indentPx}px` }}
                >
                  {displayCols.map((col) => {
                    const pc = getPitchClassAt(rowInfo.rowNumber, col);
                    const noteName = pc !== null ? getNoteName(pc, preferFlats) : "·";

                    const isPrimary = activeButtons.some(
                      (b) =>
                        b.row === rowInfo.rowNumber && b.column === col,
                    );

                    const coreRow = rowInfo.rowNumber === 4 ? 1 : rowInfo.rowNumber === 5 ? 2 : 0;
                    const isAuxDuplicate = coreRow > 0 &&
                      activeButtons.some((b) =>
                        b.row === coreRow && b.column === col
                      );

                    return (
                      <div
                        key={`cba-btn-${rowInfo.rowNumber}-${col}`}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono transition-all select-none ${
                          isPrimary
                            ? "bg-emerald-400 border-2 border-emerald-200 text-zinc-950 font-black shadow-[0_0_8px_rgba(52,211,153,0.9)] ring-2 ring-emerald-400/60 scale-105"
                            : isAuxDuplicate
                            ? "bg-emerald-950/90 border border-emerald-600/80 text-emerald-300 font-bold shadow-sm"
                            : "bg-zinc-900/90 border border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        }`}
                        title={`Row ${rowInfo.rowNumber}, Col ${col}: ${noteName}`}
                      >
                        {noteName}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
