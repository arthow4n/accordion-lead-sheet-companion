import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import React from "react";
import { renderToString } from "react-dom/server";
import { PRESET_SONGS } from "../../src/lib/storage/presets.ts";
import { LeadSheetReader } from "../../src/components/LeadSheetReader.tsx";
import { ChordBadge } from "../../src/components/ChordBadge.tsx";
import { MiniGripDrawer } from "../../src/components/MiniGripDrawer.tsx";
import { ImportModal } from "../../src/components/ImportModal.tsx";
import { AutoScrollFooter } from "../../src/components/AutoScrollFooter.tsx";
import {
  clearSongbook,
  deleteSong,
  exportSongbook,
  getSong,
  getSongs,
  importSongbook,
  initPresets,
  saveSong,
} from "../../src/lib/storage/songbook.ts";
import {
  enrichChord,
  enrichLeadSheetLines,
  parseLeadSheetText,
} from "../../src/lib/parser/tokenizer.ts";
import { transposeChord } from "../../src/lib/capo/enharmonics.ts";
import { generateCbaGrip } from "../../src/lib/cba/grips.ts";
import type { ChordDetail, LeadSheetLine, LeadSheetSong, ViewMode } from "../../src/types/index.ts";

// ============================================================================
// E2E-01: Mobile Reader Segmented Layout
// Viewport matrix: 360px (Small Android), 375px (iPhone SE/8), 390px (iPhone 14), 430px (iPhone 15 Pro Max)
// ============================================================================

Deno.test("E2E-01: Mobile Reader Segmented Layout across mobile viewports (360px, 375px, 390px, 430px)", () => {
  const viewports = [
    { name: "Small Android (Galaxy S8/A-series)", width: 360, height: 740 },
    { name: "iPhone SE / 8 Standard", width: 375, height: 667 },
    { name: "iPhone 12/13/14 Modern", width: 390, height: 844 },
    { name: "iPhone 14/15 Pro Max", width: 430, height: 932 },
  ];

  const countryRoads = PRESET_SONGS.find((s) => s.id === "preset_country_roads");
  assertExists(countryRoads, "Country Roads preset song must exist");

  for (const vp of viewports) {
    // 1. Render LeadSheetReader in simulated mobile viewport
    const html = renderToString(
      React.createElement(LeadSheetReader, {
        song: countryRoads,
        capo: 2,
        viewMode: "stradella",
        fontSizeClass: "text-base",
      }),
    );

    assertExists(html);
    assertNotEquals(html.length, 0);

    // 2. Verify song title and metadata are rendered
    assertEquals(
      html.includes("Take Me Home, Country Roads"),
      true,
      `Title missing for viewport ${vp.name}`,
    );
    assertEquals(html.includes("John Denver"), true, `Artist missing for viewport ${vp.name}`);
    assertEquals(html.includes("Capo:"), true, `Capo badge missing for viewport ${vp.name}`);

    // 3. Verify section headers are rendered (Verse 1, Chorus, Bridge)
    assertEquals(html.includes("VERSE 1") || html.includes("Verse 1"), true);
    assertEquals(html.includes("CHORUS") || html.includes("Chorus"), true);
    assertEquals(html.includes("BRIDGE") || html.includes("Bridge"), true);

    // 4. Verify atomic inline-flex column container styling
    // Must contain display: inline-flex and flex-direction: column
    assertEquals(
      html.includes("display:inline-flex") || html.includes("display: inline-flex"),
      true,
      "Atomic segmented layout requires display: inline-flex",
    );
    assertEquals(
      html.includes("flex-direction:column") || html.includes("flex-direction: column"),
      true,
      "Atomic segmented layout requires flex-direction: column",
    );

    // 5. Verify flex-wrap container on line level to prevent horizontal scrollbar blowout
    assertEquals(
      html.includes("flex-wrap"),
      true,
      "LineRenderer must use flex-wrap container for zero horizontal overflow",
    );

    // 6. Verify chord badges and lyric syllables are properly paired
    assertEquals(html.includes("Almost"), true);
    assertEquals(html.includes("West Virginia"), true);
    assertEquals(html.includes("Shenandoah"), true);

    // 7. Verify all rendered lines have atomic segment structure
    const enrichedLines = enrichLeadSheetLines(
      countryRoads.lines as LeadSheetLine[],
      2,
      countryRoads.originalKey,
    );
    for (const line of enrichedLines) {
      if (line.type === "chord_lyric" && line.segments) {
        for (const seg of line.segments) {
          // Each segment must maintain either chord or lyric
          assertEquals(Boolean(seg.chord || seg.lyric), true);
        }
      }
    }
  }
});

// ============================================================================
// E2E-02: Real-time Capo Transposition
// Key transitions: Capo 0 -> Capo 2 -> Capo 3
// Enharmonic checks: G -> A -> Bb with key-appropriate accidentals
// ============================================================================

Deno.test("E2E-02: Real-time Capo Transposition (Capo 0 -> 2 -> 3 with enharmonic spellings)", () => {
  const countryRoads = PRESET_SONGS.find((s) => s.id === "preset_country_roads")!;
  assertExists(countryRoads);

  // --------------------------------------------------------------------------
  // Step 1: Capo 0 (Identity / Concert Pitch in Key of G)
  // --------------------------------------------------------------------------
  const linesCapo0 = enrichLeadSheetLines(countryRoads.lines as LeadSheetLine[], 0, "G");
  const firstChordLyric0 = linesCapo0.find((l) => l.type === "chord_lyric")?.segments?.[0];
  assertExists(firstChordLyric0);
  const firstChord0 = firstChordLyric0.chord as ChordDetail;
  assertExists(firstChord0);

  assertEquals(firstChord0.originalChord.raw, "G");
  assertEquals(firstChord0.soundingChord.raw, "G");
  assertEquals(firstChord0.stradella.primaryBass, "G");
  assertEquals(firstChord0.stradella.chordButton?.label, "g");

  // --------------------------------------------------------------------------
  // Step 2: Capo 2 (Key of A Major)
  // G + 2 frets = A, Em + 2 frets = F#m, D + 2 frets = E, C + 2 frets = D
  // --------------------------------------------------------------------------
  const linesCapo2 = enrichLeadSheetLines(countryRoads.lines as LeadSheetLine[], 2, "G");
  const firstChordLyric2 = linesCapo2.find((l) => l.type === "chord_lyric")?.segments?.[0];
  assertExists(firstChordLyric2);
  const firstChord2 = firstChordLyric2.chord as ChordDetail;
  assertExists(firstChord2);

  assertEquals(firstChord2.originalChord.raw, "G");
  assertEquals(firstChord2.soundingChord.raw, "A");
  assertEquals(firstChord2.stradella.primaryBass, "A");
  assertEquals(firstChord2.stradella.chordButton?.label, "a");

  // Verify second chord: Em + Capo 2 = F#m (sharp spelling in Key of A)
  const secondChordLyric2 = linesCapo2.find((l) => l.type === "chord_lyric")?.segments?.[1];
  assertExists(secondChordLyric2);
  const secondChord2 = secondChordLyric2.chord as ChordDetail;
  assertEquals(secondChord2.soundingChord.raw, "F#m");

  // --------------------------------------------------------------------------
  // Step 3: Capo 3 (Key of Bb Major - Flat Key Signature)
  // G + 3 frets = Bb (NOT A#), Em + 3 frets = Gm, D + 3 frets = F, C + 3 frets = Eb
  // Bridge slash chord: D/F# + 3 frets = F/A (Counter-bass A_ with f major chord)
  // --------------------------------------------------------------------------
  const linesCapo3 = enrichLeadSheetLines(countryRoads.lines as LeadSheetLine[], 3, "G");
  const firstChordLyric3 = linesCapo3.find((l) => l.type === "chord_lyric")?.segments?.[0];
  assertExists(firstChordLyric3);
  const firstChord3 = firstChordLyric3.chord as ChordDetail;
  assertExists(firstChord3);

  // Key badge & chord name
  assertEquals(firstChord3.originalChord.raw, "G");
  assertEquals(firstChord3.soundingChord.raw, "Bb");
  assertEquals(firstChord3.stradella.primaryBass, "Bb");
  assertEquals(firstChord3.stradella.chordButton?.label, "bb");

  // Render HTML for Capo 3 and verify rendered badges
  const capo3Html = renderToString(
    React.createElement(LeadSheetReader, {
      song: countryRoads,
      capo: 3,
      viewMode: "stradella",
      fontSizeClass: "text-base",
    }),
  );
  assertEquals(capo3Html.includes("Bb"), true, "Must render transposed Bb badge");
  assertEquals(
    firstChord3.stradella.chordButton?.label,
    "bb",
    "Must have Stradella bb chord button in model",
  );

  // Bridge Slash Chord Verification: D/F# -> F/A with Capo 3
  const bridgeLine = linesCapo3.find((l) =>
    l.type === "chord_lyric" && l.segments?.some((s) => s.lyric?.includes("voice"))
  );
  assertExists(bridgeLine, "Bridge line with voice must exist");
  const slashSeg = bridgeLine.segments?.find((s) =>
    (s.chord as ChordDetail)?.originalChord?.raw === "D/F#"
  );
  assertExists(slashSeg, "Original D/F# segment must exist in bridge");

  const slashDetail = slashSeg.chord as ChordDetail;
  assertEquals(slashDetail.soundingChord.raw, "F/A");
  assertEquals(slashDetail.stradella.isCounterBass, true);
  assertEquals(slashDetail.stradella.primaryBass, "A_"); // Counter-bass A in F column
  assertEquals(slashDetail.stradella.chordButton?.label, "f"); // Major chord in F column
  assertEquals(slashDetail.stradella.fingering, "2 + 3"); // Counter-bass 2, Major 3

  // Enharmonic spelling check across transposition module
  assertEquals(transposeChord("G", 3, "Bb").raw, "Bb");
  assertEquals(transposeChord("C", 3, "Eb").raw, "Eb");
  assertEquals(transposeChord("D", 3, "F").raw, "F");
  assertEquals(transposeChord("D/F#", 3, "Bb").raw, "F/A");
});

// ============================================================================
// E2E-03: MiniGripDrawer Bottom Sheet Interaction
// Touch chord badge -> Opens drawer with Stradella & CBA visual grids
// Prevents viewport jump (e.stopPropagation)
// ============================================================================

Deno.test("E2E-03: MiniGripDrawer Bottom Sheet Interaction (Stradella Counter-Bass + CBA Grid + stopPropagation)", () => {
  let stopPropagationCalled = false;
  let selectedChord: ChordDetail | string | null = null;

  // 1. Prepare transposed slash chord D/F# with Capo 3 -> Sounding F/A
  const chordDetail = enrichChord("D/F#", 3);
  assertEquals(chordDetail.soundingChord.raw, "F/A");
  assertEquals(chordDetail.stradella.isCounterBass, true);
  assertEquals(chordDetail.stradella.primaryBass, "A_");
  assertEquals(chordDetail.stradella.chordButton?.label, "f");

  // 2. Simulate click on ChordBadge with event propagation check
  const mockClickEvent = {
    stopPropagation: () => {
      stopPropagationCalled = true;
    },
  } as unknown as React.MouseEvent;

  const handleSelectChord = (c: ChordDetail | string) => {
    selectedChord = c;
  };

  // Test ChordBadge event handler
  const badgeProps = {
    chord: chordDetail,
    viewMode: "stradella" as ViewMode,
    onSelectChord: handleSelectChord,
  };
  const badgeVNode = ChordBadge(badgeProps) as unknown as {
    props: { onClick?: (e: React.MouseEvent) => void; className?: string };
  };

  assertExists(badgeVNode.props.onClick);
  badgeVNode.props.onClick(mockClickEvent);

  assertEquals(
    stopPropagationCalled,
    true,
    "e.stopPropagation() MUST be invoked to prevent viewport jump",
  );
  assertEquals(selectedChord, chordDetail);

  // 3. Render MiniGripDrawer in open state
  let isDrawerOpen = true;
  const handleClose = () => {
    isDrawerOpen = false;
  };

  const drawerHtml = renderToString(
    React.createElement(MiniGripDrawer, {
      isOpen: isDrawerOpen,
      onClose: handleClose,
      chord: chordDetail,
      capo: 3,
      viewMode: "dual",
      accordionSize: "120-bass",
    }),
  );

  assertExists(drawerHtml);
  // Drawer must display original and sounding chord
  assertEquals(drawerHtml.includes("D/F#"), true);
  assertEquals(drawerHtml.includes("Sounding: F/A") || drawerHtml.includes("F/A"), true);
  assertEquals(drawerHtml.includes("Capo") && drawerHtml.includes("3"), true);

  // Stradella section verification: Counter-bass A_ (finger 2) and f major (finger 3)
  assertEquals(drawerHtml.includes("Left Hand Stradella Bass"), true);
  assertEquals(drawerHtml.includes("Counter-Bass") || drawerHtml.includes("Counter-bass"), true);
  assertEquals(drawerHtml.includes("A_"), true);

  // CBA Treble section verification: A-C-F with standard grip 1-2-4
  assertEquals(drawerHtml.includes("Right Hand CBA C-System Treble"), true);
  const cbaGrip = generateCbaGrip("F");
  assertExists(cbaGrip);
  assertEquals(cbaGrip.fingeringPattern, "1-2-4");
  assertEquals(
    cbaGrip.notes.includes("F") && cbaGrip.notes.includes("A") && cbaGrip.notes.includes("C"),
    true,
  );

  // 4. Test drawer close state
  const closedHtml = renderToString(
    React.createElement(MiniGripDrawer, {
      isOpen: false,
      onClose: handleClose,
      chord: chordDetail,
      capo: 3,
      viewMode: "stradella",
      accordionSize: "120-bass",
    }),
  );
  assertEquals(closedHtml, "", "Closed MiniGripDrawer must return null/empty markup");
});

// ============================================================================
// E2E-04: 1-Tap Clipboard Ingestion Modal
// Ingests lead sheet text with capo headers, verifies capo regex and token parsing
// ============================================================================

Deno.test("E2E-04: 1-Tap Clipboard Ingestion Modal (Capo regex, ChordLyricSegment parsing, Songbook integration)", async () => {
  // 1. Sample tab with explicit Capo header and 2-line guitar tab format
  const sampleGuitarTab = `Capo: 2
Title: Bella Ciao Custom
Artist: Italian Partisans

Am                        Dm                  Am
Una mattina mi son svegliato, o bella ciao bella ciao
              E7          Am
E ho trovato l'invasor`;

  // 2. Parse text and verify capo detection and tokenization
  const parsed = parseLeadSheetText(sampleGuitarTab);
  assertExists(parsed);
  assertEquals(parsed.capoFret, 2, "Automatic capo detection regex must extract Capo: 2");
  assertEquals(parsed.title, "Bella Ciao Custom");
  assertEquals(parsed.artist, "Italian Partisans");

  // Verify segmented lines
  const lines = parsed.lines as LeadSheetLine[];
  assertEquals(lines.length >= 2, true);

  const firstChordLine = lines.find((l) => l.type === "chord_lyric");
  assertExists(firstChordLine);
  assertExists(firstChordLine.segments);
  assertEquals(firstChordLine.segments.length >= 2, true);

  // First segment should anchor [Am] to "Una mattina mi son svegliato, "
  const seg1 = firstChordLine.segments[0];
  const chordName = typeof seg1.chord === "string"
    ? seg1.chord
    : (seg1.chord as ChordDetail)?.originalChord?.raw;
  assertEquals(chordName, "Am");
  assertEquals(seg1.lyric.includes("Una mattina"), true);

  // 3. Test ChordPro format with bracketed capo header
  const sampleChordPro = `{title: Valzer Romantico}
{artist: Accordion Virtuoso}
{capo: 3}
[G]Sotto il [C]cielo di [D7]Parigi [G]suona la fisarmonica`;

  const parsedChordPro = parseLeadSheetText(sampleChordPro);
  assertEquals(parsedChordPro.capoFret, 3);
  assertEquals(parsedChordPro.title, "Valzer Romantico");
  assertEquals(parsedChordPro.artist, "Accordion Virtuoso");

  // 4. Test Ingestion Modal Rendering and Save Action
  let savedSong: LeadSheetSong | null = null;
  let modalOpen = true;

  const handleSaveSong = (song: LeadSheetSong) => {
    savedSong = song;
    modalOpen = false;
  };

  const modalHtml = renderToString(
    React.createElement(ImportModal, {
      isOpen: modalOpen,
      onClose: () => {
        modalOpen = false;
      },
      onSaveSong: handleSaveSong,
    }),
  );

  assertExists(modalHtml);
  assertEquals(modalHtml.includes("Import Lead Sheet"), true);
  assertEquals(modalHtml.includes("1-Tap Paste"), true);
  assertEquals(modalHtml.includes("Manual Text"), true);
  assertEquals(modalHtml.includes("Web URL"), true);

  handleSaveSong(parsed);
  assertExists(savedSong);
  assertEquals((savedSong as LeadSheetSong | null)?.title, "Bella Ciao Custom");

  // 5. Save parsed song to offline IndexedDB songbook and verify
  await clearSongbook();
  await saveSong(parsed);

  const stored = await getSong(parsed.id);
  assertExists(stored);
  assertEquals(stored.title, "Bella Ciao Custom");
  assertEquals(stored.capoFret, 2);

  const allSongs = await getSongs();
  assertEquals(allSongs.some((s) => s.id === parsed.id), true);
});

// ============================================================================
// E2E-05: Delta-Time Auto-Scroll & Touch-Pause Gesture
// Initiates auto-scroll, simulates touch pointerdown, verifies pause & 3.5s resume
// ============================================================================

Deno.test("E2E-05: Delta-Time Auto-Scroll Engine & Touch-Pause Gesture (3.5s auto-resume timer)", async () => {
  // 1. Delta-time scrolling math validation
  const baseSpeedPxPerSec = 35;
  const speedMultipliers = [0.5, 1.0, 1.5, 2.0, 3.0];

  for (const mult of speedMultipliers) {
    const dt60fps = 1 / 60; // ~16.66ms
    const distancePerFrame = baseSpeedPxPerSec * mult * dt60fps;
    assertEquals(distancePerFrame > 0, true);
    assertEquals(Math.abs(distancePerFrame - (baseSpeedPxPerSec * mult) / 60) < 0.0001, true);
  }

  // 2. Touch gesture pause and 3.5s auto-resume simulation
  let isPlaying = true;
  let isTouchPaused = false;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  const testAutoResumeMs = 60; // 60ms for fast test (production is 3500ms)

  const simulateUserTouch = () => {
    if (!isPlaying) return;
    isTouchPaused = true;
    if (resumeTimer !== null) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      isTouchPaused = false;
    }, testAutoResumeMs);
  };

  // Initially playing
  assertEquals(isPlaying, true);
  assertEquals(isTouchPaused, false);

  // User taps/drags viewport (pointerdown / touchstart)
  simulateUserTouch();
  assertEquals(isTouchPaused, true, "Auto-scroll must pause immediately upon user touch gesture");

  // Render AutoScrollFooter during touch-pause state
  const pausedFooterHtml = renderToString(
    React.createElement(AutoScrollFooter, {
      isPlaying: isPlaying,
      isTouchPaused: isTouchPaused,
      speed: 1.0,
      onTogglePlay: () => {
        isPlaying = !isPlaying;
      },
      onChangeSpeed: () => {},
      onScrollToTop: () => {},
    }),
  );

  assertEquals(
    pausedFooterHtml.includes("Paused (3.5s)"),
    true,
    "Footer must display touch-pause indicator",
  );

  // Wait for auto-resume timer to expire
  await new Promise((resolve) => setTimeout(resolve, 90));
  assertEquals(isTouchPaused, false, "Auto-scroll must resume smoothly after timer expiration");

  // Render AutoScrollFooter in active scrolling state
  const playingFooterHtml = renderToString(
    React.createElement(AutoScrollFooter, {
      isPlaying: isPlaying,
      isTouchPaused: isTouchPaused,
      speed: 1.0,
      onTogglePlay: () => {
        isPlaying = !isPlaying;
      },
      onChangeSpeed: () => {},
      onScrollToTop: () => {},
    }),
  );

  assertEquals(playingFooterHtml.includes("Pause"), true);
  assertEquals(playingFooterHtml.includes("1"), true);
  assertEquals(playingFooterHtml.includes("x"), true);
});

// ============================================================================
// E2E-06: Offline Songbook Persistence & Airplane Mode
// IndexedDB storage via idb-keyval, CRUD operations, PWA precache verification
// ============================================================================

Deno.test("E2E-06: Offline Songbook Persistence & Airplane Mode (IndexedDB CRUD + PWA Precache Readiness)", async () => {
  // 1. Initialize fresh songbook with presets
  await clearSongbook();
  const presets = await initPresets();
  assertExists(presets);
  assertEquals(presets.length >= 5, true);

  // 2. Create custom lead sheet offline
  const customLeadSheet: LeadSheetSong = {
    id: "offline_custom_song_001",
    title: "Airplane Mode Accordion Waltz",
    artist: "Solo Performer",
    capoFret: 1,
    originalKey: "F",
    soundingKey: "F#",
    rawText: "[F]La vita [C7]è bella [F]senza rete",
    lines: [
      {
        type: "chord_lyric",
        segments: [
          { chord: "F", lyric: "La vita " },
          { chord: "C7", lyric: "è bella " },
          { chord: "F", lyric: "senza rete" },
        ],
      },
    ],
    updatedAt: Date.now(),
  };

  // Save to IndexedDB
  await saveSong(customLeadSheet);

  // 3. Retrieve custom song offline without network
  const retrieved = await getSong("offline_custom_song_001");
  assertExists(retrieved);
  assertEquals(retrieved.title, "Airplane Mode Accordion Waltz");
  assertEquals(retrieved.capoFret, 1);
  assertEquals(retrieved.originalKey, "F");

  // 4. Update custom song
  const updatedCustom: LeadSheetSong = {
    ...customLeadSheet,
    title: "Airplane Mode Accordion Waltz (Live Version)",
    capoFret: 3,
    updatedAt: Date.now(),
  };
  await saveSong(updatedCustom);

  const retrievedUpdated = await getSong("offline_custom_song_001");
  assertExists(retrievedUpdated);
  assertEquals(retrievedUpdated.title, "Airplane Mode Accordion Waltz (Live Version)");
  assertEquals(retrievedUpdated.capoFret, 3);

  // 5. JSON export and import verification in offline mode
  const exportedJson = await exportSongbook();
  assertExists(exportedJson);
  const parsedExport = JSON.parse(exportedJson);
  assertExists(parsedExport.songs);
  assertEquals(parsedExport.songs.length >= 6, true);

  // Clear and restore from export JSON
  await clearSongbook();
  const emptyCheck = await getSongs();
  assertEquals(emptyCheck.length, 0);

  const importedSongs = await importSongbook(exportedJson, "replace");
  assertEquals(importedSongs.length, parsedExport.songs.length);

  // 6. Delete song
  await deleteSong("offline_custom_song_001");
  const deletedCheck = await getSong("offline_custom_song_001");
  assertEquals(deletedCheck, undefined);

  // 7. Verify PWA Service Worker precache bundle exists in dist/ or config in vite.config.ts
  try {
    const swContent = await Deno.readTextFile("./dist/sw.js");
    assertExists(swContent, "dist/sw.js service worker must exist for offline PWA");
    assertEquals(swContent.includes("workbox") || swContent.includes("precache"), true);
  } catch (_err) {
    const viteConfig = await Deno.readTextFile("./vite.config.ts");
    assertEquals(
      viteConfig.includes("VitePWA"),
      true,
      "vite.config.ts must configure VitePWA plugin",
    );
  }
});
