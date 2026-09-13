import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { MelodyEvent, ScoreDocument, ScoreMeasure } from "../../src/types/score.ts";
import { addRational, compareRational, rational } from "../../src/lib/score/rational.ts";
import { isEventInsideMeasure, validateScoreDocument } from "../../src/lib/score/validation.ts";
import { importSongbook, normalizeSongRecord } from "../../src/lib/storage/songbook.ts";

const measure = (overrides: Partial<ScoreMeasure> = {}): ScoreMeasure => ({
  id: "m1",
  writtenIndex: 0,
  melody: [],
  harmonies: [],
  navigation: [],
  ...overrides,
});

const score = (overrides: Partial<ScoreDocument> = {}): ScoreDocument => ({
  schemaVersion: 1,
  source: { kind: "musicxml", sanitizedXml: "<score-partwise/>" },
  tempoMap: [{ offset: rational(0), bpm: 90, source: "default" }],
  sections: [],
  measures: [measure()],
  issues: [],
  ...overrides,
});

Deno.test("rational durations reduce, preserve signs, and compare exactly", () => {
  assertEquals(rational(2, 4), { numerator: 1, denominator: 2 });
  assertEquals(rational(1, -2), { numerator: -1, denominator: 2 });
  assertEquals(addRational(rational(1, 3), rational(1, 6)), rational(1, 2));
  assertEquals(compareRational(rational(2, 4), rational(1, 2)), 0);
  assertThrows(() => rational(1, 0), RangeError);
});

Deno.test("score validation rejects missing pitches and invalid source state", () => {
  const event: MelodyEvent = {
    id: "n1",
    offset: rational(0),
    duration: rational(1, 4),
    rest: false,
  };
  const result = validateScoreDocument(score({
    source: { kind: "photo", persistence: "opted_in" },
    measures: [measure({ melody: [event] })],
  }));
  assertEquals(result.valid, false);
  assertEquals(result.issues.map((item) => item.code), ["missing_source_asset", "missing_pitch"]);
});

Deno.test("event containment uses exact rational boundaries", () => {
  const event: MelodyEvent = {
    id: "n1",
    offset: rational(3, 4),
    duration: rational(1, 4),
    rest: true,
  };
  assertEquals(isEventInsideMeasure(event, rational(1)), true);
  assertEquals(isEventInsideMeasure({ ...event, offset: rational(4, 5) }, rational(1)), false);
});

Deno.test("song normalization preserves legacy records and rejects malformed score payloads", () => {
  const legacy = normalizeSongRecord({
    id: "legacy",
    title: "Legacy",
    rawText: "C",
    lines: [],
    capoFret: 14,
    updatedAt: 10,
  });
  assertEquals(legacy?.capoFret, 2);
  assertEquals(legacy?.capo, 2);
  assertEquals(
    normalizeSongRecord({ id: "bad", title: "Bad", rawText: "", lines: [], score: {} }),
    undefined,
  );
});

Deno.test("songbook import rejects malformed records instead of partially importing", async () => {
  await assertRejects(
    () => importSongbook(JSON.stringify({ version: 2, songs: [{ id: "bad" }] }), "replace"),
    Error,
    "No valid songs",
  );
  await assertRejects(
    () =>
      importSongbook(
        JSON.stringify({
          version: 2,
          songs: [
            {
              id: "good",
              title: "Good",
              rawText: "C",
              lines: [],
              capoFret: 0,
              updatedAt: 1,
            },
            { id: "bad" },
          ],
        }),
        "replace",
      ),
    Error,
    "malformed record",
  );
});
