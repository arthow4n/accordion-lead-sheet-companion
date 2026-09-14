/**
 * Bounded OCR, Key Signature, Meter, and Section/Direction Recognition Engine.
 *
 * Implements Milestone 8 requirements:
 * - Lazy Tesseract.js integration loading pinned eng.traineddata from Cache Storage.
 * - Zero network access to CDN.
 * - Bounded OCR on chord banner and header regions only (no full-page OCR).
 * - Deterministic supplementation for all 0-to-6 sharp/flat key signatures and 6/8 meter.
 * - Normalization through existing deterministic chord parser.
 * - Parsing of Fine/Slut, D.C., D.S., Segno, Coda, endings, and section labels.
 */

import type {
  ImageBox,
  NavigationMark,
  ScoreKeySignature,
  ScoreTimeSignature,
} from "../../types/score.ts";
import { normalizeChordLookupCandidates } from "../lookup/lookupParser.ts";
import { getCachedArtifactBuffer, OMR_ARTIFACTS } from "./omrManifest.ts";
import type { RawImageData } from "./photoPreprocessing.ts";

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

  // 2. Named key words e.g. "G Major", "Bb Major", "D Minor", "F# Major", or "Key: G"
  // Require explicit "maj/major/min/minor" or "key" prefix to avoid misinterpreting bare chords as key signatures.
  const nameMatch = trimmed.match(/^(?:key\s*[:\s]\s*)?([A-G][b#♭♯]?)\s+(maj|major|min|minor)$/i) ||
    trimmed.match(/^key\s*[:\s]\s*([A-G][b#♭♯]?)$/i);
  if (nameMatch) {
    let tonic = nameMatch[1].charAt(0).toUpperCase();
    if (nameMatch[1].length > 1) {
      const acc = nameMatch[1].charAt(1);
      if (acc === "#" || acc === "♯") tonic += "#";
      else if (acc === "b" || acc === "♭") tonic += "b";
    }
    const isMinor = (nameMatch[2] || "").toLowerCase().startsWith("min");
    const fifthsMap: Record<string, number> = {
      "C": 0,
      "G": 1,
      "D": 2,
      "A": 3,
      "E": 4,
      "B": 5,
      "F#": 6,
      "C#": 7,
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
      }
      if (fifths >= -6 && fifths <= 6) {
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
  const tokens = text.match(/\b[A-G][b#♭♯]?(?:[a-zA-Z0-9\+\-\^\/]*)(?=$|[\s,;:|])/g) || [];
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

    const parsedMeter = parseMeterToken(trimmed);
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

/** Cached language data URL for Tesseract to prevent external network calls. */
let cachedOcrLangUrl: string | null = null;

/**
 * Ensure language model is available locally without external CDN access.
 * Returns the object URL or local path for Tesseract worker initialization.
 */
export async function getLocalOcrLangPath(): Promise<string> {
  if (cachedOcrLangUrl) return cachedOcrLangUrl;

  const ocrBuf = await getCachedArtifactBuffer("ocr");
  if (!ocrBuf) {
    throw new Error(
      `OCR language data (${OMR_ARTIFACTS.ocr.filename}) is not in cache. Please download models first.`,
    );
  }

  // Create local object URL for offline Tesseract loading
  if (typeof URL !== "undefined" && typeof Blob !== "undefined") {
    const blob = new Blob([ocrBuf], { type: "application/octet-stream" });
    cachedOcrLangUrl = URL.createObjectURL(blob);
    return cachedOcrLangUrl;
  }

  return "";
}

/** Revoke cached language object URL when cleaning up. */
export function revokeOcrLangUrl(): void {
  if (cachedOcrLangUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(cachedOcrLangUrl);
    cachedOcrLangUrl = null;
  }
}

function rawImageToCanvas(crop: RawImageData): unknown {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(crop.width, crop.height);
    const ctx = canvas.getContext("2d");
    if (ctx && typeof ImageData !== "undefined") {
      const imgData = new ImageData(
        crop.data as unknown as ImageData["data"],
        crop.width,
        crop.height,
      );
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }
  } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");
    if (ctx && typeof ImageData !== "undefined") {
      const imgData = new ImageData(
        crop.data as unknown as ImageData["data"],
        crop.width,
        crop.height,
      );
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }
  }
  return crop.data as unknown as Blob;
}

/**
 * Perform bounded OCR on cropped staff chord banners and header regions.
 * Resolves HIGH-01 by executing local Tesseract.js against local Cache Storage language data.
 */
export async function recognizeStaffBoundedOcr(
  image: RawImageData,
  staves: Array<{ box: ImageBox; id?: string }>,
  lineSpacing: number = 24,
): Promise<import("./scoreFusion.ts").OcrScoreData> {
  const ocrData: import("./scoreFusion.ts").OcrScoreData = {
    measures: [],
    sections: [],
    unrecognizedDirections: [],
  };

  let langPath: string;
  try {
    langPath = await getLocalOcrLangPath();
  } catch (_e) {
    // If language artifact is not cached yet, return empty OCR data gracefully
    return ocrData;
  }

  if (!langPath) return ocrData;

  // Lazily import tesseract.js and run bounded recognition
  let worker;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng", 1, {
      langPath,
      gzip: false,
      cacheMethod: "none",
    });

    // 1. Recognize header region of first staff for key & meter
    if (staves.length > 0) {
      const headerCrop = cropStaffHeaderRegion(image, staves[0].box, lineSpacing);
      const canvas = rawImageToCanvas(headerCrop);
      // deno-lint-ignore no-explicit-any
      const headerRes = await (worker as any).recognize(canvas);
      const headerText = headerRes.data?.text || "";
      const parsedKey = parseKeySignatureSymbols(headerText);
      if (parsedKey) ocrData.keySignature = parsedKey;
      const parsedMeter = parseMeterToken(headerText);
      if (parsedMeter) ocrData.timeSignature = parsedMeter;
    }

    // 2. Recognize bounded chord banners above each staff
    for (let i = 0; i < staves.length; i++) {
      const bannerCrop = cropStaffChordBanner(image, staves[i].box, lineSpacing);
      const canvas = rawImageToCanvas(bannerCrop);
      // deno-lint-ignore no-explicit-any
      const bannerRes = await (worker as any).recognize(canvas);
      const bannerText = bannerRes.data?.text || "";

      // Extract chords from banner
      const chords = extractChordsFromOcrText(bannerText);

      // Extract navigation & sections from banner
      const form = extractNavigationAndSectionsFromOcrText(bannerText);
      if (form.keySignature && !ocrData.keySignature) {
        ocrData.keySignature = form.keySignature;
      }
      if (form.timeSignature && !ocrData.timeSignature) {
        ocrData.timeSignature = form.timeSignature;
      }
      if (form.sections.length > 0) {
        for (const s of form.sections) {
          ocrData.sections?.push({
            label: s.label,
            startMeasureIndex: i,
          });
        }
      }
      if (form.unrecognizedDirections.length > 0) {
        ocrData.unrecognizedDirections?.push(...form.unrecognizedDirections);
      }

      ocrData.measures?.push({
        measureIndex: i,
        chords,
        navigation: form.navigation,
      });
    }
  } catch (err) {
    console.warn("Bounded OCR recognition skipped or failed:", err);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (_err) {
        // ignore termination error
      }
    }
  }

  return ocrData;
}
