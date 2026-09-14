import { assertEquals } from "@std/assert";
import {
  decodeTokenIds,
  getTokenId,
  getTokenString,
  getVocabularySize,
  OMR_TOKEN_IDS,
  untokenize,
} from "../../src/lib/score/omrTokenizer.ts";
import {
  mxhmToChordSymbol,
  parseHumdrumScore,
  parseKernDuration,
  parseKernKey,
  parseKernMeter,
  parseKernPitch,
} from "../../src/lib/score/humdrumParser.ts";

Deno.test("OMR-01: Tokenizer vocabulary and token lookup", () => {
  assertEquals(getVocabularySize(), 153);
  assertEquals(getTokenId("<bos>"), OMR_TOKEN_IDS.BOS);
  assertEquals(getTokenId("<eos>"), OMR_TOKEN_IDS.EOS);
  assertEquals(getTokenId("<pad>"), OMR_TOKEN_IDS.PAD);
  assertEquals(getTokenId("<t>"), OMR_TOKEN_IDS.TAB);
  assertEquals(getTokenId("<n>"), OMR_TOKEN_IDS.NEWLINE);
  assertEquals(getTokenId("**kern"), OMR_TOKEN_IDS.KERN);
  assertEquals(getTokenId("**mxhm"), OMR_TOKEN_IDS.MXHM);

  assertEquals(getTokenString(OMR_TOKEN_IDS.BOS), "<bos>");
  assertEquals(getTokenString(OMR_TOKEN_IDS.EOS), "<eos>");
});

Deno.test("OMR-02: Untokenize replaces delimiters and strips prefixes", () => {
  const tokens = [
    "**kern",
    "<t>",
    "**mxhm",
    "<n>",
    "*M4/4",
    "<t>",
    "*",
    "<n>",
    "=1",
    "<t>",
    "=1",
    "<n>",
    "4c",
    "<t>",
    "<chord-pitch>C",
    ":",
    "maj",
    "<n>",
    "4d",
    "<t>",
    ".",
    "<n>",
    "==<n>",
  ];
  const untokenized = untokenize(tokens);
  assertEquals(
    untokenized,
    "**kern\t**mxhm\n*M4/4\t*\n=1\t=1\n4c\tC:maj\n4d\t.\n==\n",
  );
});

Deno.test("OMR-03: decodeTokenIds stops at EOS and omits BOS/PAD", () => {
  const ids = [
    OMR_TOKEN_IDS.BOS,
    OMR_TOKEN_IDS.KERN,
    OMR_TOKEN_IDS.TAB,
    OMR_TOKEN_IDS.MXHM,
    OMR_TOKEN_IDS.EOS,
    OMR_TOKEN_IDS.KERN, // should be ignored after EOS
  ];
  const decoded = decodeTokenIds(ids);
  assertEquals(decoded, "**kern\t**mxhm");
});

Deno.test("OMR-04: mxhmToChordSymbol maps Humdrum chords to standard symbols", () => {
  assertEquals(mxhmToChordSymbol("C:maj"), "C");
  assertEquals(mxhmToChordSymbol("A:min"), "Am");
  assertEquals(mxhmToChordSymbol("G:7"), "G7");
  assertEquals(mxhmToChordSymbol("F:maj7"), "Fmaj7");
  assertEquals(mxhmToChordSymbol("D:min7"), "Dm7");
  assertEquals(mxhmToChordSymbol("B:hdim7"), "Bm7b5");
  assertEquals(mxhmToChordSymbol("B-:maj7"), "Bbmaj7");
  assertEquals(mxhmToChordSymbol("E-:min"), "Ebm");
  assertEquals(mxhmToChordSymbol("F#:min7"), "F#m7");
  assertEquals(mxhmToChordSymbol("C:maj/G"), "C/G");
  assertEquals(mxhmToChordSymbol("D:min7/F#"), "Dm7/F#");
  assertEquals(mxhmToChordSymbol("."), null);
  assertEquals(mxhmToChordSymbol("*"), null);
});

Deno.test("OMR-05: parseKernDuration converts reciprocal durations to quarter-note beats", () => {
  const whole = parseKernDuration("1");
  assertEquals(whole, { numerator: 4, denominator: 1 });

  const half = parseKernDuration("2");
  assertEquals(half, { numerator: 2, denominator: 1 });

  const quarter = parseKernDuration("4c");
  assertEquals(quarter, { numerator: 1, denominator: 1 });

  const eighth = parseKernDuration("8dd#");
  assertEquals(eighth, { numerator: 1, denominator: 2 });

  const sixteenth = parseKernDuration("16g");
  assertEquals(sixteenth, { numerator: 1, denominator: 4 });

  const dottedHalf = parseKernDuration("2.");
  assertEquals(dottedHalf, { numerator: 3, denominator: 1 });

  const dottedQuarter = parseKernDuration("4.a");
  assertEquals(dottedQuarter, { numerator: 3, denominator: 2 });

  const tripletQuarter = parseKernDuration("12cc");
  assertEquals(tripletQuarter, { numerator: 1, denominator: 3 });
});

Deno.test("OMR-06: parseKernPitch parses step, octave, accidentals, and rests", () => {
  // Octaves
  assertEquals(parseKernPitch("c"), { step: "C", alter: 0, octave: 4 });
  assertEquals(parseKernPitch("cc"), { step: "C", alter: 0, octave: 5 });
  assertEquals(parseKernPitch("ccc"), { step: "C", alter: 0, octave: 6 });
  assertEquals(parseKernPitch("C"), { step: "C", alter: 0, octave: 3 });
  assertEquals(parseKernPitch("CC"), { step: "C", alter: 0, octave: 2 });

  // Accidentals
  assertEquals(parseKernPitch("4f#"), { step: "F", alter: 1, octave: 4 });
  assertEquals(parseKernPitch("8b-"), { step: "B", alter: -1, octave: 4 });
  assertEquals(parseKernPitch("2ee##"), { step: "E", alter: 2, octave: 5 });
  assertEquals(parseKernPitch("4dd--"), { step: "D", alter: -2, octave: 5 });

  // Rest
  assertEquals(parseKernPitch("4r"), undefined);
});

Deno.test("OMR-07: parseKernMeter and parseKernKey", () => {
  assertEquals(parseKernMeter("*M4/4"), { beats: 4, beatType: 4 });
  assertEquals(parseKernMeter("*M3/4"), { beats: 3, beatType: 4 });
  assertEquals(parseKernMeter("*met(c)"), { beats: 4, beatType: 4 });
  assertEquals(parseKernMeter("*met(c|)"), { beats: 2, beatType: 2 });

  assertEquals(parseKernKey("*k[]"), { fifths: 0, mode: "major" });
  assertEquals(parseKernKey("*k[f#]"), { fifths: 1, mode: "major" });
  assertEquals(parseKernKey("*k[f#c#]"), { fifths: 2, mode: "major" });
  assertEquals(parseKernKey("*k[b-]"), { fifths: -1, mode: "major" });
  assertEquals(parseKernKey("*k[b-e-a-]"), { fifths: -3, mode: "major" });
});

Deno.test("OMR-08: parseHumdrumScore produces structured ScoreDocument with measures and chords", () => {
  const humdrum = `
**kern\t**mxhm
*clefG2\t*
*k[f#]\t*
*M4/4\t*
*MM120\t*
=1\t=1
=!|:\t*
4g\tG:maj
4b\t.
4dd\t.
4g\t.
=2\t=2
2ee\tC:maj
2dd\tD:7
=:|!\t*
==\t==
*-
`;

  const doc = parseHumdrumScore(humdrum, { title: "Golden Autumn" });
  assertEquals(doc.schemaVersion, 1);
  assertEquals(doc.title, "Golden Autumn");
  assertEquals(doc.key?.fifths, 1);
  assertEquals(doc.time?.beats, 4);
  assertEquals(doc.tempoMap[0]?.bpm, 120);

  assertEquals(doc.measures.length, 2);

  // Measure 1
  const m1 = doc.measures[0];
  assertEquals(m1.writtenIndex, 0);
  assertEquals(m1.printedNumber, 1);
  assertEquals(m1.melody.length, 4);
  assertEquals(m1.harmonies.length, 1);
  assertEquals(m1.harmonies[0].raw, "G");
  assertEquals(m1.navigation[0], { kind: "repeat-start" });

  // Measure 2
  const m2 = doc.measures[1];
  assertEquals(m2.writtenIndex, 1);
  assertEquals(m2.printedNumber, 2);
  assertEquals(m2.melody.length, 2);
  assertEquals(m2.harmonies.length, 2);
  assertEquals(m2.harmonies[0].raw, "C");
  assertEquals(m2.harmonies[1].raw, "D7");
  assertEquals(m2.navigation[0], { kind: "repeat-end" });

  // Verify valid duration - no blocking issues
  const blockingIssues = doc.issues.filter((i) => i.blocksGuidance);
  assertEquals(blockingIssues.length, 0);
});
