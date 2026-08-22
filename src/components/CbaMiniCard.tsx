import React from "react";
import type { CbaButtonCoord, ChordDetail, ParsedChord } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { parseChord } from "../lib/capo/transposition.ts";
import { getNoteName } from "../lib/capo/enharmonics.ts";
import { getPitchClassAt } from "../lib/cba/grid.ts";

export interface CbaMiniCardProps {
  chord: ChordDetail | string;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  fontSizeClass?: string;
  className?: string;
}

// 5 Rows in top-to-bottom visual order with authentic 60-degree diagonal stagger
export const CBA_MINI_ROWS = [
  { rowNum: 5, y: 6, xOffset: 12 },
  { rowNum: 4, y: 15, xOffset: 9 },
  { rowNum: 3, y: 24, xOffset: 6 },
  { rowNum: 2, y: 33, xOffset: 3 },
  { rowNum: 1, y: 42, xOffset: 0 },
];

// Font and Card Scaling Map
export const CBA_MINI_SCALE_MAP: Record<string, {
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
    notesSize: "text-[11px]",
    svgW: "w-[62px]",
    svgH: "h-[46px]",
    minW: "min-w-[80px]",
  },
  "text-base": {
    cardPad: "p-2",
    titleSize: "text-base",
    notesSize: "text-xs",
    svgW: "w-[72px]",
    svgH: "h-[52px]",
    minW: "min-w-[92px]",
  },
  "text-lg": {
    cardPad: "p-2.5",
    titleSize: "text-lg",
    notesSize: "text-sm",
    svgW: "w-[84px]",
    svgH: "h-[60px]",
    minW: "min-w-[106px]",
  },
  "text-xl": {
    cardPad: "p-3",
    titleSize: "text-xl",
    notesSize: "text-base",
    svgW: "w-[96px]",
    svgH: "h-[68px]",
    minW: "min-w-[122px]",
  },
  "text-2xl": {
    cardPad: "p-3.5",
    titleSize: "text-2xl",
    notesSize: "text-lg",
    svgW: "w-[110px]",
    svgH: "h-[78px]",
    minW: "min-w-[138px]",
  },
};

export const CbaMiniCard: React.FC<CbaMiniCardProps> = ({
  chord,
  onSelectChord,
  active = false,
  fontSizeClass = "text-base",
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

  // Determine dynamic column range to display ALL active buttons (minimum 5 columns, with padding)
  const cols = activeButtons.map((b) => b.column);
  const rawMinCol = cols.length > 0 ? Math.min(...cols) : 3;
  const rawMaxCol = cols.length > 0 ? Math.max(...cols) : 6;
  const startCol = Math.max(1, rawMinCol - 1);
  const endCol = Math.min(12, Math.max(startCol + 4, rawMaxCol + 1));
  const displayCols: number[] = [];
  for (let c = startCol; c <= endCol; c++) {
    displayCols.push(c);
  }

  // Determine if note spelling should prefer flats
  const preferFlats = notes.some((n) => n.includes("b")) ||
    Boolean(soundingChord?.root && soundingChord.root.includes("b"));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectChord) {
      onSelectChord(chordDetail);
    }
  };

  const currentScale = CBA_MINI_SCALE_MAP[fontSizeClass] || CBA_MINI_SCALE_MAP["text-base"];

  const colSpacing = 9.5;
  const svgWidth = 14 + (displayCols.length - 1) * colSpacing + 12;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${chordName}: ${notes.join(" - ")} (5-Row CBA Grip)`}
      className={`flex flex-col items-center justify-between ${currentScale.cardPad} rounded-xl border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
        active
          ? "bg-emerald-950/90 border-emerald-400 shadow-md ring-1 ring-emerald-400"
          : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-emerald-600/60"
      } ${currentScale.minW} ${className}`}
    >
      {/* Bold Chord Title + Note Spellings Subtitle */}
      <div className="flex flex-col items-center justify-center gap-0.5 mb-1.5 w-full">
        <span
          className={`${currentScale.titleSize} font-black text-emerald-400 font-mono tracking-tight leading-none`}
        >
          {chordName}
        </span>
        {notes.length > 0 && (
          <span
            className={`${currentScale.notesSize} text-zinc-300 font-mono font-bold tracking-tight leading-snug text-center whitespace-nowrap`}
          >
            {notes.join(" · ")}
          </span>
        )}
      </div>

      {/* Authentic Staggered 5-Row CBA Lattice with In-Button Notes */}
      <div className="bg-zinc-950/90 rounded-lg p-1 border border-zinc-800/80 shadow-inner flex items-center justify-center">
        <svg
          viewBox={`0 0 ${svgWidth} 48`}
          className={`${currentScale.svgW} ${currentScale.svgH} overflow-visible`}
          aria-hidden="true"
        >
          {CBA_MINI_ROWS.map(({ rowNum, y, xOffset }) => {
            return displayCols.map((col, colIdx) => {
              const pc = getPitchClassAt(rowNum, col);
              const noteName = getNoteName(pc, preferFlats);

              // Direct active button in primary grip
              const isDirectActive = activeButtons.some(
                (b) => b.row === rowNum && b.column === col,
              );

              // Two-way auxiliary duplicate highlighting
              const isAuxDuplicate = !isDirectActive && activeButtons.some((b) => {
                const bEff = ((b.row - 1) % 3) + 1;
                const curEff = ((rowNum - 1) % 3) + 1;
                return bEff === curEff && b.column === col;
              });

              // Soft Warm Amber-Gold Root Note Beacon (Finger 1)
              const isRoot = isDirectActive && (
                (grip.rootButtonCoord && grip.rootButtonCoord.row === rowNum &&
                  grip.rootButtonCoord.column === col) ||
                activeButtons.find((b) => b.row === rowNum && b.column === col)?.finger === 1
              );

              const isLit = isDirectActive || isAuxDuplicate;
              const isPrimary = isDirectActive;
              const x = xOffset + 5 + colIdx * colSpacing;

              return (
                <g key={`cba-dot-${rowNum}-${col}`}>
                  {/* Glowing ring for active primary buttons */}
                  {isPrimary && (
                    <circle
                      cx={x}
                      cy={y}
                      r={isRoot ? 5.2 : 4.8}
                      fill="none"
                      stroke={isRoot ? "#fde047" : "#34d399"}
                      strokeWidth={isRoot ? 1.4 : 1.2}
                      opacity={0.85}
                    />
                  )}

                  {/* Button circle: Soft Amber-Gold for Root, Emerald for Chord Tones */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isRoot ? 4.4 : isPrimary ? 4.2 : isAuxDuplicate ? 3.6 : 2.0}
                    fill={isRoot
                      ? "#fde047"
                      : isPrimary
                      ? "#10b981"
                      : isAuxDuplicate
                      ? "#065f46"
                      : "#27272a"}
                    stroke={isRoot
                      ? "#eab308"
                      : isPrimary
                      ? "#34d399"
                      : isAuxDuplicate
                      ? "#10b981"
                      : "#3f3f46"}
                    strokeWidth={isLit ? (isRoot ? 1.1 : 0.8) : 0.4}
                  />

                  {/* Direct In-Button Note Initials on lit buttons */}
                  {isLit && noteName && (
                    <text
                      x={x}
                      y={y + (noteName.length > 2 ? 0.9 : 1.1)}
                      fontSize={isPrimary
                        ? (noteName.length > 2 ? "2.6" : "3.2")
                        : (noteName.length > 2 ? "2.3" : "2.7")}
                      fontWeight={isRoot ? "900" : "bold"}
                      fontFamily="monospace"
                      textAnchor="middle"
                      fill={isRoot ? "#451a03" : isPrimary ? "#022c22" : "#a7f3d0"}
                      className="select-none pointer-events-none"
                    >
                      {noteName}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>
    </button>
  );
};
