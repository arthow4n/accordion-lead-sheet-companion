import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import type {
  AccordionSize,
  ChordDetail,
  LeadSheetLine,
  LeadSheetSong,
  ViewMode,
} from "../types/index.ts";
import { enrichLeadSheetLines } from "../lib/parser/tokenizer.ts";
import { COMMIT_HASH, COMMIT_URL } from "../version.ts";
import { LineRenderer } from "./LineRenderer.tsx";
import { CbaMiniCard } from "./CbaMiniCard.tsx";

export interface LeadSheetReaderProps {
  song: LeadSheetSong;
  capo: number;
  viewMode: ViewMode;
  fontSizeClass?: string;
  accordionSize?: AccordionSize;
  onSelectChord?: (chord: ChordDetail | string) => void;
  selectedChord?: ChordDetail | string | null;
  className?: string;
}

export const LeadSheetReader: React.FC<LeadSheetReaderProps> = ({
  song,
  capo,
  viewMode,
  fontSizeClass = "text-base",
  onSelectChord,
  selectedChord,
  className = "",
}) => {
  // Reactively re-enrich lines with current capo
  const renderedLines = useMemo(() => {
    const rawLines = (song.lines || []) as LeadSheetLine[];
    return enrichLeadSheetLines(rawLines, capo, song.originalKey);
  }, [song.lines, capo, song.originalKey]);

  // Precompute unique chords per section
  const { sectionChordsMap, allSongChords } = useMemo(() => {
    const map = new Map<number, Array<ChordDetail | string>>();
    const allChords: Array<ChordDetail | string> = [];
    const allSeen = new Set<string>();

    for (let i = 0; i < renderedLines.length; i++) {
      const line = renderedLines[i];
      if (line.type === "section_header") {
        const uniqueChords: Array<ChordDetail | string> = [];
        const seen = new Set<string>();
        for (let j = i + 1; j < renderedLines.length; j++) {
          const nextLine = renderedLines[j];
          if (nextLine.type === "section_header") break;
          if (nextLine.segments) {
            for (const seg of nextLine.segments) {
              if (seg.chord) {
                const rawName = typeof seg.chord === "string"
                  ? seg.chord
                  : seg.chord.soundingChord?.raw || seg.chord.originalChord?.raw || "Chord";
                if (!seen.has(rawName)) {
                  seen.add(rawName);
                  uniqueChords.push(seg.chord);
                }
              }
            }
          }
        }
        map.set(i, uniqueChords);
      }

      if (line.segments) {
        for (const seg of line.segments) {
          if (seg.chord) {
            const rawName = typeof seg.chord === "string"
              ? seg.chord
              : seg.chord.soundingChord?.raw || seg.chord.originalChord?.raw || "Chord";
            if (!allSeen.has(rawName)) {
              allSeen.add(rawName);
              allChords.push(seg.chord);
            }
          }
        }
      }
    }
    return { sectionChordsMap: map, allSongChords: allChords };
  }, [renderedLines]);

  return (
    <div
      className={`flex flex-col max-w-2xl w-full mx-auto px-2 sm:px-4 py-4 pb-36 text-zinc-100 ${className}`}
    >
      {/* Song Header */}
      <header className="mb-6 pb-3 border-b border-zinc-800/80">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
          {song.title || "Untitled Song"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono">
          {song.artist && <span className="text-zinc-300 font-sans">{song.artist}</span>}
          {song.artist && <span>•</span>}
          <span>Capo: {capo}</span>
          {song.originalKey && (
            <>
              <span>•</span>
              <span>Key: {song.originalKey}</span>
            </>
          )}
          {song.sourceUrl && (
            <>
              <span>•</span>
              <a
                href={song.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                title={`Open original source: ${song.sourceUrl}`}
              >
                <ExternalLink className="w-3 h-3" />
                <span>Source</span>
              </a>
            </>
          )}
        </div>
      </header>

      {/* Fallback 5-Row Grips preview if song has no section headers */}
      {viewMode === "cba" && sectionChordsMap.size === 0 && allSongChords.length > 0 && (
        <div className="mb-4 p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
            5-Row CBA Grips in Song:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {allSongChords.map((chord, cIdx) => (
              <CbaMiniCard
                key={`top-cba-${cIdx}`}
                chord={chord}
                onSelectChord={onSelectChord}
                active={Boolean(
                  selectedChord &&
                    ((typeof chord === "string" && chord === selectedChord) ||
                      (typeof chord === "object" &&
                        typeof selectedChord === "object" &&
                        chord?.soundingChord?.raw ===
                          (selectedChord as ChordDetail)?.soundingChord?.raw)),
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Song Lines */}
      <div className="space-y-4">
        {renderedLines.map((line, idx) => (
          <LineRenderer
            key={`line-${idx}`}
            line={line}
            viewMode={viewMode}
            onSelectChord={onSelectChord}
            selectedChord={selectedChord}
            fontSizeClass={fontSizeClass}
            sectionChords={sectionChordsMap.get(idx)}
          />
        ))}
      </div>

      {/* Footer with Commit Hash */}
      <footer className="mt-12 pt-4 pb-4 border-t border-zinc-900 flex items-center justify-center gap-1.5 text-[11px] text-zinc-600 font-mono">
        <span>Accordion Companion</span>
        <span>•</span>
        <a
          href={COMMIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-blue-400 hover:underline transition-colors"
          title={`View commit ${COMMIT_HASH} on GitHub`}
        >
          {COMMIT_HASH}
        </a>
      </footer>
    </div>
  );
};
