import React, { useState } from "react";
import type {
  CbaDisplayMode,
  ChordDetail,
  ChordLyricSegment,
  LeadSheetLine,
  NoteSpelling,
  StradellaDisplayMode,
  StradellaTransition,
  ViewMode,
} from "../types/index.ts";
import { ChordBadge, isChordActive } from "./ChordBadge.tsx";
import { CbaMiniCard } from "./CbaMiniCard.tsx";
import { StradellaMiniCard } from "./StradellaMiniCard.tsx";
import { isMeasureDelimiter } from "../lib/parser/twoline.ts";

export interface LineRendererProps {
  line: LeadSheetLine | ChordLyricSegment[];
  viewMode?: ViewMode;
  cbaDisplayMode?: CbaDisplayMode;
  stradellaDisplayMode?: StradellaDisplayMode;
  jamFillsEnabled?: boolean;
  noteSpelling?: NoteSpelling;
  onSelectChord?: (chord: ChordDetail | string) => void;
  selectedChord?: ChordDetail | string | null;
  fontSizeClass?: string;
  sectionChords?: Array<ChordDetail | string>;
}

export interface TabStaffLineProps {
  line: LeadSheetLine;
  defaultExpanded?: boolean;
}

type ChordSegmentWithChord = ChordLyricSegment & {
  chord: NonNullable<ChordLyricSegment["chord"]>;
};

interface LineChordEntry {
  chord: ChordSegmentWithChord["chord"];
  stradellaTransition?: StradellaTransition;
}

function extractLineChords(segments: ChordLyricSegment[]): LineChordEntry[] {
  return segments
    .filter((segment): segment is ChordSegmentWithChord => Boolean(segment.chord))
    .map((segment) => ({
      chord: segment.chord,
      stradellaTransition: segment.stradellaTransition,
    }));
}

/**
 * Collapsible ASCII Tab Staves Container Component
 */
export const TabStaffLine: React.FC<TabStaffLineProps> = ({
  line,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const tabContent = line.tabBlock && line.tabBlock.length > 0
    ? line.tabBlock.join("\n")
    : (line.rawText || "");

  return (
    <div className="py-1.5 my-1 max-w-full">
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-mono font-semibold transition-colors cursor-pointer select-none"
          aria-expanded={isExpanded}
        >
          <span>🎸</span>
          <span>Guitar Tab Riffs</span>
          <span className="text-zinc-400 font-bold">
            [{isExpanded ? "Hide" : "Show"}]
          </span>
        </button>
      </div>
      {isExpanded && (
        <pre className="font-mono text-xs text-zinc-300 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 overflow-x-auto whitespace-pre leading-relaxed select-text">
          {tabContent}
        </pre>
      )}
    </div>
  );
};

/**
 * Helper to determine whether a line is a dense measure/instrumental line (no vocal lyrics).
 */
export function isDenseMeasureLine(segments: ChordLyricSegment[]): boolean {
  if (!segments || segments.length === 0) return false;

  let hasChordsOrDelimiters = false;

  for (const seg of segments) {
    if (seg.chord) {
      hasChordsOrDelimiters = true;
    }
    const lyric = (seg.lyric || "").trim();
    if (lyric) {
      if (isMeasureDelimiter(lyric) || /^[|:/\s]+$/.test(lyric)) {
        hasChordsOrDelimiters = true;
      } else {
        // Contains actual vocal lyrics, so this is a standard chord-lyric line
        return false;
      }
    }
  }

  return hasChordsOrDelimiters;
}

export const LineRenderer: React.FC<LineRendererProps> = ({
  line,
  viewMode = "stradella",
  cbaDisplayMode = "line_cards",
  stradellaDisplayMode = "badges",
  jamFillsEnabled = false,
  noteSpelling = "auto",
  onSelectChord,
  selectedChord,
  fontSizeClass = "text-base",
  sectionChords = [],
}) => {
  const renderDenseMeasureLine = (segments: ChordLyricSegment[]) => {
    // Extract line-level chronological chords
    const lineChords = extractLineChords(segments);

    const content = (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 leading-relaxed max-w-full overflow-x-clip">
        {segments.map((segment, idx) => {
          const lyricTrim = (segment.lyric || "").trim();
          const isDelim = !segment.chord &&
            (isMeasureDelimiter(lyricTrim) || /^[|:/\s]+$/.test(lyricTrim));

          if (isDelim) {
            return (
              <div
                key={`delim-${idx}`}
                className="inline-flex items-center justify-center px-1.5 py-0.5 text-zinc-500 font-mono font-bold select-none border-r border-zinc-700/60 self-center text-sm"
                aria-hidden="true"
              >
                {lyricTrim}
              </div>
            );
          }

          return (
            <div
              key={`seg-${idx}`}
              className="inline-flex items-center gap-1.5 min-h-[1.75rem] min-w-0"
            >
              <ChordBadge
                chord={segment.chord}
                viewMode={viewMode}
                cbaDisplayMode={cbaDisplayMode}
                stradellaDisplayMode={stradellaDisplayMode}
                jamFillsEnabled={jamFillsEnabled}
                noteSpelling={noteSpelling}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                active={isChordActive(segment.chord, selectedChord)}
                stradellaTransition={segment.stradellaTransition}
              />
            </div>
          );
        })}
      </div>
    );

    // Line-level mini-cards for CBA
    if (viewMode === "cba" && cbaDisplayMode === "line_cards" && lineChords.length > 0) {
      return (
        <div className="flex flex-col gap-1.5 my-1 max-w-full">
          <div className="flex flex-wrap items-center gap-1.5 pb-1 overflow-x-auto">
            {lineChords.map(({ chord }, cIdx) => (
              <CbaMiniCard
                key={`measure-line-cba-${cIdx}`}
                chord={chord}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                jamFillsEnabled={jamFillsEnabled}
                noteSpelling={noteSpelling}
                active={isChordActive(chord, selectedChord)}
              />
            ))}
          </div>
          {content}
        </div>
      );
    }

    // Line-level mini-cards for Stradella LH
    if (
      viewMode === "stradella" && stradellaDisplayMode === "line_cards" &&
      lineChords.length > 0
    ) {
      return (
        <div className="flex flex-col gap-1.5 my-1 max-w-full">
          <div className="flex flex-wrap items-center gap-1.5 pb-1 overflow-x-auto">
            {lineChords.map(({ chord, stradellaTransition }, cIdx) => (
              <StradellaMiniCard
                key={`measure-line-strad-${cIdx}`}
                chord={chord}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                active={isChordActive(chord, selectedChord)}
                stradellaTransition={stradellaTransition}
                noteSpelling={noteSpelling}
              />
            ))}
          </div>
          {content}
        </div>
      );
    }

    return content;
  };

  const renderStandardChordLyricLine = (segments: ChordLyricSegment[]) => {
    // Extract line-level chronological chords
    const lineChords = extractLineChords(segments);

    const content = (
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 leading-normal max-w-full overflow-x-clip">
        {segments.map((segment, idx) => (
          <div
            key={`seg-${idx}`}
            className="inline-flex flex-col items-start max-w-full min-w-0"
            style={{ display: "inline-flex", flexDirection: "column" }}
          >
            <div className="min-h-[1.5rem] flex items-center mb-0.5">
              <ChordBadge
                chord={segment.chord}
                viewMode={viewMode}
                cbaDisplayMode={cbaDisplayMode}
                stradellaDisplayMode={stradellaDisplayMode}
                jamFillsEnabled={jamFillsEnabled}
                noteSpelling={noteSpelling}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                active={isChordActive(segment.chord, selectedChord)}
                stradellaTransition={segment.stradellaTransition}
              />
            </div>
            <span
              className={`lyric-syllable font-sans font-medium text-zinc-100 whitespace-pre whitespace-pre-wrap break-words max-w-full min-w-0 ${fontSizeClass}`}
            >
              {segment.lyric || (segment.chord ? "\u00A0" : "")}
            </span>
          </div>
        ))}
      </div>
    );

    // Line-level mini-cards for CBA
    if (viewMode === "cba" && cbaDisplayMode === "line_cards" && lineChords.length > 0) {
      return (
        <div className="flex flex-col gap-1 my-1 max-w-full">
          <div className="flex flex-wrap items-center gap-1.5 pb-1 overflow-x-auto">
            {lineChords.map(({ chord }, cIdx) => (
              <CbaMiniCard
                key={`line-cba-${cIdx}`}
                chord={chord}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                jamFillsEnabled={jamFillsEnabled}
                noteSpelling={noteSpelling}
                active={isChordActive(chord, selectedChord)}
              />
            ))}
          </div>
          {content}
        </div>
      );
    }

    // Line-level mini-cards for Stradella LH
    if (
      viewMode === "stradella" && stradellaDisplayMode === "line_cards" &&
      lineChords.length > 0
    ) {
      return (
        <div className="flex flex-col gap-1 my-1 max-w-full">
          <div className="flex flex-wrap items-center gap-1.5 pb-1 overflow-x-auto">
            {lineChords.map(({ chord, stradellaTransition }, cIdx) => (
              <StradellaMiniCard
                key={`line-strad-${cIdx}`}
                chord={chord}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                active={isChordActive(chord, selectedChord)}
                stradellaTransition={stradellaTransition}
                noteSpelling={noteSpelling}
              />
            ))}
          </div>
          {content}
        </div>
      );
    }

    return content;
  };

  // Support both LeadSheetLine objects and raw ChordLyricSegment[] arrays
  if (Array.isArray(line)) {
    if (isDenseMeasureLine(line)) {
      return renderDenseMeasureLine(line);
    }
    return renderStandardChordLyricLine(line);
  }

  // Handle distinct line types
  switch (line.type) {
    case "section_header": {
      const title = line.headerTitle || line.rawText || "";
      const displayTitle = title.replace(/[\[\]]/g, "").trim();
      return (
        <div className="pt-4 pb-2 mt-2 border-b border-zinc-800/80 flex flex-col gap-2 max-w-full">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-xs font-bold font-mono uppercase tracking-wider">
              {displayTitle}
            </span>
          </div>

          {/* If CBA mode and sectionChords exist, render 5-row mini-cards row */}
          {viewMode === "cba" && sectionChords && sectionChords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 overflow-x-auto">
              {sectionChords.map((chord, cIdx) => (
                <CbaMiniCard
                  key={`sec-cba-${cIdx}`}
                  chord={chord}
                  onSelectChord={onSelectChord}
                  fontSizeClass={fontSizeClass}
                  jamFillsEnabled={jamFillsEnabled}
                  noteSpelling={noteSpelling}
                  active={isChordActive(chord, selectedChord)}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    case "tab_staff": {
      return <TabStaffLine line={line} />;
    }

    case "comment": {
      return (
        <div className="py-1 text-sm text-zinc-400 italic break-words max-w-full">
          {line.rawText}
        </div>
      );
    }

    case "empty": {
      return <div className="h-4" aria-hidden="true" />;
    }

    case "chord_lyric":
    default: {
      const segments = line.segments || [];
      if (!segments.length && line.rawText) {
        return (
          <div className={`font-mono text-zinc-300 py-1 break-words max-w-full ${fontSizeClass}`}>
            {line.rawText}
          </div>
        );
      }

      if (isDenseMeasureLine(segments)) {
        return renderDenseMeasureLine(segments);
      }

      return renderStandardChordLyricLine(segments);
    }
  }
};
