import React, { useMemo, useState } from "react";
import { ExternalLink, Music, RotateCcw, Sparkles, Zap } from "lucide-react";
import type {
  AccordionSize,
  ChordDetail,
  LeadSheetLine,
  LeadSheetSong,
  StradellaGrooveType,
  ViewMode,
} from "../types/index.ts";
import { enrichLeadSheetLines } from "../lib/parser/tokenizer.ts";
import { getSoundingKey } from "../lib/capo/enharmonics.ts";
import { enrichSongLinesWithVoiceLeading, extractSectionChords } from "../lib/cba/sectionChords.ts";
import {
  getLastPersistedCbaGripMode,
  getLastPersistedGroove,
  getLastPersistedJamFills,
  persistCbaGripMode,
  persistGroove,
  persistJamFills,
} from "../lib/storage/urlState.ts";
import { STRADELLA_GROOVES } from "../lib/stradella/grooves.ts";
import { COMMIT_HASH, COMMIT_URL } from "../version.ts";
import { LineRenderer } from "./LineRenderer.tsx";
import { isChordActive } from "./ChordBadge.tsx";
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

  // User preference for CBA grip mode (default: "root")
  const [cbaGripMode, setCbaGripMode] = useState<"root" | "voice_led">(() => {
    return getLastPersistedCbaGripMode();
  });

  // User preference for Stradella groove (default: "boom_chick")
  const [groove, setGroove] = useState<StradellaGrooveType>(() => {
    return getLastPersistedGroove();
  });

  // User preference for Jam Fills scale overlay (default: false)
  const [jamFills, setJamFills] = useState<boolean>(() => {
    return getLastPersistedJamFills();
  });

  // Listen for preference changes from other components
  React.useEffect(() => {
    const handleGrip = () => setCbaGripMode(getLastPersistedCbaGripMode());
    const handleGroove = () => setGroove(getLastPersistedGroove());
    const handleJamFills = () => setJamFills(getLastPersistedJamFills());

    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("cbaGripModeChanged", handleGrip);
      globalThis.addEventListener("grooveChanged", handleGroove);
      globalThis.addEventListener("jamFillsChanged", handleJamFills);
      return () => {
        globalThis.removeEventListener("cbaGripModeChanged", handleGrip);
        globalThis.removeEventListener("grooveChanged", handleGroove);
        globalThis.removeEventListener("jamFillsChanged", handleJamFills);
      };
    }
  }, []);

  const handleToggleGripMode = (mode: "root" | "voice_led") => {
    setCbaGripMode(mode);
    persistCbaGripMode(mode);
  };

  const handleSelectGroove = (newGroove: StradellaGrooveType) => {
    setGroove(newGroove);
    persistGroove(newGroove);
  };

  const handleToggleJamFills = () => {
    const next = !jamFills;
    setJamFills(next);
    persistJamFills(next);
  };

  // Calculate sounding key from written key and current capo
  const soundingKey = song.originalKey ? getSoundingKey(song.originalKey, capo) : "";

  // Reactively re-enrich lines with current capo and chronological whole-song voice leading
  const renderedLines = useMemo(() => {
    const rawLines = (song.lines || []) as LeadSheetLine[];
    const enriched = enrichLeadSheetLines(rawLines, capo, song.originalKey);
    return enrichSongLinesWithVoiceLeading(enriched, cbaGripMode);
  }, [song.lines, capo, song.originalKey, cbaGripMode]);

  // Precompute unique chords per section and for the entire song
  const { sectionChordsMap, allSongChords } = useMemo(() => {
    return extractSectionChords(renderedLines, cbaGripMode);
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

        {/* Unified Context-Aware Dynamic Config Bar (Approach 1) */}
        {onChangeCapo && (
          <div className="mt-3 p-2 sm:p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-inner">
            {/* Universal Left Section: Capo Stepper & Toggles */}
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

              {/* Key Status */}
              {song.originalKey && (
                <span className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                  Key: <span className="font-bold text-zinc-100">{song.originalKey}</span>
                  {capo > 0 && soundingKey && soundingKey !== song.originalKey && (
                    <span className="text-blue-400 font-bold ml-1.5">➔ {soundingKey}</span>
                  )}
                </span>
              )}
            </div>

            {/* Context-Aware Right Section (Morphed by active ViewMode) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* 1. Stradella LH View Mode: Strategy C Groove Selector */}
              {viewMode === "stradella" && (
                <div className="flex items-center bg-zinc-950 rounded-lg p-1 border border-zinc-800 gap-1 text-xs font-mono">
                  <div className="flex items-center gap-1 px-1.5 text-zinc-400 text-[11px]">
                    <Music className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline font-semibold">Groove:</span>
                  </div>
                  <select
                    value={groove}
                    onChange={(e) => handleSelectGroove(e.target.value as StradellaGrooveType)}
                    className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2 py-1 text-xs font-bold text-blue-300 hover:text-white cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    aria-label="Select Stradella Accompaniment Groove"
                  >
                    {STRADELLA_GROOVES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.timeSignature})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. CBA RH View Mode: Grip Mode + Strategy D Jam Fills Toggle */}
              {viewMode === "cba" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Grip Mode Toggle */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("root")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "root"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Canonical Root Shapes (100% Consistent 1-2-4 Triangle Muscle Memory)"
                      aria-pressed={cbaGripMode === "root"}
                    >
                      <span>🪗</span>
                      <span>Root</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("voice_led")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "voice_led"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Smooth Voice Leading (Whole-Song Continuous Flow with Minimal Hand Shifts)"
                      aria-pressed={cbaGripMode === "voice_led"}
                    >
                      <span>🌊</span>
                      <span>Voice-Led</span>
                    </button>
                  </div>

                  {/* Jam Fills Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleJamFills}
                    className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                      jamFills
                        ? "bg-sky-950/90 border border-sky-500/80 text-sky-300 ring-1 ring-sky-400/50 shadow-sky-900/30"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                    title={jamFills
                      ? "Jam Fills ON (Displaying Pentatonic/Blues scale buttons on CBA grid)"
                      : "Jam Fills OFF"}
                    aria-pressed={jamFills}
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 ${jamFills ? "text-sky-400 fill-current" : ""}`}
                    />
                    <span>Fills</span>
                  </button>
                </div>
              )}

              {/* 3. Guitar View Mode: Original Chords Indicator */}
              {viewMode === "guitar" && (
                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-amber-400 font-semibold flex items-center gap-1">
                  <span>🎸</span>
                  <span>Original Chords</span>
                </div>
              )}

              {/* 4. Dual View Mode: Compact Combined Controls */}
              {viewMode === "dual" && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={groove}
                    onChange={(e) => handleSelectGroove(e.target.value as StradellaGrooveType)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-300 hover:text-white cursor-pointer"
                    aria-label="Select Stradella Groove"
                  >
                    {STRADELLA_GROOVES.map((g) => (
                      <option key={g.id} value={g.id}>
                        🥁 {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleGripMode(cbaGripMode === "root" ? "voice_led" : "root")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      cbaGripMode === "voice_led"
                        ? "bg-emerald-600/30 border border-emerald-500/60 text-emerald-300"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400"
                    }`}
                    title="Toggle CBA Voice Leading"
                  >
                    {cbaGripMode === "voice_led" ? "🌊 Voice-Led" : "🪗 Root"}
                  </button>
                </div>
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
                active={isChordActive(chord, selectedChord)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lead Sheet Main Content */}
      <main className="space-y-1">
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
      </main>

      {/* Commit Hash & Build Info Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-850 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none">
        <span>Accordion Lead Sheet Companion</span>
        {COMMIT_URL && COMMIT_HASH !== "dev"
          ? (
            <a
              href={COMMIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 underline underline-offset-2 transition-colors cursor-pointer"
              title={`View commit ${COMMIT_HASH} on GitHub`}
            >
              build: {COMMIT_HASH}
            </a>
          )
          : <span>build: {COMMIT_HASH}</span>}
      </footer>
    </div>
  );
};
