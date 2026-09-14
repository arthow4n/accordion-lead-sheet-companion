import { assert, assertEquals } from "@std/assert";
import {
  extractStaffCropTensor,
  OMR_FIXED_HEIGHT,
  OMR_MAX_WIDTH,
  OMR_MIN_WIDTH,
} from "../../src/lib/score/omrPreprocessing.ts";
import type { RawImageData } from "../../src/lib/score/photoPreprocessing.ts";

function createSyntheticImage(width: number, height: number): RawImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // White background with dark horizontal staff lines every 20px
      const isLine = y % 20 === 0;
      const val = isLine ? 20 : 240;
      data[idx] = val; // R
      data[idx + 1] = val; // G
      data[idx + 2] = val; // B
      data[idx + 3] = 255; // A
    }
  }
  return { data, width, height };
}

Deno.test("OMR-PRE-01: extractStaffCropTensor produces fixed 128px height tensor", () => {
  const img = createSyntheticImage(800, 600);
  const cropBox = { x: 50, y: 100, width: 700, height: 100 };

  const tensor = extractStaffCropTensor(img, cropBox, "staff-0");

  assertEquals(tensor.id, "staff-0");
  assertEquals(tensor.height, OMR_FIXED_HEIGHT);
  assert(tensor.width >= OMR_MIN_WIDTH && tensor.width <= OMR_MAX_WIDTH);
  assertEquals(tensor.data.length, tensor.width * tensor.height);

  // Assert pixel values are in [0.0, 1.0]
  for (let i = 0; i < tensor.data.length; i++) {
    assert(tensor.data[i] >= 0.0 && tensor.data[i] <= 1.0);
  }
});

Deno.test("OMR-PRE-02: extractStaffCropTensor clamps out-of-bounds crop box safely", () => {
  const img = createSyntheticImage(200, 200);
  // Crop box extending outside image
  const outOfBoundsBox = { x: -50, y: -30, width: 300, height: 260 };

  const tensor = extractStaffCropTensor(img, outOfBoundsBox, "staff-clamped");
  assertEquals(tensor.height, OMR_FIXED_HEIGHT);
  assert(tensor.width >= OMR_MIN_WIDTH);
  assertEquals(tensor.data.length, tensor.width * tensor.height);
});
