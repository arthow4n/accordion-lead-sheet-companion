/**
 * UX Tests for Score Review Queue and Non-Friction Play Flow.
 * Path: tests/ux/score_correction.test.tsx
 */

import { assertStringIncludes } from "@std/assert";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreReviewQueue } from "../../src/components/ScoreReviewQueue.tsx";
import { LeadSheetReader } from "../../src/components/LeadSheetReader.tsx";
import type { ScoreDocument } from "../../src/types/score.ts";
import { rational, RATIONAL_ZERO } from "../../src/lib/score/rational.ts";

function createScoreWithActionableIssues(): ScoreDocument {
  return {
    schemaVersion: 1,
    title: "Actionable Review Score",
    source: { kind: "photo", persistence: "ephemeral" },
    time: { beats: 4, beatType: 4 },
    key: { fifths: 0, mode: "major" },
    tempoMap: [{ offset: RATIONAL_ZERO, bpm: 90, source: "default" }],
    sections: [],
    measures: [
      {
        id: "m1",
        writtenIndex: 0,
        melody: [
          {
            id: "m1-n1",
            offset: rational(0, 1),
            duration: rational(1, 1),
            pitch: { step: "C", alter: 0, octave: 4 },
            rest: false,
            confidence: 0.70,
          },
        ],
        harmonies: [
          {
            id: "m1-h1",
            offset: rational(0, 1),
            raw: "C",
            confidence: 0.65,
            provenance: "photo-omr",
          },
        ],
        navigation: [],
      },
    ],
    issues: [
      {
        code: "chord_disagreement",
        message: "Measure 1: OMR detected 'C' but OCR detected 'Cm'.",
        severity: "warning",
        measureId: "m1",
        blocksGuidance: false,
      },
    ],
  };
}

Deno.test("UX-CORRECT-01: ScoreReviewQueue renders actionable issue count and review trigger", () => {
  const doc = createScoreWithActionableIssues();
  const html = renderToStaticMarkup(
    <ScoreReviewQueue
      document={doc}
      onUpdateDocument={() => {}}
    />,
  );

  assertStringIncludes(html, "Actionable Review Queue (1 issue)");
  assertStringIncludes(html, "Review Issues");
});

Deno.test("UX-CORRECT-02: LeadSheetReader integrates ScoreReviewQueue alongside measure guidance", () => {
  const doc = createScoreWithActionableIssues();
  const html = renderToStaticMarkup(
    <LeadSheetReader
      song={{
        id: "review-test",
        title: "Review Test Song",
        capoFret: 0,
        rawText: "",
        lines: [],
        updatedAt: 1,
        score: doc,
      }}
      capo={0}
      viewMode="stradella"
      onUpdateSong={() => {}}
    />,
  );

  assertStringIncludes(html, "Score reader");
  assertStringIncludes(html, "Actionable Review Queue");
});
