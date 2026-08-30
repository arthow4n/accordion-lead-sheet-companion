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
  computeCbaJamFills,
  enrichSongLinesWithVoiceLeading,
  extractSectionChords,
  generateCanonicalRootGrip,
  getCounterBassColumn,
  getGroovePresetList,
  getInitialSong,
  getInitialViewMode,
  getIsUpdateAvailable,
  getLastPersistedCbaGripMode,
  getLastPersistedGroove,
  getLastPersistedJamFills,
  getLastPersistedSongId,
  getSongFromUrl,
  getViewModeFromUrl,
  initUpdateChecker,
  isJamFillButton,
  persistCbaGripMode,
  persistGroove,
  persistJamFills,
  persistLastSongId,
  solveCompoundChord,
  solveStradellaChord,
  solveStradellaGroove,
  STRADELLA_GROOVES,
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

Deno.test("REFACTOR-URL-01b: URL and PWA song persistence resolve after async songbook hydration", () => {
  const fallbackSong = MOCK_SONGS[0];
  const persistedSong = MOCK_SONGS[1];
  const previousSongId = getLastPersistedSongId();

  try {
    if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();

    // A standalone PWA has no incoming URL, so its persisted song must resolve from the full
    // songbook once IndexedDB has hydrated it.
    persistLastSongId(persistedSong.id);
    assertEquals(getInitialSong([fallbackSong, persistedSong], ""), persistedSong);

    // A browser URL remains authoritative over the PWA/localStorage value.
    assertEquals(
      getInitialSong([fallbackSong, persistedSong], `?song=${fallbackSong.id}`),
      fallbackSong,
    );
  } finally {
    if (typeof globalThis.localStorage !== "undefined") {
      if (previousSongId) {
        globalThis.localStorage.setItem("accordion_companion_last_song_id", previousSongId);
      } else {
        globalThis.localStorage.removeItem("accordion_companion_last_song_id");
      }
    }
  }
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

Deno.test("REFACTOR-CBA-02: Whole-song continuous voice leading enrichment and persistence", () => {
  if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
  assertEquals(getLastPersistedCbaGripMode(), "root_5row");

  persistCbaGripMode("voice_led");
  assertEquals(getLastPersistedCbaGripMode(), "voice_led");

  persistCbaGripMode("root_3row");
  assertEquals(getLastPersistedCbaGripMode(), "root_3row");

  persistCbaGripMode("root_5row");
  assertEquals(getLastPersistedCbaGripMode(), "root_5row");

  // Backward compatibility alias
  persistCbaGripMode("root");
  assertEquals(getLastPersistedCbaGripMode(), "root_5row");

  const lines: LeadSheetLine[] = [
    {
      type: "chord_lyric",
      segments: [
        { chord: enrichChord("C", 0), lyric: "I " },
        { chord: enrichChord("Am", 0), lyric: "see " },
      ],
    },
    {
      type: "chord_lyric",
      segments: [
        { chord: enrichChord("Dm", 0), lyric: "trees " },
        { chord: enrichChord("G7", 0), lyric: "of green" },
      ],
    },
  ];

  const voiceLedLines = enrichSongLinesWithVoiceLeading(lines, "voice_led");
  assertEquals(voiceLedLines.length, 2);
  const firstChord = voiceLedLines[0].segments?.[0]?.chord;
  const secondChord = voiceLedLines[0].segments?.[1]?.chord;
  const thirdChord = voiceLedLines[1].segments?.[0]?.chord;

  assertExists(firstChord);
  assertExists(secondChord);
  assertExists(thirdChord);

  if (typeof firstChord !== "string" && typeof secondChord !== "string") {
    assertExists(secondChord.cba);
    // C to Am shares common tones C and E
    assertExists(secondChord.cba?.sharedCoords);
    assertExists(secondChord.cba?.flowVector);
  }

  // 3-Row vs 5-Row Ergonomic Generation
  const bm3Row = generateCanonicalRootGrip(parseChord("Bm"), 5, "3row");
  const bm5Row = generateCanonicalRootGrip(parseChord("Bm"), 5, "5row");
  assertEquals((bm3Row.buttons || []).every((b) => b.row <= 3), true);
  assertEquals((bm5Row.buttons || []).some((b) => b.row >= 4), true); // Bm uses Row 4 (Aux 1) for F#
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

// ============================================================================
// 6. Strategy C: Stradella Grooves & Rhythmic Step Generator
// ============================================================================

Deno.test("REFACTOR-GROOVE-01: solveStradellaGroove generates valid 4/4 and 3/4 pulse steps", () => {
  assertEquals(STRADELLA_GROOVES.length >= 4, true);
  assertEquals(getGroovePresetList().some((g) => g.id === "boom_chick"), true);

  const chord = parseChord("C");
  const voicing = solveStradellaChord(chord);

  // 1. Folk Boom-Chick: Beat 1 Root (C), Beat 2 Chord (C), Beat 3 Alt (G, Col +1), Beat 4 Chord (C)
  const boomChick = solveStradellaGroove(chord, voicing, "boom_chick");
  assertExists(boomChick);
  assertEquals(boomChick?.steps.length, 4);
  assertEquals(boomChick?.steps[0].buttonName, "C");
  assertEquals(boomChick?.steps[0].type, "bass");
  assertEquals(boomChick?.steps[1].type, "chord");
  assertEquals(boomChick?.steps[2].buttonName, "G");
  assertEquals(boomChick?.steps[2].type, "alt_bass");
  assertEquals(boomChick?.altBassButton?.column, 1); // G is Col 1

  // 2. Waltz 3/4: Beat 1 Root, Beat 2 Chord, Beat 3 Chord
  const waltz = solveStradellaGroove(chord, voicing, "waltz");
  assertExists(waltz);
  assertEquals(waltz?.steps.length, 3);
  assertEquals(waltz?.steps[0].type, "bass");
  assertEquals(waltz?.steps[1].type, "chord");
  assertEquals(waltz?.steps[2].type, "chord");

  // 3. Offbeat Chop: 8-step subdivision with rests on downbeats
  const chop = solveStradellaGroove(chord, voicing, "offbeat_chop");
  assertExists(chop);
  assertEquals(chop?.steps.length, 8);
  assertEquals(chop?.steps[0].type, "rest");
  assertEquals(chop?.steps[1].type, "chord");

  // 4. Persistence
  if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
  assertEquals(getLastPersistedGroove(), "boom_chick");
  persistGroove("waltz");
  assertEquals(getLastPersistedGroove(), "waltz");
});

// ============================================================================
// 7. Strategy D: CBA Jam Fill Scale Calculator
// ============================================================================

Deno.test("REFACTOR-FILLS-01: computeCbaJamFills generates minor/major blues scales and button coordinates", () => {
  // 1. Minor Blues for Am (A, C, D, D#, E, G)
  const amChord = parseChord("Am");
  const amFills = computeCbaJamFills(amChord);
  assertExists(amFills);
  assertEquals(amFills?.scaleType, "minor_blues");
  assertEquals(amFills?.notes.includes("A"), true);
  assertEquals(amFills?.notes.includes("C"), true);
  assertEquals(amFills?.notes.includes("D"), true);
  assertEquals(amFills?.notes.includes("E"), true);
  assertEquals(amFills?.notes.includes("G"), true);
  assertEquals(amFills?.fillButtonCoords.length > 0, true);

  // Button membership check
  assertEquals(isJamFillButton(1, 4, amFills), true); // A note is on Row 1 Col 4

  // 2. Major Blues for C (C, D, D#, E, G, A)
  const cChord = parseChord("C");
  const cFills = computeCbaJamFills(cChord);
  assertExists(cFills);
  assertEquals(cFills?.scaleType, "major_blues");
  assertEquals(cFills?.notes.includes("C"), true);
  assertEquals(cFills?.notes.includes("E"), true);
  assertEquals(cFills?.notes.includes("G"), true);

  // 3. Dominant Blues for G7 (G, B, C, C#, D, F)
  const g7Chord = parseChord("G7");
  const g7Fills = computeCbaJamFills(g7Chord);
  assertExists(g7Fills);
  assertEquals(g7Fills?.scaleType, "dominant_blues");

  // 4. Persistence
  if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
  assertEquals(getLastPersistedJamFills(), false);
  persistJamFills(true);
  assertEquals(getLastPersistedJamFills(), true);
});

// ============================================================================
// 8. PWA Service Worker Update Controller
// ============================================================================

Deno.test("REFACTOR-PWA-01: initUpdateChecker and getIsUpdateAvailable lifecycle handles listeners gracefully", () => {
  let updateFired = false;
  const cleanup = initUpdateChecker(() => {
    updateFired = true;
  });

  assertEquals(typeof cleanup, "function");
  assertEquals(typeof getIsUpdateAvailable(), "boolean");

  cleanup();
  assertEquals(updateFired, false);
});
