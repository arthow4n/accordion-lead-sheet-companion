/**
 * Generic Fallback Parser & HTML Utility Helpers
 * Path: api/parsers/generic.ts
 */

import type { TabImportResponse } from "../../src/types/index.ts";

/**
 * Decodes standard and numeric HTML entities commonly found in scraped tab sheets.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    // Standard named entities
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "--")
    // Hexadecimal numeric entities: &#xNN;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    // Decimal numeric entities: &#NNN;
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return "";
      }
    });
}

/**
 * Extracts Capo fret number (0-11) from raw text or HTML using English, Portuguese,
 * Spanish, and ChordPro patterns.
 */
export function extractCapoFret(text: string): number {
  if (!text) return 0;

  // 1. ChordPro directive: {capo: 3} or {c: 3}
  const chordProMatch = text.match(/\{(?:capo|c):\s*(\d+)[^}]*\}/i);
  if (chordProMatch) {
    const fret = parseInt(chordProMatch[1], 10);
    if (!isNaN(fret) && fret >= 0 && fret <= 11) {
      return fret;
    }
  }

  // 2. Portuguese: "com capotraste na 2ª casa" / "capotraste: 3" / `<span id="cifra_capo">2ª casa</span>`
  const ptMatch = text.match(
    /(?:capotraste|capo)\s*(?:na|no|em)?\s*(\d+)(?:ª|º|a|o)?\s*(?:casa)?/i,
  );
  if (ptMatch) {
    const fret = parseInt(ptMatch[1], 10);
    if (!isNaN(fret) && fret >= 0 && fret <= 11) {
      return fret;
    }
  }

  // 3. English: "Capo 2", "Capo: 3rd fret", "Capo at 4th", "Capo on fret 1"
  const enMatch = text.match(
    /capo\s*(?:at|on|fret|fret\s*:|:)?\s*(\d+)(?:st|nd|rd|th)?(?:\s*fret)?/i,
  );
  if (enMatch) {
    const fret = parseInt(enMatch[1], 10);
    if (!isNaN(fret) && fret >= 0 && fret <= 11) {
      return fret;
    }
  }

  // 4. Spanish: "cejilla en el 2do traste" / "cejilla: 3"
  const esMatch = text.match(
    /cejilla\s*(?:en|en\s*el|:)?\s*(\d+)(?:do|er|ro|to)?(?:\s*traste)?/i,
  );
  if (esMatch) {
    const fret = parseInt(esMatch[1], 10);
    if (!isNaN(fret) && fret >= 0 && fret <= 11) {
      return fret;
    }
  }

  return 0;
}

/**
 * Extracts title and artist from HTML <title> tag or <meta> tags.
 */
export function extractMetadataFromHtml(html: string): { title?: string; artist?: string } {
  let title: string | undefined;
  let artist: string | undefined;

  // Check OpenGraph title: <meta property="og:title" content="...">
  const ogTitleMatch = html.match(
    /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  ) || html.match(
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
  );

  let rawTitleStr = ogTitleMatch ? ogTitleMatch[1] : undefined;

  // Fallback to <title> tag
  if (!rawTitleStr) {
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch) {
      rawTitleStr = titleTagMatch[1];
    }
  }

  if (rawTitleStr) {
    rawTitleStr = decodeHtmlEntities(rawTitleStr).trim();
    // Common formats: "Song Title by Artist", "Song Title - Artist", "Song Title Chords by Artist"
    const byMatch = rawTitleStr.match(
      /^(.+?)\s+(?:by|por)\s+(.+?)(?:\s+chords|\s+tabs|\|\s*.+)?$/i,
    );
    if (byMatch) {
      title = byMatch[1].replace(/chords|tabs|acordes/gi, "").trim();
      artist = byMatch[2].replace(/chords|tabs|acordes/gi, "").trim();
    } else {
      const parts = rawTitleStr.split(/[-–|]/);
      if (parts.length >= 2) {
        title = parts[0].replace(/chords|tabs|acordes/gi, "").trim();
        artist = parts[1].replace(/chords|tabs|acordes/gi, "").trim();
      } else {
        title = rawTitleStr.replace(/chords|tabs|acordes/gi, "").trim();
      }
    }
  }

  return { title, artist };
}

/**
 * Generic HTML lead sheet / chord extractor.
 * Looks for <pre>, <code>, or common tab containers.
 */
export function parseGeneric(html: string): TabImportResponse {
  // Try <pre> container first
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  let raw = "";

  if (preMatch) {
    raw = preMatch[1].replace(/<[^>]+>/g, "");
  } else {
    // Try <code> container
    const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
    if (codeMatch) {
      raw = codeMatch[1].replace(/<[^>]+>/g, "");
    }
  }

  raw = decodeHtmlEntities(raw).trim();

  const { title, artist } = extractMetadataFromHtml(html);
  const capoFret = extractCapoFret(html) || extractCapoFret(raw);

  return {
    success: raw.length > 0,
    source: "generic",
    title,
    artist,
    capoFret,
    rawContent: raw,
    error: raw.length > 0 ? undefined : "Unable to extract chord content from target URL",
  };
}
