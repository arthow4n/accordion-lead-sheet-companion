import React from "react";
import type { AccordionSize, ParsedChord, StradellaVoicing } from "../types/index.ts";
import {
  getBassNoteForColumn,
  getCounterBassNoteForColumn,
  isColumnOutOfRange,
} from "../lib/stradella/layout.ts";

export interface StradellaGridProps {
  stradella?: StradellaVoicing;
  soundingChord?: ParsedChord;
  accordionSize?: AccordionSize;
  className?: string;
}

interface ButtonItem {
  rowName: string;
  rowIndex: number;
  label: string;
  isCounterBass?: boolean;
  isActive: boolean;
  fingerLabel?: string;
  isOutOfRange?: boolean;
}

export const StradellaGrid: React.FC<StradellaGridProps> = ({
  stradella,
  soundingChord,
  accordionSize = "120-bass",
  className = "",
}) => {
  const targetCol = stradella?.columnOffset ?? 0;
  const isOutOfRange = stradella?.isOutOfRange ?? isColumnOutOfRange(targetCol, accordionSize);

  // We display 3 columns: targetCol - 1, targetCol, targetCol + 1
  const columns = [targetCol - 1, targetCol, targetCol + 1];

  const activeBassLabel = stradella?.primaryBass || soundingChord?.root || "";
  const activeChordLabel = stradella?.chordButton?.label?.toLowerCase() || "";
  const isCounterBassActive = Boolean(stradella?.isCounterBass || activeBassLabel.endsWith("_"));

  // Extract fingers from stradella.fingering (e.g. "2 + 3" or "4 + 3" or "3")
  const fingerParts = (stradella?.fingering || "4 + 3").split("+").map((s) => s.trim());
  const bassFinger = fingerParts[0] || (isCounterBassActive ? "2" : "4");
  const chordFinger = fingerParts[1] || (fingerParts.length === 1 ? fingerParts[0] : "3");

  const rowLabels = [
    { name: "Counter-Bass", key: "counter" },
    { name: "Fundamental", key: "bass" },
    { name: "Major (M)", key: "major" },
    { name: "Minor (m)", key: "minor" },
    { name: "7th (7)", key: "seventh" },
    { name: "Dim (d)", key: "dim" },
  ];

  return (
    <div
      className={`flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-2.5 ${className}`}
    >
      {/* Header with Chord explanation */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
        <div>
          <span className="text-[11px] sm:text-xs font-bold text-zinc-300 font-mono">
            Stradella Voicing:
          </span>
          <span className="ml-1.5 sm:ml-2 text-[11px] sm:text-xs font-semibold text-emerald-400">
            {stradella?.explanation || `${activeBassLabel} Bass + ${activeChordLabel || "Chord"}`}
          </span>
        </div>
        {stradella?.fingering && (
          <span className="px-1.5 sm:px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] sm:text-xs font-mono font-bold">
            Fingering: {stradella.fingering}
          </span>
        )}
      </div>

      {/* Out of Range Warning */}
      {isOutOfRange && (
        <div className="mb-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-600/70 text-amber-300 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ Chord column {targetCol} is out of {accordionSize} standard range</span>
          <span className="text-[10px] text-amber-400">Transposition recommended</span>
        </div>
      )}

      {/* 3-Column Visual Grid */}
      <div className="overflow-x-auto pb-0.5">
        <div className="min-w-[280px]">
          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 mb-1 text-center text-[10px] font-mono font-semibold text-zinc-400">
            <div className="text-left text-zinc-500 pl-1">Row</div>
            {columns.map((col) => (
              <div
                key={`col-hdr-${col}`}
                className={`py-0.5 rounded ${
                  col === targetCol
                    ? "bg-zinc-800 text-zinc-100 font-bold border border-zinc-700"
                    : "text-zinc-500"
                }`}
              >
                {getBassNoteForColumn(col)} Col ({col > 0 ? `+${col}` : col})
              </div>
            ))}
          </div>

          {/* Row Matrix */}
          <div className="space-y-1 sm:space-y-1.5">
            {rowLabels.map((rowInfo, rowIdx) => {
              return (
                <div key={rowInfo.key} className="grid grid-cols-4 gap-1 sm:gap-1.5 items-center">
                  <div className="text-[10px] font-medium text-zinc-400 truncate pl-1">
                    {rowInfo.name}
                  </div>

                  {columns.map((col) => {
                    const bassNote = getBassNoteForColumn(col);
                    const counterNote = getCounterBassNoteForColumn(col);
                    const isTargetCol = col === targetCol;

                    let buttonLabel = "";
                    let isCounter = false;
                    let isActive = false;
                    let fingerText = "";

                    if (rowIdx === 0) {
                      // Counter-Bass
                      buttonLabel = `${counterNote}_`;
                      isCounter = true;
                      if (
                        isTargetCol &&
                        isCounterBassActive &&
                        activeBassLabel.toLowerCase().replace(/_/g, "") ===
                          counterNote.toLowerCase()
                      ) {
                        isActive = true;
                        fingerText = bassFinger;
                      }
                    } else if (rowIdx === 1) {
                      // Fundamental Bass
                      buttonLabel = bassNote;
                      if (
                        isTargetCol &&
                        !isCounterBassActive &&
                        activeBassLabel.toLowerCase() === bassNote.toLowerCase()
                      ) {
                        isActive = true;
                        fingerText = bassFinger;
                      }
                    } else if (rowIdx === 2) {
                      // Major Triad
                      buttonLabel = bassNote.toLowerCase();
                      if (
                        isTargetCol &&
                        (activeChordLabel === buttonLabel ||
                          activeChordLabel === `${bassNote.toLowerCase()}m` === false &&
                            activeChordLabel === bassNote.toLowerCase())
                      ) {
                        isActive = true;
                        fingerText = chordFinger;
                      }
                    } else if (rowIdx === 3) {
                      // Minor Triad
                      buttonLabel = `${bassNote.toLowerCase()}m`;
                      if (isTargetCol && activeChordLabel === buttonLabel) {
                        isActive = true;
                        fingerText = chordFinger;
                      }
                    } else if (rowIdx === 4) {
                      // 7th Chord
                      buttonLabel = `${bassNote.toLowerCase()}7`;
                      if (isTargetCol && activeChordLabel === buttonLabel) {
                        isActive = true;
                        fingerText = chordFinger;
                      }
                    } else if (rowIdx === 5) {
                      // Diminished
                      buttonLabel = `${bassNote.toLowerCase()}d`;
                      if (
                        isTargetCol &&
                        (activeChordLabel === buttonLabel ||
                          activeChordLabel === `${bassNote.toLowerCase()}dim`)
                      ) {
                        isActive = true;
                        fingerText = chordFinger;
                      }
                    }

                    // Button styling
                    let btnClass = "bg-zinc-800/60 border-zinc-700/50 text-zinc-400";
                    if (isActive) {
                      if (isCounter) {
                        btnClass =
                          "bg-amber-500/30 border-amber-400 text-amber-200 shadow-md ring-2 ring-amber-400 font-bold";
                      } else if (rowIdx === 1) {
                        btnClass =
                          "bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-md ring-2 ring-emerald-400 font-bold";
                      } else {
                        btnClass =
                          "bg-blue-500/30 border-blue-400 text-blue-200 shadow-md ring-2 ring-blue-400 font-bold";
                      }
                    } else if (isTargetCol) {
                      btnClass = "bg-zinc-800 border-zinc-600 text-zinc-300";
                    }

                    return (
                      <div
                        key={`cell-${rowInfo.key}-${col}`}
                        className={`h-8 flex flex-col items-center justify-center rounded-lg border text-xs font-mono transition-all ${btnClass}`}
                      >
                        <span className="leading-tight">{buttonLabel}</span>
                        {isActive && fingerText && (
                          <span className="text-[9px] font-sans font-bold leading-none mt-0.5 opacity-90">
                            [{fingerText}]
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
