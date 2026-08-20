import React from "react";
import { FolderOpen, Plus, Sun, SunMedium } from "lucide-react";
import type { ViewMode } from "../types/index.ts";

export interface CapoBarProps {
  capo: number;
  onChangeCapo: (capo: number) => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  originalKey?: string;
  soundingKey?: string;
  onOpenSongbook?: () => void;
  onOpenImport?: () => void;
  wakeLockActive?: boolean;
  onToggleWakeLock?: () => void;
  className?: string;
}

export const CapoBar: React.FC<CapoBarProps> = ({
  capo,
  onChangeCapo,
  viewMode,
  onChangeViewMode,
  originalKey,
  soundingKey,
  onOpenSongbook,
  onOpenImport,
  wakeLockActive = false,
  onToggleWakeLock,
  className = "",
}) => {
  const handleDecrement = () => {
    onChangeCapo(Math.max(0, capo - 1));
  };

  const handleIncrement = () => {
    onChangeCapo(Math.min(11, capo + 1));
  };

  return (
    <div
      className={`sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-3 py-2 shadow-sm ${className}`}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Capo Stepper & Key Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={capo <= 0}
              className="w-7 h-7 flex items-center justify-center text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 rounded active:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Decrease Capo"
            >
              -
            </button>
            <span className="px-1.5 text-xs font-mono font-bold text-blue-400 min-w-[3.75rem] text-center select-none">
              Capo {capo}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={capo >= 11}
              className="w-7 h-7 flex items-center justify-center text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 rounded active:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Increase Capo"
            >
              +
            </button>
          </div>

          {soundingKey && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono">
              Key: {originalKey ? `${originalKey} ➔ ` : ""}
              {soundingKey}
            </span>
          )}
        </div>

        {/* Center: 1-Tap View Switcher */}
        <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 gap-0.5">
          <button
            type="button"
            onClick={() => onChangeViewMode("stradella")}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              viewMode === "stradella"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Left Hand Stradella Bass Mode"
          >
            🪗 LH
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("cba")}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              viewMode === "cba"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Right Hand CBA C-System Treble Mode"
          >
            🔘 RH
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("dual")}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              viewMode === "dual"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Dual Mode (Guitar Chords + Stradella)"
          >
            🎸 Dual
          </button>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-1.5">
          {onToggleWakeLock && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                wakeLockActive
                  ? "bg-amber-950/80 border-amber-600/70 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
              title={wakeLockActive ? "Screen Wake Lock Active" : "Wake Lock Disabled"}
              aria-label="Toggle Wake Lock"
            >
              {wakeLockActive ? <Sun className="w-4 h-4" /> : <SunMedium className="w-4 h-4" />}
            </button>
          )}

          {onOpenSongbook && (
            <button
              type="button"
              onClick={onOpenSongbook}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Open Songbook"
              aria-label="Open Songbook"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Import New Lead Sheet"
              aria-label="Import New Lead Sheet"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
