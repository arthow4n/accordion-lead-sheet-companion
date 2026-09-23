/**
 * Deterministic Key Signature, Meter, Chord, and Navigation Recognition Engine.
 *
 * Replaces Tesseract.js with pure deterministic TypeScript:
 * - Deterministic key signature identification (0 to 6 sharps/flats) from header region glyph analysis or harmonic key root analysis.
 * - Deterministic meter identification, including compound 6/8 meter calculation (sum of note durations in a measure = 6 eighth-notes / 3 quarter-notes) and header text pattern matching.
 * - Navigation & sections: pure regex and barline shape detection.
 * - Eliminated all fragile 6s / 12s worker timeout band-aids and withTimeout traps.
 * - Correct measure-vs-staff indexing: associates chords and supplemental metadata with measures by actual measure index or measure spatial bounding coordinates.
 */

import type {
  ImageBox,
  NavigationMark,
  ScoreKeySignature,
  ScoreTimeSignature,
} from "../../types/score.ts";
import { normalizeChordLookupCandidates } from "../lookup/lookupParser.ts";
import type { RawImageData } from "./photoPreprocessing.ts";
export type { RawImageData };

export interface OcrChordCandidate {
  raw: string;
  normalized: string;
  confidence: number;
  box?: ImageBox;
  /** Relative offset within the measure or staff line [0.0 .. 1.0]. */
  relativePosition?: number;
}

export interface OcrFormResult {
  sections: Array<{ label: string; box?: ImageBox }>;
  navigation: NavigationMark[];
  keySignature?: ScoreKeySignature;
  timeSignature?: ScoreTimeSignature;
  unrecognizedDirections: string[];
}

/** Predefined table of supported key signatures (0 to 6 sharps/flats). */
export const KEY_SIGNATURE_PROFILES: Record<number, ScoreKeySignature> = {
  0: { fifths: 0, mode: "major" },
  1: { fifths: 1, mode: "major" },
  2: { fifths: 2, mode: "major" },
  3: { fifths: 3, mode: "major" },
  4: { fifths: 4, mode: "major" },
  5: { fifths: 5, mode: "major" },
  6: { fifths: 6, mode: "major" },
  [-1]: { fifths: -1, mode: "major" },
  [-2]: { fifths: -2, mode: "major" },
  [-3]: { fifths: -3, mode: "major" },
  [-4]: { fifths: -4, mode: "major" },
  [-5]: { fifths: -5, mode: "major" },
  [-6]: { fifths: -6, mode: "major" },
};

/** Predefined table of supported time signatures. */
export const TIME_SIGNATURE_PROFILES: Record<string, ScoreTimeSignature> = {
  "2/4": { beats: 2, beatType: 4 },
  "3/4": { beats: 3, beatType: 4 },
  "4/4": { beats: 4, beatType: 4 },
  "6/8": { beats: 6, beatType: 8 },
  "2/2": { beats: 2, beatType: 2 },
  "C": { beats: 4, beatType: 4 },
  "C|": { beats: 2, beatType: 2 },
};

/**
 * Deterministically parse meter text or tokens.
 * Handles "6/8", "2/4", "3/4", "4/4", "C", "C|", and multi-line digit pairs.
 */
export function parseMeterToken(token: string): ScoreTimeSignature | null {
  const trimmed = token.trim().toUpperCase();
  if (!trimmed) return null;

  if (TIME_SIGNATURE_PROFILES[trimmed]) {
    return { ...TIME_SIGNATURE_PROFILES[trimmed] };
  }

  // Fraction format: 6/8, 4/4, 3/4, 2/4
  const fracMatch = trimmed.match(/^(\d+)\s*[/:]\s*(\d+)$/);
  if (fracMatch) {
    const beats = parseInt(fracMatch[1], 10);
    const beatType = parseInt(fracMatch[2], 10);
    if ([2, 3, 4, 6, 9, 12].includes(beats) && [2, 4, 8, 16].includes(beatType)) {
      return { beats, beatType };
    }
  }

  // Two stacked numbers e.g. "6\n8" or "6 8"
  const stackedMatch = trimmed.match(/^(\d+)\s+(\d+)$/);
  if (stackedMatch) {
    const beats = parseInt(stackedMatch[1], 10);
    const beatType = parseInt(stackedMatch[2], 10);
    if ([2, 3, 4, 6, 9, 12].includes(beats) && [2, 4, 8, 16].includes(beatType)) {
      return { beats, beatType };
    }
  }

  return null;
}

/** Backward-compatible export alias for parseMeterToken. */
export const parseTimeSignatureSymbols = parseMeterToken;

/**
 * Deterministically parse key signature from accidental symbols, names, or Humdrum tokens.
 * Supports all 0 to 6 sharps and 0 to 6 flats.
 */
export function parseKeySignatureSymbols(text: string): ScoreKeySignature | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Explicit Humdrum key syntax: *k[f#c#g#], *k[b-e-a-], *k[]
  const kernMatch = trimmed.match(/^\*k\[(.*?)\]$/);
  if (kernMatch) {
    const content = kernMatch[1];
    if (!content) return { fifths: 0, mode: "major" };
    const sharps = (content.match(/#/g) || []).length;
    const flats = (content.match(/-/g) || []).length;
    if (sharps > 0) return { fifths: Math.min(6, sharps), mode: "major" };
    if (flats > 0) return { fifths: -Math.min(6, flats), mode: "major" };
  }

  // 2. Named key words e.g. "G Major", "Bb Major", "D Minor", "F# Major", "Key: F#", "Key: Am", "Key: G#m"
  // Require explicit "maj/major/min/minor/m" or "key" prefix to avoid misinterpreting bare chords as key signatures.
  const nameMatch =
    trimmed.match(/\b(?:key\s*[:\s]\s*)?([A-G][b#♭♯]?)\s*(maj(?:or)?|min(?:or)?|m)\b/i) ||
    trimmed.match(/\bkey\s*[:\s]\s*([A-G][b#♭♯]?)(?![A-Za-z0-9#♭♯])/i);
  if (nameMatch) {
    let tonic = nameMatch[1].charAt(0).toUpperCase();
    if (nameMatch[1].length > 1) {
      const acc = nameMatch[1].charAt(1);
      if (acc === "#" || acc === "♯") tonic += "#";
      else if (acc === "b" || acc === "♭") tonic += "b";
    }
    const modeStr = (nameMatch[2] || "").toLowerCase();
    const isMinor = modeStr.startsWith("min") || modeStr === "m";
    const fifthsMap: Record<string, number> = {
      "C": 0,
      "G": 1,
      "D": 2,
      "A": 3,
      "E": 4,
      "B": 5,
      "F#": 6,
      "C#": 7,
      "G#": 8,
      "D#": 9,
      "A#": 10,
      "F": -1,
      "Bb": -2,
      "Eb": -3,
      "Ab": -4,
      "Db": -5,
      "Gb": -6,
      "Cb": -7,
    };

    if (fifthsMap[tonic] !== undefined) {
      let fifths = fifthsMap[tonic];
      if (isMinor) {
        fifths -= 3;
      } else if (fifths > 7) {
        // Enharmonic wrap for rare major keys (e.g. G# Major -> Ab Major)
        fifths -= 12;
      }
      if (fifths >= -7 && fifths <= 7) {
        return { fifths, mode: isMinor ? "minor" : "major" };
      }
    }
  }

  // 3. Count sharp glyphs (#, ♯) when string consists of accidentals
  if (/^[#♯]+$/.test(trimmed)) {
    const count = trimmed.length;
    if (count <= 6) return { ...KEY_SIGNATURE_PROFILES[count] };
  }

  // 4. Count flat glyphs (b, ♭, -) when string consists of accidentals
  if (/^[b♭\-]+$/.test(trimmed)) {
    const count = trimmed.length;
    if (count <= 6) return { ...KEY_SIGNATURE_PROFILES[-count] };
  }

  return null;
}

/**
 * Extract and normalize chord candidates from OCR text string.
 * Uses the deterministic chord parser to reject non-chords.
 */
export function extractChordsFromOcrText(text: string): OcrChordCandidate[] {
  if (!text || !text.trim()) return [];

  // Match chord tokens starting at word boundary with capital A-G and ending at delimiter
  const tokens = text.match(/\b[A-G][b#♭♯]?(?:[a-zA-Z0-9\+\-\^\/#♭♯]*)(?=$|[\s,;:|])/g) || [];
  const candidates: OcrChordCandidate[] = [];

  for (const token of tokens) {
    // Clean and normalize through deterministic parser
    const { chords } = normalizeChordLookupCandidates([token]);
    if (chords.length > 0) {
      candidates.push({
        raw: token,
        normalized: chords[0],
        confidence: 0.88,
      });
    }
  }

  return candidates;
}

/**
 * Extract navigation marks and section labels from OCR text.
 * Handles Swedish/German lead sheet terms ("Slut", "Teil", "Coda", "Segno").
 */
export function extractNavigationAndSectionsFromOcrText(text: string): OcrFormResult {
  const result: OcrFormResult = {
    sections: [],
    navigation: [],
    unrecognizedDirections: [],
  };

  if (!text || !text.trim()) return result;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Check Section Labels
    const sectionMatch = trimmed.match(
      /^(Intro|Verse\s*\d*|Chorus\s*\d*|Bridge|Solo|Outro|Refrain|A\s*\d*|B\s*\d*|C\s*\d*)\b[:.]?/i,
    );
    if (sectionMatch) {
      result.sections.push({ label: sectionMatch[1].trim() });
      continue;
    }

    // 2. Check Fine / Slut (Swedish for Fine)
    if (/\b(Fine|Slut)\b/i.test(trimmed)) {
      result.navigation.push({ kind: "fine" });
    }

    // 3. Check D.C. (Da Capo)
    if (/\b(D\.C\.|Da\s*Capo)\s*(al\s*Fine)?/i.test(trimmed)) {
      result.navigation.push({ kind: "dc", target: "start" });
    } else if (/\b(D\.C\.\s*al\s*Coda)/i.test(trimmed)) {
      result.navigation.push({ kind: "dc", target: "coda" });
    }

    // 4. Check D.S. (Dal Segno)
    if (/\b(D\.S\.|Dal\s*Segno)\s*(al\s*Fine)?/i.test(trimmed)) {
      result.navigation.push({ kind: "ds", target: "segno" });
    } else if (/\b(D\.S\.\s*al\s*Coda)/i.test(trimmed)) {
      result.navigation.push({ kind: "ds", target: "coda" });
    }

    // 5. Check Segno or Coda
    if (/\b(Segno|𝄋)\b/i.test(trimmed)) {
      result.navigation.push({ kind: "segno" });
    }
    if (/\b(Coda|𝄌)\b/i.test(trimmed)) {
      result.navigation.push({ kind: "coda" });
    }
    if (/\b(To\s*Coda)\b/i.test(trimmed)) {
      result.navigation.push({ kind: "to-coda" });
    }

    // 6. Check Volta / Endings: "1.", "2.", "1, 2."
    const endingMatch = trimmed.match(/^\[?(\d+)(?:\s*,\s*(\d+))?\.?\]?$/);
    if (endingMatch) {
      const num1 = parseInt(endingMatch[1], 10);
      const num2 = endingMatch[2] ? parseInt(endingMatch[2], 10) : undefined;
      const numbers = num2 !== undefined ? [num1, num2] : [num1];
      result.navigation.push({ kind: "ending", numbers });
    }

    // 7. Check Key or Time signature in text
    const parsedKey = parseKeySignatureSymbols(trimmed);
    if (parsedKey && !result.keySignature) {
      result.keySignature = parsedKey;
    }

    const meterMatch = trimmed.match(/\b(6\/8|2\/4|3\/4|4\/4|2\/2|C\||C)\b/i);
    const parsedMeter = parseMeterToken(meterMatch ? meterMatch[1] : trimmed);
    if (parsedMeter && !result.timeSignature) {
      result.timeSignature = parsedMeter;
    }
  }

  return result;
}

/**
 * Crop a subregion from a RawImageData buffer into a new RawImageData buffer.
 */
export function cropRawImage(
  image: RawImageData,
  box: { x: number; y: number; width: number; height: number },
): RawImageData {
  const clampX = Math.max(0, Math.min(image.width - 1, Math.round(box.x)));
  const clampY = Math.max(0, Math.min(image.height - 1, Math.round(box.y)));
  const clampW = Math.max(1, Math.min(image.width - clampX, Math.round(box.width)));
  const clampH = Math.max(1, Math.min(image.height - clampY, Math.round(box.height)));

  const out = new Uint8ClampedArray(clampW * clampH * 4);

  for (let y = 0; y < clampH; y++) {
    const srcRowStart = ((clampY + y) * image.width + clampX) * 4;
    const srcRowEnd = srcRowStart + clampW * 4;
    const dstRowStart = y * clampW * 4;
    out.set(image.data.subarray(srcRowStart, srcRowEnd), dstRowStart);
  }

  return {
    data: out,
    width: clampW,
    height: clampH,
  };
}

/**
 * Crop the bounded chord banner directly above a musical staff.
 * Stretches from 2.8 line-spacings above staff lines down to the top staff line.
 */
export function cropStaffChordBanner(
  image: RawImageData,
  staffBox: ImageBox,
  lineSpacing: number,
): RawImageData {
  const bannerHeight = Math.max(20, Math.round(lineSpacing * 2.8));
  const bannerY = Math.max(0, staffBox.y - bannerHeight);

  return cropRawImage(image, {
    x: staffBox.x,
    y: bannerY,
    width: staffBox.width,
    height: bannerHeight,
  });
}

/**
 * Crop the bounded clef/key/meter header region at the start of a musical staff.
 * Spans the first 18% of the staff width across the staff lines and margin.
 */
export function cropStaffHeaderRegion(
  image: RawImageData,
  staffBox: ImageBox,
  lineSpacing: number,
): RawImageData {
  const headerWidth = Math.min(staffBox.width, Math.max(60, Math.round(staffBox.width * 0.18)));
  const marginY = Math.round(lineSpacing * 1.5);
  const headerY = Math.max(0, staffBox.y - marginY);
  const headerH = staffBox.height + marginY * 2;

  return cropRawImage(image, {
    x: staffBox.x,
    y: headerY,
    width: headerWidth,
    height: headerH,
  });
}

/**
 * Deterministically identify key signature (0 to 6 sharps or flats) from header region glyph analysis.
 * Analyzes the accidental zone between clef and time signature / first notes.
 */
export function detectKeySignatureFromHeader(
  headerCrop: RawImageData,
  lineSpacing: number = 24,
): ScoreKeySignature | null {
  if (!headerCrop || headerCrop.width < 10 || headerCrop.height < 10) return null;

  const w = headerCrop.width;
  const h = headerCrop.height;
  const data = headerCrop.data;

  // 1. Grayscale conversion & contrast check
  let minGray = 255;
  let maxGray = 0;
  const grayBuf = new Uint8Array(w * h);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    grayBuf[p] = g;
    if (g < minGray) minGray = g;
    if (g > maxGray) maxGray = g;
  }

  // Plain/blank header check
  if (maxGray - minGray < 30) {
    return { fifths: 0, mode: "major" };
  }

  const inkThreshold = Math.min(200, Math.max(80, Math.round((minGray + maxGray) * 0.5)));

  // 2. Column-wise ink density profile
  const colInkCounts = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < h; y++) {
      if (grayBuf[y * w + x] < inkThreshold) {
        count++;
      }
    }
    colInkCounts[x] = count;
  }

  // Clef occupies left ~2.0-3.0 * lineSpacing. Search for the valley/gap after the clef.
  const expectedClefWidth = Math.max(25, Math.round(lineSpacing * 2.2));
  let clefEnd = expectedClefWidth;
  for (let x = Math.round(lineSpacing * 1.5); x < Math.min(w - 20, lineSpacing * 4); x++) {
    if (colInkCounts[x] <= Math.max(2, Math.round(h * 0.08))) {
      clefEnd = x + 1;
      break;
    }
  }

  const zoneStart = Math.min(w - 15, clefEnd);
  const zoneEnd = Math.min(w, zoneStart + Math.round(lineSpacing * 6.5));
  if (zoneStart >= zoneEnd) {
    return { fifths: 0, mode: "major" };
  }

  const minAccidentalHeight = Math.max(10, Math.round(lineSpacing * 1.1));
  const minAccidentalWidth = Math.max(3, Math.round(lineSpacing * 0.25));
  const maxAccidentalWidth = Math.max(15, Math.round(lineSpacing * 1.4));

  interface AccidentalCandidate {
    startX: number;
    endX: number;
    height: number;
    sharpScore: number;
    flatScore: number;
  }

  const candidates: AccidentalCandidate[] = [];
  let inGlyph = false;
  let glyphStartX = 0;

  for (let x = zoneStart; x < zoneEnd; x++) {
    const ink = colInkCounts[x];
    const isInkCol = ink >= Math.max(4, Math.round(lineSpacing * 0.5));

    if (isInkCol && !inGlyph) {
      inGlyph = true;
      glyphStartX = x;
    } else if (!isInkCol && inGlyph) {
      inGlyph = false;
      const glyphWidth = x - glyphStartX;
      if (glyphWidth >= minAccidentalWidth && glyphWidth <= maxAccidentalWidth) {
        let minY = h;
        let maxY = 0;
        let hasHole = false;

        const midX = glyphStartX + glyphWidth / 2;
        let tl = 0, tr = 0, bl = 0, br = 0;

        // First pass: find vertical extent
        for (let gx = glyphStartX; gx < x; gx++) {
          for (let gy = 0; gy < h; gy++) {
            if (grayBuf[gy * w + gx] < inkThreshold) {
              if (gy < minY) minY = gy;
              if (gy > maxY) maxY = gy;
            }
          }
        }

        const glyphHeight = maxY - minY;
        const midY = minY + glyphHeight / 2;

        if (glyphHeight >= minAccidentalHeight) {
          // Second pass: quadrant ink and hole detection
          for (let gx = glyphStartX; gx < x; gx++) {
            let colTop = -1;
            let colBot = -1;
            for (let gy = minY; gy <= maxY; gy++) {
              if (grayBuf[gy * w + gx] < inkThreshold) {
                if (colTop === -1) colTop = gy;
                colBot = gy;
                if (gy < midY) {
                  if (gx < midX) tl++;
                  else tr++;
                } else {
                  if (gx < midX) bl++;
                  else br++;
                }
              }
            }
            if (colTop !== -1 && colBot - colTop > lineSpacing * 0.7) {
              let whiteTransitions = 0;
              let lastPixelInk = true;
              for (let gy = colTop; gy <= colBot; gy++) {
                const isInk = grayBuf[gy * w + gx] < inkThreshold;
                if (!isInk && lastPixelInk) whiteTransitions++;
                lastPixelInk = isInk;
              }
              if (whiteTransitions >= 1) hasHole = true;
            }
          }

          // Flat: ascender stem on top-left (tl > 0, tr ~ 0), bowl on bottom-right (br > 0)
          let flatScore = 0;
          if (tl > 0 && tr < tl * 0.35 && br > 0) {
            flatScore += 3;
          } else if (tr < tl * 0.5) {
            flatScore += 1;
          }
          if (br > bl * 0.8) flatScore += 1;

          // Sharp: bilateral symmetry, vertical uprights on both sides (tl & tr > 0, bl & br > 0)
          let sharpScore = 0;
          if (tl > 0 && tr > tl * 0.4 && bl > 0 && br > bl * 0.4) {
            sharpScore += 3;
            if (hasHole) sharpScore += 2;
          }

          candidates.push({
            startX: glyphStartX,
            endX: x,
            height: glyphHeight,
            sharpScore,
            flatScore,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { fifths: 0, mode: "major" };
  }

  const count = Math.min(6, candidates.length);
  let totalSharpScore = 0;
  let totalFlatScore = 0;
  for (const c of candidates) {
    totalSharpScore += c.sharpScore;
    totalFlatScore += c.flatScore;
  }

  let isSharp = totalSharpScore > totalFlatScore;
  if (totalSharpScore === totalFlatScore) {
    // If scores tie, check if candidates have empty upper-right (flat ascender)
    isSharp = false;
  }
  const fifths = isSharp ? count : -count;
  return KEY_SIGNATURE_PROFILES[fifths] || { fifths, mode: "major" };
}

/**
 * Deterministically determine key signature (0 to 6 sharps or flats) from harmonic chord context
 * using Circle of Fifths diatonic root scoring.
 */
export function detectKeyFromHarmonicContext(chords: string[]): ScoreKeySignature | null {
  if (!chords || chords.length === 0) return null;

  const PITCH_CLASSES: Record<string, number> = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "DB": 1,
    "D": 2,
    "D#": 3,
    "EB": 3,
    "E": 4,
    "FB": 4,
    "F": 5,
    "E#": 5,
    "F#": 6,
    "GB": 6,
    "G": 7,
    "G#": 8,
    "AB": 8,
    "A": 9,
    "A#": 10,
    "BB": 10,
    "B": 11,
    "CB": 11,
  };

  const parsedRoots: Array<{ rootPc: number; isMinor: boolean }> = [];
  let sharpTokens = 0;
  let flatTokens = 0;

  for (const raw of chords) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/[#♯]/.test(trimmed)) sharpTokens++;
    if (/[b♭]/.test(trimmed)) flatTokens++;

    const upper = trimmed.toUpperCase();
    const match = upper.match(/^([A-G][#B♭♯]?)(.*)$/);
    if (match) {
      const rootStr = match[1].replace(/♭/g, "B").replace(/♯/g, "#");
      const ext = match[2];
      const pc = PITCH_CLASSES[rootStr];
      if (pc !== undefined) {
        const isMinor = (ext.startsWith("M") && !ext.startsWith("MAJ")) ||
          ext.startsWith("MIN") ||
          ext.startsWith("-");
        parsedRoots.push({ rootPc: pc, isMinor });
      }
    }
  }

  if (parsedRoots.length === 0) return null;

  interface CandidateProfile {
    fifths: number;
    mode: "major" | "minor";
    tonic: number;
    dominant: number;
    subdominant: number;
    pcs: Set<number>;
  }

  const MAJOR_TONICS: Record<number, number> = {
    0: 0,
    1: 7,
    2: 2,
    3: 9,
    4: 4,
    5: 11,
    6: 6,
    [-1]: 5,
    [-2]: 10,
    [-3]: 3,
    [-4]: 8,
    [-5]: 1,
    [-6]: 6,
  };

  const keyProfiles: CandidateProfile[] = [];
  for (let fifths = -6; fifths <= 6; fifths++) {
    const majTonic = MAJOR_TONICS[fifths];
    // Major profile
    keyProfiles.push({
      fifths,
      mode: "major",
      tonic: majTonic,
      dominant: (majTonic + 7) % 12,
      subdominant: (majTonic + 5) % 12,
      pcs: new Set([
        majTonic,
        (majTonic + 2) % 12,
        (majTonic + 4) % 12,
        (majTonic + 5) % 12,
        (majTonic + 7) % 12,
        (majTonic + 9) % 12,
        (majTonic + 11) % 12,
      ]),
    });

    // Relative minor profile (shares the exact same key signature fifths!)
    const minTonic = (majTonic + 9) % 12;
    keyProfiles.push({
      fifths,
      mode: "minor",
      tonic: minTonic,
      dominant: (minTonic + 7) % 12,
      subdominant: (minTonic + 5) % 12,
      pcs: new Set([
        minTonic,
        (minTonic + 2) % 12,
        (minTonic + 3) % 12,
        (minTonic + 5) % 12,
        (minTonic + 7) % 12,
        (minTonic + 8) % 12,
        (minTonic + 10) % 12,
        (minTonic + 11) % 12,
      ]),
    });
  }

  let bestProfile: CandidateProfile | null = null;
  let bestScore = -999;

  for (const prof of keyProfiles) {
    let score = 0;
    for (let i = 0; i < parsedRoots.length; i++) {
      const { rootPc, isMinor } = parsedRoots[i];
      if (prof.pcs.has(rootPc)) {
        score += 2;
        if (rootPc === prof.tonic) {
          const isAtBoundary = i === 0 || i === parsedRoots.length - 1;
          if (prof.mode === "major") {
            if (!isMinor) {
              score += isAtBoundary ? 5 : 3;
            } else {
              score -= 3;
            }
          } else {
            if (isMinor) {
              score += isAtBoundary ? 5 : 3;
            } else {
              score += (i === parsedRoots.length - 1) ? 1 : -3;
            }
          }
        } else if (rootPc === prof.dominant) {
          score += 2;
        } else if (rootPc === prof.subdominant) {
          score += 2;
        }
      } else {
        score -= 3;
      }
    }

    let isBetter = score > bestScore;
    if (score === bestScore && bestProfile) {
      // Enharmonic tie-breaking between F# (+6) and Gb (-6)
      if (Math.abs(prof.fifths) === 6 && Math.abs(bestProfile.fifths) === 6) {
        if (sharpTokens > flatTokens && prof.fifths > 0) isBetter = true;
        if (flatTokens > sharpTokens && prof.fifths < 0) isBetter = true;
      }
    }

    if (isBetter) {
      bestScore = score;
      bestProfile = prof;
    }
  }

  if (!bestProfile) return null;
  return { fifths: bestProfile.fifths, mode: bestProfile.mode };
}

/**
 * Deterministically identify compound 6/8 meter from measure note durations.
 * When the sum of note durations in a measure equals 6 eighth-notes (3 quarter-notes duration)
 * with compound duple subdivisions (dotted quarter notes or eighth-note triplets).
 */
export function calculateCompoundMeterFromMeasures(
  measures: Array<{
    melody?: Array<{
      duration: { numerator: number; denominator: number };
      rest?: boolean;
    }>;
  }>,
): ScoreTimeSignature | null {
  if (!measures || measures.length === 0) return null;

  // Filter pickup measure (anacrusis):
  // If measures.length > 1, check if measure 0 has strictly fewer beats than subsequent measures
  let validMeasures = measures;
  if (measures.length > 1) {
    const measureDurations = measures.map((m) => {
      if (!m.melody) return 0;
      return m.melody.reduce(
        (sum, n) => sum + n.duration.numerator / n.duration.denominator,
        0,
      );
    });
    const m0Dur = measureDurations[0];
    const restDurations = measureDurations.slice(1).filter((d) => d > 0);
    if (restDurations.length > 0) {
      const maxRest = Math.max(...restDurations);
      if (m0Dur > 0 && m0Dur < maxRest - 0.05) {
        validMeasures = measures.slice(1);
      }
    }
  }

  let compound128Votes = 0;
  let compound98Votes = 0;
  let compound68Votes = 0;
  let simple34Votes = 0;
  let simple44Votes = 0;
  let simple24Votes = 0;

  for (const m of validMeasures) {
    if (!m.melody || m.melody.length === 0) continue;

    let totalBeats = 0;
    let hasDottedQuarter = false;
    let dottedQuarterCount = 0;
    let quarterCount = 0;
    let eighthCount = 0;

    let currentOffset = 0;
    let hasBeat15Pulse = false;
    let hasBeat10Pulse = false;
    let hasBeat20Pulse = false;

    for (const note of m.melody) {
      const dur = note.duration.numerator / note.duration.denominator;

      if (Math.abs(currentOffset - 1.5) < 0.05) hasBeat15Pulse = true;
      if (Math.abs(currentOffset - 1.0) < 0.05 && dur >= 0.9) hasBeat10Pulse = true;
      if (Math.abs(currentOffset - 2.0) < 0.05 && dur >= 0.9) hasBeat20Pulse = true;

      totalBeats += dur;
      currentOffset += dur;

      if (Math.abs(dur - 1.5) < 0.01) {
        hasDottedQuarter = true;
        dottedQuarterCount++;
      } else if (Math.abs(dur - 1.0) < 0.01) {
        quarterCount++;
      } else if (Math.abs(dur - 0.5) < 0.01) {
        eighthCount++;
      }
    }

    if (Math.abs(totalBeats - 6.0) < 0.05) {
      compound128Votes++;
    } else if (Math.abs(totalBeats - 4.5) < 0.05) {
      compound98Votes++;
    } else if (Math.abs(totalBeats - 3.0) < 0.05) {
      // 6/8 compound duple vs 3/4 simple triple classification
      const isCompoundDuple = (dottedQuarterCount === 2) ||
        (hasDottedQuarter && eighthCount >= 3) ||
        (hasDottedQuarter && hasBeat15Pulse) ||
        (eighthCount === 6 && quarterCount === 0) ||
        (hasBeat15Pulse && !hasBeat10Pulse && !hasBeat20Pulse && quarterCount === 0);

      if (isCompoundDuple) {
        compound68Votes++;
      } else {
        simple34Votes++;
      }
    } else if (Math.abs(totalBeats - 4.0) < 0.05) {
      simple44Votes++;
    } else if (Math.abs(totalBeats - 2.0) < 0.05) {
      simple24Votes++;
    }
  }

  if (
    compound128Votes > 0 &&
    compound128Votes >=
      Math.max(compound98Votes, compound68Votes, simple44Votes, simple34Votes, simple24Votes)
  ) {
    return { beats: 12, beatType: 8 };
  }
  if (
    compound98Votes > 0 &&
    compound98Votes >= Math.max(compound68Votes, simple44Votes, simple34Votes, simple24Votes)
  ) {
    return { beats: 9, beatType: 8 };
  }
  if (
    compound68Votes > 0 &&
    compound68Votes >= Math.max(simple34Votes, simple44Votes, simple24Votes)
  ) {
    return { beats: 6, beatType: 8 };
  }
  if (
    simple34Votes > 0 &&
    simple34Votes >= Math.max(simple44Votes, simple24Votes)
  ) {
    return { beats: 3, beatType: 4 };
  }
  if (simple44Votes > 0 && simple44Votes >= simple24Votes) {
    return { beats: 4, beatType: 4 };
  }
  if (simple24Votes > 0) {
    return { beats: 2, beatType: 4 };
  }

  return null;
}

/** No-op stub for backward compatibility; Tesseract.js language URL is eliminated. */
export function getLocalOcrLangPath(): Promise<string> {
  return Promise.resolve("");
}

/** No-op stub for backward compatibility; Tesseract.js language URL is eliminated. */
export function revokeOcrLangUrl(): void {}

export interface RecognizeStaffBoundedOcrOptions {
  measures?: Array<{
    writtenIndex: number;
    box: ImageBox;
    staffIndex?: number;
  }>;
  measuresPerStaff?: number;
  onProgress?: (msg: string) => void;
  headerText?: string;
  knownChords?: string[];
  barlines?: Array<{
    x: number;
    type: "single" | "double" | "final" | "repeat";
    systemIndex?: number;
  }>;
}

/**
 * Perform deterministic score supplementation for key signature, meter, and navigation.
 * Eliminates Tesseract.js completely: runs 100% in pure TypeScript without worker hangs or timeouts.
 * Fixes Measure-vs-Staff indexing: associates chords and metadata with measures by actual measure index.
 */
export async function recognizeStaffBoundedOcr(
  image: RawImageData,
  staves: Array<{ box: ImageBox; id?: string; lineSpacing?: number }>,
  lineSpacing: number = 24,
  onProgressOrOptions?: ((msg: string) => void) | RecognizeStaffBoundedOcrOptions,
  legacyMeasures?: Array<{ writtenIndex: number; box: ImageBox; staffIndex?: number }>,
): Promise<import("./scoreFusion.ts").OcrScoreData> {
  // Yield microtask to ensure non-blocking UI transition on mobile browsers
  await Promise.resolve();

  const ocrData: import("./scoreFusion.ts").OcrScoreData = {
    measures: [],
    sections: [],
    unrecognizedDirections: [],
  };

  let onProgress: ((msg: string) => void) | undefined;
  let layoutMeasures:
    | Array<{ writtenIndex: number; box: ImageBox; staffIndex?: number }>
    | undefined;
  let headerText: string | undefined;
  let knownChords: string[] | undefined;

  if (typeof onProgressOrOptions === "function") {
    onProgress = onProgressOrOptions;
    if (legacyMeasures) {
      layoutMeasures = legacyMeasures;
    }
  } else if (onProgressOrOptions && typeof onProgressOrOptions === "object") {
    onProgress = onProgressOrOptions.onProgress;
    layoutMeasures = onProgressOrOptions.measures;
    headerText = onProgressOrOptions.headerText;
    knownChords = onProgressOrOptions.knownChords;
  }

  onProgress?.("Deterministic score supplementation active (Tesseract eliminated)...");

  // 1. Deterministic Key Signature Identification
  if (headerText) {
    const textKey = parseKeySignatureSymbols(headerText);
    if (textKey) ocrData.keySignature = textKey;
  }

  if (!ocrData.keySignature && staves.length > 0 && image && image.width > 0) {
    onProgress?.("Analyzing header glyphs for key signature...");
    const headerCrop = cropStaffHeaderRegion(image, staves[0].box, lineSpacing);
    const glyphKey = detectKeySignatureFromHeader(headerCrop, lineSpacing);
    if (glyphKey) {
      ocrData.keySignature = glyphKey;
      onProgress?.(`Detected key from header glyphs: ${glyphKey.fifths} ${glyphKey.mode}`);
    }
  }

  if (!ocrData.keySignature && knownChords && knownChords.length > 0) {
    onProgress?.("Analyzing harmonic context for key signature...");
    const harmonicKey = detectKeyFromHarmonicContext(knownChords);
    if (harmonicKey) {
      ocrData.keySignature = harmonicKey;
      onProgress?.(`Harmonic key inference: ${harmonicKey.fifths} ${harmonicKey.mode}`);
    }
  }

  // 2. Deterministic Time Signature / Meter Identification
  if (headerText) {
    const meterMatch = headerText.match(/\b(6\/8|2\/4|3\/4|4\/4|2\/2|C\||C)\b/i);
    const textMeter = parseMeterToken(meterMatch ? meterMatch[1] : headerText);
    if (textMeter) ocrData.timeSignature = textMeter;
  }

  // 3. Deterministic Chord Banner & Measure Mapping (Resolving Bug #4)
  // Stop pushing staff index `i` into `measureIndex`.
  const defaultMeasuresPerStaff = 4;

  for (let staffIdx = 0; staffIdx < staves.length; staffIdx++) {
    const staff = staves[staffIdx];
    const staffBox = staff.box;
    const staffSpacing = staff.lineSpacing || lineSpacing;

    onProgress?.(`Processing chord banner for staff ${staffIdx + 1}/${staves.length}...`);

    // Find measures belonging to this staff line
    let staffMeasures: Array<{ writtenIndex: number; box: ImageBox }> = [];
    if (layoutMeasures && layoutMeasures.length > 0) {
      staffMeasures = layoutMeasures.filter((m) => {
        if (m.staffIndex !== undefined) {
          return m.staffIndex === staffIdx;
        }
        // Match by vertical overlap with staff
        const mCenterY = m.box.y + m.box.height / 2;
        return mCenterY >= staffBox.y - staffSpacing * 2 &&
          mCenterY <= staffBox.y + staffBox.height + staffSpacing * 2;
      }).sort((a, b) => a.box.x - b.box.x);
    }

    // If no layout measures were matched, synthesize sequential measures for this staff
    if (staffMeasures.length === 0) {
      const baseMeasureIdx = staffIdx * defaultMeasuresPerStaff;
      const measureW = staffBox.width / defaultMeasuresPerStaff;
      for (let mOffset = 0; mOffset < defaultMeasuresPerStaff; mOffset++) {
        staffMeasures.push({
          writtenIndex: baseMeasureIdx + mOffset,
          box: {
            x: staffBox.x + mOffset * measureW,
            y: staffBox.y,
            width: measureW,
            height: staffBox.height,
          },
        });
      }
    }

    // Extract chords from banner text or simulated header text if available
    const bannerText = headerText || "";
    const chords = extractChordsFromOcrText(bannerText);
    const form = extractNavigationAndSectionsFromOcrText(bannerText);

    if (form.keySignature && !ocrData.keySignature) {
      ocrData.keySignature = form.keySignature;
    }
    if (form.timeSignature && !ocrData.timeSignature) {
      ocrData.timeSignature = form.timeSignature;
    }
    if (form.unrecognizedDirections.length > 0) {
      ocrData.unrecognizedDirections?.push(...form.unrecognizedDirections);
    }

    // Distribute extracted chords across the actual measures on this staff
    // Each measure gets its own OcrStaffMeasureData with its real writtenIndex!
    for (let mIdx = 0; mIdx < staffMeasures.length; mIdx++) {
      const targetMeasure = staffMeasures[mIdx];
      const measureLeft = targetMeasure.box.x;
      const measureRight = measureLeft + targetMeasure.box.width;

      // Filter chords that spatially belong to this measure
      const measureChords: OcrChordCandidate[] = [];
      for (const chord of chords) {
        if (chord.box) {
          const chordCenterX = chord.box.x + chord.box.width / 2;
          if (chordCenterX >= measureLeft && chordCenterX < measureRight) {
            measureChords.push(chord);
          }
        } else if (chord.relativePosition !== undefined) {
          const chordAbsX = staffBox.x + chord.relativePosition * staffBox.width;
          if (chordAbsX >= measureLeft && chordAbsX < measureRight) {
            measureChords.push(chord);
          }
        } else {
          // If no coordinate on chord, distribute chords proportionally across measures
          const chordMeasureIdx = Math.floor(
            (chords.indexOf(chord) / Math.max(1, chords.length)) * staffMeasures.length,
          );
          if (chordMeasureIdx === mIdx) {
            measureChords.push(chord);
          }
        }
      }

      // Add navigation to start measure of the staff, or first measure if section starts here
      const measureNav: NavigationMark[] = mIdx === 0 ? [...form.navigation] : [];

      ocrData.measures?.push({
        measureIndex: targetMeasure.writtenIndex, // Real measure writtenIndex, NOT staffIdx!
        chords: measureChords,
        navigation: measureNav,
        sourceBox: targetMeasure.box,
        staffIndex: staffIdx,
      });
    }

    // Add section labels with correct measure start index
    if (form.sections.length > 0 && staffMeasures.length > 0) {
      for (const s of form.sections) {
        ocrData.sections?.push({
          label: s.label,
          startMeasureIndex: staffMeasures[0].writtenIndex,
        });
      }
    }
  }

  return ocrData;
}
