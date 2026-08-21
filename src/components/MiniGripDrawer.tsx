import React, { useState } from "react";
import { X } from "lucide-react";
import type { AccordionSize, ChordDetail, ViewMode } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
import { generateCanonicalRootGrip } from "../lib/cba/grips.ts";
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

  if (!isOpen || !chord) return null;

  const handleToggleGripMode = (mode: "root" | "voice_led") => {
    setCbaGripMode(mode);
    try {
      if (typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.setItem("cbaGripMode", mode);
        globalThis.dispatchEvent(new Event("cbaGripModeChanged"));
      }
    } catch {
      // ignore
    }
  };

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
        className="relative w-full max-w-2xl mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl p-3 sm:p-4 max-h-[85vh] overflow-y-auto"
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
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleGripMode("root");
                    }}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      cbaGripMode === "root"
                        ? "bg-emerald-600 text-white font-bold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Root Shapes
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleGripMode("voice_led");
                    }}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      cbaGripMode === "voice_led"
                        ? "bg-emerald-600 text-white font-bold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Smooth Inversions
                  </button>
                </div>
              </div>
              <CbaGrid
                cba={cbaGripMode === "root" && chordDetail.soundingChord
                  ? generateCanonicalRootGrip(chordDetail.soundingChord)
                  : chordDetail.cba}
                soundingChord={chordDetail.soundingChord}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
