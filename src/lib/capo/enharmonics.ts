import type { ParsedChord } from "../../types/index.ts";
import {
  FLAT_SPELLINGS,
  formatChord,
  getPitchClass,
  normalizeCapoFret,
  normalizePitchClass,
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

/**
 * Calculate sounding key from written key and capo fret
 */
export function getSoundingKey(writtenKey: string, capoFret: number): string {
  const normFret = normalizeCapoFret(capoFret);
  if (normFret === 0) return writtenKey;

  const isMinor = writtenKey.endsWith("m") && !writtenKey.endsWith("dim");
  const tonic = isMinor ? writtenKey.slice(0, -1) : writtenKey;
  const tonicPc = getPitchClass(tonic);
  const soundingPc = transposePitchClass(tonicPc, normFret);

  // Determine spelling for the new key tonic
  // Standard flat tonics: F (5), Bb (10), Eb (3), Ab (8), Db (1), Gb (6)
  // Standard minor flat tonics: Dm (2), Gm (7), Cm (0), Fm (5), Bbm (10), Ebm (3)
  let preferFlats = false;
  if (isMinor) {
    if ([2, 7, 0, 5, 10, 3].includes(soundingPc)) {
      preferFlats = true;
    }
  } else {
    if ([5, 10, 3, 8, 1, 6].includes(soundingPc)) {
      preferFlats = true;
    }
  }

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
    return {
      ...parsed,
      raw: formatChord(parsed),
      rootPitchClass: normalizePitchClass(parsed.rootPitchClass),
      bassPitchClass: parsed.bassPitchClass !== undefined
        ? normalizePitchClass(parsed.bassPitchClass)
        : undefined,
    };
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
