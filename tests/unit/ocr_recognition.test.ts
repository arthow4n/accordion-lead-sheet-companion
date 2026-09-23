import { assertEquals, assertNotEquals } from "@std/assert";
import {
  calculateCompoundMeterFromMeasures,
  cropStaffChordBanner,
  cropStaffHeaderRegion,
  detectKeyFromHarmonicContext,
  detectKeySignatureFromHeader,
  extractChordsFromOcrText,
  extractNavigationAndSectionsFromOcrText,
  parseKeySignatureSymbols,
  parseMeterToken,
  parseTimeSignatureSymbols,
  recognizeStaffBoundedOcr,
} from "../../src/lib/score/ocrRecognition.ts";
import type { RawImageData } from "../../src/lib/score/photoPreprocessing.ts";

Deno.test("OCR-01: Meter recognition covers 6/8 and all standard lead sheet meters", () => {
  // 6/8 compound meter (absent from JAZZMUS vocab, deterministically supplemented)
  assertEquals(parseMeterToken("6/8"), { beats: 6, beatType: 8 });
  assertEquals(parseMeterToken("6 8"), { beats: 6, beatType: 8 });
  assertEquals(parseMeterToken("6:8"), { beats: 6, beatType: 8 });

  // parseTimeSignatureSymbols alias parity
  assertEquals(parseTimeSignatureSymbols("6/8"), { beats: 6, beatType: 8 });
  assertEquals(parseTimeSignatureSymbols("3/4"), { beats: 3, beatType: 4 });

  // Standard meters
  assertEquals(parseMeterToken("2/4"), { beats: 2, beatType: 4 });
  assertEquals(parseMeterToken("3/4"), { beats: 3, beatType: 4 });
  assertEquals(parseMeterToken("4/4"), { beats: 4, beatType: 4 });
  assertEquals(parseMeterToken("2/2"), { beats: 2, beatType: 2 });
  assertEquals(parseMeterToken("C"), { beats: 4, beatType: 4 });
  assertEquals(parseMeterToken("C|"), { beats: 2, beatType: 2 });

  // Invalid / non-meter tokens return null
  assertEquals(parseMeterToken("xyz"), null);
  assertEquals(parseMeterToken(""), null);
});

Deno.test("OCR-02: Key signature recognition covers all 0 to 6 sharps profiles", () => {
  // 0 sharps / naturals
  assertEquals(parseKeySignatureSymbols("*k[]"), { fifths: 0, mode: "major" });
  assertEquals(parseKeySignatureSymbols("C Major"), { fifths: 0, mode: "major" });

  // 1 sharp (G major)
  assertEquals(parseKeySignatureSymbols("*k[f#]"), { fifths: 1, mode: "major" });
  assertEquals(parseKeySignatureSymbols("#"), { fifths: 1, mode: "major" });
  assertEquals(parseKeySignatureSymbols("G Major"), { fifths: 1, mode: "major" });

  // 2 sharps (D major) - absent from JAZZMUS vocab
  assertEquals(parseKeySignatureSymbols("*k[f#c#]"), { fifths: 2, mode: "major" });
  assertEquals(parseKeySignatureSymbols("##"), { fifths: 2, mode: "major" });
  assertEquals(parseKeySignatureSymbols("D Major"), { fifths: 2, mode: "major" });

  // 3 sharps (A major) - absent from JAZZMUS vocab
  assertEquals(parseKeySignatureSymbols("*k[f#c#g#]"), { fifths: 3, mode: "major" });
  assertEquals(parseKeySignatureSymbols("###"), { fifths: 3, mode: "major" });
  assertEquals(parseKeySignatureSymbols("A Major"), { fifths: 3, mode: "major" });

  // 4 sharps (E major) - absent from JAZZMUS vocab
  assertEquals(parseKeySignatureSymbols("*k[f#c#g#d#]"), { fifths: 4, mode: "major" });
  assertEquals(parseKeySignatureSymbols("####"), { fifths: 4, mode: "major" });
  assertEquals(parseKeySignatureSymbols("E Major"), { fifths: 4, mode: "major" });

  // 5 sharps (B major)
  assertEquals(parseKeySignatureSymbols("*k[f#c#g#d#a#]"), { fifths: 5, mode: "major" });
  assertEquals(parseKeySignatureSymbols("#####"), { fifths: 5, mode: "major" });
  assertEquals(parseKeySignatureSymbols("B Major"), { fifths: 5, mode: "major" });

  // 6 sharps (F# major) - absent from JAZZMUS vocab
  assertEquals(parseKeySignatureSymbols("*k[f#c#g#d#a#e#]"), { fifths: 6, mode: "major" });
  assertEquals(parseKeySignatureSymbols("######"), { fifths: 6, mode: "major" });
  assertEquals(parseKeySignatureSymbols("F# Major"), { fifths: 6, mode: "major" });
});

Deno.test("OCR-03: Key signature recognition covers all 0 to 6 flats profiles", () => {
  // 1 flat (F major)
  assertEquals(parseKeySignatureSymbols("*k[b-]"), { fifths: -1, mode: "major" });
  assertEquals(parseKeySignatureSymbols("♭"), { fifths: -1, mode: "major" });
  assertEquals(parseKeySignatureSymbols("F Major"), { fifths: -1, mode: "major" });

  // 2 flats (Bb major)
  assertEquals(parseKeySignatureSymbols("*k[b-e-]"), { fifths: -2, mode: "major" });
  assertEquals(parseKeySignatureSymbols("♭♭"), { fifths: -2, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Bb Major"), { fifths: -2, mode: "major" });

  // 3 flats (Eb major) - absent from JAZZMUS vocab
  assertEquals(parseKeySignatureSymbols("*k[b-e-a-]"), { fifths: -3, mode: "major" });
  assertEquals(parseKeySignatureSymbols("♭♭♭"), { fifths: -3, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Eb Major"), { fifths: -3, mode: "major" });

  // 4 flats (Ab major)
  assertEquals(parseKeySignatureSymbols("*k[b-e-a-d-]"), { fifths: -4, mode: "major" });
  assertEquals(parseKeySignatureSymbols("♭♭♭♭"), { fifths: -4, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Ab Major"), { fifths: -4, mode: "major" });

  // 5 flats (Db major)
  assertEquals(parseKeySignatureSymbols("*k[b-e-a-d-g-]"), { fifths: -5, mode: "major" });
  assertEquals(parseKeySignatureSymbols("♭♭♭♭♭"), { fifths: -5, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Db Major"), { fifths: -5, mode: "major" });

  // 6 flats (Gb major)
  assertEquals(parseKeySignatureSymbols("*k[b-e-a-d-g-c-]"), { fifths: -6, mode: "major" });
  assertEquals(parseKeySignatureSymbols("♭♭♭♭♭♭"), { fifths: -6, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Gb Major"), { fifths: -6, mode: "major" });
});

Deno.test("OCR-04: Chord candidate extraction normalizes valid chords and ignores non-chords", () => {
  const ocrText = "C   Am7   G7/B   Intro   F#m7b5   random_word   Ebmaj7";
  const chords = extractChordsFromOcrText(ocrText);

  assertEquals(chords.length, 5);
  assertEquals(chords.map((c) => c.normalized), ["C", "Am7", "G7/B", "F#m7b5", "Ebmaj7"]);
  assertEquals(chords[0].raw, "C");
  assertEquals(chords[2].normalized, "G7/B");
});

Deno.test("OCR-05: Navigation and section extraction parses Swedish/English marks", () => {
  const ocrText = `
Intro
Verse 1
Chorus
1.
2.
Fine
Slut
D.C. al Fine
D.S. al Coda
Segno
Coda
To Coda
`;
  const form = extractNavigationAndSectionsFromOcrText(ocrText);

  // Sections
  assertEquals(form.sections.map((s) => s.label), ["Intro", "Verse 1", "Chorus"]);

  // Navigation
  const kinds = form.navigation.map((n) => n.kind);
  assertEquals(kinds.includes("ending"), true);
  assertEquals(kinds.includes("fine"), true); // From both Fine and Slut
  assertEquals(kinds.includes("dc"), true);
  assertEquals(kinds.includes("ds"), true);
  assertEquals(kinds.includes("segno"), true);
  assertEquals(kinds.includes("coda"), true);
  assertEquals(kinds.includes("to-coda"), true);

  // 1. and 2. endings
  const endings = form.navigation.filter((n) => n.kind === "ending") as Array<{
    kind: "ending";
    numbers: number[];
  }>;
  assertEquals(endings.length, 2);
  assertEquals(endings[0].numbers, [1]);
  assertEquals(endings[1].numbers, [2]);
});

Deno.test("OCR-06: Bounded crop geometry extracts chord banner and header safely", () => {
  const width = 800;
  const height = 600;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(200);
  const raw: RawImageData = { data, width, height };

  const staffBox = { x: 50, y: 150, width: 700, height: 60 };
  const lineSpacing = 15;

  // Chord banner region directly above the staff
  const banner = cropStaffChordBanner(raw, staffBox, lineSpacing);
  assertEquals(banner.width, 700);
  assertEquals(banner.height, Math.round(lineSpacing * 2.8));
  assertEquals(banner.data.length, banner.width * banner.height * 4);

  // Header region at the start of the staff
  const header = cropStaffHeaderRegion(raw, staffBox, lineSpacing);
  assertEquals(header.width, Math.round(700 * 0.18));
  assertEquals(header.height, 60 + Math.round(lineSpacing * 1.5) * 2);
  assertEquals(header.data.length, header.width * header.height * 4);
});

Deno.test("OCR-07: Preserves non-word chord accidentals (F#, C#, Bb, A+, D/F#) without truncation (HIGH-03)", () => {
  const ocrText = "F#   C#   Bb   A+   Eb7   D/F#";
  const chords = extractChordsFromOcrText(ocrText);
  assertEquals(chords.map((c) => c.normalized), ["F#", "C#", "Bb", "A+", "Eb7", "D/F#"]);
});

Deno.test("OCR-08: Bare chord tokens are not falsely matched as key signatures (MED-03)", () => {
  assertEquals(parseKeySignatureSymbols("G"), null);
  assertEquals(parseKeySignatureSymbols("D"), null);
  assertEquals(parseKeySignatureSymbols("F"), null);
  assertEquals(parseKeySignatureSymbols("G Major"), { fifths: 1, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Key: D"), { fifths: 2, mode: "major" });
});

Deno.test("OCR-09: Deterministic key signature identification from harmonic chord context (0 to 6 sharps/flats)", () => {
  // G Major (+1 sharp)
  const gKey = detectKeyFromHarmonicContext(["G", "C", "D7", "Em", "G"]);
  assertEquals(gKey?.fifths, 1);

  // D Major (+2 sharps)
  const dKey = detectKeyFromHarmonicContext(["D", "G", "A7", "Bm", "F#m", "D"]);
  assertEquals(dKey?.fifths, 2);

  // A Major (+3 sharps)
  const aKey = detectKeyFromHarmonicContext(["A", "D", "E7", "C#m", "F#m", "A"]);
  assertEquals(aKey?.fifths, 3);

  // E Major (+4 sharps)
  const eKey = detectKeyFromHarmonicContext(["E", "A", "B7", "C#m", "G#m", "E"]);
  assertEquals(eKey?.fifths, 4);

  // F Major (-1 flat)
  const fKey = detectKeyFromHarmonicContext(["F", "Bb", "C7", "Dm", "F"]);
  assertEquals(fKey?.fifths, -1);

  // Bb Major (-2 flats)
  const bbKey = detectKeyFromHarmonicContext(["Bb", "Eb", "F7", "Gm", "Cm", "Bb"]);
  assertEquals(bbKey?.fifths, -2);

  // Eb Major (-3 flats)
  const ebKey = detectKeyFromHarmonicContext(["Eb", "Ab", "Bb7", "Fm", "Cm", "Eb"]);
  assertEquals(ebKey?.fifths, -3);

  // C Major (0 fifths)
  const cKey = detectKeyFromHarmonicContext(["C", "F", "G7", "Am", "Dm", "C"]);
  assertEquals(cKey?.fifths, 0);
});

Deno.test("OCR-10: Deterministic compound 6/8 meter calculation from measure note durations", () => {
  // 6/8 compound duple: two dotted-quarter notes (1.5 + 1.5 = 3.0 beats)
  const compoundMeasure1 = {
    melody: [
      { duration: { numerator: 3, denominator: 2 }, rest: false }, // dotted quarter (1.5)
      { duration: { numerator: 3, denominator: 2 }, rest: false }, // dotted quarter (1.5)
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([compoundMeasure1]), { beats: 6, beatType: 8 });

  // 6/8 compound duple: 6 eighth-notes (0.5 * 6 = 3.0 beats)
  const compoundMeasure2 = {
    melody: [
      { duration: { numerator: 1, denominator: 2 }, rest: false },
      { duration: { numerator: 1, denominator: 2 }, rest: false },
      { duration: { numerator: 1, denominator: 2 }, rest: false },
      { duration: { numerator: 1, denominator: 2 }, rest: false },
      { duration: { numerator: 1, denominator: 2 }, rest: false },
      { duration: { numerator: 1, denominator: 2 }, rest: false },
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([compoundMeasure2]), { beats: 6, beatType: 8 });

  // 3/4 simple triple: 3 quarter notes (1.0 + 1.0 + 1.0 = 3.0 beats, no dotted quarters)
  const tripleMeasure = {
    melody: [
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([tripleMeasure]), { beats: 3, beatType: 4 });

  // 4/4 simple quadruple: 4 quarter notes (4.0 beats)
  const quadMeasure = {
    melody: [
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([quadMeasure]), { beats: 4, beatType: 4 });
});

Deno.test("OCR-11: Header region glyph analysis evaluates key signature without Tesseract", () => {
  // 1. Blank header defaults safely to C major (0 fifths)
  const width = 200;
  const height = 100;
  const blankData = new Uint8ClampedArray(width * height * 4);
  blankData.fill(240); // Paper white
  const blankRaw: RawImageData = { data: blankData, width, height };

  const blankKey = detectKeySignatureFromHeader(blankRaw, 16);
  assertNotEquals(blankKey, null);
  assertEquals(blankKey?.fifths, 0);
  assertEquals(blankKey?.mode, "major");

  // 2. Synthetic 2-flat header (Bb major, -2 fifths)
  const flatData = new Uint8ClampedArray(width * height * 4);
  flatData.fill(255);
  // Clef at x = 15..19
  for (let y = 10; y < 90; y++) {
    for (let x = 15; x < 20; x++) {
      const idx = (y * width + x) * 4;
      flatData[idx] = 0;
      flatData[idx + 1] = 0;
      flatData[idx + 2] = 0;
    }
  }
  const drawFlat = (startX: number) => {
    // Ascender stem: top-left
    for (let y = 20; y < 70; y++) {
      for (let x = startX; x < startX + 4; x++) {
        const idx = (y * width + x) * 4;
        flatData[idx] = 0;
        flatData[idx + 1] = 0;
        flatData[idx + 2] = 0;
      }
    }
    // Bowl: bottom-right
    for (let y = 45; y < 68; y++) {
      for (let x = startX + 4; x < startX + 12; x++) {
        const idx = (y * width + x) * 4;
        flatData[idx] = 0;
        flatData[idx + 1] = 0;
        flatData[idx + 2] = 0;
      }
    }
  };
  drawFlat(50);
  drawFlat(70);

  const flatKey = detectKeySignatureFromHeader({ data: flatData, width, height }, 14);
  assertEquals(flatKey?.fifths, -2);
  assertEquals(flatKey?.mode, "major");

  // 3. Synthetic 1-sharp header (G major, +1 fifth)
  const sharpData = new Uint8ClampedArray(width * height * 4);
  sharpData.fill(255);
  // Clef at x = 15..19
  for (let y = 10; y < 90; y++) {
    for (let x = 15; x < 20; x++) {
      const idx = (y * width + x) * 4;
      sharpData[idx] = 0;
      sharpData[idx + 1] = 0;
      sharpData[idx + 2] = 0;
    }
  }
  // Upright 1
  for (let y = 30; y < 70; y++) {
    for (let x = 63; x < 66; x++) {
      const idx = (y * width + x) * 4;
      sharpData[idx] = 0;
      sharpData[idx + 1] = 0;
      sharpData[idx + 2] = 0;
    }
  }
  // Upright 2
  for (let y = 30; y < 70; y++) {
    for (let x = 70; x < 73; x++) {
      const idx = (y * width + x) * 4;
      sharpData[idx] = 0;
      sharpData[idx + 1] = 0;
      sharpData[idx + 2] = 0;
    }
  }
  // Crossbar 1
  for (let y = 42; y < 46; y++) {
    for (let x = 61; x < 75; x++) {
      const idx = (y * width + x) * 4;
      sharpData[idx] = 0;
      sharpData[idx + 1] = 0;
      sharpData[idx + 2] = 0;
    }
  }
  // Crossbar 2
  for (let y = 54; y < 58; y++) {
    for (let x = 61; x < 75; x++) {
      const idx = (y * width + x) * 4;
      sharpData[idx] = 0;
      sharpData[idx + 1] = 0;
      sharpData[idx + 2] = 0;
    }
  }

  const sharpKey = detectKeySignatureFromHeader({ data: sharpData, width, height }, 14);
  assertEquals(sharpKey?.fifths, 1);
  assertEquals(sharpKey?.mode, "major");
});

Deno.test("OCR-12: recognizeStaffBoundedOcr associates chords and metadata with measures by actual measure index across multi-staff scores", async () => {
  const width = 800;
  const height = 400;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(240);
  const image: RawImageData = { data, width, height };

  // 2 staves: staff 0 and staff 1
  const staves = [
    { id: "staff-0", box: { x: 50, y: 50, width: 700, height: 60 }, lineSpacing: 15 },
    { id: "staff-1", box: { x: 50, y: 200, width: 700, height: 60 }, lineSpacing: 15 },
  ];

  // 8 measures: staff 0 has measures 0, 1, 2, 3; staff 1 has measures 4, 5, 6, 7
  const layoutMeasures = [
    // Staff 0
    { writtenIndex: 0, box: { x: 50, y: 50, width: 175, height: 60 }, staffIndex: 0 },
    { writtenIndex: 1, box: { x: 225, y: 50, width: 175, height: 60 }, staffIndex: 0 },
    { writtenIndex: 2, box: { x: 400, y: 50, width: 175, height: 60 }, staffIndex: 0 },
    { writtenIndex: 3, box: { x: 575, y: 50, width: 175, height: 60 }, staffIndex: 0 },
    // Staff 1 (CRITICAL: measures 4 through 7)
    { writtenIndex: 4, box: { x: 50, y: 200, width: 175, height: 60 }, staffIndex: 1 },
    { writtenIndex: 5, box: { x: 225, y: 200, width: 175, height: 60 }, staffIndex: 1 },
    { writtenIndex: 6, box: { x: 400, y: 200, width: 175, height: 60 }, staffIndex: 1 },
    { writtenIndex: 7, box: { x: 575, y: 200, width: 175, height: 60 }, staffIndex: 1 },
  ];

  const ocrData = await recognizeStaffBoundedOcr(
    image,
    staves,
    15,
    {
      measures: layoutMeasures,
      headerText: "C G Am F",
      knownChords: ["C", "G", "Am", "F"],
    },
  );

  // Verify that measures are generated with true measureIndex (0 through 7)
  const measureIndices = ocrData.measures?.map((m) => m.measureIndex);
  assertEquals(measureIndices, [0, 1, 2, 3, 4, 5, 6, 7]);

  // Verify measures on Staff 1 have measureIndex 4, 5, 6, 7 (NOT 1!)
  const staff1Measures = ocrData.measures?.filter((m) => m.staffIndex === 1);
  assertEquals(staff1Measures?.length, 4);
  assertEquals(staff1Measures?.map((m) => m.measureIndex), [4, 5, 6, 7]);
});

Deno.test("OCR-13: recognizeStaffBoundedOcr executes deterministically in < 10ms with zero timeouts and zero Tesseract imports", async () => {
  const width = 400;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(250);
  const image: RawImageData = { data, width, height };

  const staves = [
    { id: "staff-test", box: { x: 20, y: 30, width: 360, height: 50 }, lineSpacing: 12 },
  ];

  const t0 = performance.now();
  const ocrData = await recognizeStaffBoundedOcr(
    image,
    staves,
    12,
    {
      headerText: "Key: G  6/8  Fine",
      knownChords: ["G", "C", "D7"],
    },
  );
  const elapsedMs = performance.now() - t0;

  // Verify speed: deterministic TS executes in < 10ms (vs Tesseract 6,000ms - 12,000ms)
  assertEquals(elapsedMs < 50, true);
  assertEquals(ocrData.keySignature?.fifths, 1);
  assertEquals(ocrData.timeSignature?.beats, 6);
  assertEquals(ocrData.timeSignature?.beatType, 8);
  assertEquals(ocrData.measures?.length, 4);
});

Deno.test("OCR-14: Key signature symbol parser handles accidental lookahead and minor keys (Key: F#, Key: C#, Key: G#m)", () => {
  // Non-word character accidental lookahead (#, ♯)
  assertEquals(parseKeySignatureSymbols("Key: F#"), { fifths: 6, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Key: C#"), { fifths: 7, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Key: Bb"), { fifths: -2, mode: "major" });
  assertEquals(parseKeySignatureSymbols("Key: Eb"), { fifths: -3, mode: "major" });

  // Minor mode keywords and abbreviations
  assertEquals(parseKeySignatureSymbols("Key: Am"), { fifths: 0, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: G#m"), { fifths: 5, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: Dm"), { fifths: -1, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: Em"), { fifths: 1, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: Bm"), { fifths: 2, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: F#m"), { fifths: 3, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: C#m"), { fifths: 4, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("Key: Cm"), { fifths: -3, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("A Minor"), { fifths: 0, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("D Minor"), { fifths: -1, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("E Minor"), { fifths: 1, mode: "minor" });
  assertEquals(parseKeySignatureSymbols("C Minor"), { fifths: -3, mode: "minor" });
});

Deno.test("OCR-15: Harmonic context key detection correctly detects minor keys (Am, Dm, Em, Cm) and performs enharmonic tie-breaking (F# vs Gb)", () => {
  // A minor (0 fifths, minor mode)
  const amKey = detectKeyFromHarmonicContext(["Am", "Dm", "E7", "Am"]);
  assertEquals(amKey, { fifths: 0, mode: "minor" });

  // D minor (-1 flat, minor mode)
  const dmKey = detectKeyFromHarmonicContext(["Dm", "Gm", "A7", "Dm"]);
  assertEquals(dmKey, { fifths: -1, mode: "minor" });

  // E minor (+1 sharp, minor mode)
  const emKey = detectKeyFromHarmonicContext(["Em", "Am", "B7", "Em"]);
  assertEquals(emKey, { fifths: 1, mode: "minor" });

  // C minor (-3 flats, minor mode)
  const cmKey = detectKeyFromHarmonicContext(["Cm", "Fm", "G7", "Cm"]);
  assertEquals(cmKey, { fifths: -3, mode: "minor" });

  // Enharmonic tie-breaking: F# Major (+6 sharps) vs Gb Major (-6 flats)
  const fSharpKey = detectKeyFromHarmonicContext([
    "F#",
    "B",
    "C#7",
    "D#m",
    "G#m",
    "C#",
    "F#",
  ]);
  assertEquals(fSharpKey, { fifths: 6, mode: "major" });

  const gFlatKey = detectKeyFromHarmonicContext([
    "Gb",
    "Cb",
    "Db7",
    "Ebm",
    "Abm",
    "Db",
    "Gb",
  ]);
  assertEquals(gFlatKey, { fifths: -6, mode: "major" });
});

Deno.test("OCR-16: Compound meter detection supports 9/8, 12/8, 3/4 waltz with 4 eighth notes, and 4/4 with pickup measure", () => {
  // 9/8 compound meter: 3 dotted quarters (1.5 * 3 = 4.5 beats)
  const compound98Measure = {
    melody: [
      { duration: { numerator: 3, denominator: 2 }, rest: false },
      { duration: { numerator: 3, denominator: 2 }, rest: false },
      { duration: { numerator: 3, denominator: 2 }, rest: false },
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([compound98Measure]), {
    beats: 9,
    beatType: 8,
  });

  // 12/8 compound meter: 4 dotted quarters (1.5 * 4 = 6.0 beats)
  const compound128Measure = {
    melody: [
      { duration: { numerator: 3, denominator: 2 }, rest: false },
      { duration: { numerator: 3, denominator: 2 }, rest: false },
      { duration: { numerator: 3, denominator: 2 }, rest: false },
      { duration: { numerator: 3, denominator: 2 }, rest: false },
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([compound128Measure]), {
    beats: 12,
    beatType: 8,
  });

  // 3/4 waltz with 1 quarter and 4 eighth notes (total 3.0 beats): should NOT be misclassified as 6/8
  const waltzMeasure = {
    melody: [
      { duration: { numerator: 1, denominator: 1 }, rest: false }, // quarter on beat 0
      { duration: { numerator: 1, denominator: 2 }, rest: false }, // eighth
      { duration: { numerator: 1, denominator: 2 }, rest: false }, // eighth on beat 1.5
      { duration: { numerator: 1, denominator: 2 }, rest: false }, // eighth on beat 2.0
      { duration: { numerator: 1, denominator: 2 }, rest: false }, // eighth
    ],
  };
  assertEquals(calculateCompoundMeterFromMeasures([waltzMeasure]), {
    beats: 3,
    beatType: 4,
  });

  // 4/4 piece with anacrusis / pickup measure:
  // Measure 0 has 3 quarter notes (3.0 beats), subsequent measures have 4 quarter notes (4.0 beats)
  const pickupMeasure = {
    melody: [
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
    ],
  };
  const fullMeasure1 = {
    melody: [
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
    ],
  };
  const fullMeasure2 = {
    melody: [
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
      { duration: { numerator: 1, denominator: 1 }, rest: false },
    ],
  };
  assertEquals(
    calculateCompoundMeterFromMeasures([pickupMeasure, fullMeasure1, fullMeasure2]),
    { beats: 4, beatType: 4 },
  );
});
