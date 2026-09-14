import { assertEquals } from "@std/assert";
import {
  cropStaffChordBanner,
  cropStaffHeaderRegion,
  extractChordsFromOcrText,
  extractNavigationAndSectionsFromOcrText,
  parseKeySignatureSymbols,
  parseMeterToken,
} from "../../src/lib/score/ocrRecognition.ts";
import type { RawImageData } from "../../src/lib/score/photoPreprocessing.ts";

Deno.test("OCR-01: Meter recognition covers 6/8 and all standard lead sheet meters", () => {
  // 6/8 compound meter (absent from JAZZMUS vocab, deterministically supplemented)
  assertEquals(parseMeterToken("6/8"), { beats: 6, beatType: 8 });
  assertEquals(parseMeterToken("6 8"), { beats: 6, beatType: 8 });
  assertEquals(parseMeterToken("6:8"), { beats: 6, beatType: 8 });

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
