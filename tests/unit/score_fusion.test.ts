import { assertEquals, assertNotEquals } from "@std/assert";
import type { MelodyEvent, ScoreDocument, ScoreMeasure } from "../../src/types/score.ts";
import { rational, RATIONAL_ZERO } from "../../src/lib/score/rational.ts";
import { fuseScoreDocument, type OcrScoreData } from "../../src/lib/score/scoreFusion.ts";

function createMockScoreDoc(overrides: Partial<ScoreDocument> = {}): ScoreDocument {
  const m1: ScoreMeasure = {
    id: "m1",
    writtenIndex: 0,
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    melody: [
      {
        id: "m1-n1",
        offset: rational(0, 1),
        duration: rational(1, 1),
        pitch: { step: "C", alter: 0, octave: 4 },
        rest: false,
        confidence: 0.92,
      },
    ],
    harmonies: [
      {
        id: "m1-h1",
        offset: rational(0, 1),
        raw: "C",
        confidence: 0.88,
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
        pitch: { step: "D", alter: 0, octave: 4 },
        rest: false,
        confidence: 0.85,
      },
    ],
    harmonies: [
      {
        id: "m2-h1",
        offset: rational(0, 1),
        raw: "Dm",
        confidence: 0.65,
        provenance: "photo-omr",
      },
    ],
    navigation: [],
  };

  return {
    schemaVersion: 1,
    title: "Fusion Test Lead Sheet",
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

Deno.test("FUSION-01: Auto-accepts high-confidence chord agreement between OMR and OCR", () => {
  const doc = createMockScoreDoc();
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

Deno.test("FUSION-02: Preserves chord disagreement as separate issue evidence without blocking guidance", () => {
  const doc = createMockScoreDoc();
  const ocrData: OcrScoreData = {
    measures: [
      {
        measureIndex: 1, // measure m2 has OMR chord "Dm"
        chords: [{ raw: "D7", normalized: "D7", confidence: 0.88 }],
      },
    ],
  };

  const result = fuseScoreDocument(doc, ocrData);
  assertEquals(result.chordDisagreements, 1);

  const disagreementIssue = result.document.issues.find((i) => i.code === "chord_disagreement");
  assertNotEquals(disagreementIssue, undefined);
  assertEquals(disagreementIssue?.severity, "warning");
  assertEquals(disagreementIssue?.blocksGuidance, false);
  assertEquals(disagreementIssue?.measureId, "m2");

  // Verify conservative source-backed guidance was selected
  const m2Harmony = result.document.measures[1].harmonies[0];
  assertEquals(m2Harmony.raw, "D7"); // OCR had 0.88 vs OMR 0.65 (> 0.15 higher)
  assertEquals(m2Harmony.confidence, 0.75); // Capped due to disagreement
});

Deno.test("FUSION-03: Deterministically supplements 6/8 meter absent from JAZZMUS vocab", () => {
  const doc = createMockScoreDoc();
  assertEquals(doc.time, { beats: 4, beatType: 4 });

  const ocrData: OcrScoreData = {
    timeSignature: { beats: 6, beatType: 8 },
  };

  const result = fuseScoreDocument(doc, ocrData);
  assertEquals(result.document.time, { beats: 6, beatType: 8 });
  assertEquals(result.document.measures[0].time, { beats: 6, beatType: 8 });
  assertEquals(result.document.measures[1].time, { beats: 6, beatType: 8 });
});

Deno.test("FUSION-04: Deterministically supplements key signatures (0 to 6 sharps/flats)", () => {
  const doc = createMockScoreDoc();
  assertEquals(doc.key?.fifths, 0);

  // 3 sharps -> A major
  const ocrData: OcrScoreData = {
    keySignature: { fifths: 3, mode: "major" },
  };

  const result = fuseScoreDocument(doc, ocrData);
  assertEquals(result.document.key?.fifths, 3);
  assertEquals(result.document.measures[0].key?.fifths, 3);
  assertEquals(result.document.measures[1].key?.fifths, 3);
});

Deno.test("FUSION-05: Gating policy flags low melody confidence and hides speculative guidance", () => {
  const doc = createMockScoreDoc();
  // Set measure 1 melody notes to very low confidence (e.g. 0.25)
  const lowNote: MelodyEvent = {
    id: "m1-n1",
    offset: rational(0, 1),
    duration: rational(1, 1),
    pitch: { step: "E", alter: 0, octave: 4 },
    rest: false,
    confidence: 0.22,
  };
  doc.measures[0].melody = [lowNote];

  const result = fuseScoreDocument(doc);
  const lowMelodyIssue = result.document.issues.find((i) => i.code === "low_melody_confidence");
  assertNotEquals(lowMelodyIssue, undefined);
  assertEquals(lowMelodyIssue?.measureId, "m1");
  assertEquals(lowMelodyIssue?.blocksGuidance, false); // Actionable issue in review queue
  assertEquals(result.document.measures[0].confidence, 0.22);
});

Deno.test("FUSION-06: Detects structural navigation contradictions (D.S. without Segno, Coda without target)", () => {
  const doc = createMockScoreDoc();
  // Add Dal Segno mark without any matching Segno in score
  doc.measures[1].navigation = [{ kind: "ds", target: "segno" }];

  const result = fuseScoreDocument(doc);
  assertEquals(result.unresolvedContradictions, 1);

  const navIssue = result.document.issues.find((i) => i.code === "ambiguous_navigation");
  assertNotEquals(navIssue, undefined);
  assertEquals(navIssue?.blocksGuidance, false);
});

Deno.test("FUSION-07: Fuses section labels and preserves unfamiliar localized directions", () => {
  const doc = createMockScoreDoc();
  const ocrData: OcrScoreData = {
    sections: [
      { label: "Intro", startMeasureIndex: 0, endMeasureIndex: 0 },
      { label: "Chorus", startMeasureIndex: 1, endMeasureIndex: 1 },
    ],
    unrecognizedDirections: ["Langsam und zart"],
  };

  const result = fuseScoreDocument(doc, ocrData);
  assertEquals(result.document.sections.length, 2);
  assertEquals(result.document.sections[0].label, "Intro");
  assertEquals(result.document.sections[1].label, "Chorus");

  // Unfamiliar direction is preserved as text mark and flagged as info issue
  const dirIssue = result.document.issues.find((i) => i.code === "unfamiliar_direction");
  assertNotEquals(dirIssue, undefined);
  assertEquals(dirIssue?.severity, "info");
  assertEquals(dirIssue?.blocksGuidance, false);

  const m1TextNav = result.document.measures[0].navigation.find((n) => n.kind === "text");
  assertNotEquals(m1TextNav, undefined);
  if (m1TextNav && m1TextNav.kind === "text") {
    assertEquals(m1TextNav.text, "Langsam und zart");
  }
});
