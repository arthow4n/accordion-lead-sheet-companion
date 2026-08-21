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
        className={`relative before:absolute before:-inset-2.5 before:content-[''] min-h-6 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold tracking-tight transition-all cursor-pointer select-none active:scale-95 ${stringBadgeStyle} ${className}`}
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

  // Classification for clean Stradella view
  const isSlash = Boolean(
    chord.soundingChord?.bassNote ||
      chord.originalChord?.bassNote ||
      soundingChordName.includes("/"),
  );

  const compoundQualities = [
    "major7",
    "minor7",
    "halfDiminished7",
    "six",
    "minorSix",
    "dominant9",
    "major9",
    "minor9",
    "dominant13",
    "sevenSharpEleven",
    "sevenFlatNine",
    "sixNine",
    "altered",
    "sus4",
    "sus2",
    "add9",
    "augmented",
  ];
  const isCompound = Boolean(
    chord.soundingChord?.quality &&
      compoundQualities.includes(chord.soundingChord.quality) &&
      chord.stradella?.chordButton &&
      !isSlash,
  );

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

  // Base root for slash chords (e.g. "C" from "C/B")
  const slashBaseChord = isSlash ? soundingChordName.split("/")[0] : soundingChordName;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${rawChordName} (Sounding: ${soundingChordName}) - Tap for button diagram`}
      className={`relative before:absolute before:-inset-2.5 before:content-[''] min-h-6 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-mono transition-all cursor-pointer select-none active:scale-95 ${badgeStyle} ${className}`}
    >
      {viewMode === "stradella" && (
        <span className="flex items-center gap-1">
          {isSlash
            ? (
              <span className="flex items-center font-bold">
                <span className="text-zinc-100">{slashBaseChord}</span>
                <span className="text-zinc-400 mx-0.5">/</span>
                <span
                  className={isCounterBass
                    ? "text-amber-300 underline decoration-amber-400/80 font-bold"
                    : "text-sky-400 font-bold"}
                >
                  {primaryBass}
                </span>
              </span>
            )
            : isCompound
            ? (
              <span className="flex items-baseline gap-1">
                <span className="font-bold text-sky-400">{soundingChordName}</span>
                <span className="text-[9px] text-zinc-400 font-normal opacity-90">
                  ({primaryBass}+{chordButton})
                </span>
              </span>
            )
            : <span className="font-bold text-sky-400">{soundingChordName}</span>}
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
            {isSlash
              ? (
                <span className={isCounterBass ? "text-amber-400 font-bold" : "text-sky-400"}>
                  /{primaryBass}
                </span>
              )
              : isCompound
              ? <span>{primaryBass}+{chordButton}</span>
              : <span className="text-sky-400 font-semibold">{soundingChordName}</span>}
          </span>
        </span>
      )}
    </button>
  );
};
