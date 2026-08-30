import { assertEquals } from "@std/assert";
import { generateCbaGrip, getChordNotes, getChordPitchClasses } from "../../src/lib/cba/grips.ts";
import { classifyChordQuality, parseChord } from "../../src/lib/capo/transposition.ts";
import { isChordToken } from "../../src/lib/parser/twoline.ts";
import { solveStradellaGroove } from "../../src/lib/stradella/grooves.ts";
import { solveStradellaChord } from "../../src/lib/stradella/solver.ts";
import type { ChordQuality } from "../../src/types/index.ts";

const PARSER_CASES: Array<{
  token: string;
  quality: ChordQuality;
  extension: string;
  root?: string;
  bassNote?: string;
}> = [
  { token: "C5", quality: "power5", extension: "5" },
  { token: "Cm(maj7)", quality: "minorMajor7", extension: "m(maj7)" },
  { token: "CmMaj7", quality: "minorMajor7", extension: "mMaj7" },
  { token: "Cmin(maj7)", quality: "minorMajor7", extension: "min(maj7)" },
  { token: "CmM7", quality: "minorMajor7", extension: "mM7" },
  {
    token: "Em(maj7)/D#",
    quality: "minorMajor7",
    extension: "m(maj7)",
    root: "E",
    bassNote: "D#",
  },
  { token: "C7sus4", quality: "dominant7Sus4", extension: "7sus4" },
  { token: "C7sus", quality: "dominant7Sus4", extension: "7sus" },
  { token: "C11", quality: "dominant11", extension: "11" },
  { token: "Cm11", quality: "minor11", extension: "m11" },
  { token: "Cmin11", quality: "minor11", extension: "min11" },
  { token: "C7#9", quality: "sevenSharpNine", extension: "7#9" },
  { token: "C7(#9)", quality: "sevenSharpNine", extension: "7(#9)" },
  { token: "C7♯9", quality: "sevenSharpNine", extension: "7#9" },
  { token: "C7(♯9)", quality: "sevenSharpNine", extension: "7(#9)" },
  { token: "C7#5", quality: "sevenSharpFive", extension: "7#5" },
  { token: "C7(#5)", quality: "sevenSharpFive", extension: "7(#5)" },
  { token: "C7(♯5)", quality: "sevenSharpFive", extension: "7(#5)" },
  { token: "Caug7", quality: "sevenSharpFive", extension: "aug7" },
  { token: "C+7", quality: "sevenSharpFive", extension: "+7" },
  { token: "Cadd4", quality: "add4", extension: "add4" },
  { token: "Cadd11", quality: "add4", extension: "add11" },
];

Deno.test("CHORD-COVERAGE-PARSER-01: locked spellings are accepted and classified semantically", () => {
  for (const expected of PARSER_CASES) {
    assertEquals(isChordToken(expected.token), true, `Tokenizer rejected ${expected.token}`);
    const parsed = parseChord(expected.token);
    assertEquals(parsed.quality, expected.quality, `Quality mismatch for ${expected.token}`);
    assertEquals(parsed.root, expected.root ?? "C");
    assertEquals(parsed.extension, expected.extension);
    assertEquals(parsed.bassNote, expected.bassNote);
    assertEquals(parsed.raw, expected.token.replace(/♯/g, "#"));
  }
});

Deno.test("CHORD-COVERAGE-PARSER-02: new precedence does not absorb distinct existing qualities", () => {
  assertEquals(parseChord("Caug").quality, "augmented");
  assertEquals(parseChord("C+").quality, "augmented");
  assertEquals(parseChord("C7sus2").quality, "sus2");
  assertEquals(classifyChordQuality("7♯9", ""), "sevenSharpNine");
  assertEquals(classifyChordQuality("7♯5", ""), "sevenSharpFive");
  assertEquals(isChordToken("not-a-chord"), false);
});

const RH_CASES: Array<{ quality: ChordQuality; suffix: string; intervals: number[] }> = [
  { quality: "power5", suffix: "5", intervals: [0, 7] },
  { quality: "minorMajor7", suffix: "m(maj7)", intervals: [0, 3, 7, 11] },
  { quality: "dominant7Sus4", suffix: "7sus4", intervals: [0, 5, 7, 10] },
  { quality: "dominant11", suffix: "11", intervals: [0, 10, 2, 5] },
  { quality: "minor11", suffix: "m11", intervals: [0, 3, 10, 5] },
  { quality: "sevenSharpNine", suffix: "7#9", intervals: [0, 4, 10, 3] },
  { quality: "sevenSharpFive", suffix: "7#5", intervals: [0, 4, 8, 10] },
  { quality: "add4", suffix: "add4", intervals: [0, 4, 5, 7] },
];

Deno.test("CHORD-COVERAGE-RH-01: locked RH pitch sets are exact at C and transpose across 12 roots", () => {
  const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

  for (const { quality, suffix, intervals } of RH_CASES) {
    const cChord = parseChord(`C${suffix}`);
    assertEquals(cChord.quality, quality);
    assertEquals(getChordPitchClasses(0, quality), intervals);

    for (const root of roots) {
      const parsed = parseChord(`${root}${suffix}`);
      assertEquals(parsed.quality, quality, `${root}${suffix} quality mismatch`);
      const expected = intervals.map((interval) => (parsed.rootPitchClass + interval) % 12);
      assertEquals(
        getChordPitchClasses(parsed.rootPitchClass, quality),
        expected,
        `${root}${suffix} pitch-set mismatch`,
      );
    }
  }
});

Deno.test("CHORD-COVERAGE-RH-02: altered auto spelling and truthful power grip fingering", () => {
  assertEquals(getChordNotes(parseChord("C7#9")).includes("D#"), true);
  assertEquals(getChordNotes(parseChord("C7#5")).includes("G#"), true);

  const powerGrip = generateCbaGrip("C5");
  assertEquals(powerGrip.notes, ["C", "G"]);
  assertEquals(powerGrip.buttonCoords?.length, 2);
  assertEquals(powerGrip.buttonCoords?.map((button) => button.finger), [1, 2]);
  assertEquals(powerGrip.fingeringPattern, "1-2");

  assertEquals((generateCbaGrip("C11").buttonCoords?.length ?? 0) <= 4, true);
  assertEquals((generateCbaGrip("Cm11").buttonCoords?.length ?? 0) <= 4, true);
});

Deno.test("CHORD-COVERAGE-LH-01: exact compound recipes and bass-only strategies", () => {
  const expectations: Array<{
    token: string;
    bass: string;
    chord?: string;
    row?: string;
  }> = [
    { token: "Cm(maj7)", bass: "C", chord: "cm", row: "minor" },
    { token: "C11", bass: "C", chord: "gm", row: "minor" },
    { token: "Cm11", bass: "C", chord: "eb", row: "major" },
    { token: "C7#9", bass: "C", chord: "c7", row: "seventh" },
    { token: "C7#5", bass: "C", chord: "c7", row: "seventh" },
    { token: "Cadd4", bass: "C", chord: "c", row: "major" },
    { token: "C5", bass: "C" },
    { token: "C7sus4", bass: "C" },
  ];

  for (const expected of expectations) {
    const voicing = solveStradellaChord(expected.token);
    assertEquals(voicing.primaryBass, expected.bass, `${expected.token} bass mismatch`);
    assertEquals(voicing.chordButton?.label, expected.chord, `${expected.token} chord mismatch`);
    assertEquals(voicing.chordButton?.row, expected.row, `${expected.token} row mismatch`);
    assertEquals(typeof voicing.columnOffset, "number");
    assertEquals(voicing.isOutOfRange, false);
  }

  assertEquals(
    solveStradellaGroove(parseChord("C5"), solveStradellaChord("C5"), "boom_chick"),
    null,
  );
  assertEquals(
    solveStradellaGroove(parseChord("C7sus4"), solveStradellaChord("C7sus4"), "boom_chick"),
    null,
  );
});

Deno.test("CHORD-COVERAGE-LH-02: slash semantics preserve new family rows and minimum-distance bass", () => {
  const minorMajorSlash = solveStradellaChord("Em(maj7)/D#");
  assertEquals(minorMajorSlash.primaryBass, "D#_");
  assertEquals(minorMajorSlash.isCounterBass, true);
  assertEquals(minorMajorSlash.columnOffset, 5);
  assertEquals(minorMajorSlash.chordButton?.label, "em");
  assertEquals(minorMajorSlash.chordButton?.row, "minor");

  const bassOnlySlash = solveStradellaChord("C7sus4/E");
  assertEquals(bassOnlySlash.chordButton, undefined);
  assertEquals(bassOnlySlash.isCounterBass, true);
  assertEquals(bassOnlySlash.columnOffset, 0);

  const roots = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  for (const root of roots) {
    for (const { suffix } of RH_CASES) {
      const voicing = solveStradellaChord(`${root}${suffix}`);
      assertEquals(typeof voicing.columnOffset, "number");
      assertEquals(voicing.rootButton?.row, "bass");
    }
  }
});
