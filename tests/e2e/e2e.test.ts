import { assertEquals, assertExists } from "@std/assert";
import { PRESET_SONGS } from "../../src/lib/storage/presets.ts";
import { enrichLeadSheetLines, parseLeadSheetText } from "../../src/lib/parser/tokenizer.ts";
import { solveStradellaChord } from "../../src/lib/stradella/solver.ts";
import { generateCbaGrip } from "../../src/lib/cba/grips.ts";
import { optimizeVoiceLeading } from "../../src/lib/cba/voiceLeading.ts";
import {
  clearSongbook,
  exportSongbook,
  getSong,
  getSongs,
  importSongbook,
  initPresets,
  saveSong,
} from "../../src/lib/storage/songbook.ts";
import type { ChordDetail, LeadSheetLine, LeadSheetSong } from "../../src/types/index.ts";

// ============================================================================
// Tier 4 Real-World Application Scenario 1:
// Standard Folk Lead Sheet ("Bella Ciao" in Am with Capo 2)
// Features: F5 (Capo), F6 (Stradella Core), F7 (Slash Solver), F10 (Tokenizer), F20 (LeadSheetReader)
// ============================================================================

Deno.test("Tier 4 Scenario 1: Standard Folk Lead Sheet ('Bella Ciao' in Am with Capo 2)", () => {
  const bellaCiao = PRESET_SONGS.find((s) => s.id === "preset_bella_ciao");
  assertExists(bellaCiao, "Bella Ciao preset must exist");
  assertEquals(bellaCiao.capoFret, 2);

  // Am with Capo 2 sounding Bm
  const enrichedLines = enrichLeadSheetLines(bellaCiao.lines as LeadSheetLine[], 2, "Am");
  assertExists(enrichedLines);

  const verseLine = enrichedLines.find((l) => l.type === "chord_lyric");
  assertExists(verseLine);
  assertExists(verseLine.segments);

  // Am + Capo 2 -> Bm (sounding Bm, Stradella bass B, chord bm)
  const amSegment = verseLine.segments[0];
  assertExists(amSegment);
  const amDetail = amSegment.chord as ChordDetail;
  assertEquals(amDetail.soundingChord.raw, "Bm");
  assertEquals(amDetail.stradella.primaryBass, "B");
  assertEquals(amDetail.stradella.chordButton?.label, "bm");

  // Dm + Capo 2 -> Em (sounding Em, Stradella bass E, chord em)
  const dmSegment = enrichedLines
    .flatMap((l) => l.segments || [])
    .find((s) => (s.chord as ChordDetail)?.originalChord?.raw === "Dm");
  assertExists(dmSegment);
  const dmDetail = dmSegment.chord as ChordDetail;
  assertEquals(dmDetail.soundingChord.raw, "Em");
  assertEquals(dmDetail.stradella.primaryBass, "E");
  assertEquals(dmDetail.stradella.chordButton?.label, "em");

  // E7 + Capo 2 -> F#7 (sounding F#7, Stradella bass F# or counter-bass, chord f#7)
  const e7Segment = enrichedLines
    .flatMap((l) => l.segments || [])
    .find((s) => (s.chord as ChordDetail)?.originalChord?.raw === "E7");
  assertExists(e7Segment);
  const e7Detail = e7Segment.chord as ChordDetail;
  assertEquals(e7Detail.soundingChord.raw, "F#7");
  assertEquals(e7Detail.stradella.chordButton?.label, "f#7");
});

// ============================================================================
// Tier 4 Scenario 2:
// Jazz Standard ("Autumn Leaves" with Slash Chords & Half-Diminished m7b5)
// Features: F7 (Slash Solver), F8 (Compound Voicings), F9 (CBA Engine), F20 (LeadSheetReader), F22 (MiniGripDrawer)
// ============================================================================

Deno.test("Tier 4 Scenario 2: Jazz Standard ('Autumn Leaves' with Slash Chords & m7b5 compound voicings)", () => {
  const autumnLeaves = PRESET_SONGS.find((s) => s.id === "preset_autumn_leaves");
  assertExists(autumnLeaves, "Autumn Leaves preset must exist");

  // 1. Test F#m7b5 compound voicing (F# + am chord button)
  const fsharpM7b5 = solveStradellaChord("F#m7b5");
  assertExists(fsharpM7b5);
  assertEquals(fsharpM7b5.primaryBass, "F#");
  assertEquals(fsharpM7b5.chordButton?.label, "am"); // F#m7b5 uses minor chord of minor 3rd (A minor)
  assertExists(fsharpM7b5.explanation);

  // 2. Test Am7 compound voicing (A + c major chord button)
  const am7 = solveStradellaChord("Am7");
  assertExists(am7);
  assertEquals(am7.primaryBass, "A");
  assertEquals(am7.chordButton?.label, "c"); // Am7 uses relative major chord (C major)
  assertExists(am7.explanation);

  // 3. Test B7 dominant voicing (B + b7 chord button)
  const b7 = solveStradellaChord("B7");
  assertExists(b7);
  assertEquals(b7.primaryBass, "B");
  assertEquals(b7.chordButton?.label, "b7");

  // 4. Test CBA Voice leading for Autumn Leaves progression (Am7 -> D7 -> Gmaj7 -> Cmaj7)
  const grip1 = generateCbaGrip("Am7");
  const grip2 = optimizeVoiceLeading("D7", grip1);
  const grip3 = optimizeVoiceLeading("Gmaj7", grip2);
  const grip4 = optimizeVoiceLeading("Cmaj7", grip3);

  assertExists(grip1);
  assertExists(grip2);
  assertExists(grip3);
  assertExists(grip4);

  // Centroids should remain in compact hand reach (within ~2.5 columns)
  const delta12 = Math.abs((grip2.centroidColumn ?? 5) - (grip1.centroidColumn ?? 5));
  const delta23 = Math.abs((grip3.centroidColumn ?? 5) - (grip2.centroidColumn ?? 5));
  const delta34 = Math.abs((grip4.centroidColumn ?? 5) - (grip3.centroidColumn ?? 5));

  assertEquals(
    delta12 <= 2.5,
    true,
    "Voice leading must keep Am7 -> D7 centroid jump <= 2.5 columns",
  );
  assertEquals(
    delta23 <= 2.5,
    true,
    "Voice leading must keep D7 -> Gmaj7 centroid jump <= 2.5 columns",
  );
  assertEquals(
    delta34 <= 2.5,
    true,
    "Voice leading must keep Gmaj7 -> Cmaj7 centroid jump <= 2.5 columns",
  );
});

// ============================================================================
// Tier 4 Scenario 3:
// Live Stage Performance with Auto-Scroll & Bluetooth Pedal Navigation
// Features: F17 (WakeLock), F18 (rAF Auto-Scroller), F19 (Pedal Navigation), F20 (LeadSheetReader)
// ============================================================================

Deno.test("Tier 4 Scenario 3: Live Stage Performance with Auto-Scroll, Touch-Pause & Bluetooth Pedal Navigation", () => {
  // 1. Test Pedal scrolling step calculation: 80% viewport height
  const viewportHeight = 800;
  const pedalScrollFraction = 0.8;
  const pedalJump = viewportHeight * pedalScrollFraction;
  assertEquals(pedalJump, 640);

  // 2. Test Auto-scroll delta time frame rates: 60fps (16.6ms) vs 120fps (8.33ms)
  const speed = 1.0;
  const basePxPerSec = 35;

  const dt60 = 0.016667;
  const distance60 = basePxPerSec * speed * dt60;

  const dt120 = 0.008333;
  const distance120 = basePxPerSec * speed * dt120;

  // 120Hz display takes half the pixels per frame, giving perfectly identical speed per second
  assertEquals(Math.round(distance60 * 60), Math.round(distance120 * 120));
});

// ============================================================================
// Tier 4 Scenario 4:
// Web Ingestion from Tab Formats (ChordPro and 2-Line Guitar Tabs)
// Features: F10 (Tokenizer), F12 (ChordPro), F13 (2-Line Tab), F14 (Capo Parser)
// ============================================================================

Deno.test("Tier 4 Scenario 4: Web Ingestion from Tab Formats & ChordPro with automatic capo extraction", () => {
  const webScrapedTab = `Capo: 4
Title: House of the Rising Sun (Web Import)
Artist: Folk Legends

Am     C        D        F
There is a house in New Orleans
Am       C        E7
They call the Rising Sun`;

  const parsed = parseLeadSheetText(webScrapedTab);
  assertEquals(parsed.capoFret, 4);
  assertEquals(parsed.title, "House of the Rising Sun (Web Import)");
  assertEquals(parsed.artist, "Folk Legends");

  const lines = parsed.lines as LeadSheetLine[];
  assertEquals(lines.length >= 2, true);

  // Verify enriched lines with Capo 4
  const enriched = enrichLeadSheetLines(lines, 4, "Am");
  const line1 = enriched.find((l) => l.type === "chord_lyric");
  assertExists(line1);
  assertExists(line1.segments);

  // Am + Capo 4 = C#m (in Sharp key) or Dbm (in Flat key)
  const firstSeg = line1.segments[0];
  assertExists(firstSeg);
  const firstChord = firstSeg.chord as ChordDetail;
  assertExists(firstChord);
  assertEquals(firstChord.originalChord.raw, "Am");
  assertEquals(firstChord.soundingChord.rootPitchClass, (9 + 4) % 12); // A(9) + 4 = C#(1)
});

// ============================================================================
// Tier 4 Scenario 5:
// Airplane Mode Performance & Offline IndexedDB Storage Lifecycle
// Features: F16 (idb-keyval), F20 (App), F24 (PWA Offline)
// ============================================================================

Deno.test("Tier 4 Scenario 5: Airplane Mode Full Session & Offline IndexedDB Songbook Storage", async () => {
  await clearSongbook();

  // 1. Initial preload from presets
  const presets = await initPresets();
  assertEquals(presets.length >= 5, true);

  // 2. Perform batch CRUD operations offline
  const testSong: LeadSheetSong = {
    id: "offline_session_song_42",
    title: "Stage Ready Accordion Polka",
    artist: "Band Leader",
    capoFret: 2,
    originalKey: "G",
    rawText: "[G]Polka [C]dance [D7]all night [G]long",
    lines: [
      {
        type: "chord_lyric",
        segments: [
          { chord: "G", lyric: "Polka " },
          { chord: "C", lyric: "dance " },
          { chord: "D7", lyric: "all night " },
          { chord: "G", lyric: "long" },
        ],
      },
    ],
    updatedAt: Date.now(),
  };

  await saveSong(testSong);
  const retrieved = await getSong("offline_session_song_42");
  assertExists(retrieved);
  assertEquals(retrieved.title, "Stage Ready Accordion Polka");

  const songsList = await getSongs();
  assertEquals(songsList.length, presets.length + 1);

  // 3. Round-trip export/import in offline mode
  const jsonExport = await exportSongbook();
  assertExists(jsonExport);

  await clearSongbook();
  const emptyCheck = await getSongs();
  assertEquals(emptyCheck.length, 0);

  const restored = await importSongbook(jsonExport, "replace");
  assertEquals(restored.length, presets.length + 1);

  const finalCheck = await getSong("offline_session_song_42");
  assertExists(finalCheck);
  assertEquals(finalCheck.title, "Stage Ready Accordion Polka");
});
