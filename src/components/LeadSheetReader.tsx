import React, { useMemo, useState } from "react";
import { ExternalLink, RotateCcw, Zap } from "lucide-react";
import type {
  AccordionSize,
  CbaGrip,
  ChordDetail,
  LeadSheetLine,
  LeadSheetSong,
  ViewMode,
} from "../types/index.ts";
import { enrichLeadSheetLines } from "../lib/parser/tokenizer.ts";
import { getSoundingKey } from "../lib/capo/enharmonics.ts";
import { generateCanonicalRootGrip } from "../lib/cba/grips.ts";
import { computeCbaTransition, optimizeVoiceLeading } from "../lib/cba/voiceLeading.ts";
import { COMMIT_HASH, COMMIT_URL } from "../version.ts";
import { LineRenderer } from "./LineRenderer.tsx";
import { CbaMiniCard } from "./CbaMiniCard.tsx";

export interface LeadSheetReaderProps {
  song: LeadSheetSong;
  capo: number;
  viewMode: ViewMode;
  onChangeCapo?: (capo: number) => void;
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
  onChangeCapo,
  fontSizeClass = "text-base",
  onSelectChord,
  selectedChord,
  className = "",
}) => {
  const defaultCapo = song.capoFret ?? song.capo ?? 0;
  const [lastNonZeroCapo, setLastNonZeroCapo] = useState<number>(
    defaultCapo > 0 ? defaultCapo : (capo > 0 ? capo : 2),
  );

  // User preference for CBA grip mode (default: "root" for 100% muscle-memory consistency)
  const [cbaGripMode, setCbaGripMode] = useState<"root" | "voice_led">(() => {
    try {
      if (typeof globalThis.localStorage !== "undefined") {
        return (globalThis.localStorage.getItem("cbaGripMode") as "root" | "voice_led") || "root";
      }
    } catch {
      // ignore
    }
    return "root";
  });

  // Listen for preference changes from MiniGripDrawer
  React.useEffect(() => {
    const handler = () => {
      try {
        if (typeof globalThis.localStorage !== "undefined") {
          const mode = (globalThis.localStorage.getItem("cbaGripMode") as "root" | "voice_led") ||
            "root";
          setCbaGripMode(mode);
        }
      } catch {
        // ignore
      }
    };
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("cbaGripModeChanged", handler);
      return () => globalThis.removeEventListener("cbaGripModeChanged", handler);
    }
  }, []);

  // Calculate sounding key from written key and current capo
  const soundingKey = song.originalKey ? getSoundingKey(song.originalKey, capo) : "";

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
        // Generate section unique chords according to cbaGripMode (Root vs Smooth Voice-Led)
        let prevGrip: CbaGrip | undefined = undefined;
        const resolvedUniqueChords = uniqueChords.map((chord) => {
          if (typeof chord === "string") return chord;
          const sounding = chord.soundingChord || chord.originalChord;
          if (!sounding) return chord;
          const grip = cbaGripMode === "root"
            ? computeCbaTransition(generateCanonicalRootGrip(sounding), prevGrip)
            : optimizeVoiceLeading(sounding, prevGrip);
          prevGrip = grip;
          return {
            ...chord,
            cba: grip,
          };
        });
        map.set(i, resolvedUniqueChords);
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

    const resolvedAllChords = allChords.map((chord) => {
      if (typeof chord === "string") return chord;
      const sounding = chord.soundingChord || chord.originalChord;
      if (!sounding) return chord;
      const grip = cbaGripMode === "root" ? generateCanonicalRootGrip(sounding) : chord.cba;
      return {
        ...chord,
        cba: grip,
      };
    });

    return { sectionChordsMap: map, allSongChords: resolvedAllChords };
  }, [renderedLines, cbaGripMode]);

  const handleToggleCapo = () => {
    if (!onChangeCapo) return;
    if (capo > 0) {
      setLastNonZeroCapo(capo);
      onChangeCapo(0);
    } else {
      const target = lastNonZeroCapo > 0 ? lastNonZeroCapo : (defaultCapo > 0 ? defaultCapo : 2);
      onChangeCapo(target);
    }
  };

  const handleResetCapo = () => {
    if (onChangeCapo) {
      onChangeCapo(defaultCapo);
      if (defaultCapo > 0) {
        setLastNonZeroCapo(defaultCapo);
      }
    }
  };

  return (
    <div
      className={`flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 pb-36 text-zinc-100 ${className}`}
    >
      {/* Song Header */}
      <header className="mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-0.5">
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
            </div>
          </div>

          {song.sourceUrl && (
            <a
              href={song.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-blue-400 hover:text-blue-300 text-xs font-mono transition-colors shrink-0 cursor-pointer"
              title={`Open original source: ${song.sourceUrl}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Source</span>
            </a>
          )}
        </div>

        {/* Dedicated Capo & Key Controller Bar */}
        {onChangeCapo && (
          <div className="mt-3 p-2 sm:p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-inner">
            {/* Left: Capo Stepper & Toggles */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Stepper with Large Touch Targets */}
              <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => onChangeCapo(Math.max(0, capo - 1))}
                  disabled={capo <= 0}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-30 rounded active:bg-zinc-800 transition-colors cursor-pointer select-none"
                  aria-label="Decrease Capo"
                >
                  -
                </button>
                <span className="px-2 text-xs sm:text-sm font-mono font-bold text-blue-400 min-w-[3.75rem] text-center select-none">
                  Capo {capo}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeCapo(Math.min(11, capo + 1))}
                  disabled={capo >= 11}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-30 rounded active:bg-zinc-800 transition-colors cursor-pointer select-none"
                  aria-label="Increase Capo"
                >
                  +
                </button>
              </div>

              {/* Quick Capo On / Off Toggle */}
              <button
                type="button"
                onClick={handleToggleCapo}
                className={`min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 ${
                  capo > 0
                    ? "bg-blue-600/30 border border-blue-500/60 text-blue-300 hover:bg-blue-600/40 shadow-sm"
                    : "bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
                title={capo > 0
                  ? "Toggle Capo OFF (Fret 0)"
                  : `Toggle Capo ON (Fret ${lastNonZeroCapo})`}
              >
                <Zap className={`w-3.5 h-3.5 ${capo > 0 ? "fill-current" : ""}`} />
                <span>{capo > 0 ? "Capo ON" : "Capo OFF"}</span>
              </button>

              {/* Always-Visible Reset to Recommended Default Capo */}
              <button
                type="button"
                onClick={handleResetCapo}
                className={`min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 shadow-sm ${
                  capo !== defaultCapo
                    ? "bg-amber-950/40 border border-amber-600/70 text-amber-300 hover:bg-amber-900/50 hover:text-amber-200"
                    : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
                title={`Reset capo to imported default: Capo ${defaultCapo}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({defaultCapo})</span>
              </button>
            </div>

            {/* Right: Key & Transposition Status */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
              {song.originalKey && (
                <span className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                  Key: <span className="font-bold text-zinc-100">{song.originalKey}</span>
                  {capo > 0 && soundingKey && soundingKey !== song.originalKey && (
                    <span className="text-blue-400 font-bold ml-1.5">➔ {soundingKey}</span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}
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
                fontSizeClass={fontSizeClass}
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
