import React from "react";
import type { CbaButtonCoord, CbaGrip, CbaJamFillScale, ParsedChord } from "../types/index.ts";
import { getNoteName } from "../lib/capo/enharmonics.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { getPitchClassAt } from "../lib/cba/grid.ts";
import { computeCbaJamFills } from "../lib/cba/jamFills.ts";

export interface CbaGridProps {
  cba?: CbaGrip;
  soundingChord?: ParsedChord;
  jamFillsEnabled?: boolean;
  jamFillsScale?: CbaJamFillScale | null;
  className?: string;
}

export const CbaGrid: React.FC<CbaGridProps> = ({
  cba,
  soundingChord,
  jamFillsEnabled = false,
  jamFillsScale,
  className = "",
}) => {
  const chordName = cba?.chordName || cba?.chord || soundingChord?.raw || "Chord";
  const grip = cba || (soundingChord ? generateCbaGrip(soundingChord) : null);
  const notes = grip?.notes || [];
  const activeButtons: CbaButtonCoord[] = grip?.buttonCoords || grip?.buttons || [];

  // Compute Jam Fill scale if enabled
  const activeJamFills = jamFillsEnabled
    ? (jamFillsScale !== undefined ? jamFillsScale : computeCbaJamFills(soundingChord))
    : null;

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
    { rowNumber: 5, indentPx: 36 },
    { rowNumber: 4, indentPx: 27 },
    { rowNumber: 3, indentPx: 18 },
    { rowNumber: 2, indentPx: 9 },
    { rowNumber: 1, indentPx: 0 },
  ];

  // Determine if note spelling should prefer flats
  const preferFlats = notes.some((n) => n.includes("b")) ||
    Boolean(soundingChord?.root && soundingChord.root.includes("b"));

  return (
    <div
      className={`flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-3 ${className}`}
    >
      {/* Chord and Pitches in its own dedicated line */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-zinc-800/80 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-bold text-emerald-400">
            {chordName}
          </span>
          {notes.length > 0 && (
            <span className="text-xs text-zinc-300 font-medium">
              [{notes.join(" - ")}]
            </span>
          )}
        </div>

        {/* Strategy D: Jam Fill Scale Header Tag */}
        {activeJamFills && (
          <span className="px-2 py-0.5 rounded bg-sky-950/80 border border-sky-600/60 text-sky-300 text-[10px] sm:text-xs font-semibold">
            🎨 {activeJamFills.scaleName}: [{activeJamFills.notes.join(", ")}]
          </span>
        )}
      </div>

      {/* Staggered Button Keyboard */}
      <div className="overflow-x-auto pb-1 flex justify-center">
        <div className="py-1 space-y-1.5">
          {rows.map((rowInfo) => (
            <div
              key={`cba-row-${rowInfo.rowNumber}`}
              className="flex items-center gap-2"
              style={{ marginLeft: `${rowInfo.indentPx}px` }}
            >
              {displayCols.map((col) => {
                const pc = getPitchClassAt(rowInfo.rowNumber, col);
                const noteName = getNoteName(pc, preferFlats);

                const isPrimary = activeButtons.some(
                  (b) => b.row === rowInfo.rowNumber && b.column === col,
                );

                // Two-way shadow duplicate highlighting
                const isAuxDuplicate = !isPrimary && activeButtons.some((b) => {
                  const bEffectiveRow = ((b.row - 1) % 3) + 1;
                  const currentEffectiveRow = ((rowInfo.rowNumber - 1) % 3) + 1;
                  return bEffectiveRow === currentEffectiveRow && b.column === col;
                });

                const isRoot = isPrimary && (
                  (grip?.rootButtonCoord && grip.rootButtonCoord.row === rowInfo.rowNumber &&
                    grip.rootButtonCoord.column === col) ||
                  activeButtons.find((b) => b.row === rowInfo.rowNumber && b.column === col)
                      ?.finger === 1
                );

                const isGhost = !isPrimary && !isAuxDuplicate &&
                  Boolean(
                    grip?.exitingCoords && grip.exitingCoords.length > 0 &&
                      grip.exitingCoords.some((xc) =>
                        xc.row === rowInfo.rowNumber && xc.column === col
                      ),
                  );

                // Check for Jam Fill scale tone
                const isFillNote = Boolean(
                  !isPrimary &&
                    !isAuxDuplicate &&
                    activeJamFills &&
                    activeJamFills.pitchClasses.includes(pc),
                );

                let btnClass =
                  "bg-zinc-900/90 border border-zinc-800 text-zinc-500 hover:border-zinc-700";

                if (isRoot) {
                  btnClass =
                    "bg-amber-300 border-2 border-amber-100 text-zinc-950 font-black shadow-[0_0_12px_rgba(251,191,36,0.85)] ring-2 ring-amber-400/80 scale-110";
                } else if (isPrimary) {
                  btnClass =
                    "bg-emerald-400 border-2 border-emerald-200 text-zinc-950 font-black shadow-[0_0_10px_rgba(52,211,153,0.9)] ring-2 ring-emerald-400/60 scale-105";
                } else if (isAuxDuplicate) {
                  btnClass =
                    "bg-emerald-950/90 border border-emerald-600/80 text-emerald-300 font-bold shadow-sm";
                } else if (isFillNote) {
                  btnClass =
                    "bg-sky-950/90 border-2 border-sky-400 text-sky-200 font-bold shadow-[0_0_8px_rgba(56,189,248,0.6)] ring-1 ring-sky-400/40";
                } else if (isGhost) {
                  btnClass =
                    "bg-indigo-500/15 border border-dashed border-indigo-400/50 text-indigo-300/70 shadow-xs scale-95";
                }

                return (
                  <div
                    key={`cba-btn-${rowInfo.rowNumber}-${col}`}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-mono transition-all select-none ${btnClass}`}
                    title={`Row ${rowInfo.rowNumber}, Col ${col}: ${noteName}${
                      isRoot
                        ? " (Root)"
                        : isFillNote
                        ? ` (Fill Tone - ${activeJamFills?.scaleName})`
                        : isGhost
                        ? " (Previous Chord Shadow)"
                        : ""
                    }`}
                  >
                    {noteName}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
