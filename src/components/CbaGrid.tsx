import React from "react";
import type { CbaButtonCoord, CbaGrip, ParsedChord } from "../types/index.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { parseChord } from "../lib/capo/transposition.ts";
import { getNoteName } from "../lib/capo/enharmonics.ts";
import { getPitchClassAt } from "../lib/cba/grid.ts";
import { computeCbaJamFills } from "../lib/cba/jamFills.ts";

export interface CbaGridProps {
  cba?: CbaGrip;
  soundingChord?: ParsedChord | string;
  className?: string;
  jamFillsEnabled?: boolean;
}

export const CBA_ROWS_5 = [
  { rowNumber: 5, label: "Row 5 (Aux 2)", indentPx: 24 },
  { rowNumber: 4, label: "Row 4 (Aux 1)", indentPx: 18 },
  { rowNumber: 3, label: "Row 3", indentPx: 12 },
  { rowNumber: 2, label: "Row 2", indentPx: 6 },
  { rowNumber: 1, label: "Row 1", indentPx: 0 },
];

export const CbaGrid: React.FC<CbaGridProps> = ({
  cba,
  soundingChord,
  className = "",
  jamFillsEnabled = false,
}) => {
  const parsedChord: ParsedChord = typeof soundingChord === "string"
    ? parseChord(soundingChord)
    : soundingChord || parseChord(cba?.chord || "C");

  const grip: CbaGrip = cba || generateCbaGrip(parsedChord);
  const activeButtons: CbaButtonCoord[] = grip?.buttonCoords || grip?.buttons || [];
  const chordName = parsedChord.raw || grip?.chord || "Chord";
  const notes = grip?.notes || [];

  // Determine dynamic column range based on active buttons (minimum 5 columns)
  const cols = activeButtons.map((b) => b.column);
  const minCol = cols.length > 0 ? Math.min(...cols) : 3;
  const maxCol = cols.length > 0 ? Math.max(...cols) : 6;
  const startCol = Math.max(1, minCol - 1);
  const endCol = Math.min(12, Math.max(startCol + 4, maxCol + 1));
  const displayCols: number[] = [];
  for (let c = startCol; c <= endCol; c++) {
    displayCols.push(c);
  }

  const preferFlats = notes.some((n) => n.includes("b")) ||
    Boolean(parsedChord?.root && parsedChord.root.includes("b"));

  const rows = CBA_ROWS_5;

  // Compute Jam Fill scale for this chord if enabled
  const activeJamFills = jamFillsEnabled ? computeCbaJamFills(parsedChord) : null;

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
          {grip.flowVector && grip.flowVector !== "●" && (
            <span className="text-xs text-sky-400 font-bold">
              {grip.flowVector}
            </span>
          )}
        </div>

        {/* Strategy D: Jam Fill Scale Header Tag */}
        {activeJamFills && (
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 text-[10px] sm:text-xs font-semibold">
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

                // Root Note Beacon (Finger 1)
                const isRoot = isPrimary && (
                  (grip?.rootButtonCoord && grip.rootButtonCoord.row === rowInfo.rowNumber &&
                    grip.rootButtonCoord.column === col) ||
                  activeButtons.find((b) => b.row === rowInfo.rowNumber && b.column === col)
                      ?.finger === 1
                );

                // Entering Tone in voice leading transition
                const isEntering = isPrimary && !isRoot &&
                  Boolean(
                    grip?.enteringCoords && grip.enteringCoords.length > 0 &&
                      grip.enteringCoords.some((ec) =>
                        ec.row === rowInfo.rowNumber && ec.column === col
                      ),
                  );

                // Ghost releasing note from previous chord
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
                } else if (isEntering) {
                  btnClass =
                    "bg-sky-400 border-2 border-sky-100 text-zinc-950 font-black shadow-[0_0_10px_rgba(56,189,248,0.9)] ring-2 ring-sky-400/70 scale-105";
                } else if (isPrimary) {
                  btnClass =
                    "bg-emerald-400 border-2 border-emerald-100 text-zinc-950 font-black shadow-[0_0_10px_rgba(52,211,153,0.9)] ring-2 ring-emerald-400/60 scale-105";
                } else if (isAuxDuplicate) {
                  btnClass =
                    "bg-emerald-950/70 border border-dashed border-emerald-500/70 text-emerald-300 font-bold shadow-sm";
                } else if (isFillNote) {
                  btnClass =
                    "bg-cyan-950/90 border-2 border-cyan-400 text-cyan-200 font-bold shadow-[0_0_8px_rgba(34,211,238,0.6)] ring-1 ring-cyan-400/40";
                } else if (isGhost) {
                  btnClass =
                    "bg-indigo-950/40 border border-dashed border-indigo-400/50 text-indigo-300/70 shadow-xs scale-95";
                }

                return (
                  <div
                    key={`cba-btn-${rowInfo.rowNumber}-${col}`}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-mono transition-all select-none ${btnClass}`}
                    title={`Row ${rowInfo.rowNumber}, Col ${col}: ${noteName}${
                      isRoot
                        ? " (Root Beacon)"
                        : isEntering
                        ? " (New Voice - Strike)"
                        : isPrimary
                        ? " (Kept Voice - Hold)"
                        : isAuxDuplicate
                        ? " (Auxiliary Duplicate)"
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
