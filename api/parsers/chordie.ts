/**
 * Chordie Scraper & ChordPro Parser
 * Path: api/parsers/chordie.ts
 */

import type { TabImportResponse } from "../../src/types/index.ts";
import { decodeHtmlEntities, extractCapoFret, extractMetadataFromHtml } from "./generic.ts";

/**
 * Parses Chordie tab HTML, extracting ChordPro directives or formatted chord sheets.
 */
export function parseChordie(html: string): TabImportResponse | null {
  if (!html) return null;

  let raw = "";

  // 1. Primary Strategy: Extract textarea#chordproContent or textarea[name=chopro]
  const textareaMatch =
    html.match(/<textarea[^>]*id=["']chordproContent["'][^>]*>([\s\S]*?)<\/textarea>/i) ||
    html.match(/<textarea[^>]*name=["']chopro["'][^>]*>([\s\S]*?)<\/textarea>/i) ||
    html.match(/<textarea[^>]*class=["'][^"']*chordpro[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i);

  if (textareaMatch && textareaMatch[1].trim().length > 0) {
    raw = decodeHtmlEntities(textareaMatch[1]).trim();
  }

  // 2. Secondary Strategy: Extract <pre class="chordpro"> or <pre>
  if (!raw) {
    const preMatch =
      html.match(/<pre[^>]*class=["'][^"']*chordpro[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i) ||
      html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) ||
      html.match(/<div[^>]*class=["'][^"']*chordpro[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    if (preMatch && preMatch[1].trim().length > 0) {
      raw = decodeHtmlEntities(preMatch[1].replace(/<[^>]+>/g, "")).trim();
    }
  }

  // 3. Tertiary Strategy: Extract from #song or .chordline / .textline divs
  if (!raw) {
    const songDivMatch = html.match(/<div[^>]*id=["']song["'][^>]*>([\s\S]*?)<\/div>/i);
    if (songDivMatch) {
      const lines = songDivMatch[1].split(/<\/div>|<br\s*\/?>/i);
      const cleanedLines = lines.map((line) => {
        return decodeHtmlEntities(
          line
            .replace(/<span[^>]*class=["'][^"']*bracket[^"']*["'][^>]*>/gi, "")
            .replace(/<\/span>/gi, "")
            .replace(/<[^>]+>/g, ""),
        ).trim();
      }).filter(Boolean);
      if (cleanedLines.length > 0) {
        raw = cleanedLines.join("\n");
      }
    }
  }

  if (!raw) return null;

  let title: string | undefined;
  let artist: string | undefined;
  let originalKey: string | undefined;
  let capoFret = 0;

  // Extract ChordPro metadata directives: {title: ...}, {t: ...}
  const titleMatch = raw.match(/\{(?:title|t):\s*([^}]+)\}/i);
  if (titleMatch) title = titleMatch[1].trim();

  const artistMatch = raw.match(/\{(?:artist|a):\s*([^}]+)\}/i);
  if (artistMatch) {
    artist = artistMatch[1].trim();
  } else {
    const subtitleMatch = raw.match(/\{(?:subtitle|st|su):\s*([^}]+)\}/i);
    if (subtitleMatch) artist = subtitleMatch[1].trim();
  }

  const keyMatch = raw.match(/\{(?:key|k):\s*([^}]+)\}/i);
  if (keyMatch) originalKey = keyMatch[1].trim();

  const capoMatch = raw.match(/\{(?:capo|c):\s*(\d+)[^}]*\}/i);
  if (capoMatch) {
    capoFret = parseInt(capoMatch[1], 10) || 0;
  } else {
    capoFret = extractCapoFret(html) || extractCapoFret(raw);
  }

  // Fallback title / artist from HTML tags
  if (!title || !artist) {
    const meta = extractMetadataFromHtml(html);
    if (!title && meta.title) title = meta.title;
    if (!artist && meta.artist) artist = meta.artist;
  }

  return {
    success: true,
    source: "chordie",
    title,
    artist,
    capoFret,
    originalKey,
    rawContent: raw,
  };
}
