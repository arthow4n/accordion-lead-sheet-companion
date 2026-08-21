/**
 * Scraper Parsers Router & Export Index
 * Path: api/parsers/index.ts
 */

import type { TabImportResponse, TabSource } from "../../src/types/index.ts";
import {
  decodeHtmlEntities,
  extractCapoFret,
  extractMetadataFromHtml,
  parseGeneric,
} from "./generic.ts";
import { cleanUgContent, parseUltimateGuitar } from "./ultimateGuitar.ts";
import { parseChordie } from "./chordie.ts";
import { parseEChords } from "./eChords.ts";
import { parseCifraClub } from "./cifraClub.ts";

export {
  cleanUgContent,
  decodeHtmlEntities,
  extractCapoFret,
  extractMetadataFromHtml,
  parseChordie,
  parseCifraClub,
  parseEChords,
  parseGeneric,
  parseUltimateGuitar,
};

/**
 * Identifies the TabSource from a target URL string.
 */
export function identifyTabSource(urlString: string): TabSource {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("ultimate-guitar.com")) return "ultimate-guitar";
    if (host.includes("chordie.com")) return "chordie";
    if (host.includes("e-chords.com") || host.includes("cifras.com.br")) return "e-chords";
    if (host.includes("cifraclub.com")) return "cifraclub";
  } catch {
    // Fall back to substring match if URL constructor fails
    if (urlString.includes("ultimate-guitar.com")) return "ultimate-guitar";
    if (urlString.includes("chordie.com")) return "chordie";
    if (urlString.includes("e-chords.com") || urlString.includes("cifras.com.br")) {
      return "e-chords";
    }
    if (urlString.includes("cifraclub.com")) return "cifraclub";
  }
  return "generic";
}

/**
 * Routes raw HTML from a target URL to the appropriate specialized parser,
 * falling back to the generic extractor if necessary.
 */
export function parseTabHtml(targetUrl: string, html: string): TabImportResponse {
  const source = identifyTabSource(targetUrl);
  let result: TabImportResponse | null = null;

  switch (source) {
    case "ultimate-guitar":
      result = parseUltimateGuitar(html);
      break;
    case "chordie":
      result = parseChordie(html);
      break;
    case "e-chords":
      result = parseEChords(html);
      break;
    case "cifraclub":
      result = parseCifraClub(html);
      break;
  }

  // If site-specific parser succeeded, return its response
  if (result && result.success && result.rawContent.trim().length > 0) {
    result.sourceUrl = targetUrl;
    return result;
  }

  // Fallback to generic DOM extraction
  const genericResult = parseGeneric(html);
  if (genericResult.success && genericResult.rawContent.trim().length > 0) {
    // Retain detected source if known
    if (source !== "generic") {
      genericResult.source = source;
    }
    genericResult.sourceUrl = targetUrl;
    return genericResult;
  }

  return {
    success: false,
    source,
    sourceUrl: targetUrl,
    capoFret: 0,
    rawContent: "",
    error: "Unable to extract chord content from target URL",
  };
}
