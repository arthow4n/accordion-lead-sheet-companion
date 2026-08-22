/**
 * Architecture, Utilities, and Refactoring Regression Test Suite
 * Path: tests/unit/refactor_architecture.test.ts
 */

import { assertEquals, assertExists } from "@std/assert";
import type { LeadSheetLine, LeadSheetSong } from "../../src/types/index.ts";
import {
  COMPOUND_QUALITIES,
  COMPOUND_RULES,
  computeCbaCentroid,
  extractSectionChords,
  getCounterBassColumn,
  getInitialSong,
  getInitialViewMode,
  getSongFromUrl,
  getViewModeFromUrl,
  solveCompoundChord,
} from "../../src/lib/index.ts";
import { isChordActive } from "../../src/components/ChordBadge.tsx";
import { enrichChord } from "../../src/lib/parser/tokenizer.ts";
import { parseChord } from "../../src/lib/capo/transposition.ts";

const MOCK_SONGS: LeadSheetSong[] = [
  {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    capoFret: 0,
    rawText: "[Em7] [A7] [Dmaj7]",
    lines: [],
    updatedAt: 1000,
  },
  {
    id: "bella-ciao",
    title: "Bella Ciao",
    capoFret: 2,
    rawText: "[Am] [E7] [Am]",
    lines: [],
    updatedAt: 2000,
  },
];

// ============================================================================
// 1. URL State and Persistence Utilities (src/lib/storage/urlState.ts)
// ============================================================================

Deno.test("REFACTOR-URL-01: Song parameter resolution from URL query and fallback", () => {
  // Direct matching
  const found = getSongFromUrl(MOCK_SONGS, "?song=bella-ciao");
  assertExists(found);
  assertEquals(found?.id, "bella-ciao");

  // Case-insensitive title matching
  const foundByTitle = getSongFromUrl(MOCK_SONGS, "?song=autumn%20leaves");
  assertExists(foundByTitle);
  assertEquals(foundByTitle?.id, "autumn-leaves");

  // Fallback on missing or invalid
  const notFound = getSongFromUrl(MOCK_SONGS, "?song=non-existent");
  assertEquals(notFound, undefined);

  // Initial song resolution fallback
  const initial = getInitialSong(MOCK_SONGS, "?song=bella-ciao");
  assertEquals(initial.id, "bella-ciao");
});

Deno.test("REFACTOR-URL-02: View mode resolution from canonical parameters", () => {
  assertEquals(getViewModeFromUrl("?view=stradella"), "stradella");
  assertEquals(getViewModeFromUrl("?view=cba"), "cba");
  assertEquals(getViewModeFromUrl("?view=guitar"), "guitar");
  assertEquals(getViewModeFromUrl("?view=dual"), "dual");
  assertEquals(getViewModeFromUrl("?view=unknown"), undefined);
  assertEquals(getViewModeFromUrl(""), undefined);

  // Initial view mode resolution
  if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
  assertEquals(getInitialViewMode(undefined, "?view=cba"), "cba");

  if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
  assertEquals(getInitialViewMode({ ...MOCK_SONGS[0], viewMode: "dual" }, ""), "dual");

  if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
  assertEquals(getInitialViewMode(undefined, ""), "stradella");
});

// ============================================================================
// 2. Section Chords Extractor (src/lib/cba/sectionChords.ts)
// ============================================================================

Deno.test("REFACTOR-CBA-01: Section chords and voice leading extraction across sections", () => {
  const lines: LeadSheetLine[] = [
    { type: "section_header", headerTitle: "Verse" },
    {
      type: "chord_lyric",
      segments: [
        { chord: enrichChord("Am", 0), lyric: "First lyric" },
        { chord: enrichChord("Dm", 0), lyric: " second" },
      ],
    },
    { type: "section_header", headerTitle: "Chorus" },
    {
      type: "chord_lyric",
      segments: [
        { chord: enrichChord("E7", 0), lyric: "Third" },
        { chord: enrichChord("Am", 0), lyric: " fourth" },
      ],
    },
  ];

  // Test root grip mode
  const rootResult = extractSectionChords(lines, "root");
  assertExists(rootResult.sectionChordsMap.get(0));
  assertEquals(rootResult.sectionChordsMap.get(0)?.length, 2);
  assertExists(rootResult.sectionChordsMap.get(2));
  assertEquals(rootResult.sectionChordsMap.get(2)?.length, 2);
  assertEquals(rootResult.allSongChords.length, 3); // Am, Dm, E7

  // Test voice-led mode
  const voiceLedResult = extractSectionChords(lines, "voice_led");
  assertExists(voiceLedResult.sectionChordsMap.get(0));
  assertEquals(voiceLedResult.sectionChordsMap.get(0)?.length, 2);
});

// ============================================================================
// 3. Active Chord Predicate (isChordActive)
// ============================================================================

Deno.test("REFACTOR-ACTIVE-01: isChordActive correctly compares strings and ChordDetail objects", () => {
  const detailC = enrichChord("C", 0);
  const detailG = enrichChord("G", 0);
  const detailCWithCapo = enrichChord("A", 3); // Sounding C

  // String vs String
  assertEquals(isChordActive("C", "C"), true);
  assertEquals(isChordActive("C", "G"), false);

  // String vs Object
  assertEquals(isChordActive("C", detailC), true);
  assertEquals(isChordActive("G", detailC), false);
  assertEquals(isChordActive(detailC, "C"), true);
  assertEquals(isChordActive(detailC, "G"), false);

  // Object vs Object
  assertEquals(isChordActive(detailC, detailC), true);
  assertEquals(isChordActive(detailC, detailG), false);
  assertEquals(isChordActive(detailC, detailCWithCapo), true); // Both sound C

  // Nullish handling
  assertEquals(isChordActive(null, detailC), false);
  assertEquals(isChordActive(detailC, null), false);
  assertEquals(isChordActive(undefined, undefined), false);
});

// ============================================================================
// 4. CBA Centroid and Stradella Coordinate Math
// ============================================================================

Deno.test("REFACTOR-MATH-01: computeCbaCentroid and getCounterBassColumn math", () => {
  // Centroid computation
  const coords = [
    { row: 1, column: 4 },
    { row: 2, column: 5 },
    { row: 3, column: 6 },
  ];
  const centroid = computeCbaCentroid(coords);
  assertEquals(centroid.column, 5);
  assertEquals(centroid.row, 2);

  // Empty fallback
  const emptyCentroid = computeCbaCentroid([], 7, 4);
  assertEquals(emptyCentroid.column, 7);
  assertEquals(emptyCentroid.row, 4);

  // Counter-bass column delta is always -4 (4 fifths flat = Major 3rd above fundamental)
  assertEquals(getCounterBassColumn(0), -4); // C fund -> E_ counter-bass in Ab col (-4)
  assertEquals(getCounterBassColumn(5), 1); // B fund -> D#_ counter-bass in G col (1)
});

// ============================================================================
// 5. Compound Qualities & Rules Declarative Verification
// ============================================================================

Deno.test("REFACTOR-COMPOUND-01: Compound rules specify accurate column deltas and produce valid voicings", () => {
  assertEquals(COMPOUND_QUALITIES.includes("major7"), true);
  assertEquals(COMPOUND_QUALITIES.includes("minor7"), true);
  assertEquals(COMPOUND_QUALITIES.includes("dominant9"), true);

  for (const quality of COMPOUND_QUALITIES) {
    const rule = COMPOUND_RULES[quality];
    assertExists(rule, `Rule must exist for quality ${quality}`);
    assertExists(rule?.columnDelta, `Column delta must exist for ${quality}`);
    assertExists(rule?.chordRow, `Chord row must exist for ${quality}`);

    // Verify solveCompoundChord uses the rule seamlessly
    const parsed = parseChord(
      `C${quality === "major7" ? "maj7" : quality === "minor7" ? "m7" : "9"}`,
    );
    const voicing = solveCompoundChord(parsed);
    assertExists(voicing.rootButton);
    assertExists(voicing.chordButton);
  }
});
