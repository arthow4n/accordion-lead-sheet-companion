/**
 * E-Chords Scraper & Parser
 * Path: api/parsers/eChords.ts
 */

import type { TabImportResponse } from "../../src/types/index.ts";
import { decodeHtmlEntities, extractCapoFret, extractMetadataFromHtml } from "./generic.ts";

/**
 * Parses E-Chords HTML page, unwrapping <u> and <span> tags while preserving horizontal column alignment.
 */
export function parseEChords(html: string): TabImportResponse | null {
  if (!html) return null;

  const preMatch = html.match(/<pre[^>]*id=["']core["'][^>]*>([\s\S]*?)<\/pre>/i) ||
    html.match(/<pre[^>]*class=["'][^"']*core[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i) ||
    html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);

  if (!preMatch) return null;

  // Strip <u> or <span class="c"> tags around chords while preserving text content and position
  let raw = preMatch[1]
    .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "$1")
    .replace(/<span[^>]*class=["'][^"']*c[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "");

  raw = decodeHtmlEntities(raw).trim();
  if (!raw) return null;

  let title: string | undefined;
  let artist: string | undefined;

  // Title selector: <h1 class="song-title"> or <h1 class="title">
  const titleMatch =
    html.match(/<h1[^>]*class=["'][^"']*(?:song-title|title)[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) title = decodeHtmlEntities(titleMatch[1].trim());

  // Artist selector: <h2 class="artist-name"> or <p class="artist-name">
  const artistMatch =
    html.match(/<h2[^>]*class=["'][^"']*(?:artist-name|artist)[^"']*["'][^>]*>([^<]+)<\/h2>/i) ||
    html.match(/<p[^>]*class=["'][^"']*(?:artist-name|artist)[^"']*["'][^>]*>([^<]+)<\/p>/i) ||
    html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (artistMatch) artist = decodeHtmlEntities(artistMatch[1].trim());

  // Fallback metadata if missing
  if (!title || !artist) {
    const meta = extractMetadataFromHtml(html);
    if (!title && meta.title) title = meta.title;
    if (!artist && meta.artist) artist = meta.artist;
  }

  const capoFret = extractCapoFret(html) || extractCapoFret(raw);

  return {
    success: true,
    source: "e-chords",
    title,
    artist,
    capoFret,
    rawContent: raw,
  };
}
