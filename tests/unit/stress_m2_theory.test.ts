import { assertEquals } from "@std/assert";
import { solveStradellaChord } from "../../src/lib/stradella/solver.ts";
import { isColumnOutOfRange } from "../../src/lib/stradella/layout.ts";
import { parseChord } from "../../src/lib/capo/transposition.ts";
import { getSoundingKey, isFlatKey, transposeChord } from "../../src/lib/capo/enharmonics.ts";
import { generateCbaGrip } from "../../src/lib/cba/grips.ts";
import { optimizeVoiceLeading } from "../../src/lib/cba/voiceLeading.ts";

// ============================================================================
// 1. STRADELLA EXTENDED CHORD VOICING STRESS TESTS
// ============================================================================

Deno.test("M2-CHALLENGE-01: Stradella solver for required extended chord qualities", () => {
  // 1. C7#11 -> C bass (col 0) + cdim chord (col 0)
  const c7sharp11 = solveStradellaChord("C7#11");
  assertEquals(c7sharp11.primaryBass, "C");
  assertEquals(c7sharp11.chordButton?.label, "cdim");
  assertEquals(c7sharp11.chordButton?.row, "diminished");
  assertEquals(c7sharp11.columnOffset, 0);
  assertEquals(c7sharp11.isCounterBass, false);
  assertEquals(c7sharp11.fingering, "4 + 3");

  // 2. Gb7(#11) -> Gb bass (col -6) + gbdim chord (col -6)
  const gb7sharp11 = solveStradellaChord("Gb7(#11)");
  assertEquals(gb7sharp11.primaryBass, "Gb");
  assertEquals(gb7sharp11.chordButton?.label, "gbdim");
  assertEquals(gb7sharp11.chordButton?.row, "diminished");
  assertEquals(gb7sharp11.columnOffset, -6);
  assertEquals(gb7sharp11.isCounterBass, false);

  // 3. C7b9 -> C bass (col 0) + dbdim chord (col -5)
  const c7b9 = solveStradellaChord("C7b9");
  assertEquals(c7b9.primaryBass, "C");
  assertEquals(c7b9.chordButton?.label, "dbdim");
  assertEquals(c7b9.chordButton?.row, "diminished");
  assertEquals(c7b9.columnOffset, 0);
  assertEquals(c7b9.isCounterBass, false);

  // 4. G13b9 -> G bass (col 1) + abdim chord (col -4)
  const g13b9 = solveStradellaChord("G13b9");
  assertEquals(g13b9.primaryBass, "G");
  assertEquals(g13b9.chordButton?.label, "abdim");
  assertEquals(g13b9.chordButton?.row, "diminished");
  assertEquals(g13b9.columnOffset, 1);

  // 5. C13 -> C bass (col 0) + gm chord (col 1)
  const c13 = solveStradellaChord("C13");
  assertEquals(c13.primaryBass, "C");
  assertEquals(c13.chordButton?.label, "gm");
  assertEquals(c13.chordButton?.row, "minor");
  assertEquals(c13.columnOffset, 0);

  // 6. Cm9 -> C bass (col 0) + eb chord (col -3)
  const cm9 = solveStradellaChord("Cm9");
  assertEquals(cm9.primaryBass, "C");
  assertEquals(cm9.chordButton?.label, "eb");
  assertEquals(cm9.chordButton?.row, "major");
  assertEquals(cm9.columnOffset, 0);

  // 7. C6/9 -> C bass (col 0) + g chord (col 1)
  const c69 = solveStradellaChord("C6/9");
  assertEquals(c69.primaryBass, "C");
  assertEquals(c69.chordButton?.label, "g");
  assertEquals(c69.chordButton?.row, "major");
  assertEquals(c69.columnOffset, 0);

  // 8. C7alt -> C bass (col 0) + cdim chord (col 0)
  const c7alt = solveStradellaChord("C7alt");
  assertEquals(c7alt.primaryBass, "C");
  assertEquals(c7alt.chordButton?.label, "cdim");
  assertEquals(c7alt.chordButton?.row, "diminished");
  assertEquals(c7alt.columnOffset, 0);
});

Deno.test("M2-CHALLENGE-02: Stradella extended voicings across all 12 roots", () => {
  const roots = [
    { root: "C", col: 0 },
    { root: "G", col: 1 },
    { root: "D", col: 2 },
    { root: "A", col: 3 },
    { root: "E", col: 4 },
    { root: "B", col: 5 },
    { root: "F#", col: 6 },
    { root: "Db", col: -5 },
    { root: "Ab", col: -4 },
    { root: "Eb", col: -3 },
    { root: "Bb", col: -2 },
    { root: "F", col: -1 },
  ];

  for (const { root, col } of roots) {
    // 7#11 test
    const s11 = solveStradellaChord(`${root}7#11`);
    assertEquals(s11.primaryBass, root);
    assertEquals(s11.columnOffset, col);
    assertEquals(s11.chordButton?.row, "diminished");

    // 13 test
    const d13 = solveStradellaChord(`${root}13`);
    assertEquals(d13.primaryBass, root);
    assertEquals(d13.columnOffset, col);
    assertEquals(d13.chordButton?.row, "minor");

    // m9 test
    const m9 = solveStradellaChord(`${root}m9`);
    assertEquals(m9.primaryBass, root);
    assertEquals(m9.columnOffset, col);
    assertEquals(m9.chordButton?.row, "major");

    // 6/9 test
    const six9 = solveStradellaChord(`${root}6/9`);
    assertEquals(six9.primaryBass, root);
    assertEquals(six9.columnOffset, col);
    assertEquals(six9.chordButton?.row, "major");
  }
});

// ============================================================================
// 2. SLASH CHORD COUNTER-BASS DISTANCE MINIMIZATION TESTS
// ============================================================================

Deno.test("M2-CHALLENGE-03: Required slash chord counter-bass vs fundamental selections", () => {
  // 1. C/B -> B_ in G column (Col 1, dist 1 vs fundamental B col 5 dist 5)
  const cOverB = solveStradellaChord("C/B");
  assertEquals(cOverB.primaryBass, "B_");
  assertEquals(cOverB.isCounterBass, true);
  assertEquals(cOverB.chordButton?.label, "c");
  assertEquals(cOverB.columnOffset, 1);
  assertEquals(cOverB.fingering, "2 + 3");

  // 2. F/E -> E_ in C column (Col 0, dist 1 vs fundamental E col 4 dist 5)
  const fOverE = solveStradellaChord("F/E");
  assertEquals(fOverE.primaryBass, "E_");
  assertEquals(fOverE.isCounterBass, true);
  assertEquals(fOverE.chordButton?.label, "f");
  assertEquals(fOverE.columnOffset, 0);
  assertEquals(fOverE.fingering, "2 + 3");

  // 3. Am/G -> fundamental G (Col 1, dist 2 vs counter-bass G_ in Eb col -3 dist 6)
  const amOverG = solveStradellaChord("Am/G");
  assertEquals(amOverG.primaryBass, "G");
  assertEquals(amOverG.isCounterBass, false);
  assertEquals(amOverG.chordButton?.label, "am");
  assertEquals(amOverG.columnOffset, 1);
  assertEquals(amOverG.fingering, "4 + 3");

  // 4. D/F# -> F#_ in D column (Col 2, dist 0 - Major 3rd counter-bass)
  const dOverFsharp = solveStradellaChord("D/F#");
  assertEquals(dOverFsharp.primaryBass, "F#_");
  assertEquals(dOverFsharp.isCounterBass, true);
  assertEquals(dOverFsharp.chordButton?.label, "d");
  assertEquals(dOverFsharp.columnOffset, 2);
  assertEquals(dOverFsharp.fingering, "2 + 3");
});

Deno.test("M2-CHALLENGE-04: Chromatic descending slash line verification (A Whiter Shade of Pale)", () => {
  const sequence = [
    { chord: "C", expectedBass: "C", isCounter: false, col: 0, chordBtn: "c" },
    { chord: "C/B", expectedBass: "B_", isCounter: true, col: 1, chordBtn: "c" },
    { chord: "Am", expectedBass: "A", isCounter: false, col: 3, chordBtn: "am" },
    { chord: "Am/G", expectedBass: "G", isCounter: false, col: 1, chordBtn: "am" },
    { chord: "F", expectedBass: "F", isCounter: false, col: -1, chordBtn: "f" },
    { chord: "F/E", expectedBass: "E_", isCounter: true, col: 0, chordBtn: "f" },
    { chord: "Dm", expectedBass: "D", isCounter: false, col: 2, chordBtn: "dm" },
    { chord: "Dm/C", expectedBass: "C", isCounter: false, col: 0, chordBtn: "dm" },
  ];

  for (const step of sequence) {
    const res = solveStradellaChord(step.chord);
    assertEquals(res.primaryBass, step.expectedBass, `Bass failed for ${step.chord}`);
    assertEquals(res.isCounterBass, step.isCounter, `CounterBass failed for ${step.chord}`);
    assertEquals(res.columnOffset, step.col, `Col offset failed for ${step.chord}`);
    assertEquals(res.chordButton?.label, step.chordBtn, `Chord button failed for ${step.chord}`);
  }
});

Deno.test("M2-CHALLENGE-05: Comprehensive Circle of Fifths 7th-in-bass distance minimization", () => {
  // Test Root/Major7th slash chords around the full Circle of Fifths
  // Every Major/Major7th in bass should choose the counter-bass 1 column to the right!
  const rootMajor7Pairs = [
    { chord: "C/B", expectedBass: "B_", expectedCol: 1 },
    { chord: "G/F#", expectedBass: "F#_", expectedCol: 2 },
    { chord: "D/C#", expectedBass: "C#_", expectedCol: 3 },
    { chord: "A/G#", expectedBass: "G#_", expectedCol: 4 },
    { chord: "E/D#", expectedBass: "D#_", expectedCol: 5 },
    { chord: "B/A#", expectedBass: "A#_", expectedCol: 6 },
    { chord: "F/E", expectedBass: "E_", expectedCol: 0 },
    { chord: "Bb/A", expectedBass: "A_", expectedCol: -1 },
    { chord: "Eb/D", expectedBass: "D_", expectedCol: -2 },
    { chord: "Ab/G", expectedBass: "G_", expectedCol: -3 },
    { chord: "Db/C", expectedBass: "C_", expectedCol: -4 },
    { chord: "Gb/F", expectedBass: "F_", expectedCol: -5 },
  ];

  for (const { chord, expectedBass, expectedCol } of rootMajor7Pairs) {
    const res = solveStradellaChord(chord);
    assertEquals(res.isCounterBass, true, `${chord} should use counter-bass`);
    assertEquals(res.primaryBass, expectedBass, `${chord} bass label mismatch`);
    assertEquals(res.columnOffset, expectedCol, `${chord} column offset mismatch`);
  }
});

// ============================================================================
// 3. KEY SIGNATURE TRANSPOSITION & ENHARMONIC SPELLING STRESS TESTS
// ============================================================================

Deno.test("M2-CHALLENGE-06: 12 Keys x 11 Capo Frets Enharmonic Consistency Oracle", () => {
  const majorKeys = [
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
  ];

  for (const key of majorKeys) {
    for (let fret = 1; fret <= 11; fret++) {
      const soundingKey = getSoundingKey(key, fret);
      const isFlat = isFlatKey(soundingKey);

      // Transpose a sample chord in that key context
      const transposed = transposeChord(key, fret, key);

      // Verify that if soundingKey is a flat key, transposed chord root has no '#'
      if (isFlat) {
        assertEquals(
          transposed.root.includes("#"),
          false,
          `Flat key ${soundingKey} produced sharp chord root ${transposed.root} (written ${key} + capo ${fret})`,
        );
      } else {
        // In sharp keys, transposed chord root must not have 'b' (except maybe F if natural)
        if (transposed.root !== "F" && transposed.root !== "C" && transposed.root !== "G") {
          assertEquals(
            transposed.root.includes("b"),
            false,
            `Sharp key ${soundingKey} produced flat chord root ${transposed.root} (written ${key} + capo ${fret})`,
          );
        }
      }
    }
  }
});

Deno.test("M2-CHALLENGE-07: Rare roots and Unicode normalization under transpositions", () => {
  // Rare roots: Cb, Fb, B#, E#
  const rareChords = ["Cb", "Fb", "B#", "E#", "C/Fb", "G/Cb"];

  for (const chord of rareChords) {
    // Capo 0 must normalize cleanly
    const t0 = transposeChord(chord, 0);
    assertEquals(t0.root.includes("Cb"), false);
    assertEquals(t0.root.includes("Fb"), false);
    assertEquals(t0.root.includes("B#"), false);
    assertEquals(t0.root.includes("E#"), false);

    // Stradella solver must resolve without NaN or errors
    const strad = solveStradellaChord(chord);
    assertEquals(typeof strad.columnOffset, "number");
    assertEquals(isNaN(strad.columnOffset ?? 0), false);
    assertEquals((strad.primaryBass ?? "").length > 0, true);
  }

  // Unicode accidentals
  const unicodeChords = ["B♭7", "F♯m", "C♯dim", "E♭/G", "A♭maj7", "G7(♭9)"];
  for (const chord of unicodeChords) {
    const parsed = parseChord(chord);
    assertEquals(parsed.raw.includes("♭"), false);
    assertEquals(parsed.raw.includes("♯"), false);
    const strad = solveStradellaChord(chord);
    assertEquals(isNaN(strad.columnOffset ?? 0), false);
  }
});

// ============================================================================
// 4. CBA C-SYSTEM GEOMETRY & VOICE LEADING STRESS TESTS
// ============================================================================

Deno.test("M2-CHALLENGE-08: CBA C-System Treble grips for all extended chord qualities", () => {
  const extendedChords = [
    "C7#11",
    "Gb7(#11)",
    "C7b9",
    "G13b9",
    "C13",
    "Cm9",
    "C6/9",
    "C7alt",
    "Dbmaj7",
    "F#m7b5",
  ];

  for (const chordStr of extendedChords) {
    const grip = generateCbaGrip(chordStr, 0);
    assertEquals(grip.notes.length >= 3, true);
    const btns = grip.buttons ?? grip.buttonCoords ?? [];
    assertEquals(btns.length, grip.notes.length);
    assertEquals(typeof grip.centroidColumn, "number");
    assertEquals(isNaN(grip.centroidColumn!), false);

    // Verify fingerings are valid numbers 1-5
    for (const btn of btns) {
      assertEquals((btn.finger ?? 0) >= 1 && (btn.finger ?? 0) <= 5, true);
      assertEquals(btn.row >= 1 && btn.row <= 5, true);
      assertEquals(btn.column >= 1 && btn.column <= 15, true);
    }
  }
});

Deno.test("M2-CHALLENGE-09: CBA voice leading shift bounds across jazz progressions", () => {
  const progressions = [
    ["Dm7", "G7", "Cmaj7", "A7"],
    ["Cm7", "F7", "Bbmaj7", "Ebmaj7"],
    ["Am7", "D7", "Gmaj7", "Cmaj7"],
  ];

  for (const prog of progressions) {
    let prevGrip = generateCbaGrip(prog[0], 0, 5);
    for (let i = 1; i < prog.length; i++) {
      const nextGrip = optimizeVoiceLeading(prog[i], prevGrip);
      const shift = Math.abs((nextGrip.centroidColumn ?? 5) - (prevGrip.centroidColumn ?? 5));
      // Voice leading must keep hand shift bounded within <= 2.5 columns
      assertEquals(
        shift <= 2.5,
        true,
        `Hand shift ${shift} exceeded 2.5 between ${prog[i - 1]} and ${prog[i]}`,
      );
      prevGrip = nextGrip;
    }
  }
});

// ============================================================================
// 5. ADVERSARIAL EDGE CASE & BOUNDARY STRESS TESTS
// ============================================================================

Deno.test("M2-CHALLENGE-10: Accordion physical size boundary clamping", () => {
  // 48-bass: bounds -2 (Bb) to 5 (B)
  assertEquals(isColumnOutOfRange(-2, "48-bass"), false);
  assertEquals(isColumnOutOfRange(5, "48-bass"), false);
  assertEquals(isColumnOutOfRange(-3, "48-bass"), true); // Eb out of 48-bass
  assertEquals(isColumnOutOfRange(6, "48-bass"), true); // F# out of 48-bass

  const c48 = solveStradellaChord("C", "48-bass");
  assertEquals(c48.isOutOfRange, false);

  const eb48 = solveStradellaChord("Eb", "48-bass");
  assertEquals(eb48.isOutOfRange, true);

  const eb72 = solveStradellaChord("Eb", "72-bass");
  assertEquals(eb72.isOutOfRange, false);

  const fsharp72 = solveStradellaChord("F#", "72-bass");
  assertEquals(fsharp72.isOutOfRange, false);

  const db72 = solveStradellaChord("Db", "72-bass");
  assertEquals(db72.isOutOfRange, true); // Db (-5) out of 72-bass (-3 to 6)
});

Deno.test("M2-CHALLENGE-11: Exotic parenthesized alterations and jazz syntax variations", () => {
  const variations = [
    { input: "C7(b9)", expectedQual: "sevenFlatNine" },
    { input: "C7(♭9)", expectedQual: "sevenFlatNine" },
    { input: "C7(-9)", expectedQual: "sevenFlatNine" },
    { input: "C7(#11)", expectedQual: "sevenSharpEleven" },
    { input: "C7(♯11)", expectedQual: "sevenSharpEleven" },
    { input: "C7(+11)", expectedQual: "sevenSharpEleven" },
    { input: "Gb7(#11)", expectedQual: "sevenSharpEleven" },
    { input: "G13(b9)", expectedQual: "sevenFlatNine" },
    { input: "C13", expectedQual: "dominant13" },
    { input: "C6/9", expectedQual: "sixNine" },
    { input: "C69", expectedQual: "sixNine" },
    { input: "C6(9)", expectedQual: "sixNine" },
    { input: "C7alt", expectedQual: "altered" },
    { input: "C7(b5)", expectedQual: "altered" },
    { input: "C7(b13)", expectedQual: "altered" },
  ];

  for (const v of variations) {
    const parsed = parseChord(v.input);
    assertEquals(
      parsed.quality,
      v.expectedQual,
      `Failed to classify ${v.input}: expected ${v.expectedQual}, got ${parsed.quality}`,
    );

    const strad = solveStradellaChord(v.input);
    assertEquals(typeof strad.columnOffset, "number");
    assertEquals(isNaN(strad.columnOffset ?? 0), false);
  }
});
