import { assertEquals } from "@std/assert";
import type { CbaGrip } from "../../types/index.ts";
import { generateCanonicalRootGrip, generateCbaGrip } from "./grips.ts";
import { getCbaVisualRowOffset, getPitchClassAt } from "./grid.ts";
import { computeCbaTransition, optimizeVoiceLeading } from "./voiceLeading.ts";

Deno.test("CBA geometry: five-row auxiliary lattice alternates physical diagonal direction", () => {
  assertEquals(
    [1, 2, 3, 4, 5].map((row) => getCbaVisualRowOffset(row)),
    [0, -1, 0, 1, 0],
  );

  for (let column = 1; column <= 12; column++) {
    assertEquals(getPitchClassAt(4, column), getPitchClassAt(1, column));
    assertEquals(getPitchClassAt(5, column), getPitchClassAt(2, column));
    assertEquals(getPitchClassAt(2, column), (getPitchClassAt(1, column) + 1) % 12);
    assertEquals(getPitchClassAt(3, column), (getPitchClassAt(2, column) + 1) % 12);
  }
});

Deno.test("CBA-01: Bb Major (Bb - D - F) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("Bb", 0, 5);
  assertEquals(grip.notes, ["Bb", "D", "F"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 4, note: "Bb", finger: 1 });
  assertEquals(coords[1], { row: 3, column: 5, note: "D", finger: 2 });
  assertEquals(coords[2], { row: 3, column: 6, note: "F", finger: 4 });
});

Deno.test("CBA-02: G Minor (G - Bb - D) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("Gm", 0, 4);
  assertEquals(grip.notes, ["G", "Bb", "D"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 3, note: "G", finger: 1 });
  assertEquals(coords[1], { row: 2, column: 4, note: "Bb", finger: 2 });
  assertEquals(coords[2], { row: 3, column: 5, note: "D", finger: 4 });
});

Deno.test("CBA-SPELLING-01: Note spelling changes labels but not CBA physical coordinates", () => {
  const flats = generateCbaGrip("Db7", 0, 5, 5, "flats");
  const sharps = generateCbaGrip("C#7", 0, 5, 5, "sharps");

  assertEquals(flats.notes, ["Db", "F", "Ab", "B"]);
  assertEquals(sharps.notes, ["C#", "F", "G#", "B"]);
  assertEquals(
    flats.buttonCoords?.map((button) => ({ row: button.row, column: button.column })),
    sharps.buttonCoords?.map((button) => ({ row: button.row, column: button.column })),
  );
});

Deno.test("CBA-03: F Major (F - A - C) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("F", 0, 5);
  assertEquals(grip.notes, ["F", "A", "C"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 3, column: 6, note: "F", finger: 1 });
  assertEquals(coords[1], { row: 4, column: 4, note: "A", finger: 2 });
  assertEquals(coords[2], { row: 4, column: 5, note: "C", finger: 4 });
});

Deno.test("CBA-04: C Major (Root) (C - E - G) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("C", 0, 6);
  assertEquals(grip.notes, ["C", "E", "G"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 1, column: 5, note: "C", finger: 1 });
  assertEquals(coords[1], { row: 2, column: 6, note: "E", finger: 2 });
  assertEquals(coords[2], { row: 2, column: 7, note: "G", finger: 4 });
});

Deno.test("CBA-05: C Major (1st Inv) (E - G - C) with 1-2-5 fingering", () => {
  const grip = generateCbaGrip("C", 1, 6);
  assertEquals(grip.notes, ["E", "G", "C"]);
  assertEquals(grip.fingeringPattern, "1-2-5");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 6, note: "E", finger: 1 });
  assertEquals(coords[1], { row: 2, column: 7, note: "G", finger: 2 });
  assertEquals(coords[2], { row: 1, column: 5, note: "C", finger: 5 });
});

Deno.test("CBA-06: C Major (2nd Inv) (G - C - E) with 1-3-5 fingering", () => {
  const grip = generateCbaGrip("C", 2, 6);
  assertEquals(grip.notes, ["G", "C", "E"]);
  assertEquals(grip.fingeringPattern, "1-3-5");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 7, note: "G", finger: 1 });
  assertEquals(coords[1], { row: 1, column: 5, note: "C", finger: 3 });
  assertEquals(coords[2], { row: 2, column: 6, note: "E", finger: 5 });
});

Deno.test("CBA Voice Leading: minimizes centroid column delta between consecutive chords", () => {
  const fGrip = generateCbaGrip("F", 0, 5);
  const cGrip = optimizeVoiceLeading("C", fGrip);
  const delta = Math.abs((cGrip.centroidColumn ?? 5) - (fGrip.centroidColumn ?? 5));
  assertEquals(delta <= 1.5, true);
});

Deno.test("CBA 4-note chord generation: Cmaj7 with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("Cmaj7", 0);
  assertEquals(grip.notes.length, 4);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
});

Deno.test("CBA-07: SevenSharpEleven (C7#11) with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("C7#11", 0);
  assertEquals(grip.notes, ["C", "E", "F#", "Bb"]);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
  assertEquals(grip.buttonCoords?.length, 4);
});

Deno.test("CBA-08: SevenFlatNine (C7b9) with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("C7b9", 0);
  assertEquals(grip.notes, ["C", "E", "Bb", "Db"]);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
  assertEquals(grip.buttonCoords?.length, 4);
});

Deno.test("CBA-09: Dominant13 (C13) with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("C13", 0);
  assertEquals(grip.notes, ["C", "E", "Bb", "A"]);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
  assertEquals(grip.buttonCoords?.length, 4);
});

Deno.test("CBA-10: SixNine (C6/9) with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("C6/9", 0);
  assertEquals(grip.notes, ["C", "E", "A", "D"]);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
  assertEquals(grip.buttonCoords?.length, 4);
});

Deno.test("CBA-11: Minor9 (Cm9) with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("Cm9", 0);
  assertEquals(grip.notes, ["Eb", "G", "Bb", "D"]);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
  assertEquals(grip.buttonCoords?.length, 4);
});

Deno.test("CBA-12: Altered (C7alt) with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("C7alt", 0);
  assertEquals(grip.notes, ["C", "E", "F#", "Bb"]);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
  assertEquals(grip.buttonCoords?.length, 4);
});

Deno.test("CBA-13: Voice leading progression Dm7 -> G7 -> Cmaj7 minimizes shift", () => {
  const dm7 = generateCbaGrip("Dm7", 0, 5);
  const g7 = optimizeVoiceLeading("G7", dm7);
  const cmaj7 = optimizeVoiceLeading("Cmaj7", g7);

  // Centroids should remain tightly clustered around column 4-6
  assertEquals(Math.abs((dm7.centroidColumn ?? 5) - (g7.centroidColumn ?? 5)) <= 2.5, true);
  assertEquals(Math.abs((g7.centroidColumn ?? 5) - (cmaj7.centroidColumn ?? 5)) <= 2.5, true);
});

Deno.test("CBA-14: Multi-note same-row chord cluster compactness (C7b9, G7b9, Cdim7, Dbdim7)", () => {
  const sameRowChords = ["C7b9", "G7b9", "Cdim7", "Dbdim7", "Edim7", "A7b9"];
  for (const chord of sameRowChords) {
    const grip = generateCbaGrip(chord, 0, 5);
    assertEquals(grip.buttonCoords?.length, 4);
    const cols = grip.buttonCoords!.map((b) => b.column);
    const spread = Math.max(...cols) - Math.min(...cols);
    assertEquals(
      spread <= 4,
      true,
      `Chord ${chord} cluster spread ${spread} exceeds max compact spread (4)`,
    );

    // Verify all button coordinates are unique (no collision)
    const set = new Set(grip.buttonCoords!.map((b) => `r${b.row}c${b.column}`));
    assertEquals(set.size, 4, `Chord ${chord} has button collision`);
  }
});

Deno.test("CBA-15: Canonical Root Grip Invariance across all 12 keys (100% muscle-memory retention)", () => {
  const testChords = [
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "Db",
    "Ab",
    "Eb",
    "Bb",
    "F",
    "Am",
    "Em",
    "Bm",
    "F#m",
    "C#m",
    "G#m",
    "Dm",
    "Gm",
    "Cm",
    "Fm",
    "Bbm",
    "Ebm",
  ];
  for (const chord of testChords) {
    const rootGrip = generateCanonicalRootGrip(chord, 5);
    assertEquals(rootGrip.isRootGrip, true);
    assertEquals(rootGrip.inversion, 0);
    assertEquals(rootGrip.buttonCoords?.length, 3);
    assertEquals(rootGrip.fingeringPattern, "1-2-4");
    assertEquals(rootGrip.rootButtonCoord?.finger, 1);
    assertEquals(rootGrip.rootButtonCoord?.note, rootGrip.notes[0]);

    // Hand span bounds: column delta <= 2 (compact 3-column span)
    const cols = rootGrip.buttonCoords!.map((b) => b.column);
    const colSpan = Math.max(...cols) - Math.min(...cols);
    assertEquals(colSpan <= 2, true, `Chord ${chord} column span ${colSpan} exceeds 2`);

    // Row span bounds: row delta <= 2 (contiguous 3-row tier)
    const rows = rootGrip.buttonCoords!.map((b) => b.row);
    const rowSpan = Math.max(...rows) - Math.min(...rows);
    assertEquals(rowSpan <= 2, true, `Chord ${chord} row span ${rowSpan} exceeds 2`);
  }
});

Deno.test("CBA-16: Amber-Gold Root Beacon tagging on 7th and extended chords", () => {
  const extendedChords = ["G7", "Am7", "Cmaj7", "Bm7b5", "F#7"];
  for (const chord of extendedChords) {
    const grip = generateCanonicalRootGrip(chord, 5);
    assertEquals(grip.isRootGrip, true);
    assertEquals(grip.rootButtonCoord?.finger, 1);
    assertEquals(grip.buttonCoords?.length, 4);
    assertEquals(grip.fingeringPattern, "1-2-4-5");
  }
});

Deno.test("CBA-17: Transition Diff Dynamics (shared, entering, exiting, flowVector)", () => {
  const cGrip = generateCanonicalRootGrip("C", 5);
  const amGrip = generateCanonicalRootGrip("Am", 5);
  const transition = computeCbaTransition(amGrip, cGrip);

  // Both C and Am share note C (r:1, c:5) and E (r:2, c:6)
  assertEquals(transition.sharedCoords?.length, 2);
  // Am introduces note A (r:1, c:4)
  assertEquals(transition.enteringCoords?.length, 1);
  assertEquals(transition.enteringCoords?.[0]?.note, "A");
  // C releases note G (r:2, c:7) as ghost
  assertEquals(transition.exitingCoords?.length, 1);
  assertEquals(transition.exitingCoords?.[0]?.note, "G");
  // Flow vector is defined
  assertEquals(typeof transition.flowVector, "string");
});

Deno.test("CBA-18: Voice-Led Inversions Flow across Autumn Leaves progression", () => {
  const progression = ["Am7", "D7", "Gmaj7", "Cmaj7", "F#m7b5", "B7", "Em"];
  let prevGrip: CbaGrip | undefined = undefined;

  for (const chord of progression) {
    const grip = optimizeVoiceLeading(chord, prevGrip);
    assertEquals(grip.buttonCoords && grip.buttonCoords.length >= 3, true);
    // Flow vectors and transition dynamics are attached
    if (prevGrip) {
      assertEquals(typeof grip.flowVector, "string");
      assertEquals(Array.isArray(grip.sharedCoords), true);
      assertEquals(Array.isArray(grip.enteringCoords), true);
      assertEquals(Array.isArray(grip.exitingCoords), true);
    }
    prevGrip = grip;
  }
});
