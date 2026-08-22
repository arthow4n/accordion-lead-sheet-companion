import React from "react";
import type {
  CbaDisplayMode,
  ChordDetail,
  StradellaDisplayMode,
  ViewMode,
} from "../types/index.ts";

import { COMPOUND_QUALITIES } from "../lib/stradella/compound.ts";
import { computeCbaJamFills } from "../lib/cba/jamFills.ts";
import { getPitchClassAt } from "../lib/cba/grid.ts";

export interface ChordBadgeProps {
  chord?: string | ChordDetail;
  viewMode?: ViewMode;
  cbaDisplayMode?: CbaDisplayMode;
  stradellaDisplayMode?: StradellaDisplayMode;
  jamFillsEnabled?: boolean;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  fontSizeClass?: string;
  className?: string;
}

export const BADGE_SIZE_MAP: Record<string, {
  badgeFont: string;
  badgePad: string;
  minH: string;
  subFont: string;
  dualMainFont: string;
}> = {
  "text-sm": {
    badgeFont: "text-xs",
    badgePad: "px-1.5 py-0.5",
    minH: "min-h-6",
    subFont: "text-[8px]",
    dualMainFont: "text-[10px]",
  },
  "text-base": {
    badgeFont: "text-xs sm:text-sm",
    badgePad: "px-2 py-0.5 sm:py-1",
    minH: "min-h-6 sm:min-h-7",
    subFont: "text-[9px]",
    dualMainFont: "text-[11px]",
  },
  "text-lg": {
    badgeFont: "text-sm sm:text-base",
    badgePad: "px-2.5 py-1",
    minH: "min-h-6 sm:min-h-7",
    subFont: "text-[10px]",
    dualMainFont: "text-xs",
  },
  "text-xl": {
    badgeFont: "text-base sm:text-lg",
    badgePad: "px-3 py-1.5",
    minH: "min-h-6 sm:min-h-8",
    subFont: "text-xs",
    dualMainFont: "text-sm",
  },
  "text-2xl": {
    badgeFont: "text-lg sm:text-xl",
    badgePad: "px-3.5 py-2",
    minH: "min-h-6 sm:min-h-9",
    subFont: "text-sm",
    dualMainFont: "text-base",
  },
};

const CBA_MICRO_ROWS = [
  { rowNum: 5, y: 2, xOffset: 3 },
  { rowNum: 4, y: 5.5, xOffset: 2.25 },
  { rowNum: 3, y: 9, xOffset: 1.5 },
  { rowNum: 2, y: 12.5, xOffset: 0.75 },
  { rowNum: 1, y: 16, xOffset: 0 },
];

const STRADELLA_MICRO_ROWS = [
  { rowKey: "counter", y: 2, xOffset: 0 },
  { rowKey: "bass", y: 5.5, xOffset: 1 },
  { rowKey: "major", y: 9, xOffset: 2 },
  { rowKey: "minor", y: 12.5, xOffset: 3 },
  { rowKey: "seventh", y: 16, xOffset: 4 },
];

/**
 * Checks whether a chord candidate is active / selected.
 */
export function isChordActive(
  chord?: ChordDetail | string | null,
  activeChord?: ChordDetail | string | null,
): boolean {
  if (!chord || !activeChord) return false;
  if (typeof chord === "string" && typeof activeChord === "string") {
    return chord === activeChord;
  }
  if (typeof chord === "string" && typeof activeChord === "object") {
    return (
      chord === activeChord.soundingChord?.raw ||
      chord === activeChord.originalChord?.raw
    );
  }
  if (typeof chord === "object" && typeof activeChord === "string") {
    return (
      chord.soundingChord?.raw === activeChord ||
      chord.originalChord?.raw === activeChord
    );
  }
  if (typeof chord === "object" && typeof activeChord === "object") {
    return (
      Boolean(chord.soundingChord?.raw) &&
      chord.soundingChord?.raw === activeChord.soundingChord?.raw
    );
  }
  return false;
}

export const ChordBadge: React.FC<ChordBadgeProps> = ({
  chord,
  viewMode = "stradella",
  cbaDisplayMode = "line_cards",
  stradellaDisplayMode = "badges",
  jamFillsEnabled = false,
  onSelectChord,
  active = false,
  fontSizeClass = "text-base",
  className = "",
}) => {
  if (!chord) {
    return <span className="inline-block h-6 min-w-[1.5rem]" aria-hidden="true" />;
  }

  const currentBadgeSize = BADGE_SIZE_MAP[fontSizeClass] || BADGE_SIZE_MAP["text-base"];

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation so clicking chord badge does not trigger page turns or scroll gestures (UX-05)
    e.stopPropagation();
    if (onSelectChord) {
      onSelectChord(chord);
    }
  };

  // If chord is a plain string
  if (typeof chord === "string") {
    let stringBadgeStyle = "";
    if (viewMode === "cba") {
      stringBadgeStyle = active
        ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400"
        : "bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/70 hover:border-emerald-500 text-emerald-400";
    } else if (viewMode === "guitar") {
      stringBadgeStyle = active
        ? "bg-amber-600 text-black border-amber-400 shadow-md ring-2 ring-amber-400"
        : "bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 hover:border-amber-500 text-amber-300";
    } else {
      stringBadgeStyle = active
        ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
        : "bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700";
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`relative before:absolute before:-inset-2.5 before:content-[''] ${currentBadgeSize.minH} inline-flex items-center gap-1 ${currentBadgeSize.badgePad} rounded ${currentBadgeSize.badgeFont} font-mono font-bold tracking-tight transition-all cursor-pointer select-none active:scale-95 ${stringBadgeStyle} ${className}`}
      >
        {chord}
      </button>
    );
  }

  // ChordDetail structure
  const isCounterBass = Boolean(
    chord.stradella?.isCounterBass ||
      (chord.stradella?.primaryBass && chord.stradella.primaryBass.endsWith("_")),
  );

  const rawChordName = chord.originalChord?.raw || chord.soundingChord?.raw || "Chord";
  const soundingChordName = chord.soundingChord?.raw || rawChordName;
  const primaryBass = chord.stradella?.primaryBass || chord.soundingChord?.root || "";
  const chordButton = chord.stradella?.chordButton?.label || "";

  // Classification for clean Stradella view
  const isSlash = Boolean(
    chord.soundingChord?.bassNote ||
      chord.originalChord?.bassNote ||
      soundingChordName.includes("/"),
  );

  const isCompound = Boolean(
    chord.soundingChord?.quality &&
      COMPOUND_QUALITIES.includes(chord.soundingChord.quality) &&
      chord.stradella?.chordButton &&
      !isSlash,
  );

  // Styling based on mode and counter-bass vs fundamental
  let badgeStyle = "";
  if (viewMode === "cba") {
    badgeStyle = active
      ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400 font-bold"
      : "bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/70 hover:border-emerald-500 text-emerald-400 font-semibold";
  } else if (viewMode === "guitar") {
    badgeStyle = active
      ? "bg-amber-600 text-black border-amber-400 shadow-md ring-2 ring-amber-400 font-bold"
      : "bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 text-amber-300 font-semibold";
  } else if (isCounterBass) {
    badgeStyle = active
      ? "bg-amber-600 text-black border-amber-400 shadow-md ring-2 ring-amber-400 font-bold"
      : "bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 text-amber-300 font-semibold";
  } else {
    badgeStyle = active
      ? "bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400 font-bold"
      : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-100";
  }

  // Base root for slash chords (e.g. "C" from "C/B")
  const slashBaseChord = isSlash ? soundingChordName.split("/")[0] : soundingChordName;

  // Format chord button label with proper capitalization for compound recipe
  let formattedChordBtn = chord.stradella?.chordButton?.note || chordButton;
  if (chord.stradella?.chordButton) {
    const btn = chord.stradella.chordButton;
    const btnNote = btn.note || btn.label;
    if (btn.row === "minor") {
      formattedChordBtn = `${btnNote}m`;
    } else if (btn.row === "seventh") {
      formattedChordBtn = `${btnNote}7`;
    } else if (btn.row === "diminished") {
      formattedChordBtn = `${btnNote}dim`;
    } else {
      formattedChordBtn = btnNote; // Major row
    }
  }

  // Jam Fills Scale Calculation for CBA mode
  const jamFills = (jamFillsEnabled && chord.soundingChord)
    ? computeCbaJamFills(chord.soundingChord)
    : null;
  const jamFillPcs = new Set(jamFills?.pitchClasses || []);

  // Micro Grid computation when cbaDisplayMode is "micro_badges"
  const activeButtons = chord.cba?.buttonCoords || chord.cba?.buttons || [];
  const cols = activeButtons.map((b) => b.column);
  const minCol = cols.length > 0 ? Math.min(...cols) : 3;
  const startCol = Math.max(1, minCol - 1);
  const displayCols = [startCol, startCol + 1, startCol + 2, startCol + 3, startCol + 4];
  const enteringSet = new Set(
    (chord.cba?.enteringCoords || []).map((c) => `${c.row}-${c.column}`),
  );

  // Micro Grid computation when stradellaDisplayMode is "micro_badges"
  const stradTargetCol = chord.stradella?.rootButton?.column ?? chord.stradella?.columnOffset ?? 0;
  const stradDisplayCols = [stradTargetCol - 1, stradTargetCol, stradTargetCol + 1];

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${rawChordName} (Sounding: ${soundingChordName})${
        jamFills ? ` | Fills: ${jamFills.notes.join(" · ")}` : ""
      } - Tap for button diagram`}
      className={`relative before:absolute before:-inset-2.5 before:content-[''] ${currentBadgeSize.minH} inline-flex items-center gap-1 ${currentBadgeSize.badgePad} rounded border ${currentBadgeSize.badgeFont} font-mono transition-all cursor-pointer select-none active:scale-95 ${badgeStyle} ${className}`}
    >
      {viewMode === "stradella" && (
        <span className="flex items-center gap-1">
          {isSlash
            ? (
              <span className="flex items-center font-bold">
                <span className="text-zinc-100">{slashBaseChord}</span>
                <span className="text-zinc-400 mx-0.5">/</span>
                <span
                  className={isCounterBass
                    ? "text-amber-300 underline decoration-amber-400/80 font-bold"
                    : "text-sky-400 font-bold"}
                >
                  {primaryBass}
                </span>
              </span>
            )
            : isCompound
            ? (
              <span className="flex items-baseline gap-1">
                <span className="font-bold text-sky-400">{soundingChordName}</span>
                <span
                  className={`${currentBadgeSize.subFont} text-zinc-400 font-normal opacity-90`}
                >
                  ({primaryBass}+{formattedChordBtn})
                </span>
              </span>
            )
            : <span className="font-bold text-sky-400">{soundingChordName}</span>}

          {/* Micro 3-Column Stradella SVG Grid when in micro_badges mode */}
          {stradellaDisplayMode === "micro_badges" && (
            <svg
              viewBox="0 0 20 18"
              className="w-[20px] h-[15px] overflow-visible shrink-0 ml-0.5"
              aria-hidden="true"
            >
              {STRADELLA_MICRO_ROWS.map((rowInfo) =>
                stradDisplayCols.map((col, cIdx) => {
                  let isStradActive = false;
                  let isStradCounter = false;
                  let isStradBass = false;

                  if (rowInfo.rowKey === "counter") {
                    if (
                      chord.stradella?.rootButton
                        ? chord.stradella.rootButton.row === "counter-bass" &&
                          chord.stradella.rootButton.column === col
                        : isCounterBass && col === stradTargetCol
                    ) {
                      isStradActive = true;
                      isStradCounter = true;
                    }
                  } else if (rowInfo.rowKey === "bass") {
                    if (
                      chord.stradella?.rootButton
                        ? chord.stradella.rootButton.row === "bass" &&
                          chord.stradella.rootButton.column === col
                        : !isCounterBass && col === stradTargetCol
                    ) {
                      isStradActive = true;
                      isStradBass = true;
                    }
                  } else if (rowInfo.rowKey === "major") {
                    if (
                      chord.stradella?.chordButton &&
                      chord.stradella.chordButton.row === "major" &&
                      chord.stradella.chordButton.column === col
                    ) {
                      isStradActive = true;
                    }
                  } else if (rowInfo.rowKey === "minor") {
                    if (
                      chord.stradella?.chordButton &&
                      chord.stradella.chordButton.row === "minor" &&
                      chord.stradella.chordButton.column === col
                    ) {
                      isStradActive = true;
                    }
                  } else if (rowInfo.rowKey === "seventh") {
                    if (
                      chord.stradella?.chordButton &&
                      chord.stradella.chordButton.row === "seventh" &&
                      chord.stradella.chordButton.column === col
                    ) {
                      isStradActive = true;
                    }
                  }

                  const x = 2 + rowInfo.xOffset + cIdx * 5.5;
                  const y = rowInfo.y;

                  return (
                    <circle
                      key={`strad-micro-${rowInfo.rowKey}-${col}`}
                      cx={x}
                      cy={y}
                      r={isStradActive ? 1.5 : 0.6}
                      fill={isStradCounter
                        ? "#fde047"
                        : isStradBass
                        ? "#10b981"
                        : isStradActive
                        ? "#38bdf8"
                        : "#27272a"}
                      stroke={isStradCounter
                        ? "#eab308"
                        : isStradBass
                        ? "#34d399"
                        : isStradActive
                        ? "#0284c7"
                        : "none"}
                      strokeWidth={isStradActive ? 0.4 : 0}
                    />
                  );
                })
              )}
            </svg>
          )}
        </span>
      )}

      {viewMode === "guitar" && (
        <span className="text-amber-300 font-bold tracking-tight">
          {rawChordName}
        </span>
      )}

      {viewMode === "cba" && (
        <span className="flex items-center gap-1">
          <span className="text-emerald-400 font-bold tracking-tight">
            {soundingChordName}
          </span>
          {chord.cba?.flowVector && chord.cba.flowVector !== "●" && (
            <span className="text-[10px] text-sky-400 font-bold">
              {chord.cba.flowVector}
            </span>
          )}

          {/* Jam Fills Pentatonic Scale Subtext (Concept 3) */}
          {jamFills && jamFills.notes.length > 0 && (
            <span
              className={`${currentBadgeSize.subFont} text-cyan-300 font-mono font-normal opacity-90`}
            >
              ({jamFills.notes.slice(0, 4).join("·")})
            </span>
          )}

          {/* Micro 5-Row SVG Lattice when in micro_badges mode */}
          {cbaDisplayMode === "micro_badges" && (
            <svg
              viewBox="0 0 28 18"
              className="w-[26px] h-[15px] overflow-visible shrink-0 ml-0.5"
              aria-hidden="true"
            >
              {CBA_MICRO_ROWS.map(({ rowNum, y, xOffset }) =>
                displayCols.map((col, cIdx) => {
                  const pc = getPitchClassAt(rowNum, col);
                  const isPrimary = activeButtons.some(
                    (b) => b.row === rowNum && b.column === col,
                  );
                  const isRoot = isPrimary && (
                    (chord.cba?.rootButtonCoord &&
                      chord.cba.rootButtonCoord.row === rowNum &&
                      chord.cba.rootButtonCoord.column === col) ||
                    activeButtons.find((b) => b.row === rowNum && b.column === col)
                        ?.finger === 1
                  );
                  const isEntering = isPrimary && !isRoot &&
                    enteringSet.has(`${rowNum}-${col}`);
                  const isJamFillDot = !isPrimary && jamFillPcs.has(pc);
                  const x = xOffset + 2 + cIdx * 5;

                  return (
                    <circle
                      key={`micro-${rowNum}-${col}`}
                      cx={x}
                      cy={y}
                      r={isRoot ? 1.6 : isPrimary ? 1.4 : isJamFillDot ? 0.9 : 0.6}
                      fill={isRoot
                        ? "#fde047"
                        : isEntering
                        ? "#38bdf8"
                        : isPrimary
                        ? "#10b981"
                        : isJamFillDot
                        ? "#06b6d4"
                        : "#27272a"}
                      stroke={isRoot
                        ? "#eab308"
                        : isEntering
                        ? "#0284c7"
                        : isPrimary
                        ? "#34d399"
                        : isJamFillDot
                        ? "#0891b2"
                        : "none"}
                      strokeWidth={isPrimary ? 0.4 : isJamFillDot ? 0.3 : 0}
                    />
                  );
                })
              )}
            </svg>
          )}
        </span>
      )}

      {viewMode === "dual" && (
        <span className="flex flex-col items-start leading-none py-0.5">
          <span className={`${currentBadgeSize.dualMainFont} font-bold text-zinc-100`}>
            {rawChordName}
          </span>
          <span className={`flex items-center gap-0.5 ${currentBadgeSize.subFont} text-zinc-400`}>
            {isSlash
              ? (
                <span className={isCounterBass ? "text-amber-400 font-bold" : "text-sky-400"}>
                  /{primaryBass}
                </span>
              )
              : isCompound
              ? <span>{primaryBass}+{formattedChordBtn}</span>
              : <span className="text-sky-400 font-semibold">{soundingChordName}</span>}
          </span>
        </span>
      )}
    </button>
  );
};
