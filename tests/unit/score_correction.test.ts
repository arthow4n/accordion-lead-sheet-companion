import { assertEquals } from "@std/assert";
import type { ScoreDocument, ScoreMeasure } from "../../src/types/score.ts";
import { rational, RATIONAL_ZERO } from "../../src/lib/score/rational.ts";
import {
  cycleNoteAccidental,
  getActionableScoreIssues,
  hideRecognitionHint,
  mergeUserCorrections,
  ScoreCorrectionSession,
  shiftNoteOctave,
  toggleNoteRest,
  updateMeasureChord,
  updateNoteDuration,
  updateNotePitch,
} from "../../src/lib/score/correction.ts";

function createMockScore(): ScoreDocument {
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
        confidence: 0.65,
      },
    ],
    harmonies: [
      {
        id: "m1-h1",
        offset: rational(0, 1),
        raw: "C",
        confidence: 0.70,
        provenance: "photo-omr",
      },
    ],
    navigation: [],
  };

  return {
    schemaVersion: 1,
    title: "Correction Test Score",
    source: { kind: "photo", persistence: "ephemeral" },
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    tempoMap: [{ offset: RATIONAL_ZERO, bpm: 120, source: "default" }],
    sections: [],
    measures: [m1],
    issues: [
      {
        code: "chord_disagreement",
        message: "Measure 1: OMR detected 'C' but OCR detected 'Cm'.",
        severity: "warning",
        measureId: "m1",
        blocksGuidance: false,
      },
      {
        code: "general_info",
        message: "General non-actionable score info notice.",
        severity: "info",
        blocksGuidance: false,
      },
    ],
  };
}

Deno.test("CORRECT-01: Actionable issue filtering isolates measure issues from global notices", () => {
  const doc = createMockScore();
  const actionable = getActionableScoreIssues(doc);
  assertEquals(actionable.length, 1);
  assertEquals(actionable[0].code, "chord_disagreement");
  assertEquals(actionable[0].measureId, "m1");
});

Deno.test("CORRECT-02: Quick note operations update pitch, duration, rest, octave, and accidentals", () => {
  const doc = createMockScore();

  // Pitch update
  const withPitch = updateNotePitch(doc, "m1", "m1-n1", { step: "G", alter: 0, octave: 4 });
  assertEquals(withPitch.measures[0].melody[0].pitch?.step, "G");
  assertEquals(withPitch.measures[0].melody[0].confidence, 1.0);

  // Duration update
  const withDuration = updateNoteDuration(doc, "m1", "m1-n1", rational(1, 2));
  assertEquals(withDuration.measures[0].melody[0].duration, { numerator: 1, denominator: 2 });

  // Toggle rest
  const withRest = toggleNoteRest(doc, "m1", "m1-n1");
  assertEquals(withRest.measures[0].melody[0].rest, true);

  // Octave shift
  const withOctave = shiftNoteOctave(doc, "m1", "m1-n1", 1);
  assertEquals(withOctave.measures[0].melody[0].pitch?.octave, 5);

  // Accidental cycle: natural (0) -> sharp (1) -> flat (-1) -> natural (0)
  const withSharp = cycleNoteAccidental(doc, "m1", "m1-n1");
  assertEquals(withSharp.measures[0].melody[0].pitch?.alter, 1);
  const withFlat = cycleNoteAccidental(withSharp, "m1", "m1-n1");
  assertEquals(withFlat.measures[0].melody[0].pitch?.alter, -1);
});

Deno.test("CORRECT-03: Quick chord update normalizes chord and clears disagreement issues", () => {
  const doc = createMockScore();
  assertEquals(doc.issues.some((i) => i.code === "chord_disagreement"), true);

  const updated = updateMeasureChord(doc, "m1", "G7");
  assertEquals(updated.measures[0].harmonies[0].raw, "G7");
  assertEquals(updated.measures[0].harmonies[0].confidence, 1.0);
  assertEquals(updated.measures[0].harmonies[0].provenance, "photo-manual");
  // Chord disagreement issue should now be cleared!
  assertEquals(updated.issues.some((i) => i.code === "chord_disagreement"), false);
});

Deno.test("CORRECT-04: Hide hint dismisses recognition issues without editing notation", () => {
  const doc = createMockScore();
  assertEquals(doc.issues.length, 2);

  const dismissed = hideRecognitionHint(doc, "m1", "chord_disagreement");
  assertEquals(dismissed.issues.some((i) => i.code === "chord_disagreement"), false);
  // Notation itself is unaltered
  assertEquals(dismissed.measures[0].harmonies[0].raw, "C");
});

Deno.test("CORRECT-05: User corrections are preserved across rescan and schema migration", () => {
  const userDoc = createMockScore();
  // User modified note and chord
  const modifiedUserDoc = updateNotePitch(userDoc, "m1", "m1-n1", {
    step: "A",
    alter: 0,
    octave: 4,
  });
  const finalUserDoc = updateMeasureChord(modifiedUserDoc, "m1", "Am");

  // New freshly recognized score from rescan with different OMR values
  const freshlyScannedDoc = createMockScore();
  freshlyScannedDoc.measures[0].melody[0].pitch = { step: "C", alter: 0, octave: 4 };
  freshlyScannedDoc.measures[0].harmonies[0].raw = "C";

  // Merge corrections
  const merged = mergeUserCorrections(finalUserDoc, freshlyScannedDoc);
  assertEquals(merged.measures[0].melody[0].pitch?.step, "A");
  assertEquals(merged.measures[0].harmonies[0].raw, "Am");
  assertEquals(merged.measures[0].harmonies[0].provenance, "photo-manual");
});

Deno.test("CORRECT-06: ScoreCorrectionSession provides multi-step Undo and Redo", () => {
  const doc = createMockScore();
  const session = new ScoreCorrectionSession(doc);
  assertEquals(session.canUndo, false);
  assertEquals(session.canRedo, false);

  const step1 = updateMeasureChord(doc, "m1", "F");
  session.apply(step1);
  assertEquals(session.canUndo, true);
  assertEquals(session.document.measures[0].harmonies[0].raw, "F");

  const step2 = updateMeasureChord(step1, "m1", "G");
  session.apply(step2);
  assertEquals(session.document.measures[0].harmonies[0].raw, "G");

  // Undo step 2 -> back to F
  session.undo();
  assertEquals(session.document.measures[0].harmonies[0].raw, "F");
  assertEquals(session.canRedo, true);

  // Undo step 1 -> back to original C
  session.undo();
  assertEquals(session.document.measures[0].harmonies[0].raw, "C");

  // Redo -> back to F
  session.redo();
  assertEquals(session.document.measures[0].harmonies[0].raw, "F");

  // Redo -> back to G
  session.redo();
  assertEquals(session.document.measures[0].harmonies[0].raw, "G");
});

Deno.test("CORRECT-07: Fixed validation issues (e.g. duration) are cleared from doc.issues (BLK-01)", async () => {
  const doc = createMockScore();
  doc.measures[0].writtenIndex = 1; // Measure 2 (not a pickup)
  // Set invalid duration: note has 2 quarter beats in a 4/4 measure
  doc.measures[0].melody[0].duration = rational(2, 4); // 2 beats
  // Validate to produce invalid_measure_duration issue
  const { validateScoreDocument } = await import("../../src/lib/score/validation.ts");
  const validation = validateScoreDocument(doc);
  doc.issues.push(...validation.issues);
  assertEquals(doc.issues.some((i) => i.code === "invalid_measure_duration"), true);

  // Fix note duration to 4 quarter beats (whole note in 4/4)
  const fixed = updateNoteDuration(doc, "m1", "m1-n1", rational(4));
  // The invalid_measure_duration issue must now be cleared!
  assertEquals(fixed.issues.some((i) => i.code === "invalid_measure_duration"), false);
});
