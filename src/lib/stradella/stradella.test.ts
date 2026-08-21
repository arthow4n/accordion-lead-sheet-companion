import { assertEquals } from "@std/assert";
import { solveStradellaChord } from "./solver.ts";
import { getStradellaColumn, isColumnOutOfRange, NOTE_TO_COLUMN } from "./layout.ts";

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

Deno.test("STRAD-23: sevenSharpEleven compound voicing (7#11 -> Bass + diminished on root)", () => {
  // C7#11 -> C bass (col 0) + cdim chord (col 0)
  const c7sharp11 = solveStradellaChord("C7#11");
  assertEquals(c7sharp11.primaryBass, "C");
  assertEquals(c7sharp11.chordButton?.label, "cdim");
  assertEquals(c7sharp11.columnOffset, 0);

  // Gb7(#11) -> Gb bass (col -6) + gbdim chord (col -6)
  const gb7sharp11 = solveStradellaChord("Gb7(#11)");
  assertEquals(gb7sharp11.primaryBass, "Gb");
  assertEquals(gb7sharp11.chordButton?.label, "gbdim");
  assertEquals(gb7sharp11.columnOffset, -6);
});

Deno.test("STRAD-24: sevenFlatNine compound voicing (7b9 -> Bass + diminished half-step up)", () => {
  // C7b9 -> C bass (col 0) + dbdim chord (col -5)
  const c7b9 = solveStradellaChord("C7b9");
  assertEquals(c7b9.primaryBass, "C");
  assertEquals(c7b9.chordButton?.label, "dbdim");
  assertEquals(c7b9.columnOffset, 0);

  // G7b9 -> G bass (col 1) + abdim chord (col -4)
  const g7b9 = solveStradellaChord("G7b9");
  assertEquals(g7b9.primaryBass, "G");
  assertEquals(g7b9.chordButton?.label, "abdim");
  assertEquals(g7b9.columnOffset, 1);
});

Deno.test("STRAD-25: dominant13 compound voicing (13 -> Bass + minor 5th up)", () => {
  // C13 -> C bass (col 0) + gm chord (col 1)
  const c13 = solveStradellaChord("C13");
  assertEquals(c13.primaryBass, "C");
  assertEquals(c13.chordButton?.label, "gm");
  assertEquals(c13.columnOffset, 0);

  // G13 -> G bass (col 1) + dm chord (col 2)
  const g13 = solveStradellaChord("G13");
  assertEquals(g13.primaryBass, "G");
  assertEquals(g13.chordButton?.label, "dm");
  assertEquals(g13.columnOffset, 1);
});

Deno.test("STRAD-26: minor9 compound voicing (m9 -> Bass + major b3 up)", () => {
  // Cm9 -> C bass (col 0) + eb chord (col -3)
  const cm9 = solveStradellaChord("Cm9");
  assertEquals(cm9.primaryBass, "C");
  assertEquals(cm9.chordButton?.label, "eb");
  assertEquals(cm9.columnOffset, 0);

  // Am9 -> A bass (col 3) + c chord (col 0)
  const am9 = solveStradellaChord("Am9");
  assertEquals(am9.primaryBass, "A");
  assertEquals(am9.chordButton?.label, "c");
  assertEquals(am9.columnOffset, 3);
});

Deno.test("STRAD-27: sixNine compound voicing (6/9 -> Bass + major 5th up)", () => {
  // C6/9 -> C bass (col 0) + g chord (col 1)
  const c69 = solveStradellaChord("C6/9");
  assertEquals(c69.primaryBass, "C");
  assertEquals(c69.chordButton?.label, "g");
  assertEquals(c69.columnOffset, 0);

  // F6/9 -> F bass (col -1) + c chord (col 0)
  const f69 = solveStradellaChord("F6/9");
  assertEquals(f69.primaryBass, "F");
  assertEquals(f69.chordButton?.label, "c");
  assertEquals(f69.columnOffset, -1);
});

Deno.test("STRAD-28: altered compound voicing (C7alt -> C + cdim)", () => {
  const c7alt = solveStradellaChord("C7alt");
  assertEquals(c7alt.primaryBass, "C");
  assertEquals(c7alt.chordButton?.label, "cdim");
  assertEquals(c7alt.columnOffset, 0);
});

Deno.test("STRAD-29: Rare root column mapping in layout.ts", () => {
  assertEquals(NOTE_TO_COLUMN["Fb"], -8);
  assertEquals(NOTE_TO_COLUMN["Cb"], -7);
  assertEquals(NOTE_TO_COLUMN["E#"], 11);
  assertEquals(NOTE_TO_COLUMN["B#"], 12);

  assertEquals(getStradellaColumn("Fb"), -8);
  assertEquals(getStradellaColumn("Cb"), -7);
  assertEquals(getStradellaColumn("E#"), 11);
  assertEquals(getStradellaColumn("B#"), 12);
});

Deno.test("STRAD-30: Rare root canonical resolution in Stradella solver", () => {
  // Cb normalizes to B (Col 5)
  const cb = solveStradellaChord("Cb");
  assertEquals(cb.primaryBass, "B");
  assertEquals(cb.chordButton?.label, "b");
  assertEquals(cb.columnOffset, 5);

  // Fb normalizes to E (Col 4)
  const fb = solveStradellaChord("Fb");
  assertEquals(fb.primaryBass, "E");
  assertEquals(fb.chordButton?.label, "e");
  assertEquals(fb.columnOffset, 4);

  // B# normalizes to C (Col 0)
  const bsharp = solveStradellaChord("B#");
  assertEquals(bsharp.primaryBass, "C");
  assertEquals(bsharp.chordButton?.label, "c");
  assertEquals(bsharp.columnOffset, 0);

  // E# normalizes to F (Col -1)
  const esharp = solveStradellaChord("E#");
  assertEquals(esharp.primaryBass, "F");
  assertEquals(esharp.chordButton?.label, "f");
  assertEquals(esharp.columnOffset, -1);
});

Deno.test("STRAD-31: Counter-bass slash distance comparisons across Circle of Fifths", () => {
  // C/B: root C (0), bass B (5). Counter-bass B_ in G col (1) is dist 1 vs fund B dist 5
  const cOverB = solveStradellaChord("C/B");
  assertEquals(cOverB.primaryBass, "B_");
  assertEquals(cOverB.isCounterBass, true);
  assertEquals(cOverB.columnOffset, 1);

  // Am/F#: root A (3), bass F# (6). Counter-bass F#_ in D col (2) is dist 1 vs fund F# dist 3
  const amOverFsharp = solveStradellaChord("Am/F#");
  assertEquals(amOverFsharp.primaryBass, "F#_");
  assertEquals(amOverFsharp.isCounterBass, true);
  assertEquals(amOverFsharp.columnOffset, 2);

  // C/E: root C (0), bass E (4). Counter-bass E_ in C col (0) is dist 0 vs fund E dist 4
  const cOverE = solveStradellaChord("C/E");
  assertEquals(cOverE.primaryBass, "E_");
  assertEquals(cOverE.isCounterBass, true);
  assertEquals(cOverE.columnOffset, 0);

  // F/A: root F (-1), bass A (3). Counter-bass A_ in F col (-1) is dist 0 vs fund A dist 4
  const fOverA = solveStradellaChord("F/A");
  assertEquals(fOverA.primaryBass, "A_");
  assertEquals(fOverA.isCounterBass, true);
  assertEquals(fOverA.columnOffset, -1);
});
