import { assertEquals } from "@std/assert";
import { generateCbaGrip } from "./grips.ts";
import { optimizeVoiceLeading } from "./voiceLeading.ts";

Deno.test("CBA-01: Bb Major (Bb - D - F) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("Bb", 0, 4);
  assertEquals(grip.notes, ["Bb", "D", "F"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 3, note: "Bb", finger: 1 });
  assertEquals(coords[1], { row: 3, column: 4, note: "D", finger: 2 });
  assertEquals(coords[2], { row: 3, column: 5, note: "F", finger: 4 });
});

Deno.test("CBA-02: G Minor (G - Bb - D) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("Gm", 0, 3);
  assertEquals(grip.notes, ["G", "Bb", "D"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 2, note: "G", finger: 1 });
  assertEquals(coords[1], { row: 2, column: 3, note: "Bb", finger: 2 });
  assertEquals(coords[2], { row: 3, column: 4, note: "D", finger: 4 });
});

Deno.test("CBA-03: F Major (F - A - C) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("F", 0, 6);
  assertEquals(grip.notes, ["F", "A", "C"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 3, column: 5, note: "F", finger: 1 });
  assertEquals(coords[1], { row: 1, column: 6, note: "A", finger: 2 });
  assertEquals(coords[2], { row: 1, column: 7, note: "C", finger: 4 });
});

Deno.test("CBA-04: C Major (Root) (C - E - G) with 1-2-4 fingering", () => {
  const grip = generateCbaGrip("C", 0, 5);
  assertEquals(grip.notes, ["C", "E", "G"]);
  assertEquals(grip.fingeringPattern, "1-2-4");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 1, column: 4, note: "C", finger: 1 });
  assertEquals(coords[1], { row: 2, column: 5, note: "E", finger: 2 });
  assertEquals(coords[2], { row: 2, column: 6, note: "G", finger: 4 });
});

Deno.test("CBA-05: C Major (1st Inv) (E - G - C) with 1-2-5 fingering", () => {
  const grip = generateCbaGrip("C", 1, 6);
  assertEquals(grip.notes, ["E", "G", "C"]);
  assertEquals(grip.fingeringPattern, "1-2-5");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 5, note: "E", finger: 1 });
  assertEquals(coords[1], { row: 2, column: 6, note: "G", finger: 2 });
  assertEquals(coords[2], { row: 1, column: 7, note: "C", finger: 5 });
});

Deno.test("CBA-06: C Major (2nd Inv) (G - C - E) with 1-3-5 fingering", () => {
  const grip = generateCbaGrip("C", 2, 7);
  assertEquals(grip.notes, ["G", "C", "E"]);
  assertEquals(grip.fingeringPattern, "1-3-5");

  const coords = grip.buttonCoords!;
  assertEquals(coords.length, 3);
  assertEquals(coords[0], { row: 2, column: 6, note: "G", finger: 1 });
  assertEquals(coords[1], { row: 1, column: 7, note: "C", finger: 3 });
  assertEquals(coords[2], { row: 2, column: 8, note: "E", finger: 5 });
});

Deno.test("CBA Voice Leading: minimizes centroid column delta between consecutive chords", () => {
  // Grip for F Major: centroid is around 6
  const fGrip = generateCbaGrip("F", 0, 6);
  // Next chord is C Major: voice leading should choose 1st inversion (E-G-C centroid 6) over root pos (C-E-G centroid 5)
  const cGrip = optimizeVoiceLeading("C", fGrip);
  assertEquals(cGrip.notes, ["E", "G", "C"]);
  assertEquals(cGrip.fingeringPattern, "1-2-5");
});

Deno.test("CBA 4-note chord generation: Cmaj7 with 1-2-4-5 fingering", () => {
  const grip = generateCbaGrip("Cmaj7", 0);
  assertEquals(grip.notes.length, 4);
  assertEquals(grip.fingeringPattern, "1-2-4-5");
});
