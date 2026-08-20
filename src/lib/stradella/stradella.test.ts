import { assertEquals } from "@std/assert";
import { solveStradellaChord } from "./solver.ts";
import { isColumnOutOfRange } from "./layout.ts";

Deno.test("STRAD-01: Bb fundamental major triad", () => {
  const result = solveStradellaChord("Bb");
  assertEquals(result.primaryBass, "Bb");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "bb");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, -2);
});

Deno.test("STRAD-02: Gm fundamental minor triad", () => {
  const result = solveStradellaChord("Gm");
  assertEquals(result.primaryBass, "G");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "gm");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 1);
});

Deno.test("STRAD-03: F7 dominant 7th", () => {
  const result = solveStradellaChord("F7");
  assertEquals(result.primaryBass, "F");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "f7");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, -1);
});

Deno.test("STRAD-04: Edim diminished button", () => {
  const result = solveStradellaChord("Edim");
  assertEquals(result.primaryBass, "E");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "edim");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 4);
});

Deno.test("STRAD-05: C/E major 3rd in bass (Counter-bass E_ in C col)", () => {
  const result = solveStradellaChord("C/E");
  assertEquals(result.primaryBass, "E_");
  assertEquals(result.isCounterBass, true);
  assertEquals(result.chordButton?.label, "c");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, 0);
});

Deno.test("STRAD-06: G/B major 3rd in bass (Counter-bass B_ in G col)", () => {
  const result = solveStradellaChord("G/B");
  assertEquals(result.primaryBass, "B_");
  assertEquals(result.isCounterBass, true);
  assertEquals(result.chordButton?.label, "g");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, 1);
});

Deno.test("STRAD-07: D/F# major 3rd in bass (Counter-bass F#_ in D col)", () => {
  const result = solveStradellaChord("D/F#");
  assertEquals(result.primaryBass, "F#_");
  assertEquals(result.isCounterBass, true);
  assertEquals(result.chordButton?.label, "d");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, 2);
});

Deno.test("STRAD-08: F/A major 3rd in bass (Counter-bass A_ in F col)", () => {
  const result = solveStradellaChord("F/A");
  assertEquals(result.primaryBass, "A_");
  assertEquals(result.isCounterBass, true);
  assertEquals(result.chordButton?.label, "f");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, -1);
});

Deno.test("STRAD-09: C/B Min-Distance Counter-Bass B_ in G Col (1 col jump, NOT 5)", () => {
  const result = solveStradellaChord("C/B");
  assertEquals(result.primaryBass, "B_");
  assertEquals(result.isCounterBass, true);
  assertEquals(result.chordButton?.label, "c");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, 1);
});

Deno.test("STRAD-10: Am/F# Min-Distance Counter-Bass F#_ in D Col (1 col jump, NOT 3)", () => {
  const result = solveStradellaChord("Am/F#");
  assertEquals(result.primaryBass, "F#_");
  assertEquals(result.isCounterBass, true);
  assertEquals(result.chordButton?.label, "am");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, 2);
});

Deno.test("STRAD-11: C/G 5th in bass (Col +1 Fundamental Bass)", () => {
  const result = solveStradellaChord("C/G");
  assertEquals(result.primaryBass, "G");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "c");
  assertEquals(result.fingering, "2 + 3");
  assertEquals(result.columnOffset, 1);
});

Deno.test("STRAD-12: Am/G minor chord over flat 7th bass (Col +1 Fundamental Bass)", () => {
  const result = solveStradellaChord("Am/G");
  assertEquals(result.primaryBass, "G");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "am");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 1);
});

Deno.test("STRAD-13: Cmaj7 compound (C + em chord)", () => {
  const result = solveStradellaChord("Cmaj7");
  assertEquals(result.primaryBass, "C");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "em");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 0);
});

Deno.test("STRAD-14: Am7 compound (A + c chord)", () => {
  const result = solveStradellaChord("Am7");
  assertEquals(result.primaryBass, "A");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "c");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 3);
});

Deno.test("STRAD-15: Bm7b5 compound (B + dm chord)", () => {
  const result = solveStradellaChord("Bm7b5");
  assertEquals(result.primaryBass, "B");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "dm");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 5);
});

Deno.test("STRAD-16: C6 compound (C + am chord)", () => {
  const result = solveStradellaChord("C6");
  assertEquals(result.primaryBass, "C");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "am");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 0);
});

Deno.test("STRAD-17: Cm6 compound (C + cdim chord)", () => {
  const result = solveStradellaChord("Cm6");
  assertEquals(result.primaryBass, "C");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "cdim");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 0);
});

Deno.test("STRAD-18: C9 compound (C + gm chord)", () => {
  const result = solveStradellaChord("C9");
  assertEquals(result.primaryBass, "C");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "gm");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 0);
});

Deno.test("STRAD-19: Csus4 compound (C + f chord)", () => {
  const result = solveStradellaChord("Csus4");
  assertEquals(result.primaryBass, "C");
  assertEquals(result.isCounterBass, false);
  assertEquals(result.chordButton?.label, "f");
  assertEquals(result.fingering, "4 + 3");
  assertEquals(result.columnOffset, 0);
});

Deno.test("Stradella Accordion Size clamping & out-of-range flag", () => {
  // 48-bass covers -2 to +5. Bm7b5 is in col 5 (in range).
  const inRange = solveStradellaChord("Bm7b5", "48-bass");
  assertEquals(inRange.isOutOfRange, false);

  // F# is col 6 (out of range for 48-bass)
  const outOfRange = solveStradellaChord("F#", "48-bass");
  assertEquals(outOfRange.isOutOfRange, true);

  // But in range for 72-bass (-3 to +6)
  const in72 = solveStradellaChord("F#", "72-bass");
  assertEquals(in72.isOutOfRange, false);

  assertEquals(isColumnOutOfRange(-5, "48-bass"), true);
  assertEquals(isColumnOutOfRange(0, "48-bass"), false);
});

Deno.test("STRAD-20: Flat chord roots retain negative Circle of Fifths columns", () => {
  const flatCases: Array<{
    chord: string;
    expectedBass: string;
    expectedChord: string;
    expectedCol: number;
  }> = [
    { chord: "Db", expectedBass: "Db", expectedChord: "db", expectedCol: -5 },
    { chord: "Gb", expectedBass: "Gb", expectedChord: "gb", expectedCol: -6 },
    { chord: "Ab", expectedBass: "Ab", expectedChord: "ab", expectedCol: -4 },
    { chord: "Eb", expectedBass: "Eb", expectedChord: "eb", expectedCol: -3 },
    { chord: "Bb", expectedBass: "Bb", expectedChord: "bb", expectedCol: -2 },
    { chord: "Cb", expectedBass: "Cb", expectedChord: "cb", expectedCol: -7 },
    { chord: "Dbm", expectedBass: "Db", expectedChord: "dbm", expectedCol: -5 },
    { chord: "Db7", expectedBass: "Db", expectedChord: "db7", expectedCol: -5 },
    { chord: "Dbdim", expectedBass: "Db", expectedChord: "dbdim", expectedCol: -5 },
  ];

  for (const tc of flatCases) {
    const result = solveStradellaChord(tc.chord);
    assertEquals(
      result.primaryBass,
      tc.expectedBass,
      `Failed primaryBass for ${tc.chord}`,
    );
    assertEquals(
      result.chordButton?.label,
      tc.expectedChord,
      `Failed chordButton for ${tc.chord}`,
    );
    assertEquals(
      result.columnOffset,
      tc.expectedCol,
      `Failed columnOffset for ${tc.chord}`,
    );
    assertEquals(result.isCounterBass, false);
  }
});

Deno.test("STRAD-21: Compound flat chord voicings preserve Circle of Fifths geometry", () => {
  // Dbmaj7 -> Db bass (col -5) + fm chord (col -1)
  const dbmaj7 = solveStradellaChord("Dbmaj7");
  assertEquals(dbmaj7.primaryBass, "Db");
  assertEquals(dbmaj7.chordButton?.label, "fm");
  assertEquals(dbmaj7.columnOffset, -5);

  // Ebm7 -> Eb bass (col -3) + gb chord (col -6)
  const ebm7 = solveStradellaChord("Ebm7");
  assertEquals(ebm7.primaryBass, "Eb");
  assertEquals(ebm7.chordButton?.label, "gb");
  assertEquals(ebm7.columnOffset, -3);

  // Dbsus4 -> Db bass (col -5) + gb chord (col -6)
  const dbsus4 = solveStradellaChord("Dbsus4");
  assertEquals(dbsus4.primaryBass, "Db");
  assertEquals(dbsus4.chordButton?.label, "gb");
  assertEquals(dbsus4.columnOffset, -5);

  // Db9 -> Db bass (col -5) + abm chord (col -4)
  const db9 = solveStradellaChord("Db9");
  assertEquals(db9.primaryBass, "Db");
  assertEquals(db9.chordButton?.label, "abm");
  assertEquals(db9.columnOffset, -5);
});

Deno.test("STRAD-22: Slash chords with flat chord roots and counter-bass", () => {
  // Db/F -> Counter-bass F_ in Db column (col -5)
  const dbOverF = solveStradellaChord("Db/F");
  assertEquals(dbOverF.primaryBass, "F_");
  assertEquals(dbOverF.isCounterBass, true);
  assertEquals(dbOverF.chordButton?.label, "db");
  assertEquals(dbOverF.columnOffset, -5);

  // Eb/G -> Counter-bass G_ in Eb column (col -3)
  const ebOverG = solveStradellaChord("Eb/G");
  assertEquals(ebOverG.primaryBass, "G_");
  assertEquals(ebOverG.isCounterBass, true);
  assertEquals(ebOverG.chordButton?.label, "eb");
  assertEquals(ebOverG.columnOffset, -3);
});
