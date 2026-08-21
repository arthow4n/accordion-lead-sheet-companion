import React from "react";
import type { ChordDetail, ChordLyricSegment, LeadSheetLine, ViewMode } from "../types/index.ts";
import { ChordBadge } from "./ChordBadge.tsx";

export interface LineRendererProps {
  line: LeadSheetLine | ChordLyricSegment[];
  viewMode?: ViewMode;
  onSelectChord?: (chord: ChordDetail | string) => void;
  selectedChord?: ChordDetail | string | null;
  fontSizeClass?: string;
}

export const LineRenderer: React.FC<LineRendererProps> = ({
  line,
  viewMode = "stradella",
  onSelectChord,
  selectedChord,
  fontSizeClass = "text-base",
}) => {
  // Support both LeadSheetLine objects and raw ChordLyricSegment[] arrays
  if (Array.isArray(line)) {
    return (
      <div className="flex flex-wrap items-end gap-x-1 gap-y-2 my-1 leading-relaxed max-w-full">
        {line.map((segment, idx) => (
          <div
            key={`seg-${idx}`}
            className="inline-flex flex-col items-start min-w-fit flex-shrink-0"
            style={{ display: "inline-flex", flexDirection: "column" }}
          >
            <div className="min-h-[1.5rem] flex items-center mb-0.5">
              <ChordBadge
                chord={segment.chord}
                viewMode={viewMode}
                onSelectChord={onSelectChord}
                active={Boolean(
                  selectedChord &&
                    ((typeof segment.chord === "string" && segment.chord === selectedChord) ||
                      (typeof segment.chord === "object" &&
                        typeof selectedChord === "object" &&
                        segment.chord?.soundingChord?.raw ===
                          (selectedChord as ChordDetail)?.soundingChord?.raw)),
                )}
              />
            </div>
            <span
              className={`lyric-syllable font-sans font-medium text-zinc-100 whitespace-pre ${fontSizeClass}`}
            >
              {segment.lyric || (segment.chord ? "\u00A0" : "")}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Handle distinct line types
  switch (line.type) {
    case "section_header": {
      const title = line.headerTitle || line.rawText || "";
      return (
        <div className="pt-4 pb-1 mt-2 border-b border-zinc-800/80 flex items-center gap-2 max-w-full">
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-xs font-bold font-mono uppercase tracking-wider">
            {title.replace(/[\[\]]/g, "")}
          </span>
        </div>
      );
    }

    case "tab_staff": {
      return (
        <div className="py-1 overflow-x-auto max-w-full">
          <pre className="font-mono text-xs text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-800 overflow-x-auto">
            {line.rawText}
          </pre>
        </div>
      );
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

      return (
        <div className="flex flex-wrap items-end gap-x-1 gap-y-2 my-1 leading-relaxed max-w-full">
          {segments.map((segment, idx) => (
            <div
              key={`seg-${idx}`}
              className="inline-flex flex-col items-start min-w-fit flex-shrink-0"
              style={{ display: "inline-flex", flexDirection: "column" }}
            >
              <div className="min-h-[1.5rem] flex items-center mb-0.5">
                <ChordBadge
                  chord={segment.chord}
                  viewMode={viewMode}
                  onSelectChord={onSelectChord}
                  active={Boolean(
                    selectedChord &&
                      ((typeof segment.chord === "string" && segment.chord === selectedChord) ||
                        (typeof segment.chord === "object" &&
                          typeof selectedChord === "object" &&
                          segment.chord?.soundingChord?.raw ===
                            (selectedChord as ChordDetail)?.soundingChord?.raw)),
                  )}
                />
              </div>
              <span
                className={`lyric-syllable font-sans font-medium text-zinc-100 whitespace-pre ${fontSizeClass}`}
              >
                {segment.lyric || (segment.chord ? "\u00A0" : "")}
              </span>
            </div>
          ))}
        </div>
      );
    }
  }
};
