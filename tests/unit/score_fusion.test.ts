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

Deno.test("FUSION-08: Measures 4+ in multi-staff scores receive proper chords without measure-vs-staff index distortion", () => {
  // Construct an 8-measure score (2 staves, 4 measures each)
  const doc = createMockScoreDoc();
  // Add measures 2 through 7
  for (let i = 2; i < 8; i++) {
    doc.measures.push({
      id: `m${i + 1}`,
      writtenIndex: i,
      time: { beats: 4, beatType: 4 },
      key: { fifths: 0, mode: "major" },
      melody: [
        {
          id: `m${i + 1}-n1`,
          offset: rational(0, 1),
          duration: rational(1, 1),
          pitch: { step: "C", alter: 0, octave: 4 },
          rest: false,
          confidence: 0.90,
        },
      ],
      harmonies: [
        {
          id: `m${i + 1}-h1`,
          offset: rational(0, 1),
          raw: i === 4 ? "G" : (i === 5 ? "Am" : "C"),
          confidence: 0.85,
          provenance: "photo-omr",
        },
      ],
      navigation: [],
    });
  }

  // Provide OCR data with chords properly indexed at measures 4 and 5 (Staff 1)
  const ocrData: OcrScoreData = {
    measures: [
      {
        measureIndex: 4, // Measure 4 on Staff 1
        chords: [{ raw: "G", normalized: "G", confidence: 0.92 }],
      },
      {
        measureIndex: 5, // Measure 5 on Staff 1
        chords: [{ raw: "Am", normalized: "Am", confidence: 0.90 }],
      },
    ],
  };

  const result = fuseScoreDocument(doc, ocrData);

  // Both measure 4 ("G") and measure 5 ("Am") must agree with their respective OCR chords
  assertEquals(result.chordAgreements, 2);
  assertEquals(result.chordDisagreements, 0);

  // Measure 4 (writtenIndex 4) receives high-confidence agreement
  const m4Harmony = result.document.measures[4].harmonies[0];
  assertEquals(m4Harmony.raw, "G");
  assertEquals(m4Harmony.confidence, 0.95);

  // Measure 5 (writtenIndex 5) receives high-confidence agreement
  const m5Harmony = result.document.measures[5].harmonies[0];
  assertEquals(m5Harmony.raw, "Am");
  assertEquals(m5Harmony.confidence, 0.95);

  // Measure 1 (writtenIndex 1) retains its own OMR chord "Dm" without phantom corruption
  const m1Harmony = result.document.measures[1].harmonies[0];
  assertEquals(m1Harmony.raw, "Dm");
});

Deno.test("FUSION-09: Spatial bounding box coordinates match chords to measures when spatial layout is present", () => {
  const doc = createMockScoreDoc();
  // Assign spatial bounding boxes to measures
  doc.measures[0].sourceBox = { x: 50, y: 100, width: 200, height: 60 };
  doc.measures[1].sourceBox = { x: 260, y: 100, width: 200, height: 60 };

  // OCR data with spatial bounding box matching measure 1
  const ocrData: OcrScoreData = {
    measures: [
      {
        measureIndex: 99, // Unaligned index, but matching sourceBox
        sourceBox: { x: 265, y: 105, width: 190, height: 50 },
        chords: [{ raw: "Dm", normalized: "Dm", confidence: 0.90 }],
      },
    ],
  };

  const result = fuseScoreDocument(doc, ocrData);
  assertEquals(result.chordAgreements, 1);

  const m2Harmony = result.document.measures[1].harmonies[0];
  assertEquals(m2Harmony.raw, "Dm");
  assertEquals(m2Harmony.confidence, 0.95);
});

Deno.test("FUSION-10: Native JAZZMUS **mxhm multi-chord measures preserve beat offsets and chord symbols as primary evidence", () => {
  const doc = createMockScoreDoc();
  // Measure with 2 native **mxhm chords at offsets 0/1 and 2/1
  doc.measures[0].harmonies = [
    {
      id: "m1-h1",
      offset: rational(0, 1),
      duration: rational(2, 1),
      raw: "C:maj",
      confidence: 0.90,
      provenance: "photo-omr",
    },
    {
      id: "m1-h2",
      offset: rational(2, 1),
      duration: rational(2, 1),
      raw: "G:7",
      confidence: 0.88,
      provenance: "photo-omr",
    },
  ];

  const result = fuseScoreDocument(doc);
  const fusedHarmonies = result.document.measures[0].harmonies;

  assertEquals(fusedHarmonies.length, 2);
  assertEquals(fusedHarmonies[0].raw, "C");
  assertEquals(fusedHarmonies[0].offset, rational(0, 1));
  assertEquals(fusedHarmonies[1].raw, "G7");
  assertEquals(fusedHarmonies[1].offset, rational(2, 1));
});

Deno.test("FUSION-11: Automatic mathematical 6/8 meter calculation supplements 6/8 time when compound duple note durations exist in measures", () => {
  const doc = createMockScoreDoc();
  // Replace measure 1 melody with 6 eighth-notes (each duration 1/2 beat, sum = 3 quarter-note beats)
  doc.measures[0].melody = [
    {
      id: "n1",
      offset: rational(0, 1),
      duration: rational(1, 2),
      pitch: { step: "C", alter: 0, octave: 4 },
      rest: false,
    },
    {
      id: "n2",
      offset: rational(1, 2),
      duration: rational(1, 2),
      pitch: { step: "D", alter: 0, octave: 4 },
      rest: false,
    },
    {
      id: "n3",
      offset: rational(1, 1),
      duration: rational(1, 2),
      pitch: { step: "E", alter: 0, octave: 4 },
      rest: false,
    },
    {
      id: "n4",
      offset: rational(3, 2),
      duration: rational(1, 2),
      pitch: { step: "F", alter: 0, octave: 4 },
      rest: false,
    },
    {
      id: "n5",
      offset: rational(2, 1),
      duration: rational(1, 2),
      pitch: { step: "G", alter: 0, octave: 4 },
      rest: false,
    },
    {
      id: "n6",
      offset: rational(5, 2),
      duration: rational(1, 2),
      pitch: { step: "A", alter: 0, octave: 4 },
      rest: false,
    },
  ];

  // Measure 2 with 2 dotted-quarters (duration 3/2 beats each, sum = 3 quarter-note beats)
  doc.measures[1].melody = [
    {
      id: "n7",
      offset: rational(0, 1),
      duration: rational(3, 2),
      pitch: { step: "G", alter: 0, octave: 4 },
      rest: false,
    },
    {
      id: "n8",
      offset: rational(3, 2),
      duration: rational(3, 2),
      pitch: { step: "C", alter: 0, octave: 4 },
      rest: false,
    },
  ];

  const result = fuseScoreDocument(doc);
  assertEquals(result.document.time, { beats: 6, beatType: 8 });
  assertEquals(result.document.measures[0].time, { beats: 6, beatType: 8 });
  assertEquals(result.document.measures[1].time, { beats: 6, beatType: 8 });
});

Deno.test("FUSION-12: measure.sourceBox is preserved on measures and populated onto low confidence issues", () => {
  const doc = createMockScoreDoc();
  // Assign genuine bounding boxes to measures
  doc.measures[0].sourceBox = {
    x: 40,
    y: 80,
    width: 220,
    height: 95,
    sourceWidth: 1600,
    sourceHeight: 1200,
  };
  doc.measures[1].sourceBox = {
    x: 270,
    y: 80,
    width: 210,
    height: 95,
    sourceWidth: 1600,
    sourceHeight: 1200,
  };

  // Set measure 0 melody to low confidence to trigger low_melody_confidence issue
  doc.measures[0].melody = [
    {
      id: "m1-n1",
      offset: rational(0, 1),
      duration: rational(1, 1),
      pitch: { step: "C", alter: 0, octave: 4 },
      rest: false,
      confidence: 0.30,
    },
  ];

  const result = fuseScoreDocument(doc);

  // Verify measure.sourceBox was preserved
  assertEquals(result.document.measures[0].sourceBox, {
    x: 40,
    y: 80,
    width: 220,
    height: 95,
    sourceWidth: 1600,
    sourceHeight: 1200,
  });
  assertEquals(result.document.measures[1].sourceBox, {
    x: 270,
    y: 80,
    width: 210,
    height: 95,
    sourceWidth: 1600,
    sourceHeight: 1200,
  });

  // Verify that the low_melody_confidence issue inherits measure.sourceBox
  const issue = result.document.issues.find((i) => i.code === "low_melody_confidence");
  assertNotEquals(issue, undefined);
  assertEquals(issue?.sourceBox, {
    x: 40,
    y: 80,
    width: 220,
    height: 95,
    sourceWidth: 1600,
    sourceHeight: 1200,
  });
});
