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
import { isChordToken, isMeasureDelimiter, parseTwoLineDocument } from "./twoline.ts";

/**
 * Robust Capo Header extractor matching standard lead sheet formats across
 * English, Portuguese, Spanish, and ChordPro:
 * e.g. "Capo 3", "Capo: 3rd fret", "Capo on 2", "CAPO AT 4", "{capo: 5}",
 * "com capotraste na 3ª casa", "cejilla en el 2do traste", "Capo - 2nd fret"
 */
export function extractCapoFret(text: string): number {
  if (!text) return 0;

  // 1. ChordPro directive: {capo: 3} or {c: 3}
  const chordProMatch = text.match(/\{(?:capo|c):\s*(\d+)[^}]*\}/i);
  if (chordProMatch) {
    const fret = parseInt(chordProMatch[1], 10);
    if (!isNaN(fret) && fret >= 0) {
      return fret % 12;
    }
  }

  // 2. Portuguese: "com capotraste na 3ª casa", "capotraste: 3", "2ª casa", "capo na 3 casa"
  const ptMatch = text.match(
    /(?:com\s+)?(?:capotraste|capo)?\s*(?:na|no|em)?\s*(\d+)(?:ª|º|a|o)?\s*casa/i,
  ) || text.match(
    /(?:capotraste|capo)\s*(?:na|no|em|:|-)?\s*(\d+)(?:ª|º|a|o)?\s*(?:casa)?/i,
  );
  if (ptMatch) {
    const fret = parseInt(ptMatch[1], 10);
    if (!isNaN(fret) && fret >= 0) {
      return fret % 12;
    }
  }

  // 3. Spanish: "cejilla en el 2do traste", "cejilla: 3", "con cejilla en el 1er traste"
  const esMatch = text.match(
    /(?:con\s+)?cejilla\s*(?:en|en\s*el|:|-)?\s*(\d+)(?:do|er|ro|to|º|ª)?(?:\s*traste)?/i,
  );
  if (esMatch) {
    const fret = parseInt(esMatch[1], 10);
    if (!isNaN(fret) && fret >= 0) {
      return fret % 12;
    }
  }

  // 4. English variants: "Capo: 3rd fret", "Capo on 2", "Capo - 3rd fret", "Capo: fret 3", "Capo 2nd", "Capo. 2", "CAPO AT 4"
  const enMatch = text.match(
    /capo\s*(?:at|on|fret|fret\s*:|:|\.|\-)?\s*(\d+)(?:st|nd|rd|th)?(?:\s*fret)?/i,
  ) || text.match(
    /capo\s*(?:at|on|:|\-)?\s*fret\s*(\d+)/i,
  );
  if (enMatch) {
    const fret = parseInt(enMatch[1], 10);
    if (!isNaN(fret) && fret >= 0) {
      return fret % 12;
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
 * Enrich an array of LeadSheetLines by converting raw chord strings to ChordDetail objects.
 * Guarantees that measure delimiters (|, ||, :|) are not enriched into chord badges.
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

      const rawChord = typeof seg.chord === "string"
        ? seg.chord
        : (seg.chord as ChordDetail).originalChord?.raw || (seg.chord as { raw?: string }).raw ||
          "";

      // If token is measure delimiter or invalid chord, do not enrich as chord badge
      if (!rawChord || isMeasureDelimiter(rawChord) || !isChordToken(rawChord)) {
        return {
          lyric: seg.lyric || rawChord,
        };
      }

      return {
        chord: enrichChord(rawChord, capoFret, keyContext),
        lyric: seg.lyric,
      };
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
  if (
    /\{(?:title|t|artist|a|subtitle|st|su|capo|comment|c|soc|eoc|start_of_chorus|end_of_chorus|start_of_tab|sot|end_of_tab|eot):?/i
      .test(rawText)
  ) {
    return true;
  }

  const lines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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
  const normalizedText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const extractedCapo = extractCapoFret(normalizedText);
  const capoFret = extractedCapo > 0 ? extractedCapo : defaultCapo;

  let title = "Untitled Lead Sheet";
  let artist: string | undefined;

  // Extract Title / Artist from standard header patterns
  const titleMatch = normalizedText.match(/^(?:\{title:\s*([^}]+)\}|title:\s*(.+)$)/im);
  if (titleMatch) {
    title = (titleMatch[1] || titleMatch[2]).trim();
  }

  const artistMatch = normalizedText.match(/^(?:\{artist:\s*([^}]+)\}|artist:\s*(.+)$)/im);
  if (artistMatch) {
    artist = (artistMatch[1] || artistMatch[2]).trim();
  }

  let lines: LeadSheetLine[];

  if (detectChordPro(normalizedText)) {
    const doc = parseChordProDocument(normalizedText);
    if (doc.title && title === "Untitled Lead Sheet") title = doc.title;
    if (doc.artist && !artist) artist = doc.artist;
    lines = doc.lines;
  } else {
    lines = parseTwoLineDocument(normalizedText);
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
    rawText: normalizedText,
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
  const normalizedText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const doc = parseChordProDocument(normalizedText);
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
    rawText: normalizedText,
    lines: enrichedLines,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Main re-export alias
 */
export const parseLeadSheet = parseLeadSheetText;
