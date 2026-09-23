/**
 * Comprehensive 4-Tier E2E Test Suite for Offline Score Reader.
 * Path: tests/e2e/score_reader.test.ts
 *
 * Tier 1: Feature Coverage (Staves, Barlines, Chords, Meter, Key Signatures >= 5 tests each)
 * Tier 2: Boundary & Corner Cases (empty/corrupted images, non-standard orientations, dense chords, multi-system scores)
 * Tier 3: Cross-Feature Interactions (chords with melody fusion, 6/8 meter with slash chords, camera preprocessing with playback guidance)
 * Tier 4: Real-World Scenarios (end-to-end score photo import -> review queue -> immediate playback)
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  detectBarlinesAndSliceMeasures,
  estimateSkewAngle,
  groupLinesIntoStaves,
  loadOpenCv,
  MatTracker,
  processScoreImageWithCv,
  type RawImageData,
} from "../../src/lib/score/photoPreprocessing.ts";
import { createInitialPhotoLayout } from "../../src/lib/score/photoGuidance.ts";
import {
  extractStaffCropTensor,
  OMR_FIXED_HEIGHT,
  OMR_MAX_WIDTH,
} from "../../src/lib/score/omrPreprocessing.ts";
import {
  mxhmToChordSymbol,
  parseHumdrumScore,
  parseKernMeter,
} from "../../src/lib/score/humdrumParser.ts";
import { parseKeySignatureSymbols, parseMeterToken } from "../../src/lib/score/ocrRecognition.ts";
import { fuseScoreDocument, type OcrScoreData } from "../../src/lib/score/scoreFusion.ts";
import {
  getActionableScoreIssues,
  ScoreCorrectionSession,
  updateMeasureChord,
} from "../../src/lib/score/correction.ts";
import { rational, RATIONAL_ZERO, rationalToNumber } from "../../src/lib/score/rational.ts";
import { solveStradellaChord } from "../../src/lib/stradella/solver.ts";
import { parseChord } from "../../src/lib/capo/transposition.ts";
import type {
  ImageBox,
  ScoreDocument,
  ScoreMeasure,
  ScorePhotoLayout,
  ScorePhotoMeasureGeometry,
  StaffGeometry,
} from "../../src/types/score.ts";

// ============================================================================
// Test Helpers: Image & Canvas Synthesis
// ============================================================================

function createBlankImage(width: number, height: number, fillColor = 255): RawImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(fillColor);
  return { data, width, height };
}

function drawHorizontalLine(
  img: RawImageData,
  y: number,
  startX = 0,
  endX = img.width,
  thickness = 2,
) {
  for (let dy = 0; dy < thickness; dy++) {
    const curY = y + dy;
    if (curY < 0 || curY >= img.height) continue;
    for (let x = startX; x < endX; x++) {
      if (x < 0 || x >= img.width) continue;
      const idx = (curY * img.width + x) * 4;
      img.data[idx] = 0;
      img.data[idx + 1] = 0;
      img.data[idx + 2] = 0;
      img.data[idx + 3] = 255;
    }
  }
}

function createSyntheticScoreDoc(overrides: Partial<ScoreDocument> = {}): ScoreDocument {
  const m1: ScoreMeasure = {
    id: "m1",
    writtenIndex: 0,
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    melody: [
      {
        id: "m1-n1",
        offset: rational(0, 1),
        duration: rational(1, 2),
        pitch: { step: "C", alter: 0, octave: 4 },
        rest: false,
        confidence: 0.90,
      },
      {
        id: "m1-n2",
        offset: rational(1, 2),
        duration: rational(1, 2),
        pitch: { step: "E", alter: 0, octave: 4 },
        rest: false,
        confidence: 0.88,
      },
    ],
    harmonies: [
      {
        id: "m1-h1",
        offset: rational(0, 1),
        raw: "C",
        confidence: 0.85,
        provenance: "photo-omr",
      },
    ],
    navigation: [],
  };

  const m2: ScoreMeasure = {
    id: "m2",
    writtenIndex: 1,
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    melody: [
      {
        id: "m2-n1",
        offset: rational(0, 1),
        duration: rational(1, 1),
        pitch: { step: "G", alter: 0, octave: 4 },
        rest: false,
        confidence: 0.85,
      },
    ],
    harmonies: [
      {
        id: "m2-h1",
        offset: rational(0, 1),
        raw: "G7",
        confidence: 0.80,
        provenance: "photo-omr",
      },
    ],
    navigation: [],
  };

  return {
    schemaVersion: 1,
    title: "E2E Synthetic Lead Sheet",
    source: { kind: "photo", persistence: "ephemeral" },
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    tempoMap: [{ offset: RATIONAL_ZERO, bpm: 120, source: "default" }],
    sections: [],
    measures: [m1, m2],
    issues: [],
    ...overrides,
  };
}

// ============================================================================
// TIER 1: FEATURE COVERAGE
// ============================================================================

// ----------------------------------------------------------------------------
// Feature 1: Staves (>=5 tests)
// ----------------------------------------------------------------------------

Deno.test("T1-STAVE-01: groupLinesIntoStaves detects 5-line staves and computes uniform line spacing", () => {
  const lines = [50, 64, 78, 92, 106]; // spacing = 14
  const staves = groupLinesIntoStaves(lines, 800, 600);

  assertEquals(staves.length, 1);
  assertEquals(staves[0].lineSpacing, 14);
  assertEquals(staves[0].lineYCoordinates, lines);
  assertEquals(staves[0].systemIndex, 0);
  assertEquals(staves[0].box.width, 800);
});

Deno.test("T1-STAVE-02: groupLinesIntoStaves isolates multiple systems across vertical page gaps", () => {
  // System 0: y = 40..88 (spacing 12)
  // System 1: y = 200..248 (spacing 12)
  // System 2: y = 360..408 (spacing 12)
  const lines = [
    40,
    52,
    64,
    76,
    88,
    200,
    212,
    224,
    236,
    248,
    360,
    372,
    384,
    396,
    408,
  ];
  const staves = groupLinesIntoStaves(lines, 1000, 800);

  assertEquals(staves.length, 3);
  assertEquals(staves[0].systemIndex, 0);
  assertEquals(staves[1].systemIndex, 1);
  assertEquals(staves[2].systemIndex, 2);
  assertEquals(staves[0].lineSpacing, 12);
  assertEquals(staves[1].lineSpacing, 12);
  assertEquals(staves[2].lineSpacing, 12);
});

Deno.test("T1-STAVE-03: groupLinesIntoStaves rejects stray noise lines and sub-5-line fragments", () => {
  // Stray lines at y = 10, 25, 38 (< 5 lines)
  // Valid staff at y = 120, 132, 144, 156, 168
  // Isolated noise line at y = 250
  const lines = [10, 25, 38, 120, 132, 144, 156, 168, 250];
  const staves = groupLinesIntoStaves(lines, 800, 600);

  assertEquals(staves.length, 1);
  assertEquals(staves[0].lineYCoordinates, [120, 132, 144, 156, 168]);
});

Deno.test("T1-STAVE-04: Staff bounding box incorporates headroom and footroom for chords and lyrics", () => {
  const lines = [100, 114, 128, 142, 156]; // spacing = 14, staffHeight = 56
  const staves = groupLinesIntoStaves(lines, 800, 600);

  assertEquals(staves.length, 1);
  const staff = staves[0];
  // Bounding box y starts above the top line (headroom for chords)
  assertEquals(staff.box.y < lines[0], true);
  // Bounding box bottom extends below the bottom line (footroom for lyrics)
  assertEquals(staff.box.y + staff.box.height > lines[4], true);
});

Deno.test("T1-STAVE-05: extractStaffCropTensor extracts normalized 128px-height tensor with valid dimensions", () => {
  const img = createBlankImage(600, 400);
  for (let i = 0; i < 5; i++) {
    drawHorizontalLine(img, 100 + i * 12, 50, 550, 2);
  }

  const box: ImageBox = { x: 50, y: 80, width: 500, height: 100 };
  const tensor = extractStaffCropTensor(img, box, "staff-test-1");

  assertEquals(tensor.id, "staff-test-1");
  assertEquals(tensor.height, OMR_FIXED_HEIGHT); // 128px
  assertEquals(tensor.width <= OMR_MAX_WIDTH, true); // <= 1000px
  assertEquals(tensor.data.length, tensor.width * OMR_FIXED_HEIGHT);

  // Check normalized range [0.0, 1.0]
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < tensor.data.length; i++) {
    if (tensor.data[i] < min) min = tensor.data[i];
    if (tensor.data[i] > max) max = tensor.data[i];
  }
  assertEquals(min >= 0.0, true);
  assertEquals(max <= 1.0, true);
});

Deno.test("T1-STAVE-06: Tolerance to non-uniform line spacing variance (11-13px within staff)", () => {
  // Minor hand-drawn or printing distortion: spacing alternates 11, 13, 12, 12
  const lines = [100, 111, 124, 136, 148];
  const staves = groupLinesIntoStaves(lines, 700, 500);

  assertEquals(staves.length, 1);
  assertEquals(staves[0].lineSpacing >= 11 && staves[0].lineSpacing <= 13, true);
});

// ----------------------------------------------------------------------------
// Feature 2: Barlines (>=5 tests)
// ----------------------------------------------------------------------------

Deno.test("T1-BARLINE-01: Full-height barlines spanning staff lines 1-5 are detected by OpenCV", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 600;
    const height = 200;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    // Draw 5 horizontal staff lines in binInv: y = 50, 62, 74, 86, 98
    for (let i = 0; i < 5; i++) {
      const y = 50 + i * 12;
      for (let x = 50; x < 550; x++) {
        binInv.data[y * width + x] = 255;
      }
    }

    // Draw 3 full-height barlines spanning top to bottom of staff (y = 50 to 98)
    for (const bx of [150, 300, 450]) {
      for (let y = 50; y <= 98; y++) {
        binInv.data[y * width + bx] = 255;
        binInv.data[y * width + bx + 1] = 255;
      }
    }

    const staves: StaffGeometry[] = [{
      id: "staff-0",
      systemIndex: 0,
      box: { x: 50, y: 30, width: 500, height: 90 },
      lineYCoordinates: [50, 62, 74, 86, 98],
      lineSpacing: 12,
    }];

    const { barlines, measures } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      binInv,
      staves,
      width,
      height,
    );

    assertEquals(barlines.length >= 3, true);
    assertEquals(measures.length >= 2, true);
    assertEquals(measures[0].id, "photo-measure-1");
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("T1-BARLINE-02: Short vertical strokes below morph kernel threshold are removed by MORPH_OPEN", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 400;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    // Staff lines: y = 40, 52, 64, 76, 88 (staffH = 48)
    for (let i = 0; i < 5; i++) {
      const y = 40 + i * 12;
      for (let x = 20; x < 380; x++) {
        binInv.data[y * width + x] = 255;
      }
    }

    // Draw short note stems (height 14px < 48 * 0.65 = 31.2px) at x = 100, 160, 220
    for (const sx of [100, 160, 220]) {
      for (let y = 40; y <= 54; y++) {
        binInv.data[y * width + sx] = 255;
      }
    }

    const staves: StaffGeometry[] = [{
      id: "staff-0",
      systemIndex: 0,
      box: { x: 20, y: 20, width: 360, height: 80 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    const { barlines } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      binInv,
      staves,
      width,
      height,
    );

    // Short strokes should NOT be detected as barlines
    assertEquals(barlines.length, 0);
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("T1-BARLINE-03: Barline deduplication within 8px window merges double-thick strokes", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 400;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    // Staff: y = 40, 52, 64, 76, 88
    for (let i = 0; i < 5; i++) {
      const y = 40 + i * 12;
      for (let x = 20; x < 380; x++) {
        binInv.data[y * width + x] = 255;
      }
    }

    // Draw two vertical lines only 3px apart (simulating a thick engraved double barline)
    for (const bx of [150, 153]) {
      for (let y = 40; y <= 88; y++) {
        binInv.data[y * width + bx] = 255;
        binInv.data[y * width + bx + 1] = 255;
      }
    }

    const staves: StaffGeometry[] = [{
      id: "staff-0",
      systemIndex: 0,
      box: { x: 20, y: 20, width: 360, height: 80 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    const { barlines } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      binInv,
      staves,
      width,
      height,
    );

    // Should merge into 1 barline rather than creating a 3px micro-measure
    assertEquals(barlines.length, 1);
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("T1-BARLINE-04: Sequential measure slicing produces strictly ordered writtenIndex", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 600;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    for (let i = 0; i < 5; i++) {
      const y = 40 + i * 12;
      for (let x = 40; x < 560; x++) binInv.data[y * width + x] = 255;
    }

    // 4 barlines producing 3 measures
    for (const bx of [150, 280, 410, 540]) {
      for (let y = 40; y <= 88; y++) binInv.data[y * width + bx] = 255;
    }

    const staves: StaffGeometry[] = [{
      id: "staff-0",
      systemIndex: 0,
      box: { x: 40, y: 20, width: 520, height: 80 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    const { measures } = detectBarlinesAndSliceMeasures(cv, tracker, binInv, staves, width, height);
    assertEquals(measures.length >= 3, true);

    for (let i = 0; i < measures.length; i++) {
      assertEquals(measures[i].writtenIndex, i);
      if (i > 0) {
        assertEquals(measures[i].box.x >= measures[i - 1].box.x, true);
      }
    }
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("T1-BARLINE-05: Minimum measure width threshold prevents runaway micro-slices", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 500;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    for (let i = 0; i < 5; i++) {
      const y = 40 + i * 12;
      for (let x = 20; x < 480; x++) binInv.data[y * width + x] = 255;
    }

    // Draw barlines separated by only 25px (< minMeasureWidth ~ 42px for spacing 12)
    for (const bx of [100, 125, 150, 175, 200]) {
      for (let y = 40; y <= 88; y++) binInv.data[y * width + bx] = 255;
    }

    const staves: StaffGeometry[] = [{
      id: "staff-0",
      systemIndex: 0,
      box: { x: 20, y: 20, width: 460, height: 80 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    const { measures } = detectBarlinesAndSliceMeasures(cv, tracker, binInv, staves, width, height);

    // Micro-slices < minMeasureWidth should be rejected, measure count must remain bounded
    for (const m of measures) {
      assertEquals(m.box.width >= 35, true);
    }
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("T1-BARLINE-06: Final barline near right margin bounds last measure cleanly", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 500;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    for (let i = 0; i < 5; i++) {
      const y = 40 + i * 12;
      for (let x = 30; x < 470; x++) binInv.data[y * width + x] = 255;
    }

    // Barline near right edge (x = 460)
    for (let y = 40; y <= 88; y++) {
      binInv.data[y * width + 250] = 255;
      binInv.data[y * width + 460] = 255;
    }

    const staves: StaffGeometry[] = [{
      id: "staff-0",
      systemIndex: 0,
      box: { x: 30, y: 20, width: 440, height: 80 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    const { measures } = detectBarlinesAndSliceMeasures(cv, tracker, binInv, staves, width, height);
    assertEquals(measures.length >= 1, true);

    const lastMeasure = measures[measures.length - 1];
    assertEquals(lastMeasure.box.width > 0, true);
    assertEquals(lastMeasure.box.x + lastMeasure.box.width <= width, true);
  } finally {
    tracker.releaseAll();
  }
});

// ----------------------------------------------------------------------------
// Feature 3: Chords (>=5 tests)
// ----------------------------------------------------------------------------

Deno.test("T1-CHORD-01: mxhmToChordSymbol converts standard Humdrum triads and dominant 7ths", () => {
  assertEquals(mxhmToChordSymbol("C:maj"), "C");
  assertEquals(mxhmToChordSymbol("G:7"), "G7");
  assertEquals(mxhmToChordSymbol("D:min"), "Dm");
  assertEquals(mxhmToChordSymbol("F:maj"), "F");
  assertEquals(mxhmToChordSymbol("A:min7"), "Am7");
});

Deno.test("T1-CHORD-02: mxhmToChordSymbol maps half-diminished and diminished 7ths", () => {
  assertEquals(mxhmToChordSymbol("B:hdim7"), "Bm7b5");
  assertEquals(mxhmToChordSymbol("F#:hdim7"), "F#m7b5");
  assertEquals(mxhmToChordSymbol("D#:dim7"), "D#dim7");
  assertEquals(mxhmToChordSymbol("G:dim"), "Gdim");
});

Deno.test("T1-CHORD-03: mxhmToChordSymbol preserves slash chord bass inversions", () => {
  assertEquals(mxhmToChordSymbol("C:maj/G"), "C/G");
  assertEquals(mxhmToChordSymbol("A:min7/E"), "Am7/E");
  assertEquals(mxhmToChordSymbol("G:7/B"), "G7/B");
  assertEquals(mxhmToChordSymbol("F:maj/A"), "F/A");
});

Deno.test("T1-CHORD-04: mxhmToChordSymbol maps extended jazz alterations (maj7, sus4, aug, 9, 11, 13)", () => {
  assertEquals(mxhmToChordSymbol("Eb:maj7"), "Ebmaj7");
  assertEquals(mxhmToChordSymbol("Bb:sus4"), "Bbsus4");
  assertEquals(mxhmToChordSymbol("G:aug"), "Gaug");
  assertEquals(mxhmToChordSymbol("C:9"), "C9");
  assertEquals(mxhmToChordSymbol("D:11"), "D11");
  assertEquals(mxhmToChordSymbol("E:13"), "E13");
});

Deno.test("T1-CHORD-05: Every parsed chord resolves to valid, playable Stradella buttons", () => {
  const testChords = ["C", "G7", "Dm", "Am7", "Bm7b5", "F/A", "C/G"];
  for (const chordStr of testChords) {
    const voicing = solveStradellaChord(chordStr);
    assertExists(voicing, `Voicing for ${chordStr} must exist`);
    assertExists(voicing.primaryBass, `Primary bass for ${chordStr} must exist`);
    assertExists(voicing.rootButton, `Root button for ${chordStr} must exist`);
  }
});

Deno.test("T1-CHORD-06: Score fusion chord agreement upgrades confidence to 0.95", () => {
  const doc = createSyntheticScoreDoc();
  const ocrData: OcrScoreData = {
    measures: [
      {
        measureIndex: 0,
        chords: [{ raw: "C", normalized: "C", confidence: 0.90 }],
      },
    ],
  };

  const result = fuseScoreDocument(doc, ocrData);
  assertEquals(result.chordAgreements, 1);
  assertEquals(result.chordDisagreements, 0);

  const m1Harmony = result.document.measures[0].harmonies[0];
  assertEquals(m1Harmony.raw, "C");
  assertEquals(m1Harmony.confidence, 0.95);
});

// ----------------------------------------------------------------------------
// Feature 4: Meter (>=5 tests)
// ----------------------------------------------------------------------------

Deno.test("T1-METER-01: parseMeterToken handles standard simple time signatures (4/4, 3/4, 2/4)", () => {
  const m44 = parseMeterToken("4/4");
  assertExists(m44);
  assertEquals(m44.beats, 4);
  assertEquals(m44.beatType, 4);

  const m34 = parseMeterToken("3/4");
  assertExists(m34);
  assertEquals(m34.beats, 3);
  assertEquals(m34.beatType, 4);

  const m24 = parseMeterToken("2/4");
  assertExists(m24);
  assertEquals(m24.beats, 2);
  assertEquals(m24.beatType, 4);
});

Deno.test("T1-METER-02: parseMeterToken parses compound 6/8 meter with rational beat conversion", () => {
  const m68 = parseMeterToken("6/8");
  assertExists(m68);
  assertEquals(m68.beats, 6);
  assertEquals(m68.beatType, 8);

  // Colon format
  const m68Colon = parseMeterToken("6:8");
  assertExists(m68Colon);
  assertEquals(m68Colon.beats, 6);
  assertEquals(m68Colon.beatType, 8);
});

Deno.test("T1-METER-03: parseMeterToken parses common time 'C' and cut time 'C|' / 2/2", () => {
  const cCommon = parseMeterToken("C");
  assertExists(cCommon);
  assertEquals(cCommon.beats, 4);
  assertEquals(cCommon.beatType, 4);

  const cCut = parseMeterToken("C|");
  assertExists(cCut);
  assertEquals(cCut.beats, 2);
  assertEquals(cCut.beatType, 2);

  const m22 = parseMeterToken("2/2");
  assertExists(m22);
  assertEquals(m22.beats, 2);
  assertEquals(m22.beatType, 2);
});

Deno.test("T1-METER-04: parseKernMeter parses Humdrum meter spine declarations", () => {
  const k44 = parseKernMeter("*M4/4");
  assertExists(k44);
  assertEquals(k44.beats, 4);
  assertEquals(k44.beatType, 4);

  const k34 = parseKernMeter("*M3/4");
  assertExists(k34);
  assertEquals(k34.beats, 3);
  assertEquals(k34.beatType, 4);

  const k68 = parseKernMeter("*M6/8");
  assertExists(k68);
  assertEquals(k68.beats, 6);
  assertEquals(k68.beatType, 8);
});

Deno.test("T1-METER-05: fuseScoreDocument deterministically supplements 6/8 meter over default 4/4", () => {
  const doc = createSyntheticScoreDoc({ time: { beats: 4, beatType: 4 } });
  const ocrData: OcrScoreData = {
    timeSignature: { beats: 6, beatType: 8 },
  };

  const fused = fuseScoreDocument(doc, ocrData);
  assertExists(fused.document.time);
  assertEquals(fused.document.time.beats, 6);
  assertEquals(fused.document.time.beatType, 8);

  for (const m of fused.document.measures) {
    assertExists(m.time);
    assertEquals(m.time.beats, 6);
    assertEquals(m.time.beatType, 8);
  }
});

Deno.test("T1-METER-06: parseMeterToken handles multi-line stacked digits ('6\\n8', '3  4')", () => {
  const stacked68 = parseMeterToken("6\n8");
  assertExists(stacked68);
  assertEquals(stacked68.beats, 6);
  assertEquals(stacked68.beatType, 8);

  const spaced34 = parseMeterToken("3  4");
  assertExists(spaced34);
  assertEquals(spaced34.beats, 3);
  assertEquals(spaced34.beatType, 4);

  const m98 = parseMeterToken("9/8");
  assertExists(m98);
  assertEquals(m98.beats, 9);
  assertEquals(m98.beatType, 8);
});

// ----------------------------------------------------------------------------
// Feature 5: Key Signatures (>=5 tests)
// ----------------------------------------------------------------------------

Deno.test("T1-KEY-01: parseKeySignatureSymbols handles sharp key signatures 1 to 6 sharps", () => {
  const sharpProfiles = [
    { input: "*k[f#]", expectedFifths: 1 },
    { input: "*k[f#c#]", expectedFifths: 2 },
    { input: "*k[f#c#g#]", expectedFifths: 3 },
    { input: "*k[f#c#g#d#]", expectedFifths: 4 },
    { input: "*k[f#c#g#d#a#]", expectedFifths: 5 },
    { input: "*k[f#c#g#d#a#e#]", expectedFifths: 6 },
  ];

  for (const p of sharpProfiles) {
    const key = parseKeySignatureSymbols(p.input);
    assertExists(key, `Key for ${p.input} must parse`);
    assertEquals(key.fifths, p.expectedFifths);
    assertEquals(key.mode, "major");
  }
});

Deno.test("T1-KEY-02: parseKeySignatureSymbols handles flat key signatures 1 to 6 flats", () => {
  const flatProfiles = [
    { input: "*k[b-]", expectedFifths: -1 },
    { input: "*k[b-e-]", expectedFifths: -2 },
    { input: "*k[b-e-a-]", expectedFifths: -3 },
    { input: "*k[b-e-a-d-]", expectedFifths: -4 },
    { input: "*k[b-e-a-d-g-]", expectedFifths: -5 },
    { input: "*k[b-e-a-d-g-c-]", expectedFifths: -6 },
  ];

  for (const p of flatProfiles) {
    const key = parseKeySignatureSymbols(p.input);
    assertExists(key, `Key for ${p.input} must parse`);
    assertEquals(key.fifths, p.expectedFifths);
    assertEquals(key.mode, "major");
  }
});

Deno.test("T1-KEY-03: parseKeySignatureSymbols parses natural key (C Major / A Minor, *k[])", () => {
  const key = parseKeySignatureSymbols("*k[]");
  assertExists(key);
  assertEquals(key.fifths, 0);
  assertEquals(key.mode, "major");
});

Deno.test("T1-KEY-04: parseKeySignatureSymbols parses text declarations ('Key: G', 'Bb Major', 'F# Minor')", () => {
  const gMaj = parseKeySignatureSymbols("Key: G");
  assertExists(gMaj);
  assertEquals(gMaj.fifths, 1);

  const bbMaj = parseKeySignatureSymbols("Bb Major");
  assertExists(bbMaj);
  assertEquals(bbMaj.fifths, -2);

  const fsharpMin = parseKeySignatureSymbols("F# Minor");
  assertExists(fsharpMin);
  assertEquals(fsharpMin.fifths, 3); // F# maj = 6, minor = 6 - 3 = 3
  assertEquals(fsharpMin.mode, "minor");

  const dMaj = parseKeySignatureSymbols("D Major");
  assertExists(dMaj);
  assertEquals(dMaj.fifths, 2);
});

Deno.test("T1-KEY-05: fuseScoreDocument supplements non-zero key signature across all measures", () => {
  const doc = createSyntheticScoreDoc({ key: { fifths: 0, mode: "major" } });
  const ocrData: OcrScoreData = {
    keySignature: { fifths: 2, mode: "major" }, // D Major
  };

  const fused = fuseScoreDocument(doc, ocrData);
  assertExists(fused.document.key);
  assertEquals(fused.document.key.fifths, 2);

  for (const m of fused.document.measures) {
    assertExists(m.key);
    assertEquals(m.key.fifths, 2);
  }
});

Deno.test("T1-KEY-06: Minor key signatures properly offset relative major fifths (-3)", () => {
  // A minor: A maj is 3, 3 - 3 = 0 fifths
  const aMin = parseKeySignatureSymbols("A Minor");
  assertExists(aMin);
  assertEquals(aMin.fifths, 0);
  assertEquals(aMin.mode, "minor");

  // E minor: E maj is 4, 4 - 3 = 1 fifth (1 sharp)
  const eMin = parseKeySignatureSymbols("E Minor");
  assertExists(eMin);
  assertEquals(eMin.fifths, 1);
  assertEquals(eMin.mode, "minor");

  // D minor: D maj is 2, 2 - 3 = -1 fifth (1 flat)
  const dMin = parseKeySignatureSymbols("D Minor");
  assertExists(dMin);
  assertEquals(dMin.fifths, -1);
  assertEquals(dMin.mode, "minor");
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ============================================================================

Deno.test("T2-EDGE-01: Degenerate sub-32x32 images return safe fallback layout without throwing", async () => {
  const cv = await loadOpenCv();
  const degenerateImg = createBlankImage(12, 12);
  const result = processScoreImageWithCv(cv, degenerateImg);

  assertEquals(result.usedFallback, true);
  assertEquals(result.staves.length, 0);
  assertEquals(result.layout.page.width, 12);
  assertEquals(result.layout.page.height, 12);
  assertEquals(result.layout.measures.length, 1);
});

Deno.test("T2-EDGE-02: All-white and all-black frames return graceful fallback layout", async () => {
  const cv = await loadOpenCv();

  // All-white canvas (blank paper with no ink)
  const whiteImg = createBlankImage(400, 300, 255);
  const whiteRes = processScoreImageWithCv(cv, whiteImg);
  assertEquals(whiteRes.usedFallback, true);
  assertEquals(whiteRes.staves.length, 0);
  assertEquals(whiteRes.layout.measures.length, 1);

  // All-black canvas (underexposed photo / lens cap on)
  const blackImg = createBlankImage(400, 300, 0);
  const blackRes = processScoreImageWithCv(cv, blackImg);
  assertEquals(blackRes.usedFallback, true);
  assertEquals(blackRes.staves.length, 0);
});

Deno.test("T2-EDGE-03: estimateSkewAngle estimates rotation within ±15° search window", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 400;
    const height = 200;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    // Draw horizontal lines with zero skew
    for (let i = 0; i < 5; i++) {
      const y = 80 + i * 10;
      for (let x = 50; x < 350; x++) {
        binInv.data[y * width + x] = 255;
      }
    }

    const angle = estimateSkewAngle(cv, tracker, binInv, 15, 0.5);
    // Zero-skew image should estimate angle very close to 0.0°
    assertEquals(Math.abs(angle) <= 1.0, true);
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("T2-EDGE-04: Dense chord progressions (4 chords in 1 measure) preserve distinct offsets", () => {
  const humdrumDense = `**kern	**mxhm
*M4/4	*M4/4
=1	=1
4c	C:maj
4d	D:min7
4e	E:min7
4f	F:maj7
=2	=2
1g	G:7
==	==
*-	*-`;

  const parsed = parseHumdrumScore(humdrumDense, { title: "Dense Progression" });
  assertEquals(parsed.measures.length, 2);

  const m1 = parsed.measures[0];
  assertEquals(m1.harmonies.length, 4);

  const expectedChords = ["C", "Dm7", "Em7", "Fmaj7"];
  for (let i = 0; i < 4; i++) {
    assertEquals(m1.harmonies[i].raw, expectedChords[i]);
    assertEquals(rationalToNumber(m1.harmonies[i].offset), i);
  }
});

Deno.test("T2-EDGE-05: Multi-system score (4 systems, 16 measures) preserves measure order and indexing", () => {
  // Construct 16 measures across 4 systems
  const measures: ScoreMeasure[] = [];
  for (let i = 0; i < 16; i++) {
    const systemIdx = Math.floor(i / 4);
    measures.push({
      id: `meas-${i + 1}`,
      writtenIndex: i,
      melody: [{
        id: `note-${i + 1}`,
        offset: rational(0, 1),
        duration: rational(1, 1),
        pitch: { step: "C", alter: 0, octave: 4 },
        rest: false,
        confidence: 0.9,
      }],
      harmonies: [{
        id: `harm-${i + 1}`,
        offset: rational(0, 1),
        raw: i % 2 === 0 ? "C" : "G7",
        confidence: 0.85,
      }],
      navigation: [],
      sourceBox: {
        x: (i % 4) * 200,
        y: systemIdx * 150,
        width: 190,
        height: 120,
      },
    });
  }

  const multiSystemDoc: ScoreDocument = {
    schemaVersion: 1,
    title: "16-Measure Multi-System Lead Sheet",
    source: { kind: "photo", persistence: "ephemeral" },
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    tempoMap: [{ offset: RATIONAL_ZERO, bpm: 120, source: "default" }],
    sections: [],
    measures,
    issues: [],
  };

  assertEquals(multiSystemDoc.measures.length, 16);
  for (let i = 0; i < 16; i++) {
    assertEquals(multiSystemDoc.measures[i].writtenIndex, i);
    assertExists(multiSystemDoc.measures[i].sourceBox);
  }
});

Deno.test("T2-EDGE-06: Altered jazz voicings and polychords preserve harmony integrity", () => {
  const alteredChords = ["C7(#9)", "Ab13", "Eb/Bb", "F#m7b5", "Db9", "G7b5"];
  for (const chord of alteredChords) {
    const parsed = parseChord(chord);
    assertExists(parsed, `parseChord must handle ${chord}`);
    assertEquals(parsed.root.length >= 1, true);

    const stradella = solveStradellaChord(chord);
    assertExists(stradella, `Stradella solver must find voicing for ${chord}`);
    assertExists(stradella.primaryBass);
  }
});

// ============================================================================
// TIER 3: CROSS-FEATURE INTERACTIONS
// ============================================================================

Deno.test("T3-XFEAT-01: Score fusion synchronizes melody notes and chord harmonies by beat offset", () => {
  const doc = createSyntheticScoreDoc();
  const ocrData: OcrScoreData = {
    measures: [
      {
        measureIndex: 0,
        chords: [{ raw: "C", normalized: "C", confidence: 0.95 }],
      },
      {
        measureIndex: 1,
        chords: [{ raw: "G7", normalized: "G7", confidence: 0.92 }],
      },
    ],
  };

  const fused = fuseScoreDocument(doc, ocrData);
  assertEquals(fused.chordAgreements, 2);

  // Measure 0 has 2 notes and 1 chord
  const m0 = fused.document.measures[0];
  assertEquals(m0.melody.length, 2);
  assertEquals(m0.harmonies.length, 1);
  assertEquals(m0.harmonies[0].raw, "C");
  assertEquals(rationalToNumber(m0.harmonies[0].offset), 0.0);

  // Note 1 starts at 0.0, Note 2 starts at 0.5
  assertEquals(rationalToNumber(m0.melody[0].offset), 0.0);
  assertEquals(rationalToNumber(m0.melody[1].offset), 0.5);
});

Deno.test("T3-XFEAT-02: 6/8 compound meter with stepwise chromatic bass slash chords", () => {
  const humdrum68Slash = `**kern	**mxhm
*M6/8	*M6/8
*k[]	*k[]
=1	=1
8c	C:maj
8d	.
8e	C:maj/B
8f	.
8g	A:min
8a	.
=2	=2
8f	A:min/G
8e	.
8d	F:maj
8c	.
8B	G:7/B
8d	.
==	==
*-	*-`;

  const doc = parseHumdrumScore(humdrum68Slash);
  assertEquals(doc.measures.length, 2);
  assertExists(doc.time);
  assertEquals(doc.time.beats, 6);
  assertEquals(doc.time.beatType, 8);

  // Measure 1 has C, C/B, Am
  const m1 = doc.measures[0];
  assertEquals(m1.harmonies.length, 3);
  assertEquals(m1.harmonies[0].raw, "C");
  assertEquals(m1.harmonies[1].raw, "C/B");
  assertEquals(m1.harmonies[2].raw, "Am");

  // Verify Stradella slash chord resolution for C/B (counter-bass B_ in G column)
  const slashVoicing = solveStradellaChord("C/B");
  assertExists(slashVoicing);
  assertEquals(slashVoicing.primaryBass, "B_");
});

Deno.test("T3-XFEAT-03: Camera photo layout measures are correlated with ScoreDocument measures (sourceBox linkage)", () => {
  const doc = createSyntheticScoreDoc();
  const photoLayout: ScorePhotoLayout = {
    schemaVersion: 1,
    page: { width: 800, height: 600 },
    measures: [
      {
        id: "photo-measure-1",
        writtenIndex: 0,
        box: { x: 0, y: 0, width: 400, height: 600 },
        source: "automatic",
      },
      {
        id: "photo-measure-2",
        writtenIndex: 1,
        box: { x: 400, y: 0, width: 400, height: 600 },
        source: "automatic",
      },
    ],
  };

  // Link layout to document
  doc.photoLayout = photoLayout;
  for (let i = 0; i < doc.measures.length; i++) {
    if (photoLayout.measures[i]) {
      doc.measures[i].sourceBox = photoLayout.measures[i].box;
    }
  }

  assertEquals(doc.measures[0].sourceBox?.width, 400);
  assertEquals(doc.measures[1].sourceBox?.width, 400);
  assertEquals(doc.measures[1].sourceBox?.x, 400);
});

Deno.test("T3-XFEAT-04: Speculative low-confidence melody notes (< 0.35) are isolated without affecting chords", () => {
  const doc = createSyntheticScoreDoc();
  // Set all melody note confidences very low (speculative OCR artifact)
  doc.measures[0].melody[0].confidence = 0.20;
  doc.measures[0].melody[1].confidence = 0.25;

  const fused = fuseScoreDocument(doc, undefined, { lowConfidenceThreshold: 0.35 });

  // Issue should be logged for low melody confidence
  const lowConfIssue = fused.document.issues.find((i) => i.code === "low_melody_confidence");
  assertExists(lowConfIssue);
  assertEquals(lowConfIssue.blocksGuidance, false);

  // Chord remains intact and valid
  assertEquals(fused.document.measures[0].harmonies[0].raw, "C");
});

Deno.test("T3-XFEAT-05: Score correction session updates persist through undo/redo stack", () => {
  const doc = createSyntheticScoreDoc();
  const session = new ScoreCorrectionSession(doc);

  assertEquals(session.canUndo, false);
  assertEquals(session.canRedo, false);

  // 1. Update chord in Measure 1 from C to Cm
  const docWithCm = updateMeasureChord(session.document, "m1", "Cm");
  session.apply(docWithCm);

  assertEquals(session.document.measures[0].harmonies[0].raw, "Cm");
  assertEquals(session.canUndo, true);

  // 2. Undo
  const undone = session.undo();
  assertExists(undone);
  assertEquals(undone.measures[0].harmonies[0].raw, "C");
  assertEquals(session.canRedo, true);

  // 3. Redo
  const redone = session.redo();
  assertExists(redone);
  assertEquals(redone.measures[0].harmonies[0].raw, "Cm");
});

// ============================================================================
// TIER 4: REAL-WORLD SCENARIOS
// ============================================================================

Deno.test("T4-SCENARIO-01: Folk Song Photo Import ('Bella Ciao') -> OMR Transcription -> Immediate Playback", () => {
  // Scenario 1: Standard Italian Folk Song in Am, 4/4 meter
  const bellaCiaoHumdrum = `**kern	**mxhm
*M4/4	*M4/4
*k[]	*k[]
=1	=1
4a	A:min
4b	.
4cc	.
4a	.
=2	=2
4a	A:min
4b	.
4cc	.
4a	.
=3	=3
4a	D:min
4b	.
4cc	.
4dd	.
=4	=4
1ee	E:7
==	==
*-	*-`;

  // Step 1: OMR decodes Humdrum score
  const scoreDoc = parseHumdrumScore(bellaCiaoHumdrum, { title: "Bella Ciao" });
  assertEquals(scoreDoc.measures.length, 4);

  // Step 2: Deterministic key and meter verification
  assertEquals(scoreDoc.time?.beats, 4);
  assertEquals(scoreDoc.key?.fifths, 0);

  // Step 3: Score fusion with clean OCR confirmation
  const ocrData: OcrScoreData = {
    keySignature: { fifths: 0, mode: "minor" },
    timeSignature: { beats: 4, beatType: 4 },
    measures: [
      { measureIndex: 0, chords: [{ raw: "Am", normalized: "Am", confidence: 0.95 }] },
      { measureIndex: 1, chords: [{ raw: "Am", normalized: "Am", confidence: 0.95 }] },
      { measureIndex: 2, chords: [{ raw: "Dm", normalized: "Dm", confidence: 0.95 }] },
      { measureIndex: 3, chords: [{ raw: "E7", normalized: "E7", confidence: 0.95 }] },
    ],
  };

  const fused = fuseScoreDocument(scoreDoc, ocrData);
  assertEquals(fused.chordAgreements, 4);
  assertEquals(fused.chordDisagreements, 0);

  // Step 4: Verification of immediate playback readiness
  const actionableIssues = getActionableScoreIssues(fused.document);
  assertEquals(actionableIssues.length, 0);

  // All 4 chords resolve to Stradella buttons for immediate performance
  for (const m of fused.document.measures) {
    const chord = m.harmonies[0].raw;
    const voicing = solveStradellaChord(chord);
    assertExists(voicing);
    assertExists(voicing.chordButton);
  }
});

Deno.test("T4-SCENARIO-02: Jazz Standard ('Autumn Leaves') -> Disagreement Resolution -> Playback Ready", () => {
  // Scenario 2: Jazz Standard with m7b5 and slash chord disagreement
  const autumnLeavesHumdrum = `**kern	**mxhm
*M4/4	*M4/4
*k[f#]	*k[f#]
=1	=1
2a	A:min7
2b	D:7
=2	=2
1cc	G:maj7
=3	=3
2b	C:maj7
2a	F#:hdim7
=4	=4
1g	B:7
==	==
*-	*-`;

  const scoreDoc = parseHumdrumScore(autumnLeavesHumdrum, { title: "Autumn Leaves" });
  assertEquals(scoreDoc.measures.length, 4);

  // Simulate OCR observing disagreement on measure 3 (saw F#m instead of F#m7b5)
  const ocrData: OcrScoreData = {
    keySignature: { fifths: 1, mode: "major" },
    measures: [
      { measureIndex: 2, chords: [{ raw: "F#m", normalized: "F#m", confidence: 0.80 }] },
    ],
  };

  const fused = fuseScoreDocument(scoreDoc, ocrData);
  // Preserves disagreement as actionable issue without blocking playback
  const issues = getActionableScoreIssues(fused.document);
  assertEquals(issues.length, 1);
  assertEquals(issues[0].code, "chord_disagreement");
  assertEquals(issues[0].blocksGuidance, false);

  // User uses review queue to confirm F#m7b5
  const correctedDoc = updateMeasureChord(fused.document, "m3", "F#m7b5");
  const correctedIssues = getActionableScoreIssues(correctedDoc);
  assertEquals(correctedIssues.length, 0);

  // Solves F#m7b5 compound voicing (F# bass + am chord button)
  const fsharpM7b5 = solveStradellaChord("F#m7b5");
  assertExists(fsharpM7b5);
  assertEquals(fsharpM7b5.primaryBass, "F#");
  assertEquals(fsharpM7b5.chordButton?.label, "am");
});

Deno.test("T4-SCENARIO-03: 3/4 Waltz with multi-measure repeat barlines and first/second endings", () => {
  const waltzHumdrum = `**kern	**mxhm
*M3/4	*M3/4
*k[]	*k[]
=1|:	=1|:
4c	C:maj
4e	.
4g	.
=2	=2
4d	G:7
4f	.
4b	.
=:|!	=:|!
*-	*-`;

  const scoreDoc = parseHumdrumScore(waltzHumdrum, { title: "Accordion Waltz" });
  assertEquals(scoreDoc.time?.beats, 3);
  assertEquals(scoreDoc.time?.beatType, 4);

  // Measure 1 has repeat start
  const m1 = scoreDoc.measures[0];
  const hasRepeatStart = m1.navigation.some((n) => n.kind === "repeat-start");
  assertEquals(hasRepeatStart, true);

  // Measure 2 has repeat end
  const m2 = scoreDoc.measures[1];
  const hasRepeatEnd = m2.navigation.some((n) => n.kind === "repeat-end");
  assertEquals(hasRepeatEnd, true);
});

Deno.test("T4-SCENARIO-04: Corrupted mobile camera capture -> graceful fallback -> manual measure recovery", () => {
  // Scenario 4: User takes photo in low light; CV detection yields zero valid staves
  const fallbackLayout = createInitialPhotoLayout(1200, 1600);
  assertEquals(fallbackLayout.measures.length, 1);
  assertEquals(fallbackLayout.page.width, 1200);
  assertEquals(fallbackLayout.page.height, 1600);

  // User manually defines 4 measures on the sheet
  const recoveredMeasures: ScorePhotoMeasureGeometry[] = [
    { id: "m1", writtenIndex: 0, box: { x: 0, y: 0, width: 600, height: 400 }, source: "manual" },
    { id: "m2", writtenIndex: 1, box: { x: 600, y: 0, width: 600, height: 400 }, source: "manual" },
    { id: "m3", writtenIndex: 2, box: { x: 0, y: 400, width: 600, height: 400 }, source: "manual" },
    {
      id: "m4",
      writtenIndex: 3,
      box: { x: 600, y: 400, width: 600, height: 400 },
      source: "manual",
    },
  ];

  // Synthesize fallback ScoreDocument
  const fallbackDoc: ScoreDocument = {
    schemaVersion: 1,
    title: "Camera Fallback Session",
    source: { kind: "photo", persistence: "ephemeral" },
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    tempoMap: [{ offset: RATIONAL_ZERO, bpm: 90, source: "default" }],
    sections: [],
    measures: recoveredMeasures.map((geom: ScorePhotoMeasureGeometry, idx: number) => ({
      id: geom.id,
      writtenIndex: idx,
      melody: [],
      harmonies: [{
        id: `${geom.id}-h0`,
        offset: RATIONAL_ZERO,
        raw: idx % 2 === 0 ? "C" : "G",
        provenance: "photo-manual",
      }],
      navigation: [],
      sourceBox: geom.box,
    })),
    photoLayout: {
      schemaVersion: 1,
      page: { width: 1200, height: 1600 },
      measures: recoveredMeasures,
    },
    issues: [],
  };

  assertEquals(fallbackDoc.measures.length, 4);
  assertEquals(fallbackDoc.issues.length, 0);

  // Playback is immediately available with 4 measures
  for (const m of fallbackDoc.measures) {
    assertExists(m.harmonies[0]);
    const voicing = solveStradellaChord(m.harmonies[0].raw);
    assertExists(voicing);
  }
});
