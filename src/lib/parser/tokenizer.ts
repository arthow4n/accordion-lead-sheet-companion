import type {
  ChordDetail,
  ChordLyricSegment,
  LeadSheetLine,
  LeadSheetSong,
} from "../../types/index.ts";
import { parseChord } from "../capo/transposition.ts";
import { transposeChord } from "../capo/enharmonics.ts";
import { solveStradellaChord } from "../stradella/solver.ts";
import { generateCbaGrip } from "../cba/grips.ts";
import { isChordProDocument, isChordProLine, parseChordProDocument } from "./chordpro.ts";
import { parseTwoLineDocument } from "./twoline.ts";

/**
 * Robust Capo Header extractor matching all standard lead sheet formats:
 * e.g. "Capo 3", "Capo: 3rd fret", "Capo on 2", "CAPO AT 4", "{capo: 5}"
 */
export function extractCapoFret(text: string): number {
  const match = text.match(
    /(?:(?:\{capo:\s*(\d+)\})|(?:capo\s*(?:at|on|fret|:)?\s*(\d+)(?:st|nd|rd|th)?(?:\s*fret)?))/i,
  );
  if (match) {
    const val = match[1] || match[2];
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed % 12;
      }
    }
  }
  return 0;
}

/**
 * Enrich a raw chord string into a complete ChordDetail structure
 */
export function enrichChord(
  rawChord: string,
  capoFret = 0,
  keyContext?: string,
): ChordDetail & { raw: string } {
  const originalChord = parseChord(rawChord);
  const soundingChord = transposeChord(originalChord, capoFret, keyContext);
  const stradella = solveStradellaChord(soundingChord);
  const cba = generateCbaGrip(soundingChord);

  return {
    raw: rawChord,
    originalChord,
    soundingChord,
    stradella,
    cba,
  };
}

/**
 * Enrich an array of LeadSheetLines by converting raw chord strings to ChordDetail objects
 */
export function enrichLeadSheetLines(
  lines: LeadSheetLine[],
  capoFret = 0,
  keyContext?: string,
): LeadSheetLine[] {
  return lines.map((line) => {
    if (line.type !== "chord_lyric" || !line.segments) {
      return line;
    }

    const enrichedSegments: ChordLyricSegment[] = line.segments.map((seg) => {
      if (!seg.chord) {
        return { lyric: seg.lyric };
      }

      if (typeof seg.chord === "string") {
        return {
          chord: enrichChord(seg.chord, capoFret, keyContext),
          lyric: seg.lyric,
        };
      }

      return seg;
    });

    return {
      ...line,
      segments: enrichedSegments,
    };
  });
}

/**
 * Determine whether a document string is formatted in ChordPro format
 */
export function detectChordPro(rawText: string): boolean {
  if (isChordProDocument?.(rawText)) return true;
  if (/\{(?:title|t|artist|a|capo|comment|c|soc|eoc):/i.test(rawText)) return true;

  const lines = rawText.split(/\r?\n/);
  let chordProLineCount = 0;
  for (const line of lines) {
    if (isChordProLine(line)) {
      chordProLineCount++;
    }
  }
  return chordProLineCount >= 1;
}

/**
 * Master parser for arbitrary lead sheet text (2-line guitar sheet, ChordPro, tabs)
 */
export function parseLeadSheetText(
  rawText: string,
  defaultCapo = 0,
  keyContext?: string,
): LeadSheetSong {
  const extractedCapo = extractCapoFret(rawText);
  const capoFret = extractedCapo > 0 ? extractedCapo : defaultCapo;

  let title = "Untitled Lead Sheet";
  let artist: string | undefined;
  let lines: LeadSheetLine[];

  if (detectChordPro(rawText)) {
    const doc = parseChordProDocument(rawText);
    if (doc.title) title = doc.title;
    if (doc.artist) artist = doc.artist;
    if (doc.capoFret !== undefined) {
      // Use ChordPro explicit capo if present
    }
    lines = doc.lines;
  } else {
    lines = parseTwoLineDocument(rawText);
  }

  const enrichedLines = enrichLeadSheetLines(lines, capoFret, keyContext);

  const now = Date.now();
  return {
    id: `song_${now}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    artist,
    capoFret,
    capo: capoFret,
    originalKey: keyContext,
    viewMode: "stradella",
    rawText,
    lines: enrichedLines,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse ChordPro text directly into LeadSheetSong
 */
export function parseChordPro(
  rawText: string,
  defaultCapo = 0,
  keyContext?: string,
): LeadSheetSong {
  const doc = parseChordProDocument(rawText);
  const capoFret = doc.capoFret !== undefined ? doc.capoFret : defaultCapo;
  const enrichedLines = enrichLeadSheetLines(doc.lines, capoFret, keyContext);

  const now = Date.now();
  return {
    id: `song_${now}_${Math.random().toString(36).slice(2, 9)}`,
    title: doc.title || "Untitled Lead Sheet",
    artist: doc.artist,
    capoFret,
    capo: capoFret,
    originalKey: keyContext,
    viewMode: "stradella",
    rawText,
    lines: enrichedLines,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Main re-export alias
 */
export const parseLeadSheet = parseLeadSheetText;
