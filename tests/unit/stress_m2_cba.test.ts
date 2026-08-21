import { assertEquals, assertNotEquals } from "@std/assert";
import { generateCbaGrip } from "../../src/lib/cba/grips.ts";
import { optimizeVoiceLeading } from "../../src/lib/cba/voiceLeading.ts";
import { parseChord } from "../../src/lib/capo/transposition.ts";
import { transposeChord } from "../../src/lib/capo/enharmonics.ts";
import { solveStradellaChord } from "../../src/lib/stradella/solver.ts";
import type { ChordQuality } from "../../src/types/index.ts";

const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];

const EXTENDED_QUALITIES: Array<{ quality: ChordQuality; suffix: string; expectedNotes: number }> =
  [
    { quality: "major7", suffix: "maj7", expectedNotes: 4 },
    { quality: "minor7", suffix: "m7", expectedNotes: 4 },
    { quality: "sevenSharpEleven", suffix: "7#11", expectedNotes: 4 },
    { quality: "sevenFlatNine", suffix: "7b9", expectedNotes: 4 },
    { quality: "dominant13", suffix: "13", expectedNotes: 4 },
    { quality: "minor9", suffix: "m9", expectedNotes: 4 },
    { quality: "sixNine", suffix: "6/9", expectedNotes: 4 },
    { quality: "altered", suffix: "7alt", expectedNotes: 4 },
    { quality: "major9", suffix: "maj9", expectedNotes: 4 },
    { quality: "dominant9", suffix: "9", expectedNotes: 4 },
    { quality: "halfDiminished7", suffix: "m7b5", expectedNotes: 4 },
    { quality: "diminished7", suffix: "dim7", expectedNotes: 4 },
  ];

Deno.test("STRESS-CBA-01: All 12 roots for extended chords generate valid, collision-free CBA grips", () => {
  for (const root of ROOTS) {
    for (const { suffix, expectedNotes } of EXTENDED_QUALITIES) {
      const chordName = `${root}${suffix}`;
      const grip = generateCbaGrip(chordName, 0, 5);

      // Verify note count
      assertEquals(
        grip.notes.length,
        expectedNotes,
        `Chord ${chordName} note length should be ${expectedNotes}`,
      );

      // Verify button coordinates count
      const buttons = grip.buttonCoords ?? [];
      assertEquals(
        buttons.length,
        expectedNotes,
        `Chord ${chordName} should have ${expectedNotes} button coordinates`,
      );

      // Verify no duplicate button positions (collision check)
      const coordKeys = new Set<string>();
      for (const btn of buttons) {
        const key = `r${btn.row}c${btn.column}`;
        assertEquals(
          coordKeys.has(key),
          false,
          `Chord ${chordName} has button collision at row ${btn.row}, col ${btn.column}`,
        );
        coordKeys.add(key);

        // Verify row is within standard 1..3
        assertEquals(
          btn.row >= 1 && btn.row <= 3,
          true,
          `Row ${btn.row} out of bounds for ${chordName}`,
        );

        // Verify column is within reasonable accordion treble range (e.g. 1..13)
        assertEquals(
          btn.column >= 1 && btn.column <= 13,
          true,
          `Column ${btn.column} out of bounds for ${chordName}`,
        );
      }

      // Verify fingering pattern
      assertEquals(
        grip.fingeringPattern,
        "1-2-4-5",
        `Chord ${chordName} should use 1-2-4-5 fingering`,
      );

      // Verify column spread (hand reach) <= 5 columns
      const cols = buttons.map((b) => b.column);
      const spread = Math.max(...cols) - Math.min(...cols);
      assertEquals(
        spread <= 5,
        true,
        `Chord ${chordName} column spread ${spread} exceeds max hand reach (5)`,
      );
    }
  }
});

Deno.test("STRESS-CBA-02: CBA C-System grips for all inversions (0, 1, 2, 3) of extended chords", () => {
  const testChords = ["Cmaj7", "Cm7", "C7#11", "C7b9", "C13", "Cm9", "C6/9"];

  for (const chord of testChords) {
    for (let inv = 0; inv < 4; inv++) {
      const grip = generateCbaGrip(chord, inv, 5);
      assertEquals(grip.notes.length, 4, `Inversion ${inv} of ${chord} must have 4 notes`);
      assertEquals(grip.fingeringPattern, "1-2-4-5");

      const buttons = grip.buttonCoords ?? [];
      assertEquals(buttons.length, 4);

      // Check collision
      const coordKeys = new Set(buttons.map((b) => `r${b.row}c${b.column}`));
      assertEquals(coordKeys.size, 4, `Inversion ${inv} of ${chord} has button collision`);

      // Check fingers assigned 1, 2, 4, 5
      const fingers = buttons.map((b) => b.finger);
      assertEquals(
        fingers,
        [1, 2, 4, 5],
        `Inversion ${inv} of ${chord} fingers should be [1, 2, 4, 5]`,
      );
    }
  }
});

Deno.test("STRESS-CBA-03: Triad inversions assign standard fingerings (1-2-4 / 1-2-5 / 1-3-5)", () => {
  const triadRoots = ["C", "G", "F", "D", "A", "E", "Bb", "Eb"];

  for (const root of triadRoots) {
    // Root position -> 1-2-4
    const inv0 = generateCbaGrip(root, 0, 5);
    assertEquals(inv0.fingeringPattern, "1-2-4");
    assertEquals(inv0.buttonCoords?.map((b) => b.finger), [1, 2, 4]);

    // 1st Inversion -> 1-2-5
    const inv1 = generateCbaGrip(root, 1, 5);
    assertEquals(inv1.fingeringPattern, "1-2-5");
    assertEquals(inv1.buttonCoords?.map((b) => b.finger), [1, 2, 5]);

    // 2nd Inversion -> 1-3-5
    const inv2 = generateCbaGrip(root, 2, 5);
    assertEquals(inv2.fingeringPattern, "1-3-5");
    assertEquals(inv2.buttonCoords?.map((b) => b.finger), [1, 3, 5]);
  }
});

Deno.test("STRESS-CBA-04: Voice leading across standard and jazz progressions", () => {
  const progressions: string[][] = [
    // Folk / Pop I - IV - V7 - I
    ["C", "F", "G7", "C"],
    // Jazz ii - V - I
    ["Dm7", "G7", "Cmaj7"],
    // Jazz Turnaround with Alterations
    ["Cmaj7", "A7b9", "Dm7", "G7#11", "Cmaj7"],
    // Modal progression
    ["Cm9", "F13", "Bbmaj7", "Eb6/9"],
    // Chromatic descending line
    ["C", "C/B", "Am", "Am/G", "F"],
    // Minor ii-V-i
    ["Dm7b5", "G7alt", "Cm7"],
    // Circle of 5ths chain
    ["Am7", "D7", "Gmaj7", "Cmaj7", "F#m7b5", "B7", "Em"],
  ];

  for (const prog of progressions) {
    let prevGrip = generateCbaGrip(prog[0], 0, 5);

    for (let i = 1; i < prog.length; i++) {
      const nextChord = prog[i];
      const optGrip = optimizeVoiceLeading(nextChord, prevGrip);

      // Verify grip validity
      assertNotEquals(optGrip.buttonCoords, undefined);
      assertEquals(optGrip.buttonCoords!.length >= 3, true);

      // Verify centroid shift is tightly controlled (<= 2.5 columns between consecutive steps)
      const prevCentroid = prevGrip.centroidColumn ?? 5;
      const currCentroid = optGrip.centroidColumn ?? 5;
      const shift = Math.abs(currCentroid - prevCentroid);

      assertEquals(
        shift <= 2.5,
        true,
        `Progression ${prog.join(" -> ")}: step ${
          prog[i - 1]
        } -> ${nextChord} has excessive shift ${shift.toFixed(2)}`,
      );

      prevGrip = optGrip;
    }
  }
});

Deno.test("STRESS-ROOTS-01: Rare roots normalization in parser and transposition", () => {
  const rareTestCases = [
    { raw: "Cb", expectedRoot: "B", expectedPc: 11 },
    { raw: "Fb", expectedRoot: "E", expectedPc: 4 },
    { raw: "B#", expectedRoot: "C", expectedPc: 0 },
    { raw: "E#", expectedRoot: "F", expectedPc: 5 },
    { raw: "cb", expectedRoot: "B", expectedPc: 11 },
    { raw: "fb", expectedRoot: "E", expectedPc: 4 },
    { raw: "b#", expectedRoot: "C", expectedPc: 0 },
    { raw: "e#", expectedRoot: "F", expectedPc: 5 },
    { raw: "Cbmaj7", expectedRoot: "B", expectedPc: 11 },
    { raw: "Fb7#11", expectedRoot: "E", expectedPc: 4 },
    { raw: "B#m7", expectedRoot: "C", expectedPc: 0 },
    { raw: "E#13", expectedRoot: "F", expectedPc: 5 },
    { raw: "Cb6/9", expectedRoot: "B", expectedPc: 11 },
    { raw: "Fb7b9", expectedRoot: "E", expectedPc: 4 },
    { raw: "B#m9", expectedRoot: "C", expectedPc: 0 },
  ];

  for (const tc of rareTestCases) {
    const parsed = parseChord(tc.raw);
    assertEquals(
      parsed.root,
      tc.expectedRoot,
      `parseChord('${tc.raw}') root should be '${tc.expectedRoot}', got '${parsed.root}'`,
    );
    assertEquals(
      parsed.rootPitchClass,
      tc.expectedPc,
      `parseChord('${tc.raw}') rootPitchClass should be ${tc.expectedPc}`,
    );

    // Test transposeChord with capo = 0 (idempotent canonical normalization)
    const transposed0 = transposeChord(tc.raw, 0);
    assertEquals(transposed0.root, tc.expectedRoot);
    assertEquals(transposed0.rootPitchClass, tc.expectedPc);
  }
});

Deno.test("STRESS-ROOTS-02: Rare roots in Stradella solver", () => {
  // Cb normalized to B (Col 5) -> In range for all accordion sizes
  const cb = solveStradellaChord("Cb", "48-bass");
  assertEquals(cb.primaryBass, "B");
  assertEquals(cb.columnOffset, 5);
  assertEquals(cb.isOutOfRange, false);

  // Fb normalized to E (Col 4)
  const fb = solveStradellaChord("Fb", "48-bass");
  assertEquals(fb.primaryBass, "E");
  assertEquals(fb.columnOffset, 4);
  assertEquals(fb.isOutOfRange, false);

  // B# normalized to C (Col 0)
  const bsharp = solveStradellaChord("B#", "48-bass");
  assertEquals(bsharp.primaryBass, "C");
  assertEquals(bsharp.columnOffset, 0);
  assertEquals(bsharp.isOutOfRange, false);

  // E# normalized to F (Col -1)
  const esharp = solveStradellaChord("E#", "48-bass");
  assertEquals(esharp.primaryBass, "F");
  assertEquals(esharp.columnOffset, -1);
  assertEquals(esharp.isOutOfRange, false);

  // Compound extended chord on rare root: Cbmaj7 -> B + d#m
  const cbMaj7 = solveStradellaChord("Cbmaj7", "120-bass");
  assertEquals(cbMaj7.primaryBass, "B");
  assertEquals(cbMaj7.chordButton?.label, "d#m");
  assertEquals(cbMaj7.columnOffset, 5);

  // Fb7#11 -> E + edim
  const fb7sharp11 = solveStradellaChord("Fb7#11", "120-bass");
  assertEquals(fb7sharp11.primaryBass, "E");
  assertEquals(fb7sharp11.chordButton?.label, "edim");
  assertEquals(fb7sharp11.columnOffset, 4);
});

Deno.test("STRESS-ROOTS-03: Slash chords with rare roots in Stradella solver", () => {
  // C/Cb -> C / B -> counter-bass B_ (Col 1)
  const cSlashCb = solveStradellaChord("C/Cb", "120-bass");
  assertEquals(cSlashCb.isCounterBass, true);
  assertEquals(cSlashCb.primaryBass, "B_");
  assertEquals(cSlashCb.columnOffset, 1);

  // G/Fb -> G / E -> counter-bass E_ (Col 0)
  const gSlashFb = solveStradellaChord("G/Fb", "120-bass");
  assertEquals(gSlashFb.isCounterBass, true);
  assertEquals(gSlashFb.primaryBass, "E_");
  assertEquals(gSlashFb.columnOffset, 0);

  // F/E# -> F / F (same root and bass) -> fundamental bass
  const fSlashEsharp = solveStradellaChord("F/E#", "120-bass");
  assertEquals(fSlashEsharp.primaryBass, "F");
  assertEquals(fSlashEsharp.columnOffset, -1);
});

Deno.test("STRESS-UNICODE-01: Unicode accidentals (♯, ♭) normalization across parser, transposition & Stradella", () => {
  const unicodeCases = [
    { chord: "B♭", expRoot: "Bb", expPc: 10 },
    { chord: "F♯", expRoot: "F#", expPc: 6 },
    { chord: "E♭", expRoot: "Eb", expPc: 3 },
    { chord: "A♭m", expRoot: "Ab", expPc: 8 },
    { chord: "D♭maj7", expRoot: "Db", expPc: 1 },
    { chord: "C♯7(♯11)", expRoot: "C#", expPc: 1 },
    { chord: "G7(♭9)", expRoot: "G", expPc: 7 },
    { chord: "C13(♭9)", expRoot: "C", expPc: 0 },
    { chord: "F♯m7(♭5)", expRoot: "F#", expPc: 6 },
    { chord: "B♭/D", expRoot: "Bb", expBass: "D" },
    { chord: "C/B♭", expRoot: "C", expBass: "Bb" },
    { chord: "E♭/G", expRoot: "Eb", expBass: "G" },
  ];

  for (const tc of unicodeCases) {
    // 1. Parser
    const parsed = parseChord(tc.chord);
    assertEquals(parsed.root, tc.expRoot, `parseChord('${tc.chord}') root mismatch`);
    if (tc.expPc !== undefined) {
      assertEquals(parsed.rootPitchClass, tc.expPc);
    }
    if (tc.expBass) {
      assertEquals(parsed.bassNote, tc.expBass);
    }

    // 2. Transposition (capo 0)
    const trans0 = transposeChord(tc.chord, 0);
    assertEquals(trans0.root, tc.expRoot);

    // 3. Transposition (capo 2)
    const trans2 = transposeChord(tc.chord, 2);
    assertNotEquals(trans2.root, "");
    assertEquals(typeof trans2.rootPitchClass, "number");

    // 4. Stradella
    const strad = solveStradellaChord(tc.chord);
    assertNotEquals(strad.primaryBass, "");
    assertEquals(typeof strad.columnOffset, "number");

    // 5. CBA Grip
    const cba = generateCbaGrip(tc.chord, 0, 5);
    assertNotEquals(cba.buttonCoords, undefined);
    assertEquals(cba.buttonCoords!.length >= 3, true);
  }
});
