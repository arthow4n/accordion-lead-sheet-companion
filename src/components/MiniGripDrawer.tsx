import React, { useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { AccordionSize, ChordDetail, StradellaGrooveType, ViewMode } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { generateCanonicalRootGrip } from "../lib/cba/grips.ts";
import {
  getLastPersistedGroove,
  getLastPersistedJamFills,
  persistJamFills,
} from "../lib/storage/urlState.ts";
import { StradellaGrid } from "./StradellaGrid.tsx";
import { CbaGrid } from "./CbaGrid.tsx";

export interface MiniGripDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chord: ChordDetail | string | null;
  capo?: number;
  viewMode?: ViewMode;
  accordionSize?: AccordionSize;
}

export const MiniGripDrawer: React.FC<MiniGripDrawerProps> = ({
  isOpen,
  onClose,
  chord,
  capo = 0,
  viewMode = "stradella",
  accordionSize = "120-bass",
}) => {
  const [groove, setGroove] = useState<StradellaGrooveType>(() => getLastPersistedGroove());
  const [jamFills, setJamFills] = useState<boolean>(() => getLastPersistedJamFills());

  React.useEffect(() => {
    const handleGroove = () => setGroove(getLastPersistedGroove());
    const handleJamFills = () => setJamFills(getLastPersistedJamFills());
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("grooveChanged", handleGroove);
      globalThis.addEventListener("jamFillsChanged", handleJamFills);
      return () => {
        globalThis.removeEventListener("grooveChanged", handleGroove);
        globalThis.removeEventListener("jamFillsChanged", handleJamFills);
      };
    }
  }, []);

  if (!isOpen || !chord) return null;

  // If chord is a plain string, enrich it with current capo
  const chordDetail: ChordDetail = typeof chord === "string" ? enrichChord(chord, capo) : chord;

  const originalChordName = chordDetail.originalChord?.raw || "Chord";
  const soundingChordName = chordDetail.soundingChord?.raw || originalChordName;
  const isTransposed = originalChordName !== soundingChordName || capo > 0;

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleToggleJamFills = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !jamFills;
    setJamFills(next);
    persistJamFills(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      {/* Backdrop tap to close */}
      <div
        className="flex-1 w-full"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Slide-Up Sheet */}
      <div
        className="relative w-full max-w-2xl mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl p-3 sm:p-4 max-h-[35vh] overflow-y-auto"
        onClick={handleContentClick}
      >
        {/* Drag Handle Bar */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-2" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-mono">
              {originalChordName}
            </h2>
            {isTransposed && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded bg-blue-950/80 border border-blue-700/60 text-blue-300 text-[11px] sm:text-xs font-mono font-semibold">
                Capo {capo} ➔ Sounding: {soundingChordName}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 sm:p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            aria-label="Close Grip Drawer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Accordion Voicing Grids */}
        <div className="space-y-2 sm:space-y-3">
          {/* Stradella Left Hand Grid */}
          {(viewMode === "stradella" || viewMode === "dual") && (
            <div>
              <div className="text-[11px] sm:text-xs font-bold text-zinc-400 mb-1 flex items-center gap-1.5">
                <span>🪗</span>
                <span>Left Hand Stradella Bass</span>
              </div>
              <StradellaGrid
                stradella={chordDetail.stradella}
                soundingChord={chordDetail.soundingChord}
                accordionSize={accordionSize}
                grooveType={groove}
              />
            </div>
          )}

          {/* CBA Right Hand Grid */}
          {(viewMode === "cba" || viewMode === "dual") && (
            <div>
              <div className="text-[11px] sm:text-xs font-bold text-zinc-400 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>🔘</span>
                  <span>Right Hand CBA C-System Treble</span>
                </div>

                {/* Jam Fills Toggle */}
                <button
                  type="button"
                  onClick={handleToggleJamFills}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                    jamFills
                      ? "bg-cyan-950/90 border border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-400/50 shadow-cyan-900/30"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                  title={jamFills
                    ? "Jam Fills ON (Displaying Pentatonic/Blues scale buttons on CBA grid)"
                    : "Jam Fills OFF"}
                  aria-pressed={jamFills}
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 ${jamFills ? "text-cyan-400 fill-current" : ""}`}
                  />
                  <span>Fills</span>
                </button>
              </div>
              <CbaGrid
                cba={chordDetail.cba ||
                  (chordDetail.soundingChord
                    ? generateCanonicalRootGrip(chordDetail.soundingChord)
                    : undefined)}
                soundingChord={chordDetail.soundingChord}
                jamFillsEnabled={jamFills}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
