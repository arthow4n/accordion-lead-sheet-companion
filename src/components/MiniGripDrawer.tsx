import React from "react";
import { X } from "lucide-react";
import type { AccordionSize, ChordDetail, ViewMode } from "../types/index.ts";
import { enrichChord } from "../lib/parser/tokenizer.ts";
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
        className="relative w-full max-w-2xl mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-2xl shadow-2xl p-2 sm:p-3 max-h-[35vh] overflow-y-auto"
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
              <div className="text-[11px] sm:text-xs font-bold text-zinc-400 mb-1 flex items-center gap-1.5">
                <span>🔘</span>
                <span>Right Hand CBA C-System Treble</span>
              </div>
              <CbaGrid
                cba={chordDetail.cba}
                soundingChord={chordDetail.soundingChord}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
