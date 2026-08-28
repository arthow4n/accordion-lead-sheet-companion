import React from "react";
import { FolderOpen, Plus, Sun, SunMedium } from "lucide-react";
import type { ViewMode } from "../types/index.ts";

export interface CapoBarProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  capo?: number;
  onChangeCapo?: (capo: number) => void;
  originalKey?: string;
  soundingKey?: string;
  onOpenSongbook?: () => void;
  onOpenImport?: () => void;
  wakeLockActive?: boolean;
  onToggleWakeLock?: () => void;
  className?: string;
}

export const CapoBar: React.FC<CapoBarProps> = ({
  viewMode,
  onChangeViewMode,
  onOpenSongbook,
  onOpenImport,
  wakeLockActive = false,
  onToggleWakeLock,
  className = "",
}) => {
  return (
    <header
      className={`sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-2 sm:px-4 py-1.5 sm:py-2.5 shadow-sm ${className}`}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left Side: 1-Tap View Switcher with Large Touch Targets */}
        <div className="flex bg-zinc-900 p-0.5 sm:p-1 rounded-xl border border-zinc-800 gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeViewMode("stradella")}
            className={`min-h-[38px] sm:min-h-[42px] px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 shrink-0 ${
              viewMode === "stradella"
                ? "bg-blue-600 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
            title="Left Hand Stradella Bass Mode"
            aria-pressed={viewMode === "stradella"}
          >
            <span>🪗</span>
            <span>LH</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("cba")}
            className={`min-h-[38px] sm:min-h-[42px] px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 shrink-0 ${
              viewMode === "cba"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
            title="Right Hand CBA C-System Treble Mode"
            aria-pressed={viewMode === "cba"}
          >
            <span>🔘</span>
            <span>RH</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("guitar")}
            className={`min-h-[38px] sm:min-h-[42px] px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 shrink-0 ${
              viewMode === "guitar"
                ? "bg-amber-500 text-zinc-950 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
            title="Clean Guitar Mode (Original Chords As Written)"
            aria-pressed={viewMode === "guitar"}
          >
            <span>🎸</span>
            <span className="hidden sm:inline">Guitar</span>
            <span className="sm:hidden">Gtr</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("dual")}
            className={`min-h-[38px] sm:min-h-[42px] px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 shrink-0 ${
              viewMode === "dual"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
            title="Dual Mode (Guitar Chords + Stradella)"
            aria-pressed={viewMode === "dual"}
          >
            <span>🪗🎸</span>
            <span>Dual</span>
          </button>
        </div>

        {/* Right Side: Quick Action Buttons (Large Touch Targets >= 38px) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {onToggleWakeLock && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                wakeLockActive
                  ? "bg-amber-950/90 border-amber-600/80 text-amber-300 shadow-md ring-1 ring-amber-500/50"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
              title={wakeLockActive
                ? "Screen Wake Lock Active (Display Stays Awake)"
                : "Enable Screen Wake Lock"}
              aria-label="Toggle Wake Lock"
            >
              {wakeLockActive
                ? <Sun className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                : <SunMedium className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
            </button>
          )}

          {onOpenSongbook && (
            <button
              type="button"
              onClick={onOpenSongbook}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Open Songbook Drawer"
              aria-label="Open Songbook"
            >
              <FolderOpen className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
          )}

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-900/30"
              title="Import New Lead Sheet (URL or Text)"
              aria-label="Import New Lead Sheet"
            >
              <Plus className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
