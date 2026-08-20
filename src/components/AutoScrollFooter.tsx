import React from "react";
import { ArrowDown, ArrowUp, Pause, Play, ZoomIn } from "lucide-react";

export interface AutoScrollFooterProps {
  isPlaying: boolean;
  isTouchPaused: boolean;
  speed: number;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: number) => void;
  onScrollToTop: () => void;
  onScrollToBottom?: () => void;
  fontSizeClass?: string;
  onChangeFontSize?: (sizeClass: string) => void;
  className?: string;
}

const SPEED_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
const FONT_SIZES = [
  { label: "S", class: "text-sm" },
  { label: "M", class: "text-base" },
  { label: "L", class: "text-lg" },
  { label: "XL", class: "text-xl" },
  { label: "2XL", class: "text-2xl" },
];

export const AutoScrollFooter: React.FC<AutoScrollFooterProps> = ({
  isPlaying,
  isTouchPaused,
  speed,
  onTogglePlay,
  onChangeSpeed,
  onScrollToTop,
  onScrollToBottom,
  fontSizeClass = "text-base",
  onChangeFontSize,
  className = "",
}) => {
  const currentSpeedIdx = SPEED_STEPS.indexOf(speed) >= 0 ? SPEED_STEPS.indexOf(speed) : 2; // Default 1.0x

  const handleSpeedDown = () => {
    if (currentSpeedIdx > 0) {
      onChangeSpeed(SPEED_STEPS[currentSpeedIdx - 1]);
    }
  };

  const handleSpeedUp = () => {
    if (currentSpeedIdx < SPEED_STEPS.length - 1) {
      onChangeSpeed(SPEED_STEPS[currentSpeedIdx + 1]);
    }
  };

  const currentFontIdx = FONT_SIZES.findIndex((f) => f.class === fontSizeClass);
  const handleCycleFont = () => {
    if (onChangeFontSize) {
      const nextIdx = (currentFontIdx + 1) % FONT_SIZES.length;
      onChangeFontSize(FONT_SIZES[nextIdx].class);
    }
  };

  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-3 py-2 shadow-lg ${className}`}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        {/* Play/Pause Button with Touch-Pause Indicator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm ${
              isPlaying
                ? isTouchPaused
                  ? "bg-amber-600 text-black animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            }`}
            aria-label={isPlaying ? "Pause Auto-Scroll" : "Start Auto-Scroll"}
          >
            {isPlaying
              ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>{isTouchPaused ? "Paused (3.5s)" : "Pause"}</span>
                </>
              )
              : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Auto-Scroll</span>
                </>
              )}
          </button>

          {/* Speed Stepper */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={handleSpeedDown}
              disabled={currentSpeedIdx <= 0}
              className="w-6 h-6 flex items-center justify-center text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 rounded active:bg-zinc-800 cursor-pointer"
              aria-label="Decrease Scroll Speed"
            >
              -
            </button>
            <span className="px-1 text-[11px] font-mono font-bold text-zinc-300 min-w-[2.5rem] text-center select-none">
              {speed.toFixed(2).replace(/\.?0+$/, "")}x
            </span>
            <button
              type="button"
              onClick={handleSpeedUp}
              disabled={currentSpeedIdx >= SPEED_STEPS.length - 1}
              className="w-6 h-6 flex items-center justify-center text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 rounded active:bg-zinc-800 cursor-pointer"
              aria-label="Increase Scroll Speed"
            >
              +
            </button>
          </div>
        </div>

        {/* Right Side: Font Zoom & Quick Jump */}
        <div className="flex items-center gap-1.5">
          {onChangeFontSize && (
            <button
              type="button"
              onClick={handleCycleFont}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono transition-all cursor-pointer"
              title="Cycle Font Size"
              aria-label="Cycle Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{FONT_SIZES[currentFontIdx >= 0 ? currentFontIdx : 1].label}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onScrollToTop}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Scroll to Top"
            aria-label="Scroll to Top"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          {onScrollToBottom && (
            <button
              type="button"
              onClick={onScrollToBottom}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Scroll to Bottom"
              aria-label="Scroll to Bottom"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
