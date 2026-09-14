import { assert, assertEquals } from "@std/assert";
import type { CbaKeyboardLayout } from "../../types/index.ts";
import type { SpelledPitch } from "../../types/score.ts";
import {
  CBA_ROW_SEMITONE_OFFSETS,
  DEFAULT_CBA_KEYBOARD_LAYOUT,
  getCbaLayoutButtonCount,
  getCbaMidiAt,
  getCbaPhysicalLocationsForMidi,
  getCbaPhysicalLocationsForPitch,
  getCbaRowBounds,
  spelledPitchToMidi,
  validateCbaKeyboardLayout,
} from "./keyboardLayout.ts";

const profile = DEFAULT_CBA_KEYBOARD_LAYOUT;

function midiAt(layout: CbaKeyboardLayout, row: 1 | 2 | 3 | 4 | 5, column: number): number {
  const midi = getCbaMidiAt(layout, row, column);
  assert(midi !== undefined);
  return midi;
}

function pitch(step: SpelledPitch["step"], octave: number, alter = 0): SpelledPitch {
  return { step, octave, alter };
}

Deno.test("CBA keyboard profile: FR-1XB bounds and anchor are versioned", () => {
  assertEquals(profile.id, "roland-fr-1xb-c-griff-europe-v1");
  assertEquals(profile.displayName, "Roland FR-1XB · C-Griff Europe");
  assertEquals(profile.hand, "right");
  assertEquals(profile.orientation, {
    coordinateFrame: "app-cba-grid",
    rowOrder: "outer-to-inner",
    columnOrder: "low-to-high",
  });
  assertEquals(
    profile.rows.map((bounds) => [bounds.row, bounds.minColumn, bounds.maxColumn]),
    [
      [1, 4, 15],
      [2, 3, 15],
      [3, 3, 14],
      [4, 3, 15],
      [5, 3, 14],
    ],
  );
  assertEquals(getCbaLayoutButtonCount(profile), 62);
  assertEquals(profile.reference, {
    row: 1,
    column: 5,
    pitch: { step: "C", alter: 0, octave: 4 },
    midi: 60,
  });
  assertEquals(profile.playableMidi, { lowest: 54, highest: 91 });
  assertEquals(profile.duplicatedRows, [
    { row: 4, sourceRow: 1 },
    { row: 5, sourceRow: 2 },
  ]);
});

Deno.test("CBA keyboard profile: every physical coordinate round-trips to one MIDI pitch", () => {
  const seen = new Set<string>();
  for (const bounds of profile.rows) {
    for (let column = bounds.minColumn; column <= bounds.maxColumn; column++) {
      const midi = getCbaMidiAt(profile, bounds.row, column);
      assert(midi !== undefined);
      const key = `${bounds.row}:${column}`;
      assert(!seen.has(key));
      seen.add(key);
      assert(midi >= profile.playableMidi.lowest && midi <= profile.playableMidi.highest);
      assertEquals(
        getCbaPhysicalLocationsForMidi(profile, midi).some((location) =>
          location.row === bounds.row && location.column === column
        ),
        true,
      );
    }
  }
  assertEquals(seen.size, 62);
});

Deno.test("CBA keyboard profile: all chromatic MIDI notes in the range have candidates", () => {
  for (let midi = profile.playableMidi.lowest; midi <= profile.playableMidi.highest; midi++) {
    const candidates = getCbaPhysicalLocationsForMidi(profile, midi);
    assert(candidates.length > 0, `missing candidate for MIDI ${midi}`);
    for (const candidate of candidates) {
      assertEquals(getCbaMidiAt(profile, candidate.row, candidate.column), midi);
      assertEquals(candidate.pitchClass, ((midi % 12) + 12) % 12);
    }
  }
});

Deno.test("CBA keyboard profile: duplicated rows provide stable auxiliary candidates", () => {
  for (let column = 3; column <= 14; column++) {
    const core = column >= 4
      ? getCbaPhysicalLocationsForMidi(profile, midiAt(profile, 1, column))
      : [];
    const auxiliary = getCbaPhysicalLocationsForMidi(profile, midiAt(profile, 4, column));
    assertEquals(
      auxiliary.some((location) => location.row === 4 && location.column === column),
      true,
    );
    assertEquals(
      core.some((location) => location.row === 1 && location.column === column) || column === 3,
      true,
    );
    if (column >= 4) {
      assertEquals(midiAt(profile, 1, column), midiAt(profile, 4, column));
    }
    assertEquals(midiAt(profile, 2, column), midiAt(profile, 5, column));
  }
});

Deno.test("CBA keyboard profile: spelled pitches and explicit transposition resolve without relabeling", () => {
  assertEquals(spelledPitchToMidi(pitch("C", 4)), 60);
  assertEquals(spelledPitchToMidi(pitch("F", 3, 1)), 54);
  assertEquals(spelledPitchToMidi(pitch("B", 3, -1)), 58);
  assertEquals(spelledPitchToMidi(pitch("C", 4, 2)), 62);

  assertEquals(
    getCbaPhysicalLocationsForPitch(profile, pitch("C", 4)).map(({ row, column }) => [row, column]),
    [[1, 5], [4, 5]],
  );
  assertEquals(
    getCbaPhysicalLocationsForPitch(profile, pitch("B", 3, -1), 2).map(({ row, column }) => [
      row,
      column,
    ]),
    [[1, 5], [4, 5]],
  );
  assertEquals(getCbaPhysicalLocationsForPitch(profile, pitch("C", 2)), []);
});

Deno.test("CBA keyboard profile: three-row core projection keeps the same pitch geometry", () => {
  const threeRowLayout: CbaKeyboardLayout = {
    ...profile,
    id: "abstract-c-system-core-3row-v1",
    displayName: "Abstract C-system core (3 rows)",
    rows: profile.rows.filter((bounds) => bounds.row <= 3),
    duplicatedRows: [],
  };

  for (const row of [1, 2, 3] as const) {
    const bounds = getCbaRowBounds(threeRowLayout, row);
    assert(bounds);
    for (let column = bounds.minColumn; column <= bounds.maxColumn; column++) {
      const midi = getCbaMidiAt(threeRowLayout, row, column);
      assert(midi !== undefined);
      assert(
        getCbaPhysicalLocationsForMidi(threeRowLayout, midi).some((location) =>
          location.row === row && location.column === column
        ),
      );
    }
  }
  assertEquals(CBA_ROW_SEMITONE_OFFSETS[1], 0);
  assertEquals(CBA_ROW_SEMITONE_OFFSETS[2], 1);
  assertEquals(CBA_ROW_SEMITONE_OFFSETS[3], 2);
  const threeRowMidis = { lowest: 55, highest: 91 };
  threeRowLayout.playableMidi = threeRowMidis;
  assertEquals(validateCbaKeyboardLayout(threeRowLayout), []);
  for (let midi = threeRowMidis.lowest; midi <= threeRowMidis.highest; midi++) {
    assert(getCbaPhysicalLocationsForMidi(threeRowLayout, midi).length > 0);
  }
});

Deno.test("CBA keyboard profile: finite coordinates and metadata are validated", () => {
  assertEquals(getCbaMidiAt(profile, 1, 3), undefined);
  assertEquals(getCbaMidiAt(profile, 5, 15), undefined);
  assertEquals(getCbaMidiAt(profile, 1, 5.5), undefined);
  assertEquals(validateCbaKeyboardLayout(profile), []);

  const invalidReference: CbaKeyboardLayout = {
    ...profile,
    id: "invalid-reference",
    reference: { ...profile.reference, midi: 61 },
  };
  assert(
    validateCbaKeyboardLayout(invalidReference).includes("reference pitch and MIDI do not agree"),
  );

  const invalidRange: CbaKeyboardLayout = {
    ...profile,
    id: "invalid-range",
    playableMidi: { lowest: 55, highest: 91 },
  };
  assert(
    validateCbaKeyboardLayout(invalidRange).includes(
      "playable MIDI bounds do not match finite physical buttons",
    ),
  );
  assertEquals(getCbaPhysicalLocationsForMidi(invalidRange, 54), []);
});

Deno.test("CBA keyboard profile: melodic contour fixtures enumerate deterministic candidate paths", () => {
  const allMidi = Array.from(
    { length: profile.playableMidi.highest - profile.playableMidi.lowest + 1 },
    (_, index) => profile.playableMidi.lowest + index,
  );
  const fixtures: Array<{
    name: string;
    midis: number[];
    firstExpected: string;
    lastExpected: string;
  }> = [
    { name: "ascending-range", midis: allMidi, firstExpected: "4:3", lastExpected: "2:15" },
    {
      name: "descending-range",
      midis: [...allMidi].reverse(),
      firstExpected: "2:15",
      lastExpected: "4:3",
    },
    {
      name: "chromatic-run",
      midis: Array.from({ length: 13 }, (_, index) => 60 + index),
      firstExpected: "1:5|4:5",
      lastExpected: "1:9|4:9",
    },
    {
      name: "repeated-note",
      midis: [60, 60, 60, 60],
      firstExpected: "1:5|4:5",
      lastExpected: "1:5|4:5",
    },
    {
      name: "wide-leaps",
      midis: [54, 66, 78, 91, 55],
      firstExpected: "4:3",
      lastExpected: "2:3|5:3",
    },
  ];

  for (const fixture of fixtures) {
    const candidatePath = fixture.midis.map((midi) =>
      getCbaPhysicalLocationsForMidi(profile, midi)
    );
    assert(candidatePath.every((candidates) => candidates.length > 0), fixture.name);
    assertEquals(
      candidatePath[0].map(({ row, column }) => `${row}:${column}`).join("|"),
      fixture.firstExpected,
    );
    assertEquals(
      candidatePath.at(-1)!.map(({ row, column }) => `${row}:${column}`).join("|"),
      fixture.lastExpected,
    );
    // Running lookup twice must produce the same ordered path for persistence and replay.
    assertEquals(
      candidatePath.map((candidates) =>
        candidates.map(({ row, column }) => `${row}:${column}`).join("|")
      ),
      fixture.midis.map((midi) =>
        getCbaPhysicalLocationsForMidi(profile, midi)
          .map(({ row, column }) => `${row}:${column}`)
          .join("|")
      ),
    );
  }

  // A tie can keep one physical button; a rest/phrase boundary is represented by an empty event
  // and must not invent a nearest note. These are solver-facing invariants, not UI behavior.
  const repeatedCandidates = getCbaPhysicalLocationsForMidi(profile, 60);
  assertEquals(repeatedCandidates.length, 2);
  assertEquals(
    repeatedCandidates.map(({ row, column }) => `${row}:${column}`),
    ["1:5", "4:5"],
  );
  assert(
    repeatedCandidates.some((candidate) =>
      repeatedCandidates.some((other) =>
        candidate.row === other.row && candidate.column === other.column
      )
    ),
  );
  assertEquals(getCbaPhysicalLocationsForMidi(profile, 53), []);
  assertEquals(getCbaPhysicalLocationsForMidi(profile, 92), []);
});
