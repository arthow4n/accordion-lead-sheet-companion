import type { ChordQuality, ParsedChord } from "../../types/index.ts";

/**
 * Mapping of note names to pitch classes (0-11)
 * C = 0, C#/Db = 1, D = 2, D#/Eb = 3, E = 4, F = 5,
 * F#/Gb = 6, G = 7, G#/Ab = 8, A = 9, A#/Bb = 10, B = 11
 */
export const NOTE_TO_PITCH_CLASS: Record<string, number> = {
  "C": 0,
  "B#": 0,
  "Dbb": 0,
  "C#": 1,
  "Db": 1,
  "B##": 1,
  "D": 2,
  "C##": 2,
  "Ebb": 2,
  "D#": 3,
  "Eb": 3,
  "Fbb": 3,
  "E": 4,
  "Fb": 4,
  "D##": 4,
  "F": 5,
  "E#": 5,
  "Gbb": 5,
  "F#": 6,
  "Gb": 6,
  "E##": 6,
  "G": 7,
  "F##": 7,
  "Abb": 7,
  "G#": 8,
  "Ab": 8,
  "A": 9,
  "G##": 9,
  "Bbb": 9,
  "A#": 10,
  "Bb": 10,
  "Cbb": 10,
  "B": 11,
  "Cb": 11,
  "A##": 11,
};

/**
 * Standard note spellings
 */
export const FLAT_SPELLINGS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

export const SHARP_SPELLINGS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/**
 * Modulo 12 normalization
 */
export function normalizePitchClass(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

/**
 * Normalize capo fret between 0 and 11
 */
export function normalizeCapoFret(fret: number): number {
  return ((fret % 12) + 12) % 12;
}

/**
 * Get pitch class for a note string (e.g. "C#", "Bb")
 */
export function getPitchClass(note: string): number {
  const cleanNote = note.trim();
  const pc = NOTE_TO_PITCH_CLASS[cleanNote];
  if (pc !== undefined) {
    return pc;
  }
  // Try capitalizing first letter
  const formatted = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
  return NOTE_TO_PITCH_CLASS[formatted] ?? 0;
}

/**
 * Modulo 12 pitch transposition
 */
export function transposePitchClass(
  pitchClass: number,
  semitones: number,
): number {
  return normalizePitchClass(pitchClass + semitones);
}

/**
 * Regular expression to decompose a chord string into:
 * 1: Root note ([A-G][#b]?)
 * 2: Quality / Extension
 * 3: Slash Bass note (/[A-G][#b]?)
 */
const CHORD_REGEX =
  /^([A-G][#b]?)(maj7|maj9|maj11|maj13|maj|M7|M9|min7|min9|min|m7b5|m7|m9|m11|m6|m|dim7|dim|aug7|aug|7sus4|sus4|sus2|sus|7b5|7#9|7b9|7|9|11|13|6\/9|6|add9|add2|add4|5|ø|°|\+)?(.*?)(\/([A-G][#b]?))?$/;

/**
 * Detect chord quality from quality string and extension
 */
export function classifyChordQuality(
  qualityStr: string,
  extra: string,
): ChordQuality {
  const full = (qualityStr + extra).toLowerCase().trim();

  if (full.startsWith("m7b5") || full === "ø" || full.includes("halfdim")) {
    return "halfDiminished7";
  }
  if (full.startsWith("dim7") || full === "°7") {
    return "diminished7";
  }
  if (
    full.startsWith("dim") || full === "°" || full.startsWith("o") ||
    full === "0"
  ) {
    return "diminished";
  }
  if (full.startsWith("aug") || full.startsWith("+")) {
    return "augmented";
  }
  if (full.startsWith("maj9") || full.startsWith("m9") && full.includes("maj")) {
    return "major9";
  }
  if (
    full.startsWith("maj7") || full.startsWith("m7") && full.includes("maj") ||
    full.startsWith("ma7") || full.startsWith("Δ")
  ) {
    return "major7";
  }
  if (full.startsWith("m9") || full.startsWith("min9")) {
    return "minor9";
  }
  if (
    full.startsWith("m7") || full.startsWith("min7") ||
    full.startsWith("-7")
  ) {
    return "minor7";
  }
  if (full.startsWith("m6") || full.startsWith("min6") || full.startsWith("-6")) {
    return "minorSix";
  }
  if (
    full.startsWith("m") || full.startsWith("min") || full.startsWith("-")
  ) {
    return "minor";
  }
  if (full.startsWith("9") || full.startsWith("dom9")) {
    return "dominant9";
  }
  if (full.startsWith("7") || full.startsWith("dom7")) {
    return "dominant7";
  }
  if (full.startsWith("sus4") || full.startsWith("7sus4")) {
    return "sus4";
  }
  if (full.startsWith("sus2")) {
    return "sus2";
  }
  if (full.startsWith("add9") || full.startsWith("add2")) {
    return "add9";
  }
  if (full.startsWith("6")) {
    return "six";
  }
  if (full.startsWith("alt") || full.includes("#9") || full.includes("b9")) {
    return "altered";
  }
  if (
    full === "" || full === "maj" || full === "major" || full === "m" ||
    full === "5"
  ) {
    return "major";
  }

  return "unknown";
}

/**
 * Parse arbitrary chord string into structured ParsedChord
 */
export function parseChord(rawChord: string): ParsedChord {
  const trimmed = rawChord.trim();
  const match = trimmed.match(CHORD_REGEX);

  if (!match) {
    // Fallback: check if starts with A-G
    const rootMatch = trimmed.match(/^([A-G][#b]?)(.*)$/);
    if (rootMatch) {
      const root = rootMatch[1];
      const rest = rootMatch[2];
      const slashIdx = rest.indexOf("/");
      let bassNote: string | undefined;
      let extension = rest;
      if (slashIdx !== -1) {
        bassNote = rest.slice(slashIdx + 1).trim();
        extension = rest.slice(0, slashIdx).trim();
      }
      const quality = classifyChordQuality(extension, "");
      return {
        raw: trimmed,
        root,
        quality,
        bassNote: bassNote || undefined,
        extension: extension || undefined,
        rootPitchClass: getPitchClass(root),
        bassPitchClass: bassNote ? getPitchClass(bassNote) : undefined,
      };
    }

    return {
      raw: trimmed,
      root: trimmed,
      quality: "unknown",
      rootPitchClass: 0,
    };
  }

  const root = match[1];
  const qualityStr = match[2] || "";
  const extraExt = match[3] || "";
  const bassNote = match[5] || undefined;
  const fullExt = (qualityStr + extraExt).trim();
  const quality = classifyChordQuality(qualityStr, extraExt);

  return {
    raw: trimmed,
    root,
    quality,
    bassNote: bassNote || undefined,
    extension: fullExt || undefined,
    rootPitchClass: getPitchClass(root),
    bassPitchClass: bassNote ? getPitchClass(bassNote) : undefined,
  };
}

/**
 * Format a ParsedChord back to string
 */
export function formatChord(chord: ParsedChord): string {
  const ext = chord.extension ?? "";
  const bass = chord.bassNote ? `/${chord.bassNote}` : "";
  return `${chord.root}${ext}${bass}`;
}
