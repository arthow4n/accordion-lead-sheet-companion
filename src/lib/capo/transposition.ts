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
 * Normalize Unicode accidental symbols (♯, ♭) to standard ASCII (#, b)
 */
export function normalizeUnicodeAccidentals(str: string): string {
  return str.replace(/♯/g, "#").replace(/♭/g, "b");
}

/**
 * Normalize rare enharmonic roots to canonical spellings
 * Cb -> B, Fb -> E, B# -> C, E# -> F
 */
export function normalizeRareRoot(root: string): string {
  const clean = root.trim();
  const normMap: Record<string, string> = {
    "Cb": "B",
    "Fb": "E",
    "B#": "C",
    "E#": "F",
    "cb": "B",
    "fb": "E",
    "b#": "C",
    "e#": "F",
  };
  return normMap[clean] ?? clean;
}

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
 * Get pitch class for a note string (e.g. "C#", "Bb", "B♭", "Cb")
 */
export function getPitchClass(note: string): number {
  const cleanNote = normalizeUnicodeAccidentals(note).trim();
  const normNote = normalizeRareRoot(cleanNote);
  const pc = NOTE_TO_PITCH_CLASS[normNote];
  if (pc !== undefined) {
    return pc;
  }
  // Try capitalizing first letter
  const formatted = normNote.charAt(0).toUpperCase() + normNote.slice(1);
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
  /^([A-G][#b]?)(maj7|maj9|maj11|maj13|maj|M7|M9|M13|M|min7|min9|min11|min13|min|m7b5|m7#5|m7|m9|m11|m13|m6(?:\/9)?|m|dim7|dim|aug7|aug|7sus4|7sus2|7sus|9sus4|9sus|sus4|sus2|sus|7b5|7#5|7b9|7#9|7#11|7b13|7|9|11|13|6\/9|6|add9|add2|add4|add11|add13|add#11|5|4|ø|°|\+|alt)?(.*?)(\/([A-G][#b]?))?$/i;

/**
 * Detect chord quality from quality string and extension
 */
export function classifyChordQuality(
  qualityStr: string,
  extra: string,
): ChordQuality {
  const full = normalizeUnicodeAccidentals(qualityStr + extra).toLowerCase().trim().replace(
    /[\s_]+/g,
    "",
  );

  // Half-diminished 7th (e.g. m7b5, m7(b5), min7b5, ø, halfdim)
  if (
    full.includes("m7b5") || full.includes("m7(b5)") || full.includes("min7b5") ||
    full.includes("m7-5") || full.includes("m7(♭5)") || full.includes("-7b5") ||
    full.includes("-7(b5)") || full === "ø" || full === "ø7" || full.includes("halfdim")
  ) {
    return "halfDiminished7";
  }

  // Diminished 7th
  if (
    full.startsWith("dim7") || full.startsWith("°7") || full.startsWith("o7") ||
    full.startsWith("07")
  ) {
    return "diminished7";
  }

  // Diminished Triad
  if (
    full.startsWith("dim") || full === "°" || full.startsWith("o") ||
    full === "0"
  ) {
    return "diminished";
  }

  // Minor-major 7th (e.g. m(maj7), mMaj7, min(maj7), mM7)
  // This must precede both generic major-7th and minor classification.
  if (/^(?:m\(maj7\)|mmaj7|min\(maj7\)|mm7)$/.test(full)) {
    return "minorMajor7";
  }

  // Dominant 7 sus4 (only the exact 7sus / 7sus4 spellings; 7sus2 is distinct)
  if (/^7sus4?$/.test(full)) {
    return "dominant7Sus4";
  }

  // Dominant 11 uses a practical four-note RH voicing.
  if (full === "11") {
    return "dominant11";
  }

  // Minor 11 uses a practical four-note RH voicing.
  if (full === "m11" || full === "min11") {
    return "minor11";
  }

  // Power chord: do not introduce a third through a major Stradella button.
  if (full === "5") {
    return "power5";
  }

  // Dominant 7 #9 and #5 are semantically distinct from the broad altered and
  // augmented fallbacks below.
  if (/^7(?:#9|\(#9\))$/.test(full)) {
    return "sevenSharpNine";
  }
  if (/^(?:7(?:#5|\(#5\))|aug7|\+7)$/.test(full)) {
    return "sevenSharpFive";
  }

  // Add 4 / add 11 share one practical RH and LH representation here.
  if (
    full === "add4" || full === "add11" || full === "(add4)" || full === "(add11)" ||
    full === "(4)" || full === "(11)"
  ) {
    return "add4";
  }

  // Augmented / #5
  if (
    full.startsWith("aug") || full.startsWith("+") ||
    full.includes("7#5") || full.includes("7(#5)") || full.includes("7(+5)") ||
    full.includes("maj7#5") || full.includes("maj7(#5)") || full.includes("maj7(+5)")
  ) {
    return "augmented";
  }

  // Dominant 7 #11 (e.g. 7#11, 7(#11), dominant7#11, 7(♯11))
  // But NOT maj7(#11) which is major7 with #11
  if (
    (full.includes("7#11") || full.includes("7(#11)") || full.includes("7(♯11)") ||
      full.includes("7(+11)") || full.includes("dom7#11")) &&
    !full.includes("maj") && !full.includes("m7") && !full.startsWith("m") &&
    !full.startsWith("min")
  ) {
    return "sevenSharpEleven";
  }

  // Dominant 7 b9 or 13 b9 (e.g. 7b9, 7(b9), 7(♭9), 7(-9), 13b9, 13(b9), 13(♭9), 13(-9), dominant7b9)
  if (
    full.includes("7b9") || full.includes("7(b9)") || full.includes("7(♭9)") ||
    full.includes("7(-9)") ||
    full.includes("13b9") || full.includes("13(b9)") || full.includes("13(♭9)") ||
    full.includes("13(-9)")
  ) {
    return "sevenFlatNine";
  }

  // Major 9th (e.g. maj9, maj7(9), M9, Δ9)
  if (
    full.startsWith("maj9") || full.startsWith("m9maj") || full.startsWith("maj7(9)") ||
    full.startsWith("m7(maj9)") || full.startsWith("δ9") || full.startsWith("Δ9") ||
    (full.startsWith("m9") && full.includes("maj"))
  ) {
    return "major9";
  }

  // Major 7th (e.g. maj7, maj7(#11), maj7(13), M7, Δ7, Δ, ma7)
  if (
    full.startsWith("maj7") || full.startsWith("ma7") || full.startsWith("δ7") ||
    full.startsWith("δ") || full.startsWith("Δ7") || full.startsWith("Δ") ||
    full.startsWith("m7+") || full.startsWith("7m") || full.startsWith("7m(9)") ||
    full.startsWith("m7(maj)") || (full.startsWith("m7") && full.includes("maj")) ||
    (full.startsWith("m") && full.includes("maj7"))
  ) {
    return "major7";
  }

  // 13th / Dominant 13 (e.g. 13, 13(#11), 13(b5), 13sus4, dom13)
  if (
    full.startsWith("13") || full.startsWith("dom13") || full.startsWith("dominant13")
  ) {
    return "dominant13";
  }

  // 6/9 chord
  if (
    full.startsWith("6/9") || full.startsWith("69") || full.startsWith("6(9)") ||
    full.startsWith("6add9")
  ) {
    return "sixNine";
  }

  // Minor 9th
  if (full.startsWith("m9") || full.startsWith("min9") || full.startsWith("-9")) {
    return "minor9";
  }

  // Minor 7th
  if (
    full.startsWith("m7") || full.startsWith("min7") ||
    full.startsWith("-7")
  ) {
    return "minor7";
  }

  // Minor 6th
  if (full.startsWith("m6") || full.startsWith("min6") || full.startsWith("-6")) {
    return "minorSix";
  }

  // Minor triad
  if (
    full.startsWith("m") || full.startsWith("min") || full.startsWith("-")
  ) {
    return "minor";
  }

  // Dominant 9th
  if (full.startsWith("9") || full.startsWith("dom9")) {
    return "dominant9";
  }

  // Altered chord (e.g. 7#9, 7b5, 7(b5), 7(#9), 7(b13), 7b13, alt, 7alt, 7(♯9), 7(♭5), 7(♭13))
  if (
    full.startsWith("alt") || full.includes("7alt") || full.includes("#9") ||
    full.includes("♯9") || full.includes("b9") || full.includes("♭9") ||
    full.includes("b5") || full.includes("♭5") || full.includes("7b5") ||
    full.includes("7♭5") || full.includes("7(b5)") || full.includes("7(♭5)") ||
    full.includes("7(#9)") || full.includes("7(♯9)") || full.includes("b13") ||
    full.includes("♭13") || full.includes("7(b13)") || full.includes("7(♭13)") ||
    full.includes("7b13") || full.includes("7♭13") || full.includes("#11") ||
    full.includes("♯11")
  ) {
    return "altered";
  }

  // Sus4
  if (
    full.startsWith("sus4") || full.startsWith("7sus4") || full.startsWith("9sus4") ||
    full === "4" || full === "(4)" || full === "7(4)"
  ) {
    return "sus4";
  }

  // Sus2
  if (full.startsWith("sus2") || full.startsWith("7sus2") || full === "sus") {
    return "sus2";
  }

  // Dominant 7th
  if (full.startsWith("7") || full.startsWith("dom7")) {
    return "dominant7";
  }

  // Add9 / Add2 / Add4
  if (
    full.startsWith("add9") || full.startsWith("add2") || full.startsWith("add") ||
    full.startsWith("(add")
  ) {
    return "add9";
  }

  // 6th
  if (full.startsWith("6")) {
    return "six";
  }

  // Major Triad fallback
  if (full === "" || full === "maj" || full === "major" || full === "m") {
    return "major";
  }

  return "unknown";
}

/**
 * Parse arbitrary chord string into structured ParsedChord
 */
export function parseChord(rawChord: string): ParsedChord {
  const trimmed = normalizeUnicodeAccidentals(rawChord).trim();
  const match = trimmed.match(CHORD_REGEX);

  if (!match) {
    // Fallback 1: check if starts with A-G
    const rootMatch = trimmed.match(/^([A-G][#b]?)(.*)$/i);
    if (rootMatch) {
      const rawRoot = rootMatch[1];
      const formattedRoot = rawRoot.charAt(0).toUpperCase() + rawRoot.slice(1);
      const root = normalizeRareRoot(formattedRoot);
      const rest = rootMatch[2];
      const slashIdx = rest.indexOf("/");
      let bassNote: string | undefined;
      let extension = rest;
      if (slashIdx !== -1) {
        const rawBass = rest.slice(slashIdx + 1).trim();
        const formattedBass = rawBass
          ? rawBass.charAt(0).toUpperCase() + rawBass.slice(1)
          : undefined;
        bassNote = formattedBass ? normalizeRareRoot(formattedBass) : undefined;
        extension = rest.slice(0, slashIdx).trim();
      }
      const quality = classifyChordQuality(extension, "");
      const res: ParsedChord = {
        raw: trimmed,
        root,
        quality,
        bassNote: bassNote || undefined,
        extension: extension || undefined,
        rootPitchClass: getPitchClass(root),
        bassPitchClass: bassNote ? getPitchClass(bassNote) : undefined,
      };
      res.raw = formatChord(res);
      return res;
    }

    // Fallback 2: rootless jazz chord (e.g. 13b9, 7b9, 7#9, m7b5)
    const quality = classifyChordQuality(trimmed, "");
    if (quality !== "unknown") {
      return {
        raw: trimmed,
        root: "",
        quality,
        extension: trimmed,
        rootPitchClass: 0,
      };
    }

    return {
      raw: trimmed,
      root: trimmed,
      quality: "unknown",
      rootPitchClass: 0,
    };
  }

  const rawRoot = match[1];
  const formattedRoot = rawRoot.charAt(0).toUpperCase() + rawRoot.slice(1);
  const root = normalizeRareRoot(formattedRoot);
  const qualityStr = match[2] || "";
  const extraExt = match[3] || "";
  const rawBass = match[5] || undefined;
  const formattedBass = rawBass ? rawBass.charAt(0).toUpperCase() + rawBass.slice(1) : undefined;
  const bassNote = formattedBass ? normalizeRareRoot(formattedBass) : undefined;
  const fullExt = (qualityStr + extraExt).trim();
  const quality = classifyChordQuality(qualityStr, extraExt);

  const res: ParsedChord = {
    raw: trimmed,
    root,
    quality,
    bassNote: bassNote || undefined,
    extension: fullExt || undefined,
    rootPitchClass: getPitchClass(root),
    bassPitchClass: bassNote ? getPitchClass(bassNote) : undefined,
  };
  res.raw = formatChord(res);
  return res;
}

/**
 * Format a ParsedChord back to string
 */
export function formatChord(chord: ParsedChord): string {
  const ext = chord.extension ?? "";
  const bass = chord.bassNote ? `/${chord.bassNote}` : "";
  return `${chord.root}${ext}${bass}`;
}
