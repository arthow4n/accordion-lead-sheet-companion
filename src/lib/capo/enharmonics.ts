import type { NoteSpelling, ParsedChord } from "../../types/index.ts";
import {
  FLAT_SPELLINGS,
  formatChord,
  getPitchClass,
  normalizeCapoFret,
  normalizePitchClass,
  normalizeRareRoot,
  parseChord,
  SHARP_SPELLINGS,
  transposePitchClass,
} from "./transposition.ts";

/**
 * List of known flat keys and sharp keys
 */
export const FLAT_KEYS = new Set([
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
  "Dm",
  "Gm",
  "Cm",
  "Fm",
  "Bbm",
  "Ebm",
  "Abm",
]);

export const SHARP_KEYS = new Set([
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "Em",
  "Bm",
  "F#m",
  "C#m",
  "G#m",
  "D#m",
  "A#m",
]);

/**
 * Determine if a key uses flats or sharps
 */
export function isFlatKey(key: string): boolean {
  const clean = key.trim();
  if (FLAT_KEYS.has(clean)) return true;
  if (SHARP_KEYS.has(clean)) return false;
  // If key has flat accidental
  if (clean.includes("b")) return true;
  if (clean.includes("#")) return false;
  return false;
}

/**
 * Get note name for a pitch class given preference for flats or sharps
 */
export function getNoteName(pitchClass: number, preferFlats = true): string {
  const pc = normalizePitchClass(pitchClass);
  return preferFlats ? FLAT_SPELLINGS[pc] : SHARP_SPELLINGS[pc];
}

/** Resolve the requested spelling, delegating to the existing context heuristic in Auto mode. */
export function getPreferFlats(
  spelling: NoteSpelling,
  autoPreferFlats: boolean,
): boolean {
  if (spelling === "flats") return true;
  if (spelling === "sharps") return false;
  return autoPreferFlats;
}

/**
 * Re-spell a parsed chord for display without changing its pitch classes or chord quality.
 * This deliberately runs after transposition and after any physical voicing solver.
 */
export function respellParsedChord(
  chord: ParsedChord,
  spelling: NoteSpelling = "auto",
): ParsedChord {
  if (spelling === "auto") return chord;

  const result: ParsedChord = {
    ...chord,
    root: getNoteName(chord.rootPitchClass, spelling === "flats"),
    bassNote: chord.bassPitchClass === undefined
      ? undefined
      : getNoteName(chord.bassPitchClass, spelling === "flats"),
  };
  result.raw = formatChord(result);
  return result;
}

/** Re-spell a Stradella/CBA note label while preserving suffixes such as m, 7, dim, and _. */
export function respellNoteLabel(
  label: string,
  spelling: NoteSpelling = "auto",
): string {
  if (spelling === "auto" || !label) return label;
  const match = label.match(/^([A-Ga-g](?:#|b)?)(.*)$/);
  if (!match) return label;
  const note = getNoteName(getPitchClass(match[1]), spelling === "flats");
  const spelledNote = match[1][0] === match[1][0].toLowerCase() ? note.toLowerCase() : note;
  return `${spelledNote}${match[2]}`;
}

/** Re-spell note tokens in a solver explanation without touching interval text or words. */
export function respellNoteText(
  text: string,
  spelling: NoteSpelling = "auto",
): string {
  if (spelling === "auto" || !text) return text;
  return text.replace(/(^|[^A-Za-z#b])([A-Ga-g](?:#|b)?)(?=(_|m|7|d|[^A-Za-z#b]|$))/g, (
    _match,
    prefix: string,
    note: string,
  ) => `${prefix}${respellNoteLabel(note, spelling)}`);
}

/**
 * Calculate sounding key from written key and capo fret
 */
export function getSoundingKey(
  writtenKey: string,
  capoFret: number,
  spelling: NoteSpelling = "auto",
): string {
  const normFret = normalizeCapoFret(capoFret);

  const isMinor = writtenKey.endsWith("m") && !writtenKey.endsWith("dim");
  const tonic = isMinor ? writtenKey.slice(0, -1) : writtenKey;
  const tonicPc = getPitchClass(tonic);
  const soundingPc = normFret === 0 ? tonicPc : transposePitchClass(tonicPc, normFret);

  if (spelling === "auto" && normFret === 0) return writtenKey;

  // Determine spelling for the new key tonic
  // Standard flat tonics: F (5), Bb (10), Eb (3), Ab (8), Db (1), Gb (6)
  // Standard minor flat tonics: Dm (2), Gm (7), Cm (0), Fm (5), Bbm (10), Ebm (3)
  const autoPreferFlats = isMinor
    ? [2, 7, 0, 5, 10, 3].includes(soundingPc)
    : [5, 10, 3, 8, 1, 6].includes(soundingPc);
  const preferFlats = getPreferFlats(spelling, autoPreferFlats);

  const spelledTonic = getNoteName(soundingPc, preferFlats);
  return isMinor ? `${spelledTonic}m` : spelledTonic;
}

/**
 * Heuristic to choose flat vs sharp spelling for a sounding pitch class
 */
function shouldPreferFlatsForChord(
  soundingRootPc: number,
  _writtenRootPc: number,
  writtenRootName: string,
  keyContext?: string,
): boolean {
  if (keyContext) {
    return isFlatKey(keyContext);
  }

  // Pitch class 10 (Bb/A#): almost always Bb in standard lead sheet notation
  if (soundingRootPc === 10) return true;
  // Pitch class 3 (Eb/D#): almost always Eb in standard lead sheet notation
  if (soundingRootPc === 3) return true;
  // Pitch class 8 (Ab/G#): Ab unless coming from an E/B sharp context
  if (soundingRootPc === 8) {
    if (["E", "B", "F#", "C#"].includes(writtenRootName)) return false;
    return true;
  }
  // Pitch class 1 (Db/C#): C# in sharp contexts, Db in flat contexts
  if (soundingRootPc === 1) {
    if (["A", "D", "E", "B", "F#"].includes(writtenRootName)) return false;
    return true;
  }
  // Pitch class 6 (F#/Gb): F# in natural/sharp contexts, Gb in flat contexts
  if (soundingRootPc === 6) {
    if (writtenRootName.includes("b") || ["F", "Bb", "Eb"].includes(writtenRootName)) {
      return true;
    }
    return false;
  }

  // If written chord was flat, prefer flats
  if (writtenRootName.includes("b")) return true;

  return false;
}

/**
 * Transpose a chord by capo fret, respecting key-signature and enharmonic rules
 */
export function transposeChord(
  chordInput: string | ParsedChord,
  capoFret: number,
  keyContext?: string,
): ParsedChord {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const normFret = normalizeCapoFret(capoFret);

  if (normFret === 0) {
    const normRoot = normalizeRareRoot(parsed.root);
    const normBass = parsed.bassNote ? normalizeRareRoot(parsed.bassNote) : undefined;
    const result: ParsedChord = {
      ...parsed,
      root: normRoot,
      bassNote: normBass,
      rootPitchClass: normalizePitchClass(parsed.rootPitchClass),
      bassPitchClass: parsed.bassPitchClass !== undefined
        ? normalizePitchClass(parsed.bassPitchClass)
        : undefined,
    };
    result.raw = formatChord(result);
    return result;
  }

  const soundingRootPc = transposePitchClass(parsed.rootPitchClass, normFret);

  // Compute sounding key if keyContext is provided
  const soundingKey = keyContext ? getSoundingKey(keyContext, normFret) : undefined;
  const preferFlats = shouldPreferFlatsForChord(
    soundingRootPc,
    parsed.rootPitchClass,
    parsed.root,
    soundingKey,
  );

  const spelledRoot = getNoteName(soundingRootPc, preferFlats);

  let spelledBass: string | undefined;
  let soundingBassPc: number | undefined;

  if (parsed.bassPitchClass !== undefined) {
    soundingBassPc = transposePitchClass(parsed.bassPitchClass, normFret);
    // Spell bass note consistent with the chord spelling
    spelledBass = getNoteName(soundingBassPc, preferFlats);
  }

  const result: ParsedChord = {
    raw: "",
    root: spelledRoot,
    quality: parsed.quality,
    bassNote: spelledBass,
    extension: parsed.extension,
    rootPitchClass: soundingRootPc,
    bassPitchClass: soundingBassPc,
  };

  result.raw = formatChord(result);
  return result;
}
