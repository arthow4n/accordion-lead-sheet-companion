import React from "react";
import type { CbaButtonCoord, ChordDetail, ParsedChord } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { generateCbaGrip } from "../lib/cba/grips.ts";
import { parseChord } from "../lib/capo/transposition.ts";
import { getNoteName } from "../lib/capo/enharmonics.ts";
import { getPitchClassAt } from "../lib/cba/grid.ts";
import { computeCbaJamFills } from "../lib/cba/jamFills.ts";

export interface CbaMiniCardProps {
  chord: ChordDetail | string;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  fontSizeClass?: string;
  jamFillsEnabled?: boolean;
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
  jamFillsEnabled = false,
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
  const exitingButtons: CbaButtonCoord[] = grip.exitingCoords || [];

  // Jam Fills calculation
  const jamFills = jamFillsEnabled ? computeCbaJamFills(soundingChord) : null;
  const jamFillPcs = new Set(jamFills?.pitchClasses || []);

  // Determine dynamic column range to display active AND ghost buttons (minimum 5 columns, with padding)
  const allRelevantButtons = [...activeButtons, ...exitingButtons];
  const cols = allRelevantButtons.map((b) => b.column);
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

  // Track entering (newly struck in transition) vs shared coordinates
  const enteringSet = new Set(
    (grip.enteringCoords || []).map((c) => `${c.row}-${c.column}`),
  );

  // Track ghost (released voices from previous chord) coordinates
  const exitingSet = new Set(
    (grip.exitingCoords || []).map((c) => `${c.row}-${c.column}`),
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${chordName}: ${notes.join(" - ")}${
        jamFills ? ` | Fills: ${jamFills.notes.join(" · ")}` : ""
      } (5-Row CBA Grip)`}
      className={`flex flex-col items-center justify-between ${currentScale.cardPad} rounded-xl border transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
        active
          ? "bg-emerald-950/90 border-emerald-400 shadow-md ring-1 ring-emerald-400"
          : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-emerald-600/60"
      } ${currentScale.minW} ${className}`}
    >
      {/* Bold Chord Title + Note Spellings Subtitle + Flow Vector */}
      <div className="flex flex-col items-center justify-center gap-0.5 mb-1.5 w-full">
        <div className="flex items-center gap-1">
          <span
            className={`${currentScale.titleSize} font-black text-emerald-400 font-mono tracking-tight leading-none`}
          >
            {chordName}
          </span>
          {grip.flowVector && grip.flowVector !== "●" && (
            <span className="text-[10px] text-sky-400 font-mono font-bold">
              {grip.flowVector}
            </span>
          )}
        </div>
        {notes.length > 0 && (
          <span
            className={`${currentScale.notesSize} text-zinc-300 font-mono font-bold tracking-tight leading-snug text-center whitespace-nowrap`}
          >
            {notes.join(" · ")}
          </span>
        )}
        {/* Scale-Enriched Jam Fills Note Pool (Concept 1) */}
        {jamFills && jamFills.notes.length > 0 && (
          <span className="text-[9px] text-cyan-300 font-mono font-bold tracking-tight leading-tight text-center whitespace-nowrap bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-500/40">
            ✨ {jamFills.notes.slice(0, 5).join("·")}
          </span>
        )}
      </div>

      {/* Authentic Staggered 5-Row CBA Lattice with In-Button Notes, Ghost Release Anchors & Cyan Fills */}
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
              const isPrimary = activeButtons.some(
                (b) => b.row === rowNum && b.column === col,
              );

              // Soft Warm Amber-Gold Root Note Beacon (Finger 1)
              const isRoot = isPrimary && (
                (grip.rootButtonCoord && grip.rootButtonCoord.row === rowNum &&
                  grip.rootButtonCoord.column === col) ||
                activeButtons.find((b) => b.row === rowNum && b.column === col)?.finger === 1
              );

              // Check if button is an entering tone in the voice leading transition
              const isEntering = isPrimary && !isRoot && enteringSet.has(`${rowNum}-${col}`);

              // Check if button is a ghost tone released from the previous chord
              const isGhost = !isPrimary && exitingSet.has(`${rowNum}-${col}`);

              // Check if button is an improvisational fill scale tone (Concept 1)
              const isJamFill = !isPrimary && !isGhost && jamFillPcs.has(pc);

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
                      stroke={isRoot ? "#fde047" : isEntering ? "#38bdf8" : "#34d399"}
                      strokeWidth={isRoot ? 1.4 : 1.2}
                      opacity={0.9}
                    />
                  )}

                  {/* Button circle: Amber Root, Sky Blue Entering, Emerald Kept, Ghost Indigo, Cyan Fills */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isRoot ? 4.4 : isPrimary ? 4.2 : isGhost ? 3.8 : isJamFill ? 3.4 : 2.0}
                    fill={isRoot
                      ? "#fde047"
                      : isEntering
                      ? "#38bdf8"
                      : isPrimary
                      ? "#10b981"
                      : isGhost
                      ? "rgba(49, 46, 129, 0.5)"
                      : isJamFill
                      ? "rgba(8, 51, 68, 0.85)"
                      : "#27272a"}
                    stroke={isRoot
                      ? "#eab308"
                      : isEntering
                      ? "#0284c7"
                      : isPrimary
                      ? "#34d399"
                      : isGhost
                      ? "#818cf8"
                      : isJamFill
                      ? "#06b6d4"
                      : "#3f3f46"}
                    strokeWidth={isPrimary
                      ? (isRoot ? 1.1 : 0.8)
                      : isGhost
                      ? 0.9
                      : isJamFill
                      ? 0.7
                      : 0.4}
                    strokeDasharray={isGhost ? "1.5 1.5" : undefined}
                  />

                  {/* Direct In-Button Note Initials on active buttons */}
                  {isPrimary && noteName && (
                    <text
                      x={x}
                      y={y + (noteName.length > 2 ? 0.9 : 1.1)}
                      fontSize={noteName.length > 2 ? "2.6" : "3.2"}
                      fontWeight={isRoot ? "900" : "bold"}
                      fontFamily="monospace"
                      textAnchor="middle"
                      fill={isRoot ? "#451a03" : isEntering ? "#082f49" : "#022c22"}
                      className="select-none pointer-events-none"
                    >
                      {noteName}
                    </text>
                  )}

                  {/* Faint note initials on ghost anchor buttons */}
                  {isGhost && noteName && (
                    <text
                      x={x}
                      y={y + (noteName.length > 2 ? 0.8 : 1.0)}
                      fontSize={noteName.length > 2 ? "2.2" : "2.7"}
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fill="#c7d2fe"
                      opacity={0.8}
                      className="select-none pointer-events-none"
                    >
                      {noteName}
                    </text>
                  )}

                  {/* Cyan note initials on Jam Fill scale buttons (Concept 1) */}
                  {isJamFill && noteName && (
                    <text
                      x={x}
                      y={y + (noteName.length > 2 ? 0.8 : 1.0)}
                      fontSize={noteName.length > 2 ? "2.2" : "2.7"}
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fill="#a5f3fc"
                      opacity={0.9}
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
