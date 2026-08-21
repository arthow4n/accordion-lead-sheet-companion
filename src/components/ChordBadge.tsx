import React from "react";
import type { ChordDetail, ViewMode } from "../types/index.ts";

export interface ChordBadgeProps {
  chord?: string | ChordDetail;
  viewMode?: ViewMode;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  className?: string;
}

export const ChordBadge: React.FC<ChordBadgeProps> = ({
  chord,
  viewMode = "stradella",
  onSelectChord,
  active = false,
  className = "",
}) => {
  if (!chord) {
    return <span className="inline-block h-6 min-w-[1.5rem]" aria-hidden="true" />;
  }

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation so clicking chord badge does not trigger page turns or scroll gestures (UX-05)
    e.stopPropagation();
    if (onSelectChord) {
      onSelectChord(chord);
    }
  };

  // If chord is a plain string
  if (typeof chord === "string") {
    const stringBadgeStyle = viewMode === "cba"
      ? (active
        ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400"
        : "bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/70 hover:border-emerald-500 text-emerald-400")
      : (active
        ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
        : "bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700");

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`relative before:absolute before:-inset-3 before:-inset-2.5 before:content-[''] min-h-6 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold tracking-tight transition-all cursor-pointer select-none active:scale-95 ${stringBadgeStyle} ${className}`}
      >
        {chord}
      </button>
    );
  }

  // ChordDetail structure
  const isCounterBass = Boolean(
    chord.stradella?.isCounterBass ||
      (chord.stradella?.primaryBass && chord.stradella.primaryBass.endsWith("_")),
  );

  const rawChordName = chord.originalChord?.raw || chord.soundingChord?.raw || "Chord";
  const soundingChordName = chord.soundingChord?.raw || rawChordName;
  const primaryBass = chord.stradella?.primaryBass || chord.soundingChord?.root || "";
  const chordButton = chord.stradella?.chordButton?.label || "";
  const cbaFingering = chord.cba?.fingeringPattern || "";

  // Styling based on mode and counter-bass vs fundamental
  let badgeStyle = "";
  if (viewMode === "cba") {
    badgeStyle = active
      ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400 font-bold"
      : "bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/70 hover:border-emerald-500 text-emerald-400 font-semibold";
  } else if (isCounterBass) {
    badgeStyle = active
      ? "bg-amber-600 text-black border-amber-400 shadow-md ring-2 ring-amber-400 font-bold"
      : "bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 text-amber-300 font-semibold";
  } else {
    badgeStyle = active
      ? "bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400 font-bold"
      : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-100";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${rawChordName} (Sounding: ${soundingChordName}) - Tap for button diagram`}
      className={`relative before:absolute before:-inset-3 before:-inset-2.5 before:content-[''] min-h-6 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-mono transition-all cursor-pointer select-none active:scale-95 ${badgeStyle} ${className}`}
    >
      {viewMode === "stradella" && (
        <span className="flex items-center gap-1">
          <span className={isCounterBass ? "text-amber-300 font-bold" : "text-sky-400 font-bold"}>
            {primaryBass}
          </span>
          {chordButton && <span className="text-zinc-300 text-[10px]">{chordButton}</span>}
          {chord.stradella?.fingering && (
            <span className="text-[9px] text-zinc-400 opacity-80">
              ({chord.stradella.fingering})
            </span>
          )}
        </span>
      )}

      {viewMode === "cba" && (
        <span className="flex items-center gap-1">
          <span className="text-emerald-400 font-bold">{soundingChordName}</span>
          {cbaFingering && <span className="text-[10px] text-zinc-300">[{cbaFingering}]</span>}
        </span>
      )}

      {viewMode === "dual" && (
        <span className="flex flex-col items-start leading-none py-0.5">
          <span className="text-[11px] font-bold text-zinc-100">{rawChordName}</span>
          <span className="flex items-center gap-0.5 text-[9px] text-zinc-400">
            <span className={isCounterBass ? "text-amber-400" : "text-sky-400"}>{primaryBass}</span>
            {chordButton && <span>{chordButton}</span>}
          </span>
        </span>
      )}
    </button>
  );
};
