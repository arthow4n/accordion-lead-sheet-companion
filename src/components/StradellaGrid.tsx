import React, { useLayoutEffect, useRef } from "react";
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

export const StradellaGrid: React.FC<StradellaGridProps> = ({
  stradella,
  soundingChord,
  accordionSize = "120-bass",
  className = "",
}) => {
  // Check if React is actively executing inside a component render dispatcher
  const reactInternals = React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: { H?: unknown };
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
      ReactCurrentDispatcher?: { current?: unknown };
    };
  };

  const hasDispatcher = Boolean(
    reactInternals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.H ||
      reactInternals.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher
        ?.current,
  );

  const scrollContainerRef = hasDispatcher ? useRef<HTMLDivElement>(null) : null;
  const activeAnchorRef = hasDispatcher ? useRef<HTMLDivElement>(null) : null;

  const targetCol = stradella?.columnOffset ?? 0;
  const isOutOfRange = stradella?.isOutOfRange ?? isColumnOutOfRange(targetCol, accordionSize);

  // Active buttons tracking
  const activeCols: number[] = [];
  if (typeof stradella?.rootButton?.column === "number") {
    activeCols.push(stradella.rootButton.column);
  }
  if (typeof stradella?.chordButton?.column === "number") {
    activeCols.push(stradella.chordButton.column);
  }
  if (typeof stradella?.columnOffset === "number" && activeCols.length === 0) {
    activeCols.push(stradella.columnOffset);
  }
  if (activeCols.length === 0) {
    activeCols.push(0);
  }

  const centerCol = Math.round(activeCols.reduce((a, b) => a + b, 0) / activeCols.length);

  // Display a generous 13-15 column span along the Circle of Fifths
  const startCol = centerCol - 7;
  const endCol = centerCol + 7;
  const columns: number[] = [];
  for (let c = startCol; c <= endCol; c++) {
    columns.push(c);
  }

  const activeBassLabel = stradella?.primaryBass || soundingChord?.root || "";
  const activeChordLabel = stradella?.chordButton?.label?.toLowerCase() || "";
  const isCounterBassActive = Boolean(stradella?.isCounterBass || activeBassLabel.endsWith("_"));

  // 6 Stradella rows in authentic physical diagonal stagger (top-left to bottom-right)
  // Row 0: Counter-Bass (offset 0px)
  // Row 1: Fundamental Bass (offset +6px)
  // Row 2: Major Triad (offset +12px)
  // Row 3: Minor Triad (offset +18px)
  // Row 4: 7th (offset +24px)
  // Row 5: Diminished (offset +30px)
  const rows = [
    { key: "counter", rowIndex: 0, xOffset: 0 },
    { key: "bass", rowIndex: 1, xOffset: 6 },
    { key: "major", rowIndex: 2, xOffset: 12 },
    { key: "minor", rowIndex: 3, xOffset: 18 },
    { key: "seventh", rowIndex: 4, xOffset: 24 },
    { key: "dim", rowIndex: 5, xOffset: 30 },
  ];

  // Instant layout jump to centered position before browser paint (no animated glide)
  if (hasDispatcher) {
    useLayoutEffect(() => {
      if (activeAnchorRef?.current && scrollContainerRef?.current) {
        const container = scrollContainerRef.current;
        const activeEl = activeAnchorRef.current;
        const containerWidth = container.clientWidth;
        const activeLeft = activeEl.offsetLeft;
        const activeWidth = activeEl.clientWidth;
        container.scrollLeft = activeLeft - containerWidth / 2 + activeWidth / 2;
      }
    }, [stradella, targetCol]);
  }

  return (
    <div
      className={`flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-3 ${className}`}
    >
      {/* Clean Single-Line Recipe Header without Clutter */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 font-mono">
        <span className="text-sm sm:text-base font-bold text-blue-400">
          {stradella?.explanation || `${activeBassLabel} Bass + ${activeChordLabel || "Chord"}`}
        </span>
      </div>

      {/* Out of Range Warning */}
      {isOutOfRange && (
        <div className="mb-2 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-600/70 text-amber-300 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ Chord column {targetCol} is out of {accordionSize} standard range</span>
          <span className="text-[10px] text-amber-400">Transposition recommended</span>
        </div>
      )}

      {/* Scrollable Stradella Diagonal Button Keyboard instantly centered on active chord */}
      <div
        ref={scrollContainerRef || undefined}
        className="overflow-x-auto pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="py-1 space-y-1.5 min-w-max px-4">
          {rows.map((rowInfo) => (
            <div
              key={`strad-row-${rowInfo.key}`}
              className="flex items-center gap-2"
              style={{ marginLeft: `${rowInfo.xOffset}px` }}
            >
              {columns.map((col) => {
                const bassNote = getBassNoteForColumn(col);
                const counterNote = getCounterBassNoteForColumn(col);

                let buttonLabel = "";
                let isCounter = false;
                let isActive = false;

                if (rowInfo.rowIndex === 0) {
                  // Counter-Bass (Capitalized with _ suffix, e.g. E_, B_, F#_)
                  buttonLabel = `${counterNote}_`;
                  isCounter = true;
                  if (
                    stradella?.rootButton
                      ? stradella.rootButton.row === "counter-bass" &&
                        stradella.rootButton.column === col
                      : (isCounterBassActive && col === targetCol &&
                        activeBassLabel.toLowerCase().replace(/_/g, "") ===
                          counterNote.toLowerCase())
                  ) {
                    isActive = true;
                  }
                } else if (rowInfo.rowIndex === 1) {
                  // Fundamental Bass (Capitalized, e.g. C, G, D, B)
                  buttonLabel = bassNote;
                  if (
                    stradella?.rootButton
                      ? stradella.rootButton.row === "bass" &&
                        stradella.rootButton.column === col
                      : (!isCounterBassActive && col === targetCol &&
                        activeBassLabel.toLowerCase() === bassNote.toLowerCase())
                  ) {
                    isActive = true;
                  }
                } else if (rowInfo.rowIndex === 2) {
                  // Major Triad (Capitalized, e.g. C, G, D, B)
                  buttonLabel = bassNote;
                  if (
                    stradella?.chordButton
                      ? (stradella.chordButton.row === "major" &&
                        stradella.chordButton.column === col) ||
                        (stradella.chordButton.label.toLowerCase() === bassNote.toLowerCase() &&
                          col === stradella.chordButton.column)
                      : (col === targetCol && (activeChordLabel === bassNote.toLowerCase() ||
                        (activeChordLabel.endsWith("m") === false &&
                          activeChordLabel === bassNote.toLowerCase())))
                  ) {
                    isActive = true;
                  }
                } else if (rowInfo.rowIndex === 3) {
                  // Minor Triad (Proper Casing: Bm, Em, Cm, Gm, Dm)
                  buttonLabel = `${bassNote}m`;
                  if (
                    stradella?.chordButton
                      ? (stradella.chordButton.row === "minor" &&
                        stradella.chordButton.column === col) ||
                        (stradella.chordButton.label.toLowerCase() ===
                            `${bassNote.toLowerCase()}m` &&
                          col === stradella.chordButton.column)
                      : (col === targetCol && activeChordLabel === `${bassNote.toLowerCase()}m`)
                  ) {
                    isActive = true;
                  }
                } else if (rowInfo.rowIndex === 4) {
                  // 7th Chord (Proper Casing: B7, E7, C7, G7, F#7)
                  buttonLabel = `${bassNote}7`;
                  if (
                    stradella?.chordButton
                      ? (stradella.chordButton.row === "seventh" &&
                        stradella.chordButton.column === col) ||
                        (stradella.chordButton.label.toLowerCase() ===
                            `${bassNote.toLowerCase()}7` &&
                          col === stradella.chordButton.column)
                      : (col === targetCol && activeChordLabel === `${bassNote.toLowerCase()}7`)
                  ) {
                    isActive = true;
                  }
                } else if (rowInfo.rowIndex === 5) {
                  // Diminished (Proper Casing: Bd, Ed, Cd, Gd, F#d)
                  buttonLabel = `${bassNote}d`;
                  if (
                    stradella?.chordButton
                      ? (stradella.chordButton.row === "diminished" &&
                        stradella.chordButton.column === col) ||
                        (stradella.chordButton.label.toLowerCase() ===
                            `${bassNote.toLowerCase()}d` &&
                          col === stradella.chordButton.column) ||
                        (stradella.chordButton.label.toLowerCase() ===
                            `${bassNote.toLowerCase()}dim` &&
                          col === stradella.chordButton.column)
                      : (col === targetCol && (activeChordLabel === `${bassNote.toLowerCase()}d` ||
                        activeChordLabel === `${bassNote.toLowerCase()}dim`))
                  ) {
                    isActive = true;
                  }
                }

                // Distinct color scheme based on button type
                let btnClass =
                  "bg-zinc-900/90 border border-zinc-800 text-zinc-400 hover:border-zinc-700";
                if (isActive) {
                  if (isCounter) {
                    btnClass =
                      "bg-amber-400 border-2 border-amber-200 text-zinc-950 font-black shadow-[0_0_10px_rgba(251,191,36,0.9)] ring-2 ring-amber-400/60 scale-105";
                  } else if (rowInfo.rowIndex === 1) {
                    btnClass =
                      "bg-emerald-400 border-2 border-emerald-200 text-zinc-950 font-black shadow-[0_0_10px_rgba(52,211,153,0.9)] ring-2 ring-emerald-400/60 scale-105";
                  } else {
                    btnClass =
                      "bg-blue-500 border-2 border-blue-200 text-zinc-950 font-black shadow-[0_0_10px_rgba(59,130,246,0.9)] ring-2 ring-blue-400/60 scale-105";
                  }
                }

                // Use the active button or center column as the anchor for auto-centering
                const isAnchor = isActive && (rowInfo.rowIndex === 1 || isCounter);

                return (
                  <div
                    key={`strad-btn-${rowInfo.key}-${col}`}
                    ref={isAnchor && activeAnchorRef ? activeAnchorRef : undefined}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono select-none shrink-0 transition-all ${btnClass}`}
                    title={`Col ${col}: ${buttonLabel}`}
                  >
                    {buttonLabel}
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
