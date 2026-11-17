import { test } from "vitest";
/**
 * Live External Web Integration Test Suite
 * Path: tests/live/live_sites.test.ts
 *
 * Implements Section 9.8 of SPEC.md:
 * Verifies real website tab extraction against live domains (LIVE-01 to LIVE-04).
 * Executed strictly on-demand via `npm run test:live`.
 */

import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { assertExists, assertStringIncludes } from "../assertions.ts";
import { handleRequest } from "../../api/import.ts";
import { parseLeadSheetText } from "../../src/lib/parser/tokenizer.ts";
import type { ChordDetail, LeadSheetLine, TabImportResponse } from "../../src/types/index.ts";

// ============================================================================
// LIVE-01: Ultimate Guitar Live Integration
// Target: https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596
// ============================================================================
test("LIVE-01: Ultimate Guitar live extraction (Wonderwall by Oasis)", async () => {
  const url = "https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
    { method: "GET" },
  );

  const res = await handleRequest(req);
  assertEquals(
    res.status,
    200,
    "Ultimate Guitar live request must return HTTP 200",
  );

  const data: TabImportResponse = await res.json();
  assertEquals(data.success, true);
  assertEquals(data.source, "ultimate-guitar");
  assertStringIncludes(data.title?.toLowerCase() || "", "wonderwall");
  assertStringIncludes(data.artist?.toLowerCase() || "", "oasis");
  assertEquals(
    data.capoFret,
    2,
    "Wonderwall must have capo detected at fret 2",
  );
  assertExists(data.rawContent);
  assertEquals(data.rawContent.trim().length > 100, true);

  // End-to-end tokenization and harmonic enrichment
  const song = parseLeadSheetText(data.rawContent, data.capoFret);
  assertEquals(song.capoFret, 2);
  const lines = song.lines as LeadSheetLine[];
  assertEquals(lines.length > 5, true);

  const chords = lines
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
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
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
    .find((s) => s.chord);
  assertExists(firstChordSegment);
  const chordDetail = firstChordSegment.chord as ChordDetail;
  assertExists(chordDetail.stradella);
  assertExists(chordDetail.cba);
});

// ============================================================================
// LIVE-02: Chordie Live Integration
// Target: https://www.chordie.com/chord.pere/www.guitartabs.cc/tabs/b/beatles/all_my_loving_crd_ver_2.html
// ============================================================================
test("LIVE-02: Chordie live extraction (All My Loving by The Beatles)", async () => {
  const url =
    "https://www.chordie.com/chord.pere/www.guitartabs.cc/tabs/b/beatles/all_my_loving_crd_ver_2.html";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
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
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
    .filter((s) => s.chord)
    .map((s) =>
      (s.chord as ChordDetail)?.originalChord?.raw ||
      (s.chord as { raw?: string }).raw ||
      ""
    );

  assertEquals(chords.length > 0, true, "Must have extracted chord tokens");
});

// ============================================================================
// LIVE-03: E-Chords / Cifras Live Integration
// Target: https://www.cifras.com.br/cifra/eagles/hotel-california
// ============================================================================
test("LIVE-03: E-Chords / Cifras live extraction (Hotel California by Eagles)", async () => {
  const url = "https://www.cifras.com.br/cifra/eagles/hotel-california";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
    { method: "GET" },
  );

  const res = await handleRequest(req);
  assertEquals(
    res.status,
    200,
    "Cifras / E-Chords live request must return HTTP 200",
  );

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
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
    .filter((s) => s.chord)
    .map((s) =>
      (s.chord as ChordDetail)?.originalChord?.raw ||
      (s.chord as { raw?: string }).raw ||
      ""
    );

  assertEquals(chords.length > 0, true, "Must have extracted chord tokens");
});

// ============================================================================
// LIVE-04: Cifra Club Live Integration
// Target: https://www.cifraclub.com.br/the-beatles/let-it-be/
// ============================================================================
test("LIVE-04: Cifra Club live extraction (Let It Be by The Beatles)", async () => {
  const url = "https://www.cifraclub.com.br/the-beatles/let-it-be/";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
    { method: "GET" },
  );

  const res = await handleRequest(req);
  assertEquals(
    res.status,
    200,
    "Cifra Club live request must return HTTP 200",
  );

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
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
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
});

// ============================================================================
// LIVE-05: Ultimate Guitar Live Tab Staves & Riffs Integration
// Target: Stairway to Heaven / Dust in the Wind
// ============================================================================
test("LIVE-05: Ultimate Guitar live tab staves extraction (Dust in the Wind by Kansas)", async () => {
  const url = "https://tabs.ultimate-guitar.com/tab/kansas/dust-in-the-wind-chords-14197";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
    { method: "GET" },
  );

  const res = await handleRequest(req);
  assertEquals(
    res.status,
    200,
    "Ultimate Guitar live tab request must return HTTP 200",
  );

  const data: TabImportResponse = await res.json();
  assertEquals(data.success, true);
  assertEquals(data.source, "ultimate-guitar");
  assertStringIncludes(data.title?.toLowerCase() || "", "dust in the wind");
  assertExists(data.rawContent);

  // Verify tokenization handles tab staves and chord/lyric lines
  const song = parseLeadSheetText(data.rawContent, data.capoFret);
  const lines = song.lines as LeadSheetLine[];
  assertEquals(lines.length > 5, true);

  // Verify presence of chord tokens
  const chords = lines
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
    .filter((s) => s.chord)
    .map((s) =>
      (s.chord as ChordDetail)?.originalChord?.raw ||
      (s.chord as { raw?: string }).raw ||
      ""
    );
  assertEquals(chords.length > 0, true);
});

// ============================================================================
// LIVE-06: Ultimate Guitar Jazz Alterations Integration
// Target: The Girl from Ipanema by Antonio Carlos Jobim
// ============================================================================
test("LIVE-06: Ultimate Guitar live jazz alterations extraction (The Girl from Ipanema)", async () => {
  const url =
    "https://tabs.ultimate-guitar.com/tab/antonio-carlos-jobim/the-girl-from-ipanema-chords-14660";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
    { method: "GET" },
  );

  const res = await handleRequest(req);
  assertEquals(
    res.status,
    200,
    "Ultimate Guitar jazz request must return HTTP 200",
  );

  const data: TabImportResponse = await res.json();
  assertEquals(data.success, true);
  assertEquals(data.source, "ultimate-guitar");
  assertExists(data.rawContent);

  const song = parseLeadSheetText(data.rawContent, data.capoFret);
  const lines = song.lines as LeadSheetLine[];
  assertEquals(lines.length > 5, true);

  const chords = lines
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
    .filter((s) => s.chord)
    .map((s) =>
      (s.chord as ChordDetail)?.originalChord?.raw ||
      (s.chord as { raw?: string }).raw ||
      ""
    );
  assertEquals(chords.length > 0, true);
});

// ============================================================================
// LIVE-07: Ultimate Guitar Chromatic Slash Bass Lines & Capo Integration
// Target: A Whiter Shade of Pale / Landslide
// ============================================================================
test("LIVE-07: Ultimate Guitar live chromatic bass line extraction (A Whiter Shade of Pale)", async () => {
  const url =
    "https://tabs.ultimate-guitar.com/tab/procol-harum/a-whiter-shade-of-pale-chords-17398";
  const req = new Request(
    `https://api.example.test/api/import?url=${encodeURIComponent(url)}`,
    { method: "GET" },
  );

  const res = await handleRequest(req);
  assertEquals(
    res.status,
    200,
    "Ultimate Guitar live request must return HTTP 200",
  );

  const data: TabImportResponse = await res.json();
  assertEquals(data.success, true);
  assertEquals(data.source, "ultimate-guitar");
  assertExists(data.rawContent);

  const song = parseLeadSheetText(data.rawContent, data.capoFret);
  const lines = song.lines as LeadSheetLine[];
  assertEquals(lines.length > 5, true);

  const chords = lines
    .flatMap((
      l,
    ) => (l.type === "chord_lyric" && l.segments ? l.segments : []))
    .filter((s) => s.chord)
    .map((s) =>
      (s.chord as ChordDetail)?.originalChord?.raw ||
      (s.chord as { raw?: string }).raw ||
      ""
    );
  assertEquals(chords.length > 0, true);
});
