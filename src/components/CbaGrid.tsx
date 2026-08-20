import React from "react";
import type { CbaButtonCoord, CbaGrip, ParsedChord } from "../types/index.ts";

export interface CbaGridProps {
  cba?: CbaGrip;
  soundingChord?: ParsedChord;
  className?: string;
}

export const CbaGrid: React.FC<CbaGridProps> = ({
  cba,
  soundingChord,
  className = "",
}) => {
  const chordName = cba?.chordName || cba?.chord || soundingChord?.raw || "Chord";
  const notes = cba?.notes || [];
  const fingeringPattern = cba?.fingeringPattern || "1-2-4";
  const activeButtons: CbaButtonCoord[] = cba?.buttonCoords || cba?.buttons || [];

  // Determine column range to display around active buttons (typically 1 to 8 or 4 to 11)
  const cols = activeButtons.map((b) => b.column);
  const minCol = cols.length > 0 ? Math.max(1, Math.min(...cols) - 1) : 3;
  const maxCol = cols.length > 0 ? Math.max(minCol + 5, Math.max(...cols) + 1) : 8;

  const displayCols: number[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    displayCols.push(c);
  }

  // Row descriptions for CBA C-System: Row 3 = Bellows, Row 2 = Middle, Row 1 = Edge
  const rows = [
    { rowNumber: 3, name: "Row 3 (Bellows)" },
    { rowNumber: 2, name: "Row 2 (Middle)" },
    { rowNumber: 1, name: "Row 1 (Edge)" },
  ];

  return (
    <div className={`flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-3 ${className}`}>
      {/* Header with Grip info */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
        <div>
          <span className="text-xs font-bold text-zinc-300 font-mono">
            RH CBA Grip:
          </span>
          <span className="ml-2 text-xs font-semibold text-rose-400">
            {chordName} [{notes.join(" - ")}]
          </span>
        </div>
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-mono font-bold">
          Fingers: {fingeringPattern}
        </span>
      </div>

      {/* Visual Button Grid */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[280px]">
          {/* Column indices */}
          <div className="flex items-center mb-1.5 text-center text-[10px] font-mono font-semibold text-zinc-500">
            <div className="w-24 text-left pl-1">Row</div>
            <div
              className="flex-1 grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${displayCols.length}, minmax(0, 1fr))` }}
            >
              {displayCols.map((col) => (
                <div key={`cba-col-${col}`} className="py-0.5">
                  Col {col}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-1.5">
            {rows.map((rowInfo) => (
              <div key={`cba-row-${rowInfo.rowNumber}`} className="flex items-center">
                <div className="w-24 text-[10px] font-medium text-zinc-400 truncate pl-1">
                  {rowInfo.name}
                </div>

                <div
                  className="flex-1 grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${displayCols.length}, minmax(0, 1fr))` }}
                >
                  {displayCols.map((col) => {
                    const activeBtn = activeButtons.find(
                      (b) =>
                        b.row === rowInfo.rowNumber && b.column === col,
                    );

                    const isActive = Boolean(activeBtn);

                    return (
                      <div
                        key={`cba-cell-${rowInfo.rowNumber}-${col}`}
                        className={`h-9 flex flex-col items-center justify-center rounded-lg border text-xs font-mono transition-all ${
                          isActive
                            ? "bg-rose-500/30 border-rose-400 text-rose-200 shadow-md ring-2 ring-rose-400 font-bold"
                            : "bg-zinc-800/40 border-zinc-700/40 text-zinc-600"
                        }`}
                      >
                        {isActive
                          ? (
                            <>
                              <span className="leading-tight">{activeBtn?.note}</span>
                              <span className="text-[9px] font-sans font-bold leading-none mt-0.5 text-rose-300">
                                [{activeBtn?.finger}]
                              </span>
                            </>
                          )
                          : <span className="text-[10px] opacity-40">·</span>}
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
