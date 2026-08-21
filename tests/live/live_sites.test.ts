/**
 * Live External Web Integration Test Suite
 * Path: tests/live/live_sites.test.ts
 *
 * Implements Section 9.8 of SPEC.md:
 * Verifies real website tab extraction against live domains (LIVE-01 to LIVE-04).
 * Executed strictly on-demand via `deno task test:live`.
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import handleRequest from "../../api/import.ts";
import { parseLeadSheetText } from "../../src/lib/parser/tokenizer.ts";
import type { ChordDetail, LeadSheetLine, TabImportResponse } from "../../src/types/index.ts";

// ============================================================================
// Double-Lock Isolation Guard:
// Live tests hit external domains and MUST ONLY run when RUN_LIVE_TESTS=1
// ============================================================================
const isLiveEnabled = Deno.env.get("RUN_LIVE_TESTS") === "1" ||
  Deno.env.get("RUN_LIVE_TESTS") === "true";

// ============================================================================
// LIVE-01: Ultimate Guitar Live Integration
// Target: https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596
// ============================================================================
Deno.test({
  name: "LIVE-01: Ultimate Guitar live extraction (Wonderwall by Oasis)",
  ignore: !isLiveEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const url = "https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596";
    const req = new Request(
      `https://edge.deno.dev/api/import?url=${encodeURIComponent(url)}`,
      { method: "GET" },
    );

    const res = await handleRequest(req);
    assertEquals(res.status, 200, "Ultimate Guitar live request must return HTTP 200");

    const data: TabImportResponse = await res.json();
    assertEquals(data.success, true);
    assertEquals(data.source, "ultimate-guitar");
    assertStringIncludes(data.title?.toLowerCase() || "", "wonderwall");
    assertStringIncludes(data.artist?.toLowerCase() || "", "oasis");
    assertEquals(data.capoFret, 2, "Wonderwall must have capo detected at fret 2");
    assertExists(data.rawContent);
    assertEquals(data.rawContent.trim().length > 100, true);

    // End-to-end tokenization and harmonic enrichment
    const song = parseLeadSheetText(data.rawContent, data.capoFret);
    assertEquals(song.capoFret, 2);
    const lines = song.lines as LeadSheetLine[];
    assertEquals(lines.length > 5, true);

    const chords = lines
      .flatMap((l) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
      .filter((s) => s.chord)
      .map((s) =>
        (s.chord as ChordDetail)?.originalChord?.raw ||
        (s.chord as { raw?: string }).raw ||
        ""
      );

    const uniqueChords = new Set(chords);
    assertEquals(
      uniqueChords.has("Em") || uniqueChords.has("Em7"),
      true,
      "Must contain Em or Em7",
    );
    assertEquals(uniqueChords.has("G"), true, "Must contain G");
    assertEquals(
      uniqueChords.has("D") || uniqueChords.has("Dsus4"),
      true,
      "Must contain D or Dsus4",
    );

    // Verify accordion Stradella and CBA enrichment on first chord
    const firstChordSegment = lines
      .flatMap((l) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
      .find((s) => s.chord);
    assertExists(firstChordSegment);
    const chordDetail = firstChordSegment.chord as ChordDetail;
    assertExists(chordDetail.stradella);
    assertExists(chordDetail.cba);
  },
});

// ============================================================================
// LIVE-02: Chordie Live Integration
// Target: https://www.chordie.com/chord.pere/www.guitartabs.cc/tabs/b/beatles/all_my_loving_crd_ver_2.html
// ============================================================================
Deno.test({
  name: "LIVE-02: Chordie live extraction (All My Loving by The Beatles)",
  ignore: !isLiveEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const url =
      "https://www.chordie.com/chord.pere/www.guitartabs.cc/tabs/b/beatles/all_my_loving_crd_ver_2.html";
    const req = new Request(
      `https://edge.deno.dev/api/import?url=${encodeURIComponent(url)}`,
      { method: "GET" },
    );

    const res = await handleRequest(req);
    assertEquals(res.status, 200, "Chordie live request must return HTTP 200");

    const data: TabImportResponse = await res.json();
    assertEquals(data.success, true);
    assertEquals(data.source, "chordie");
    assertExists(data.rawContent);
    assertEquals(data.rawContent.trim().length > 50, true);

    // End-to-end tokenization and harmonic enrichment
    const song = parseLeadSheetText(data.rawContent, data.capoFret);
    const lines = song.lines as LeadSheetLine[];
    assertEquals(lines.length > 3, true);

    const chords = lines
      .flatMap((l) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
      .filter((s) => s.chord)
      .map((s) =>
        (s.chord as ChordDetail)?.originalChord?.raw ||
        (s.chord as { raw?: string }).raw ||
        ""
      );

    assertEquals(chords.length > 0, true, "Must have extracted chord tokens");
  },
});

// ============================================================================
// LIVE-03: E-Chords / Cifras Live Integration
// Target: https://www.cifras.com.br/cifra/eagles/hotel-california
// ============================================================================
Deno.test({
  name: "LIVE-03: E-Chords / Cifras live extraction (Hotel California by Eagles)",
  ignore: !isLiveEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const url = "https://www.cifras.com.br/cifra/eagles/hotel-california";
    const req = new Request(
      `https://edge.deno.dev/api/import?url=${encodeURIComponent(url)}`,
      { method: "GET" },
    );

    const res = await handleRequest(req);
    assertEquals(res.status, 200, "Cifras / E-Chords live request must return HTTP 200");

    const data: TabImportResponse = await res.json();
    assertEquals(data.success, true);
    assertEquals(data.source, "e-chords");
    assertStringIncludes(data.title?.toLowerCase() || "", "hotel california");
    assertExists(data.rawContent);
    assertEquals(data.rawContent.trim().length > 100, true);

    // End-to-end tokenization and harmonic enrichment
    const song = parseLeadSheetText(data.rawContent, data.capoFret);
    const lines = song.lines as LeadSheetLine[];
    assertEquals(lines.length > 5, true);

    const chords = lines
      .flatMap((l) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
      .filter((s) => s.chord)
      .map((s) =>
        (s.chord as ChordDetail)?.originalChord?.raw ||
        (s.chord as { raw?: string }).raw ||
        ""
      );

    assertEquals(chords.length > 0, true, "Must have extracted chord tokens");
  },
});

// ============================================================================
// LIVE-04: Cifra Club Live Integration
// Target: https://www.cifraclub.com.br/the-beatles/let-it-be/
// ============================================================================
Deno.test({
  name: "LIVE-04: Cifra Club live extraction (Let It Be by The Beatles)",
  ignore: !isLiveEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const url = "https://www.cifraclub.com.br/the-beatles/let-it-be/";
    const req = new Request(
      `https://edge.deno.dev/api/import?url=${encodeURIComponent(url)}`,
      { method: "GET" },
    );

    const res = await handleRequest(req);
    assertEquals(res.status, 200, "Cifra Club live request must return HTTP 200");

    const data: TabImportResponse = await res.json();
    assertEquals(data.success, true);
    assertEquals(data.source, "cifraclub");
    assertStringIncludes(data.title?.toLowerCase() || "", "let it be");
    assertStringIncludes(data.artist?.toLowerCase() || "", "beatles");
    assertExists(data.rawContent);
    assertEquals(data.rawContent.trim().length > 100, true);

    // End-to-end tokenization and harmonic enrichment
    const song = parseLeadSheetText(data.rawContent, data.capoFret);
    const lines = song.lines as LeadSheetLine[];
    assertEquals(lines.length > 5, true);

    const chords = lines
      .flatMap((l) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
      .filter((s) => s.chord)
      .map((s) =>
        (s.chord as ChordDetail)?.originalChord?.raw ||
        (s.chord as { raw?: string }).raw ||
        ""
      );

    const uniqueChords = new Set(chords);
    assertEquals(uniqueChords.has("C"), true, "Must contain C");
    assertEquals(uniqueChords.has("G"), true, "Must contain G");
    assertEquals(uniqueChords.has("Am"), true, "Must contain Am");
    assertEquals(uniqueChords.has("F"), true, "Must contain F");
  },
});
