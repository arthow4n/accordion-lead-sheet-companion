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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  raw = decodeHtmlEntities(raw).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return null;

  let title: string | undefined;
  let artist: string | undefined;

  // 1. Check Schema.org JSON-LD for MusicRecording
  const jsonLdMatch = html.match(
    /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i,
  );
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      const record = Array.isArray(data)
        ? data.find((d: { "@type"?: string }) => d["@type"] === "MusicRecording")
        : data;
      if (record && record["@type"] === "MusicRecording") {
        if (record.name) title = record.name;
        if (record.byArtist?.name) artist = record.byArtist.name;
      }
    } catch {
      // Fall through
    }
  }

  // 2. Title selector: <h1 class="t1"> or <h1 class="head-title">
  if (!title) {
    const titleMatch = html.match(
      /<h1[^>]*class=["'][^"']*(?:t1|head-title|cifra-titulo)[^"']*["'][^>]*>([^<]+)<\/h1>/i,
    ) ||
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // 3. Artist selector: <h2 class="t3">, <span class="t3">, or <a class="t3">
  if (!artist) {
    const artistMatch = html.match(/<h2[^>]*class=["'][^"']*t3[^"']*["'][^>]*>([^<]+)<\/h2>/i) ||
      html.match(/<span[^>]*class=["'][^"']*t3[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
      html.match(/<a[^>]*class=["'][^"']*(?:t3|head-subtitle)[^"']*["'][^>]*>([^<]+)<\/a>/i);
    if (artistMatch) artist = decodeHtmlEntities(artistMatch[1].trim());
  }

  // 4. Fallback metadata from OpenGraph / title if missing
  if (!title || !artist) {
    const meta = extractMetadataFromHtml(html);
    if (!title && meta.title) title = meta.title;
    if (!artist && meta.artist) artist = meta.artist;
  }

  // Filter out unwanted menu texts
  if (artist && artist.toLowerCase().includes("menu principal")) {
    const meta = extractMetadataFromHtml(html);
    artist = meta.artist || "Unknown Artist";
  }

  // Capo detection: Portuguese strings like "com capotraste na 5ª casa", `<span id="cifra_capo">5ª casa</span>`
  const capoFret = extractCapoFret(html) || extractCapoFret(raw);

  return {
    success: true,
    source: "cifraclub",
    title: title || "Unknown Title",
    artist: artist || "Unknown Artist",
    capoFret,
    rawContent: raw,
  };
}
