/**
 * Cifra Club Scraper & Parser
 * Path: api/parsers/cifraClub.ts
 */

import type { TabImportResponse } from "../../src/types/index.ts";
import { decodeHtmlEntities, extractCapoFret, extractMetadataFromHtml } from "./generic.ts";

/**
 * Parses Cifra Club HTML page, unwrapping <b> chord tags and parsing Portuguese capo notation.
 */
export function parseCifraClub(html: string): TabImportResponse | null {
  if (!html) return null;

  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!preMatch) return null;

  // Cifra Club wraps chord names in <b>Chord</b> or <a><b>Chord</b></a>
  let raw = preMatch[1]
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "$1")
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<[^>]+>/g, "");

  raw = decodeHtmlEntities(raw).trim();
  if (!raw) return null;

  let title: string | undefined;
  let artist: string | undefined;

  // Title selector: <h1 class="t1">
  const titleMatch = html.match(/<h1[^>]*class=["'][^"']*t1[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) title = decodeHtmlEntities(titleMatch[1].trim());

  // Artist selector: <h2 class="t3">, <span class="t3">, or <a class="t3">
  const artistMatch = html.match(/<h2[^>]*class=["'][^"']*t3[^"']*["'][^>]*>([^<]+)<\/h2>/i) ||
    html.match(/<span[^>]*class=["'][^"']*t3[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
    html.match(/<a[^>]*class=["'][^"']*t3[^"']*["'][^>]*>([^<]+)<\/a>/i) ||
    html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (artistMatch) artist = decodeHtmlEntities(artistMatch[1].trim());

  // Fallback metadata if missing
  if (!title || !artist) {
    const meta = extractMetadataFromHtml(html);
    if (!title && meta.title) title = meta.title;
    if (!artist && meta.artist) artist = meta.artist;
  }

  // Capo detection: Portuguese strings like "com capotraste na 5ª casa", `<span id="cifra_capo">5ª casa</span>`
  const capoFret = extractCapoFret(html) || extractCapoFret(raw);

  return {
    success: true,
    source: "cifraclub",
    title,
    artist,
    capoFret,
    rawContent: raw,
  };
}
