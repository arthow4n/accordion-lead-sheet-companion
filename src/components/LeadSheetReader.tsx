import React, { useMemo, useState } from "react";
import { ExternalLink, Music, RefreshCw, RotateCcw, Sparkles, Zap } from "lucide-react";
import type {
  AccordionSize,
  CbaDisplayMode,
  ChordDetail,
  LeadSheetLine,
  LeadSheetSong,
  StradellaDisplayMode,
  StradellaGrooveType,
  ViewMode,
} from "../types/index.ts";
import { enrichLeadSheetLines } from "../lib/parser/tokenizer.ts";
import { getSoundingKey } from "../lib/capo/enharmonics.ts";
import { enrichSongLinesWithVoiceLeading, extractSectionChords } from "../lib/cba/sectionChords.ts";
import {
  getLastPersistedCbaDisplayMode,
  getLastPersistedCbaGripMode,
  getLastPersistedGroove,
  getLastPersistedJamFills,
  getLastPersistedStradellaDisplayMode,
  persistCbaDisplayMode,
  persistCbaGripMode,
  persistGroove,
  persistJamFills,
  persistStradellaDisplayMode,
} from "../lib/storage/urlState.ts";
import { STRADELLA_GROOVES } from "../lib/stradella/grooves.ts";
import { annotateStradellaTransitions } from "../lib/stradella/transitions.ts";
import { checkForAppUpdate } from "../lib/pwa/updateChecker.ts";
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

  // User preference for CBA grip mode (default: "root_5row")
  const [cbaGripMode, setCbaGripMode] = useState<"root_3row" | "root_5row" | "voice_led">(() => {
    return getLastPersistedCbaGripMode();
  });

  // User preference for CBA display mode (default: "line_cards")
  const [cbaDisplayMode, setCbaDisplayMode] = useState<CbaDisplayMode>(() => {
    return getLastPersistedCbaDisplayMode();
  });

  // User preference for Stradella display mode (default: "badges")
  const [stradellaDisplayMode, setStradellaDisplayMode] = useState<StradellaDisplayMode>(() => {
    return getLastPersistedStradellaDisplayMode();
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
    const handleCbaDisplay = () => setCbaDisplayMode(getLastPersistedCbaDisplayMode());
    const handleStradDisplay = () =>
      setStradellaDisplayMode(getLastPersistedStradellaDisplayMode());
    const handleGroove = () => setGroove(getLastPersistedGroove());
    const handleJamFills = () => setJamFills(getLastPersistedJamFills());

    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("cbaGripModeChanged", handleGrip);
      globalThis.addEventListener("cbaDisplayModeChanged", handleCbaCbaDisplaySafe);
      globalThis.addEventListener("stradellaDisplayModeChanged", handleStradDisplay);
      globalThis.addEventListener("grooveChanged", handleGroove);
      globalThis.addEventListener("jamFillsChanged", handleJamFills);
      return () => {
        globalThis.removeEventListener("cbaGripModeChanged", handleGrip);
        globalThis.removeEventListener("cbaDisplayModeChanged", handleCbaCbaDisplaySafe);
        globalThis.removeEventListener("stradellaDisplayModeChanged", handleStradDisplay);
        globalThis.removeEventListener("grooveChanged", handleGroove);
        globalThis.removeEventListener("jamFillsChanged", handleJamFills);
      };
    }

    function handleCbaCbaDisplaySafe() {
      handleCbaDisplay();
    }
  }, []);

  const handleToggleGripMode = (mode: "root_3row" | "root_5row" | "voice_led") => {
    setCbaGripMode(mode);
    persistCbaGripMode(mode);
  };

  const handleToggleDisplayMode = (mode: CbaDisplayMode) => {
    setCbaDisplayMode(mode);
    persistCbaDisplayMode(mode);
  };

  const handleToggleStradellaDisplayMode = (mode: StradellaDisplayMode) => {
    setStradellaDisplayMode(mode);
    persistStradellaDisplayMode(mode);
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
    const withVoiceLeading = enrichSongLinesWithVoiceLeading(enriched, cbaGripMode);
    return annotateStradellaTransitions(withVoiceLeading);
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
      onChangeCapo(lastNonZeroCapo > 0 ? lastNonZeroCapo : (defaultCapo > 0 ? defaultCapo : 2));
    }
  };

  const handleResetCapo = () => {
    if (onChangeCapo) {
      onChangeCapo(defaultCapo);
    }
  };

  const handleStepCapo = (delta: number) => {
    if (!onChangeCapo) return;
    const next = (capo + delta + 12) % 12;
    if (next > 0) {
      setLastNonZeroCapo(next);
    }
    onChangeCapo(next);
  };

  // Manual update check feedback status
  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "up_to_date" | "ready">(
    "idle",
  );

  const handleManualUpdateCheck = async () => {
    setCheckStatus("checking");
    const res = await checkForAppUpdate();
    if (res.hasUpdate) {
      setCheckStatus("ready");
    } else {
      setCheckStatus("up_to_date");
      setTimeout(() => setCheckStatus("idle"), 3000);
    }
  };

  return (
    <div
      className={`flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 pb-36 text-zinc-100 ${className}`}
    >
      {/* Header Info */}
      <header className="mb-4 space-y-2.5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-50">
              {song.title}
            </h1>
            {song.sourceUrl && (
              <a
                href={song.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors shrink-0"
                title={`Open original source tab: ${song.sourceUrl}`}
              >
                <span>Source</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 font-mono mt-0.5">
            {song.artist && <span>{song.artist}</span>}
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

        {/* Unified Responsive Config Bar (Approach 1: Universal Left + Context-Aware Right) */}
        {onChangeCapo && (
          <div className="p-2 sm:p-2.5 bg-zinc-900/90 border border-zinc-800/90 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-md">
            {/* Universal Left Controls: Capo Stepper, On/Off, Reset, Key */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Stepper: [ - ] Capo X [ + ] */}
              <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleStepCapo(-1)}
                  className="min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center font-black text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 rounded-md transition-all active:scale-95 cursor-pointer"
                  title="Capo down 1 fret (-1 semitone)"
                  aria-label="Decrease Capo"
                >
                  -
                </button>
                <span className="px-2 font-mono font-black text-xs sm:text-sm text-blue-400 select-none min-w-[58px] text-center">
                  Capo {capo}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepCapo(1)}
                  className="min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center font-black text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 rounded-md transition-all active:scale-95 cursor-pointer"
                  title="Capo up 1 fret (+1 semitone)"
                  aria-label="Increase Capo"
                >
                  +
                </button>
              </div>

              {/* Quick Toggle: [ ⚡ Capo ON/OFF ] */}
              <button
                type="button"
                onClick={handleToggleCapo}
                className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                  capo > 0
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40"
                    : "bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
                title={capo > 0
                  ? "Turn Capo OFF (Fret 0)"
                  : `Turn Capo ON (Fret ${lastNonZeroCapo})`}
                aria-label="Toggle Capo ON or OFF"
              >
                <Zap
                  className={`w-3.5 h-3.5 ${
                    capo > 0 ? "text-amber-300 fill-amber-300" : "text-zinc-500"
                  }`}
                />
                <span>{capo > 0 ? "Capo ON" : "Capo OFF"}</span>
              </button>

              {/* Reset to Default Capo Button */}
              <button
                type="button"
                onClick={handleResetCapo}
                className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                  capo !== defaultCapo
                    ? "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300"
                    : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
                title={`Reset to song default capo (${defaultCapo})`}
                aria-label="Reset to default capo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({defaultCapo})</span>
              </button>

              {/* Dynamic Sounding Key Badge */}
              {song.originalKey && (
                <div className="flex items-center gap-1 text-xs font-mono text-zinc-400 bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400">Key:</span>
                  <span className="font-bold text-zinc-200">{song.originalKey}</span>
                  {capo > 0 && (
                    <>
                      <span className="text-zinc-400 font-bold">➔</span>
                      <span className="font-black text-sky-400">{soundingKey}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Context-Aware Right Controls (Dynamic by View Mode) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* 1. Stradella LH View Mode: Groove Selector + 3-Way Display Mode */}
              {viewMode === "stradella" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 px-2 py-0.5 text-xs font-mono">
                    <Music className="w-3.5 h-3.5 text-blue-400 mr-1.5 shrink-0" />
                    <span className="text-zinc-400 font-bold mr-1">Groove:</span>
                    <select
                      value={groove}
                      onChange={(e) => handleSelectGroove(e.target.value as StradellaGrooveType)}
                      className="bg-transparent text-xs font-bold text-blue-300 hover:text-white cursor-pointer focus:outline-none py-1"
                      aria-label="Select Stradella Accompaniment Groove"
                    >
                      {STRADELLA_GROOVES.map((g) => (
                        <option key={g.id} value={g.id} className="bg-zinc-900 text-zinc-100">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Display Mode 3-Way Segmented Control: Badges, Line Cards, Micro Grids */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleStradellaDisplayMode("badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        stradellaDisplayMode === "badges"
                          ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Badges Only (Minimal, inline text badges only)"
                      aria-pressed={stradellaDisplayMode === "badges"}
                    >
                      <span>🏷️</span>
                      <span>Badges</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStradellaDisplayMode("line_cards")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        stradellaDisplayMode === "line_cards"
                          ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Line Cards (Chronological Stradella MiniCards strip above each lyric line)"
                      aria-pressed={stradellaDisplayMode === "line_cards"}
                    >
                      <span>📋</span>
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStradellaDisplayMode("micro_badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        stradellaDisplayMode === "micro_badges"
                          ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Micro Grids (3-column Stradella button matrix embedded inside badges)"
                      aria-pressed={stradellaDisplayMode === "micro_badges"}
                    >
                      <span>🔲</span>
                      <span>Micro</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. CBA RH View Mode: 3-Way Grip Mode + 3-Way Display Mode + Jam Fills Toggle */}
              {viewMode === "cba" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Grip Mode 3-Way Segmented Control */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("root_3row")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "root_3row"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="3-Row Core Shapes (Strictly Rows 1-3 for 3-Row Accordions)"
                      aria-pressed={cbaGripMode === "root_3row"}
                    >
                      <span>🪗</span>
                      <span>3-Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("root_5row")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "root_5row"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="5-Row Ergonomic Root Shapes (Isomorphic Tier 1-3, 2-4, 3-5)"
                      aria-pressed={cbaGripMode === "root_5row"}
                    >
                      <span>🖐️</span>
                      <span>5-Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("voice_led")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
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

                  {/* Display Mode 3-Way Segmented Control: Badges, Line Cards, Micro Grids */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleDisplayMode("badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaDisplayMode === "badges"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Badges Only (Minimal, inline text badges only)"
                      aria-pressed={cbaDisplayMode === "badges"}
                    >
                      <span>🏷️</span>
                      <span>Badges</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDisplayMode("line_cards")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaDisplayMode === "line_cards"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Line Cards (Chronological MiniCards strip above each lyric line)"
                      aria-pressed={cbaDisplayMode === "line_cards"}
                    >
                      <span>📋</span>
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDisplayMode("micro_badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaDisplayMode === "micro_badges"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Micro Grids (5-row dot grids embedded directly inside badges)"
                      aria-pressed={cbaDisplayMode === "micro_badges"}
                    >
                      <span>🔲</span>
                      <span>Micro</span>
                    </button>
                  </div>

                  {/* Jam Fills Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleJamFills}
                    className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                      jamFills
                        ? "bg-cyan-950/90 border border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-400/50 shadow-cyan-900/30"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                    title={jamFills
                      ? "Jam Fills ON (Displaying Pentatonic/Blues scale buttons on CBA grid & badges)"
                      : "Jam Fills OFF"}
                    aria-pressed={jamFills}
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 ${jamFills ? "text-cyan-400 fill-current" : ""}`}
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
                      handleToggleGripMode(
                        cbaGripMode === "voice_led" ? "root_5row" : "voice_led",
                      )}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      cbaGripMode === "voice_led"
                        ? "bg-emerald-600/30 border border-emerald-500/60 text-emerald-300"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400"
                    }`}
                    title="Toggle CBA Voice Leading"
                  >
                    {cbaGripMode === "voice_led" ? "🌊 Voice-Led" : "🖐️ 5-Row"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Fallback 5-Row Grips preview if song has no section headers and badges mode is selected */}
      {viewMode === "cba" && cbaDisplayMode === "badges" && sectionChordsMap.size === 0 &&
        allSongChords.length > 0 && (
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
                jamFillsEnabled={jamFills}
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
            cbaDisplayMode={cbaDisplayMode}
            stradellaDisplayMode={stradellaDisplayMode}
            jamFillsEnabled={jamFills}
            onSelectChord={onSelectChord}
            selectedChord={selectedChord}
            fontSizeClass={fontSizeClass}
            sectionChords={cbaDisplayMode === "badges" ? sectionChordsMap.get(idx) : undefined}
          />
        ))}
      </main>

      {/* Commit Hash & Build Info Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-850 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 select-none">
        <span>Accordion Lead Sheet Companion</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualUpdateCheck}
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[10px]"
            title="Check for PWA updates immediately"
          >
            <RefreshCw
              className={`w-3 h-3 ${
                checkStatus === "checking" ? "animate-spin text-blue-400" : ""
              }`}
            />
            <span>
              {checkStatus === "checking"
                ? "Checking..."
                : checkStatus === "up_to_date"
                ? "✓ Up to date"
                : checkStatus === "ready"
                ? "🚀 Update Ready!"
                : "Check for Update"}
            </span>
          </button>
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
        </div>
      </footer>
    </div>
  );
};
