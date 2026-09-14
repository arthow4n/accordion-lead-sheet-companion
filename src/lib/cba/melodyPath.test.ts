import { assert, assertEquals } from "@std/assert";
import type { MelodyEvent, SpelledPitch } from "../../types/score.ts";
import { calculateCbaMelodyTransition, solveCbaMelodyPath } from "./melodyPath.ts";
import { DEFAULT_CBA_KEYBOARD_LAYOUT, getCbaPhysicalLocationsForMidi } from "./keyboardLayout.ts";

function pitchFromMidi(midi: number): SpelledPitch {
  const names: Array<[SpelledPitch["step"], number]> = [
    ["C", 0],
    ["C", 1],
    ["D", 0],
    ["E", -1],
    ["E", 0],
    ["F", 0],
    ["F", 1],
    ["G", 0],
    ["A", -1],
    ["A", 0],
    ["B", -1],
    ["B", 0],
  ];
  const pitchClass = ((midi % 12) + 12) % 12;
  const [step, alter] = names[pitchClass];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

function note(id: string, midi: number, tie?: MelodyEvent["tie"]): MelodyEvent {
  return {
    id,
    offset: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 4 },
    pitch: pitchFromMidi(midi),
    rest: false,
    tie,
  };
}

function rest(id: string): MelodyEvent {
  return {
    id,
    offset: { numerator: 1, denominator: 4 },
    duration: { numerator: 1, denominator: 4 },
    rest: true,
  };
}

Deno.test("CBA melody solver: emits pitch-valid deterministic paths", () => {
  const events = [note("c", 60), note("cs", 61), note("d", 62), note("c-again", 60)];
  const first = solveCbaMelodyPath(events);
  const second = solveCbaMelodyPath(events);
  assertEquals(first.status, "ok");
  assertEquals(first.steps, second.steps);
  assertEquals(first.steps.length, events.length);
  for (const step of first.steps) {
    if (!step.location || step.midi === undefined) continue;
    assertEquals(step.location.midi, step.midi);
    assert(step.finger !== undefined && step.finger >= 1 && step.finger <= 5);
  }
});

Deno.test("CBA melody solver: covers every FR-1XB playable MIDI and all pitch classes", () => {
  const events = Array.from(
    {
      length: DEFAULT_CBA_KEYBOARD_LAYOUT.playableMidi.highest -
        DEFAULT_CBA_KEYBOARD_LAYOUT.playableMidi.lowest + 1,
    },
    (_, index) => note(`midi-${index}`, DEFAULT_CBA_KEYBOARD_LAYOUT.playableMidi.lowest + index),
  );
  const result = solveCbaMelodyPath(events);
  assertEquals(result.status, "ok");
  assertEquals(result.steps.length, events.length);
  for (const step of result.steps) {
    assert(step.location);
    assertEquals(step.location.midi, step.midi);
  }
});

Deno.test("CBA melody solver: ties retain the exact physical button and finger", () => {
  const result = solveCbaMelodyPath([
    note("tie-start", 60, "start"),
    note("tie-stop", 60, "stop"),
  ]);
  assertEquals(result.status, "ok");
  assertEquals(result.steps[1]?.transition?.from, result.steps[0]?.location);
  assertEquals(result.steps[1]?.transition?.fromFinger, result.steps[0]?.finger);
  assertEquals(result.steps[1]?.location, result.steps[0]?.location);
  assertEquals(result.steps[1]?.finger, result.steps[0]?.finger);
});

Deno.test("CBA melody solver: rests and phrase boundaries reset to the reference anchor", () => {
  const result = solveCbaMelodyPath([
    note("before", 60),
    rest("pause"),
    note("after-rest", 60),
    note("after-boundary", 60),
  ], { phraseBoundaryBeforeEventIds: ["after-boundary"] });
  assertEquals(result.status, "ok");
  assertEquals(result.steps[1]?.rest, true);
  assertEquals(result.steps[2]?.transition, undefined);
  assertEquals(result.steps[3]?.transition, undefined);
});

Deno.test("CBA melody solver: hard locks and malformed ties never fall back to nearest notes", () => {
  const locked = solveCbaMelodyPath([note("locked", 60)], {
    locks: [{ eventId: "locked", row: 1, column: 5, finger: 4 }],
  });
  assertEquals(locked.status, "ok");
  assertEquals(locked.steps[0]?.location, { row: 1, column: 5, midi: 60, pitchClass: 0 });
  assertEquals(locked.steps[0]?.finger, 4);

  const conflict = solveCbaMelodyPath([note("same", 60)], {
    locks: [
      { eventId: "same", row: 1 },
      { eventId: "same", row: 4 },
    ],
  });
  assertEquals(conflict.status, "invalid_lock");
  assertEquals(conflict.steps, []);

  const malformedTie = solveCbaMelodyPath([note("orphan", 60, "continue")]);
  assertEquals(malformedTie.status, "invalid_tie");
  assertEquals(malformedTie.steps, []);

  const outOfRange = solveCbaMelodyPath([note("too-low", 40)]);
  assertEquals(outOfRange.status, "out_of_range");
  assertEquals(outOfRange.steps, []);
});

Deno.test("CBA melody solver: signed travel uses repeating auxiliary row offsets", () => {
  const row3 = getCbaPhysicalLocationsForMidi(DEFAULT_CBA_KEYBOARD_LAYOUT, 62).find((loc) =>
    loc.row === 3
  )!;
  const row4 = getCbaPhysicalLocationsForMidi(DEFAULT_CBA_KEYBOARD_LAYOUT, 60).find((loc) =>
    loc.row === 4
  )!;
  const transition = calculateCbaMelodyTransition(
    { location: row3, finger: 2 },
    { location: row4, finger: 3 },
  );
  assertEquals(transition.physicalDelta, -2);
  const duplicate = calculateCbaMelodyTransition(
    { location: row4, finger: 2 },
    {
      location: getCbaPhysicalLocationsForMidi(DEFAULT_CBA_KEYBOARD_LAYOUT, 60).find((loc) =>
        loc.row === 1
      )!,
      finger: 3,
    },
  );
  assertEquals(duplicate.physicalDelta, 0);
});
