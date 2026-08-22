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

import { extractCapoFret } from "../../src/lib/parser/tokenizer.ts";
export { extractCapoFret };

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

  raw = decodeHtmlEntities(raw).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

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
