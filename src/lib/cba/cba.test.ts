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
