import { assert, assertEquals } from "@std/assert";
import { extractStaffCropTensor } from "../../src/lib/score/omrPreprocessing.ts";
import { parseHumdrumScore } from "../../src/lib/score/humdrumParser.ts";
import { enrichHarmonySequence } from "../../src/lib/score/harmony.ts";
import { solveCbaMelodyPath } from "../../src/lib/cba/melodyPath.ts";
import type { RawImageData } from "../../src/lib/score/photoPreprocessing.ts";

function createSyntheticScoreImage(): RawImageData {
  const width = 600;
  const height = 400;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255); // white background

  // Draw staff 1 lines at y = 60, 70, 80, 90, 100
  // Draw staff 2 lines at y = 200, 210, 220, 230, 240
  const staffYs = [60, 70, 80, 90, 100, 200, 210, 220, 230, 240];
  for (const sy of staffYs) {
    for (let x = 40; x < 560; x++) {
      const idx = (sy * width + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
    }
  }
  return { data, width, height };
}

Deno.test("OMR-PIPE-01: End-to-end pipeline from staff crops to CBA/Stradella guidance", () => {
  const image = createSyntheticScoreImage();
  const staff1Box = { x: 40, y: 55, width: 520, height: 50 };
  const staff2Box = { x: 40, y: 195, width: 520, height: 50 };

  // 1. Extract crop tensors
  const tensor1 = extractStaffCropTensor(image, staff1Box, "staff-1");
  const tensor2 = extractStaffCropTensor(image, staff2Box, "staff-2");

  assertEquals(tensor1.height, 128);
  assertEquals(tensor2.height, 128);
  assert(tensor1.data.length > 0);
  assert(tensor2.data.length > 0);

  // 2. Simulate OMR output for the 2 staves
  const staff1Humdrum = `
**kern\t**mxhm
*clefG2\t*
*k[f#]\t*
*M4/4\t*
=1\t=1
4g\tG:maj
4b\t.
4dd\t.
4g\t.
=2\t=2
2ee\tC:maj
2dd\tD:7
`;

  const staff2Humdrum = `
=3\t=3
4b\tG:maj
4a\t.
2g\t.
=4\t=4
1g\tG:maj
==\t==
*-
`;

  const combinedHumdrum = `${staff1Humdrum}\n!!linebreak\n${staff2Humdrum}`;

  // 3. Parse into ScoreDocument
  const scoreDoc = parseHumdrumScore(combinedHumdrum, { title: "Test Lead Sheet" });
  assertEquals(scoreDoc.measures.length, 4);

  // Verify measures
  const m1 = scoreDoc.measures[0];
  assertEquals(m1.harmonies[0].raw, "G");
  assertEquals(m1.melody.length, 4);

  const m2 = scoreDoc.measures[1];
  assertEquals(m2.harmonies[0].raw, "C");
  assertEquals(m2.harmonies[1].raw, "D7");

  // 4. Enrich harmonies into Stradella transitions and CBA voicings
  const allHarmonies = scoreDoc.measures.flatMap((m) => m.harmonies);
  const enriched = enrichHarmonySequence(allHarmonies, {
    cbaMode: "root_5row",
    accordionSize: "120-bass",
  });

  assertEquals(enriched.length, 5); // G, C, D7, G, G
  for (const h of enriched) {
    assert(h.detail !== undefined, `Chord ${h.raw} should be enriched`);
    assert(h.detail.stradella !== undefined, `Chord ${h.raw} should have Stradella buttons`);
  }

  // 5. Compute CBA melody fingering path
  const allMelody = scoreDoc.measures.flatMap((m) => m.melody);
  const melodyPath = solveCbaMelodyPath(allMelody);

  assertEquals(melodyPath.status, "ok");
  assertEquals(melodyPath.steps.length, allMelody.length);
  for (const step of melodyPath.steps) {
    if (!step.rest && step.pitch) {
      assert(
        step.finger !== undefined && step.finger >= 1 && step.finger <= 5,
        "Finger should be 1-5",
      );
      assert(step.location !== undefined, "Melody note should have a CBA location assigned");
    }
  }
});
