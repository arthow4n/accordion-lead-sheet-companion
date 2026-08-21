/**
 * Ultimate Guitar Scraper & Parser
 * Path: api/parsers/ultimateGuitar.ts
 */

import type { TabImportResponse } from "../../src/types/index.ts";
import { decodeHtmlEntities, extractCapoFret, extractMetadataFromHtml } from "./generic.ts";

/**
 * Cleans Ultimate Guitar markup tags ([ch]G[/ch], [tab], etc.) while preserving
 * whitespace and line structure.
 */
export function cleanUgContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/\[ch\](.*?)\[\/ch\]/g, "$1")
    .replace(/\[\/?tab\]/gi, "")
    .replace(/\[\/?intro\]/gi, "[Intro]")
    .replace(/\[\/?verse(?:\s*\d*)?\]/gi, (match) => {
      const numMatch = match.match(/\d+/);
      return numMatch ? `[Verse ${numMatch[0]}]` : "[Verse]";
    })
    .replace(/\[\/?chorus(?:\s*\d*)?\]/gi, (match) => {
      const numMatch = match.match(/\d+/);
      return numMatch ? `[Chorus ${numMatch[0]}]` : "[Chorus]";
    })
    .replace(/\[\/?bridge\]/gi, "[Bridge]")
    .replace(/\[\/?outro\]/gi, "[Outro]")
    .replace(/\[\/?solo\]/gi, "[Solo]")
    .replace(/\[\/?pre-chorus\]/gi, "[Pre-Chorus]");
}

/**
 * Parses Ultimate Guitar HTML page containing embedded JSON store or tab container.
 */
export function parseUltimateGuitar(html: string): TabImportResponse | null {
  if (!html) return null;

  // 1. Primary Strategy: Extract window.UGAPP.store.page = {...};
  let storeJsonStr: string | null = null;
  const scriptMatch = html.match(/window\.UGAPP\.store\.page\s*=\s*({[\s\S]+?});\s*<\/script>/);
  if (scriptMatch) {
    storeJsonStr = scriptMatch[1];
  }

  // 2. Secondary Strategy: Extract data-content="..." from js-store
  if (!storeJsonStr) {
    const storeAttrMatch =
      html.match(/class=["'][^"']*js-store[^"']*["'][^>]*data-content=["']([^"']+)["']/i) ||
      html.match(/data-content=["']([^"']+)["'][^>]*class=["'][^"']*js-store[^"']*["']/i);
    if (storeAttrMatch) {
      storeJsonStr = decodeHtmlEntities(storeAttrMatch[1]);
    }
  }

  // 3. Attempt JSON parse if store extracted
  if (storeJsonStr) {
    try {
      const store = JSON.parse(storeJsonStr);
      const pageData = store?.store?.page?.data || store?.page?.data ||
        store?.data?.page?.data || store?.data || store;
      const tabView = pageData?.tab_view || pageData;
      const wikiTab = tabView?.wiki_tab || pageData?.wiki_tab;
      const tab = pageData?.tab || tabView?.tab;

      if (wikiTab?.content || tab?.song_name || tab?.name) {
        const rawTabContent = wikiTab?.content || "";
        const cleanedContent = decodeHtmlEntities(cleanUgContent(rawTabContent))
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .trim();

        const title = tab?.song_name || tab?.name || extractMetadataFromHtml(html).title ||
          "Unknown Title";
        const artist = tab?.artist_name || extractMetadataFromHtml(html).artist || "Unknown Artist";

        let capoFret = 0;
        if (typeof tabView?.meta?.capo === "number") {
          capoFret = tabView.meta.capo;
        } else if (typeof wikiTab?.applicature?.capo === "number") {
          capoFret = wikiTab.applicature.capo;
        } else if (typeof tab?.applicature?.capo === "number") {
          capoFret = tab.applicature.capo;
        } else if (typeof tabView?.applicature?.capo === "number") {
          capoFret = tabView.applicature.capo;
        } else {
          capoFret = extractCapoFret(html) || extractCapoFret(cleanedContent);
        }

        const originalKey = tab?.tonality_name || tabView?.meta?.tonality || tab?.key || undefined;

        return {
          success: cleanedContent.length > 0,
          source: "ultimate-guitar",
          title: decodeHtmlEntities(title),
          artist: decodeHtmlEntities(artist),
          capoFret,
          originalKey,
          rawContent: cleanedContent,
        };
      }
    } catch {
      // Fall through to DOM fallback
    }
  }

  // 4. Tertiary Strategy: Fallback to DOM <pre> or js-tab-content
  const preMatch =
    html.match(/<pre[^>]*class=["'][^"']*js-tab-content[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i) ||
    html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);

  if (preMatch) {
    const raw = decodeHtmlEntities(cleanUgContent(preMatch[1].replace(/<[^>]+>/g, "")))
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();
    if (raw) {
      const meta = extractMetadataFromHtml(html);
      const capoFret = extractCapoFret(html) || extractCapoFret(raw);
      return {
        success: true,
        source: "ultimate-guitar",
        title: meta.title || "Unknown Title",
        artist: meta.artist || "Unknown Artist",
        capoFret,
        rawContent: raw,
      };
    }
  }

  return null;
}
