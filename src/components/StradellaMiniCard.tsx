import React from "react";
import type {
  ChordDetail,
  ParsedChord,
  StradellaTransition,
  StradellaVoicing,
} from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { solveStradellaChord } from "../lib/stradella/solver.ts";
import { parseChord } from "../lib/capo/transposition.ts";
import { getBassNoteForColumn, getCounterBassNoteForColumn } from "../lib/stradella/layout.ts";
import { formatStradellaTransition } from "../lib/stradella/transitions.ts";

export interface StradellaMiniCardProps {
  chord: ChordDetail | string;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  fontSizeClass?: string;
  className?: string;
  stradellaTransition?: StradellaTransition;
}

export const STRADELLA_MINI_ROWS = [
  { key: "counter", rowIndex: 0, y: 6, xOffset: 0 },
  { key: "bass", rowIndex: 1, y: 15, xOffset: 4 },
  { key: "major", rowIndex: 2, y: 24, xOffset: 8 },
  { key: "minor", rowIndex: 3, y: 33, xOffset: 12 },
  { key: "seventh", rowIndex: 4, y: 42, xOffset: 16 },
  { key: "dim", rowIndex: 5, y: 51, xOffset: 20 },
];

export const STRADELLA_MINI_SCALE_MAP: Record<string, {
  cardPad: string;
  titleSize: string;
  notesSize: string;
  svgW: string;
  svgH: string;
  minW: string;
}> = {
  "text-sm": {
    cardPad: "p-1.5",
    titleSize: "text-sm",
    notesSize: "text-[10px]",
    svgW: "w-[62px]",
    svgH: "h-[50px]",
    minW: "min-w-[80px]",
  },
  "text-base": {
    cardPad: "p-2",
    titleSize: "text-base",
    notesSize: "text-xs",
    svgW: "w-[72px]",
    svgH: "h-[56px]",
    minW: "min-w-[92px]",
  },
  "text-lg": {
    cardPad: "p-2.5",
    titleSize: "text-lg",
    notesSize: "text-xs",
    svgW: "w-[84px]",
    svgH: "h-[64px]",
    minW: "min-w-[106px]",
  },
  "text-xl": {
    cardPad: "p-3",
    titleSize: "text-xl",
    notesSize: "text-sm",
    svgW: "w-[96px]",
    svgH: "h-[72px]",
    minW: "min-w-[122px]",
  },
  "text-2xl": {
    cardPad: "p-3.5",
    titleSize: "text-2xl",
    notesSize: "text-base",
    svgW: "w-[110px]",
    svgH: "h-[82px]",
    minW: "min-w-[138px]",
  },
};

export const StradellaMiniCard: React.FC<StradellaMiniCardProps> = ({
  chord,
  onSelectChord,
  active = false,
  fontSizeClass = "text-base",
  className = "",
  stradellaTransition,
}) => {
  const chordDetail: ChordDetail = typeof chord === "string" ? enrichChord(chord, 0) : chord;
  const soundingChord: ParsedChord = chordDetail.soundingChord ||
    chordDetail.originalChord ||
    parseChord(typeof chord === "string" ? chord : "C");

  const chordName = soundingChord.raw || (typeof chord === "string" ? chord : "Chord");
  const stradella: StradellaVoicing = chordDetail.stradella || solveStradellaChord(soundingChord);

  const activeBassLabel = stradella.primaryBass || soundingChord.root || "";
  const activeChordLabel = stradella.chordButton?.label || "";
  const isCounterBass = Boolean(stradella.isCounterBass || activeBassLabel.endsWith("_"));
  const transitionMarker = formatStradellaTransition(stradellaTransition);
  const transitionDescription = stradellaTransition
    ? stradellaTransition.direction === "same"
      ? "No horizontal move"
      : `Move ${stradellaTransition.direction} ${stradellaTransition.distance} Stradella column${
        stradellaTransition.distance === 1 ? "" : "s"
      }`
    : "";

  // Track active columns
  const activeCols: number[] = [];
  if (typeof stradella.rootButton?.column === "number") {
    activeCols.push(stradella.rootButton.column);
  }
  if (typeof stradella.chordButton?.column === "number") {
    activeCols.push(stradella.chordButton.column);
  }
  if (typeof stradella.columnOffset === "number" && activeCols.length === 0) {
    activeCols.push(stradella.columnOffset);
  }
  if (activeCols.length === 0) {
    activeCols.push(0);
  }

  const centerCol = Math.round(activeCols.reduce((a, b) => a + b, 0) / activeCols.length);
  const startCol = centerCol - 2;
  const endCol = centerCol + 2;
  const displayCols: number[] = [];
  for (let c = startCol; c <= endCol; c++) {
    displayCols.push(c);
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectChord) {
      onSelectChord(chordDetail);
    }
  };

  const currentScale = STRADELLA_MINI_SCALE_MAP[fontSizeClass] ||
    STRADELLA_MINI_SCALE_MAP["text-base"];
  const colSpacing = 11;
  const svgWidth = 14 + (displayCols.length - 1) * colSpacing + 24;

  // Recipe display text (e.g. "B_ + C" or "C + em" or "G + G")
  const recipeText = isCounterBass
    ? `${activeBassLabel} + ${activeChordLabel || chordName}`
    : stradella.chordButton && stradella.chordButton.note !== activeBassLabel
    ? `${activeBassLabel} + ${stradella.chordButton.note}${
      stradella.chordButton.row === "minor"
        ? "m"
        : stradella.chordButton.row === "seventh"
        ? "7"
        : stradella.chordButton.row === "diminished"
        ? "d"
        : ""
    }`
    : activeChordLabel
    ? `${activeBassLabel} + ${activeChordLabel}`
    : activeBassLabel;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${chordName}: Stradella (${recipeText})${
        transitionDescription ? ` | ${transitionDescription}` : ""
      }`}
      className={`flex flex-col items-center justify-between ${currentScale.cardPad} rounded-xl border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
        active
          ? "bg-blue-950/90 border-blue-400 shadow-md ring-1 ring-blue-400"
          : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-blue-500/60"
      } ${currentScale.minW} ${className}`}
    >
      {/* Chord Name Header + Recipe Subtitle */}
      <div className="flex flex-col items-center justify-center gap-0.5 mb-1.5 w-full">
        <div className="flex items-center justify-center gap-1">
          <span
            className={`font-mono font-black tracking-tight text-blue-400 leading-tight ${currentScale.titleSize}`}
          >
            {chordName}
          </span>
          {transitionMarker && (
            <span
              className="font-mono text-[10px] font-black leading-none text-zinc-300 whitespace-nowrap"
              aria-label={transitionDescription}
              title={transitionDescription}
            >
              {transitionMarker}
            </span>
          )}
        </div>
        <span
          className={`font-mono font-semibold text-zinc-400 leading-tight ${currentScale.notesSize}`}
        >
          [{recipeText}]
        </span>
      </div>

      {/* Micro 6-Row Stradella Circle of Fifths Button Matrix */}
      <div className="flex items-center justify-center w-full py-0.5">
        <svg
          viewBox={`0 0 ${svgWidth} 58`}
          className={`${currentScale.svgW} ${currentScale.svgH} overflow-visible`}
          aria-hidden="true"
        >
          {STRADELLA_MINI_ROWS.map((rowInfo) =>
            displayCols.map((col, cIdx) => {
              const bassNote = getBassNoteForColumn(col);
              const counterNote = getCounterBassNoteForColumn(col);

              let buttonLabel = "";
              let isCounter = false;
              let isActive = false;

              if (rowInfo.rowIndex === 0) {
                // Counter-Bass
                buttonLabel = `${counterNote}_`;
                isCounter = true;
                if (
                  stradella.rootButton
                    ? stradella.rootButton.row === "counter-bass" &&
                      stradella.rootButton.column === col
                    : isCounterBass && col === stradella.columnOffset
                ) {
                  isActive = true;
                }
              } else if (rowInfo.rowIndex === 1) {
                // Fundamental Bass
                buttonLabel = bassNote;
                if (
                  stradella.rootButton
                    ? stradella.rootButton.row === "bass" &&
                      stradella.rootButton.column === col
                    : !isCounterBass && col === stradella.columnOffset
                ) {
                  isActive = true;
                }
              } else if (rowInfo.rowIndex === 2) {
                // Major
                buttonLabel = bassNote;
                if (
                  stradella.chordButton &&
                  stradella.chordButton.row === "major" &&
                  stradella.chordButton.column === col
                ) {
                  isActive = true;
                }
              } else if (rowInfo.rowIndex === 3) {
                // Minor
                buttonLabel = `${bassNote}m`;
                if (
                  stradella.chordButton &&
                  stradella.chordButton.row === "minor" &&
                  stradella.chordButton.column === col
                ) {
                  isActive = true;
                }
              } else if (rowInfo.rowIndex === 4) {
                // Seventh
                buttonLabel = `${bassNote}7`;
                if (
                  stradella.chordButton &&
                  stradella.chordButton.row === "seventh" &&
                  stradella.chordButton.column === col
                ) {
                  isActive = true;
                }
              } else if (rowInfo.rowIndex === 5) {
                // Diminished
                buttonLabel = `${bassNote}d`;
                if (
                  stradella.chordButton &&
                  stradella.chordButton.row === "diminished" &&
                  stradella.chordButton.column === col
                ) {
                  isActive = true;
                }
              }

              const x = 7 + rowInfo.xOffset + cIdx * colSpacing;
              const y = rowInfo.y;

              const isBassActive = isActive && (rowInfo.rowIndex === 1 || isCounter);
              const isChordActiveBtn = isActive && rowInfo.rowIndex >= 2;

              let fill = "#27272a";
              let stroke = "#3f3f46";
              let strokeWidth = 0.5;
              let textColor = "#a1a1aa";
              let r = 3.6;

              if (isBassActive) {
                if (isCounter) {
                  fill = "#fde047";
                  stroke = "#eab308";
                  strokeWidth = 1.2;
                  textColor = "#451a03";
                  r = 4.4;
                } else {
                  fill = "#10b981";
                  stroke = "#34d399";
                  strokeWidth = 1.2;
                  textColor = "#022c22";
                  r = 4.4;
                }
              } else if (isChordActiveBtn) {
                fill = "#38bdf8";
                stroke = "#0284c7";
                strokeWidth = 1.2;
                textColor = "#082f49";
                r = 4.2;
              }

              return (
                <g key={`sm-btn-${rowInfo.key}-${col}`}>
                  {isActive && (
                    <circle
                      cx={x}
                      cy={y}
                      r={r + 1.6}
                      fill="none"
                      stroke={fill}
                      strokeWidth={0.8}
                      opacity={0.6}
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                  {isActive && (
                    <text
                      x={x}
                      y={y + 1.2}
                      textAnchor="middle"
                      fontSize={buttonLabel.length > 2 ? 3 : 3.5}
                      fontFamily="monospace"
                      fontWeight="900"
                      fill={textColor}
                    >
                      {buttonLabel}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>
    </button>
  );
};
