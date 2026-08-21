import React from "react";
import type { ChordDetail, ViewMode } from "../types/index.ts";

export interface ChordBadgeProps {
  chord?: string | ChordDetail;
  viewMode?: ViewMode;
  onSelectChord?: (chord: ChordDetail | string) => void;
  active?: boolean;
  fontSizeClass?: string;
  className?: string;
}

export const ChordBadge: React.FC<ChordBadgeProps> = ({
  chord,
  viewMode = "stradella",
  onSelectChord,
  active = false,
  fontSizeClass = "text-base",
  className = "",
}) => {
  if (!chord) {
    return <span className="inline-block h-6 min-w-[1.5rem]" aria-hidden="true" />;
  }

  const badgeSizeMap: Record<string, {
    badgeFont: string;
    badgePad: string;
    minH: string;
    subFont: string;
    dualMainFont: string;
  }> = {
    "text-sm": {
      badgeFont: "text-xs",
      badgePad: "px-1.5 py-0.5",
      minH: "min-h-6",
      subFont: "text-[8px]",
      dualMainFont: "text-[10px]",
    },
    "text-base": {
      badgeFont: "text-xs sm:text-sm",
      badgePad: "px-2 py-0.5 sm:py-1",
      minH: "min-h-6 sm:min-h-7",
      subFont: "text-[9px]",
      dualMainFont: "text-[11px]",
    },
    "text-lg": {
      badgeFont: "text-sm sm:text-base",
      badgePad: "px-2.5 py-1",
      minH: "min-h-6 sm:min-h-7",
      subFont: "text-[10px]",
      dualMainFont: "text-xs",
    },
    "text-xl": {
      badgeFont: "text-base sm:text-lg",
      badgePad: "px-3 py-1.5",
      minH: "min-h-6 sm:min-h-8",
      subFont: "text-xs",
      dualMainFont: "text-sm",
    },
    "text-2xl": {
      badgeFont: "text-lg sm:text-xl",
      badgePad: "px-3.5 py-2",
      minH: "min-h-6 sm:min-h-9",
      subFont: "text-sm",
      dualMainFont: "text-base",
    },
  };
  const currentBadgeSize = badgeSizeMap[fontSizeClass] || badgeSizeMap["text-base"];

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation so clicking chord badge does not trigger page turns or scroll gestures (UX-05)
    e.stopPropagation();
    if (onSelectChord) {
      onSelectChord(chord);
    }
  };

  // If chord is a plain string
  if (typeof chord === "string") {
    let stringBadgeStyle = "";
    if (viewMode === "cba") {
      stringBadgeStyle = active
        ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400"
        : "bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/70 hover:border-emerald-500 text-emerald-400";
    } else if (viewMode === "guitar") {
      stringBadgeStyle = active
        ? "bg-amber-600 text-black border-amber-400 shadow-md ring-2 ring-amber-400"
        : "bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 hover:border-amber-500 text-amber-300";
    } else {
      stringBadgeStyle = active
        ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
        : "bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700";
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`relative before:absolute before:-inset-2.5 before:content-[''] ${currentBadgeSize.minH} inline-flex items-center gap-1 ${currentBadgeSize.badgePad} rounded ${currentBadgeSize.badgeFont} font-mono font-bold tracking-tight transition-all cursor-pointer select-none active:scale-95 ${stringBadgeStyle} ${className}`}
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
  } else if (viewMode === "guitar") {
    badgeStyle = active
      ? "bg-amber-600 text-black border-amber-400 shadow-md ring-2 ring-amber-400 font-bold"
      : "bg-amber-950/80 hover:bg-amber-900 border-amber-600/70 text-amber-300 font-semibold";
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

  // Format chord button label with proper capitalization for compound recipe
  let formattedChordBtn = chord.stradella?.chordButton?.note || chordButton;
  if (chord.stradella?.chordButton) {
    const btn = chord.stradella.chordButton;
    const btnNote = btn.note || btn.label;
    if (btn.row === "minor") {
      formattedChordBtn = `${btnNote}m`;
    } else if (btn.row === "seventh") {
      formattedChordBtn = `${btnNote}7`;
    } else if (btn.row === "diminished") {
      formattedChordBtn = `${btnNote}dim`;
    } else {
      formattedChordBtn = btnNote; // Major row
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${rawChordName} (Sounding: ${soundingChordName}) - Tap for button diagram`}
      className={`relative before:absolute before:-inset-2.5 before:content-[''] ${currentBadgeSize.minH} inline-flex items-center gap-1 ${currentBadgeSize.badgePad} rounded border ${currentBadgeSize.badgeFont} font-mono transition-all cursor-pointer select-none active:scale-95 ${badgeStyle} ${className}`}
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
                <span
                  className={`${currentBadgeSize.subFont} text-zinc-400 font-normal opacity-90`}
                >
                  ({primaryBass}+{formattedChordBtn})
                </span>
              </span>
            )
            : <span className="font-bold text-sky-400">{soundingChordName}</span>}
        </span>
      )}

      {viewMode === "guitar" && (
        <span className="text-amber-300 font-bold tracking-tight">
          {rawChordName}
        </span>
      )}

      {viewMode === "cba" && (
        <span className="text-emerald-400 font-bold tracking-tight">
          {soundingChordName}
        </span>
      )}

      {viewMode === "dual" && (
        <span className="flex flex-col items-start leading-none py-0.5">
          <span className={`${currentBadgeSize.dualMainFont} font-bold text-zinc-100`}>
            {rawChordName}
          </span>
          <span className={`flex items-center gap-0.5 ${currentBadgeSize.subFont} text-zinc-400`}>
            {isSlash
              ? (
                <span className={isCounterBass ? "text-amber-400 font-bold" : "text-sky-400"}>
                  /{primaryBass}
                </span>
              )
              : isCompound
              ? <span>{primaryBass}+{formattedChordBtn}</span>
              : <span className="text-sky-400 font-semibold">{soundingChordName}</span>}
          </span>
        </span>
      )}
    </button>
  );
};
