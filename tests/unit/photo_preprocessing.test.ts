import { assertEquals, assertExists, assertRejects, assertThrows } from "@std/assert";
import {
  detectBarlinesAndSliceMeasures,
  downscaleRawImageData,
  estimateSkewAngle,
  groupLinesIntoStaves,
  loadOpenCv,
  MatTracker,
  MAX_PHOTO_PREPROCESS_LONG_EDGE,
  PHOTO_OMR_CAPABILITY_ENABLED,
  processScoreImageWithCv,
  type RawImageData,
} from "../../src/lib/score/photoPreprocessing.ts";
import { ScoreImageWorkerClient } from "../../src/lib/score/scoreImageClient.ts";

/** Helper to generate a blank RGBA image buffer (white background). */
function createBlankImage(width: number, height: number, fillColor = 255): RawImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(fillColor);
  return { data, width, height };
}

/** Draw a filled circle (notehead) on raw RGBA buffer. */
function drawFilledCircle(
  img: RawImageData,
  cx: number,
  cy: number,
  r = 4,
) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= img.width || y < 0 || y >= img.height) continue;
        const idx = (y * img.width + x) * 4;
        img.data[idx] = 0;
        img.data[idx + 1] = 0;
        img.data[idx + 2] = 0;
        img.data[idx + 3] = 255;
      }
    }
  }
}

/** Draw a musical note (notehead + stem). Stem height is 3 to 3.5 spaces (not full staff). */
function drawQuarterNote(
  img: RawImageData,
  x: number,
  noteY: number,
  stemDir: "up" | "down" = "up",
  lineSpacing = 12,
) {
  drawFilledCircle(img, x, noteY, 4);
  const stemHeight = Math.round(lineSpacing * 3);
  if (stemDir === "up") {
    drawVerticalLine(img, x + 3, noteY - stemHeight, noteY, 2);
  } else {
    drawVerticalLine(img, x - 3, noteY, noteY + stemHeight, 2);
  }
}

/** Draw a sharp accidental '#' */
function drawSharp(img: RawImageData, x: number, y: number, height = 20) {
  drawVerticalLine(img, x, y, y + height, 2);
  drawVerticalLine(img, x + 5, y, y + height, 2);
  drawHorizontalLine(img, y + Math.round(height * 0.35), x - 2, x + 7, 2);
  drawHorizontalLine(img, y + Math.round(height * 0.65), x - 2, x + 7, 2);
}

/** Draw a horizontal line of given thickness (black ink) on raw RGBA buffer. */
function drawHorizontalLine(
  img: RawImageData,
  y: number,
  startX = 0,
  endX = img.width,
  thickness = 2,
) {
  for (let dy = 0; dy < thickness; dy++) {
    const curY = y + dy;
    if (curY < 0 || curY >= img.height) continue;
    for (let x = startX; x < endX; x++) {
      if (x < 0 || x >= img.width) continue;
      const idx = (curY * img.width + x) * 4;
      img.data[idx] = 0; // R
      img.data[idx + 1] = 0; // G
      img.data[idx + 2] = 0; // B
      img.data[idx + 3] = 255; // A
    }
  }
}

/** Draw a vertical line (black ink) on raw RGBA buffer. */
function drawVerticalLine(
  img: RawImageData,
  x: number,
  startY: number,
  endY: number,
  thickness = 2,
) {
  for (let dx = 0; dx < thickness; dx++) {
    const curX = x + dx;
    if (curX < 0 || curX >= img.width) continue;
    for (let y = startY; y <= endY; y++) {
      if (y < 0 || y >= img.height) continue;
      const idx = (y * img.width + curX) * 4;
      img.data[idx] = 0;
      img.data[idx + 1] = 0;
      img.data[idx + 2] = 0;
      img.data[idx + 3] = 255;
    }
  }
}

Deno.test("PREPROCESS-01: Internal capability gate is exported and enabled in M7", () => {
  assertEquals(PHOTO_OMR_CAPABILITY_ENABLED, true);
});

Deno.test("PREPROCESS-02: groupLinesIntoStaves groups 5-line staves and rejects isolated noise lines", () => {
  // Staff 1 at y = 50, 62, 74, 86, 98 (spacing = 12)
  // Noise line at y = 140
  // Staff 2 at y = 180, 192, 204, 216, 228 (spacing = 12)
  // Noise line at y = 290
  const lines = [50, 62, 74, 86, 98, 140, 180, 192, 204, 216, 228, 290];
  const staves = groupLinesIntoStaves(lines, 600, 400);

  assertEquals(staves.length, 2);
  assertEquals(staves[0].lineYCoordinates, [50, 62, 74, 86, 98]);
  assertEquals(staves[0].lineSpacing, 12);
  assertEquals(staves[0].systemIndex, 0);

  assertEquals(staves[1].lineYCoordinates, [180, 192, 204, 216, 228]);
  assertEquals(staves[1].lineSpacing, 12);
  assertEquals(staves[1].systemIndex, 1);
});

Deno.test("PREPROCESS-03: groupLinesIntoStaves returns empty array when lines < 5", () => {
  const staves = groupLinesIntoStaves([50, 60, 70], 600, 400);
  assertEquals(staves, []);
});

Deno.test("PREPROCESS-04: MatTracker tracks and releases OpenCV Mats without leaks", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();

  const mat1 = tracker.track(new cv.Mat(10, 10, cv.CV_8UC1));
  const mat2 = tracker.track(new cv.Mat(10, 10, cv.CV_8UC4));
  assertExists(mat1);
  assertExists(mat2);

  tracker.releaseAll();
  // Double release should be safe and idempotent
  tracker.releaseAll();
});

Deno.test("PREPROCESS-05: processScoreImageWithCv detects synthetic staff and measures", async () => {
  const cv = await loadOpenCv();
  const width = 400;
  const height = 200;
  const img = createBlankImage(width, height);

  // Draw 5 staff lines with spacing 12: y = 60, 72, 84, 96, 108
  for (let i = 0; i < 5; i++) {
    drawHorizontalLine(img, 60 + i * 12, 20, 380, 2);
  }

  // Draw 3 vertical barlines at x = 100, x = 220, x = 340
  drawVerticalLine(img, 100, 60, 108, 2);
  drawVerticalLine(img, 220, 60, 108, 2);
  drawVerticalLine(img, 340, 60, 108, 2);

  const result = processScoreImageWithCv(cv, img, { enableDeskew: false });

  assertEquals(result.usedFallback, false);
  assertEquals(result.staves.length, 1);
  assertEquals(result.staves[0].lineYCoordinates.length, 5);
  assertEquals(result.staves[0].lineSpacing, 12);

  // Barlines should be detected
  assertExists(result.barlines);
  assertEquals(result.barlines.length >= 2, true);

  // Measures should be sliced
  assertExists(result.layout.measures);
  assertEquals(result.layout.measures.length >= 2, true);
  for (const m of result.layout.measures) {
    assertEquals(m.source, "automatic");
    assertEquals(m.box.width > 20, true);
    assertEquals(m.box.height > 20, true);
  }
});

Deno.test("PREPROCESS-06: processScoreImageWithCv handles shadows with adaptive thresholding", async () => {
  const cv = await loadOpenCv();
  const width = 400;
  const height = 200;
  const img = createBlankImage(width, height);

  // Add a non-uniform lighting gradient (shadow from left to right)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Background gradient: dark on left (100), bright on right (250)
      const bg = Math.round(100 + (150 * x) / width);
      img.data[idx] = bg;
      img.data[idx + 1] = bg;
      img.data[idx + 2] = bg;
    }
  }

  // Draw staff lines (dark ink relative to local background)
  for (let i = 0; i < 5; i++) {
    const y = 60 + i * 12;
    for (let x = 30; x < 370; x++) {
      const idx = (y * width + x) * 4;
      img.data[idx] = 20;
      img.data[idx + 1] = 20;
      img.data[idx + 2] = 20;
    }
  }

  // Draw barlines
  drawVerticalLine(img, 150, 60, 108, 3);
  drawVerticalLine(img, 280, 60, 108, 3);

  const result = processScoreImageWithCv(cv, img, { enableDeskew: false });

  assertEquals(result.usedFallback, false);
  assertEquals(result.staves.length, 1);
  assertEquals(result.staves[0].lineSpacing, 12);
});

Deno.test("PREPROCESS-07: estimateSkewAngle returns 0 for straight lines", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 200;
    const height = 100;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    // Draw horizontal lines
    for (let i = 0; i < 5; i++) {
      const y = 30 + i * 8;
      for (let x = 20; x < 180; x++) {
        binInv.data[y * width + x] = 255;
      }
    }

    const angle = estimateSkewAngle(cv, tracker, binInv, 10, 1);
    assertEquals(Math.abs(angle) < 1, true);
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("PREPROCESS-08: Cancellation via AbortSignal throws AbortError and cleans up memory", async () => {
  const cv = await loadOpenCv();
  const img = createBlankImage(100, 100);
  const controller = new AbortController();
  controller.abort(); // already aborted

  assertThrows(
    () => {
      processScoreImageWithCv(cv, img, { signal: controller.signal });
    },
    DOMException,
    "aborted",
  );
});

Deno.test("PREPROCESS-09: Degenerate blank image safely falls back to single measure strip", async () => {
  const cv = await loadOpenCv();
  const img = createBlankImage(300, 200);

  const result = processScoreImageWithCv(cv, img);

  assertEquals(result.usedFallback, true);
  assertEquals(result.layout.measures.length, 1);
  assertEquals(result.layout.measures[0].id, "photo-measure-1");
  assertEquals(result.layout.page.width, 300);
  assertEquals(result.layout.page.height, 200);
});

Deno.test("PREPROCESS-10: detectBarlinesAndSliceMeasures directly produces valid measure geometry", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 400;
    const height = 100;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    const staves = [{
      id: "staff-1",
      systemIndex: 0,
      box: { x: 0, y: 10, width: 400, height: 80, sourceWidth: 400, sourceHeight: 100 },
      lineYCoordinates: [30, 40, 50, 60, 70],
      lineSpacing: 10,
    }];

    // Draw barlines in binInv
    for (let y = 30; y <= 70; y++) {
      for (const x of [100, 200, 300]) {
        binInv.data[y * width + x] = 255;
        binInv.data[y * width + x + 1] = 255;
      }
    }

    const { barlines, measures } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      binInv,
      staves,
      width,
      height,
    );

    assertEquals(barlines.length >= 3, true);
    assertEquals(measures.length >= 2, true);
    assertEquals(measures[0].id, "photo-measure-1");
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("PREP-07: Degenerate image dimensions (< 32x32) gracefully return fallback layout without throwing", async () => {
  const cv = await loadOpenCv();
  const degenerateImg = createBlankImage(10, 10);
  const result = processScoreImageWithCv(cv, degenerateImg);

  assertEquals(result.usedFallback, true);
  assertEquals(result.staves.length, 0);
  assertEquals(result.layout.page.width, 10);
  assertEquals(result.layout.page.height, 10);
  assertEquals(result.layout.measures.length, 1);
});

Deno.test("PREP-08: processScoreImageWithCv isolates sheet margins and bounds measures to music staves", async () => {
  const cv = await loadOpenCv();
  const width = 500;
  const height = 200;
  const img = createBlankImage(width, height);

  // Simulate photo with sheet paper in the center (x: 100 to 400) and dark stand on sides
  // Draw dark stand background on left (0-100) and right (400-500)
  for (let y = 0; y < height; y++) {
    for (const x of [0, 20, 50, 80, 420, 450, 480]) {
      const idx = (y * width + x) * 4;
      img.data[idx] = 40;
      img.data[idx + 1] = 40;
      img.data[idx + 2] = 40;
    }
  }

  // Draw 5 staff lines strictly within the paper sheet: x = 100 to 400
  for (let i = 0; i < 5; i++) {
    drawHorizontalLine(img, 60 + i * 12, 100, 400, 2);
  }

  // Draw 2 barlines at x = 200, x = 300
  drawVerticalLine(img, 200, 60, 108, 2);
  drawVerticalLine(img, 300, 60, 108, 2);

  const result = processScoreImageWithCv(cv, img, { enableDeskew: false });
  assertEquals(result.usedFallback, false);
  assertEquals(result.staves.length, 1);

  const staff = result.staves[0];
  // Staff horizontal bounds should tightly encapsulate paper staves, avoiding x: 0
  assertEquals(staff.box.x >= 70, true);
  assertEquals(staff.box.x + staff.box.width <= 430, true);

  // Measures should be bounded within the music area, not spanning the dark borders
  for (const m of result.layout.measures) {
    assertEquals(m.box.x >= staff.box.x, true);
    assertEquals(m.box.x + m.box.width <= staff.box.x + staff.box.width, true);
  }
});

Deno.test("PREPROCESS-11: Note stems and noteheads are immune from barline detection", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 400;
    const height = 160;
    const img = createBlankImage(width, height);

    // 5 staff lines at y = 50, 62, 74, 86, 98 (spacing = 12, staffH = 48)
    for (let i = 0; i < 5; i++) {
      drawHorizontalLine(img, 50 + i * 12, 20, 380, 2);
    }

    // Draw 4 quarter notes with noteheads and stems (stems span ~3 spaces = 36px, shorter than 48px staff)
    drawQuarterNote(img, 80, 74, "up", 12); // Note on line 3, stem up to y=38
    drawQuarterNote(img, 140, 86, "up", 12); // Note on line 4, stem up to y=50
    drawQuarterNote(img, 200, 62, "down", 12); // Note on line 2, stem down to y=98
    drawQuarterNote(img, 260, 74, "down", 12); // Note on line 3, stem down to y=110

    // No barlines drawn!
    const result = processScoreImageWithCv(cv, img, { enableDeskew: false });

    // Note stems must NOT be detected as barlines
    assertEquals(result.staves.length, 1);
    assertEquals(result.barlines.length, 0);
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("PREPROCESS-12: Genuine barlines are detected while note stems and accidentals are filtered out", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 500;
    const height = 160;
    const img = createBlankImage(width, height);

    // 5 staff lines at y = 50, 62, 74, 86, 98
    for (let i = 0; i < 5; i++) {
      drawHorizontalLine(img, 50 + i * 12, 20, 480, 2);
    }

    // Draw accidentals (sharp signs) and note stems in the measures
    drawSharp(img, 50, 56, 18);
    drawQuarterNote(img, 80, 62, "down", 12);
    drawQuarterNote(img, 120, 74, "up", 12);

    // Genuine barline 1 at x = 180 (spans line 1 through line 5: y = 50 to 98)
    drawVerticalLine(img, 180, 50, 98, 2);

    drawSharp(img, 210, 68, 18);
    drawQuarterNote(img, 240, 86, "up", 12);
    drawQuarterNote(img, 280, 74, "down", 12);

    // Genuine barline 2 at x = 340 (spans line 1 through line 5)
    drawVerticalLine(img, 340, 50, 98, 2);

    drawQuarterNote(img, 390, 62, "up", 12);

    const result = processScoreImageWithCv(cv, img, { enableDeskew: false });

    assertEquals(result.usedFallback, false);
    assertEquals(result.staves.length, 1);

    // Exactly 2 barlines should be detected (the genuine ones at 180 and 340)
    assertEquals(result.barlines.length, 2);
    assertEquals(Math.abs(result.barlines[0].x - 180) <= 3, true);
    assertEquals(Math.abs(result.barlines[1].x - 340) <= 3, true);

    // Sliced measures should separate the staves into genuine musical measures
    assertEquals(result.layout.measures.length >= 2, true);
    for (const m of result.layout.measures) {
      assertEquals(m.box.width >= 35, true);
    }
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("PREPROCESS-13: downscaleRawImageData clamps long edge to 1600px preserving aspect ratio", () => {
  assertEquals(MAX_PHOTO_PREPROCESS_LONG_EDGE, 1600);

  // Large landscape image (3200 x 2400)
  const largeLandscape = createBlankImage(3200, 2400);
  const scaledLandscape = downscaleRawImageData(largeLandscape, 1600);
  assertEquals(scaledLandscape.width, 1600);
  assertEquals(scaledLandscape.height, 1200);

  // Large portrait image (1800 x 3600)
  const largePortrait = createBlankImage(1800, 3600);
  const scaledPortrait = downscaleRawImageData(largePortrait, 1600);
  assertEquals(scaledPortrait.width, 800);
  assertEquals(scaledPortrait.height, 1600);

  // Already within bounds image (800 x 600)
  const normalImg = createBlankImage(800, 600);
  const scaledNormal = downscaleRawImageData(normalImg, 1600);
  assertEquals(scaledNormal.width, 800);
  assertEquals(scaledNormal.height, 600);
  assertEquals(scaledNormal.data.length, normalImg.data.length);
});

Deno.test("PREPROCESS-14: Musical barline deduplication merges barlines within staff.lineSpacing * 3", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 400;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    // Staff: spacing 12, lineSpacing * 3 = 36px
    const staves = [{
      id: "staff-1",
      systemIndex: 0,
      box: { x: 20, y: 20, width: 360, height: 80, sourceWidth: 400, sourceHeight: 150 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    // Draw lines in binInv
    for (let y = 40; y <= 88; y++) {
      // 2 barlines separated by only 15px (simulating engraving artifact or double barline)
      binInv.data[y * width + 150] = 255;
      binInv.data[y * width + 165] = 255;
      // Another barline well separated at 280px
      binInv.data[y * width + 280] = 255;
    }

    const { barlines } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      binInv,
      staves,
      width,
      height,
    );

    // 150 and 165 should merge into 1 barline, plus the barline at 280 -> total 2 barlines
    assertEquals(barlines.length, 2);
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("PREPROCESS-15: System measure capping limits measures per staff to <= 6", async () => {
  const cv = await loadOpenCv();
  const tracker = new MatTracker();
  try {
    const width = 1200;
    const height = 150;
    const binInv = tracker.track(new cv.Mat(height, width, cv.CV_8UC1));
    binInv.data.fill(0);

    const staves = [{
      id: "staff-1",
      systemIndex: 0,
      box: { x: 50, y: 20, width: 1100, height: 80, sourceWidth: 1200, sourceHeight: 150 },
      lineYCoordinates: [40, 52, 64, 76, 88],
      lineSpacing: 12,
    }];

    // Draw 8 barlines across the staff (would ordinarily produce 9 measures)
    const xs = [150, 270, 390, 510, 630, 750, 870, 990];
    for (const bx of xs) {
      for (let y = 40; y <= 88; y++) {
        binInv.data[y * width + bx] = 255;
      }
    }

    const { measures } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      binInv,
      staves,
      width,
      height,
      { maxMeasuresPerSystem: 6 },
    );

    // Must be capped to <= 6 measures per system
    assertEquals(measures.length <= 6, true);
    assertEquals(measures.length > 0, true);

    // Written indices must be strictly sequential
    for (let i = 0; i < measures.length; i++) {
      assertEquals(measures[i].writtenIndex, i);
      assertEquals(measures[i].box.width > 0, true);
    }
  } finally {
    tracker.releaseAll();
  }
});

Deno.test("PREPROCESS-16: ScoreImageWorkerClient aborts on pre-aborted signal and handles termination cleanly", async () => {
  const client = new ScoreImageWorkerClient();
  const img = createBlankImage(100, 100);

  const controller = new AbortController();
  controller.abort();

  // Pre-aborted signal should reject immediately with AbortError
  await assertRejects(
    async () => {
      await client.process(img, undefined, controller.signal);
    },
    DOMException,
    "aborted",
  );

  // Terminate client cleanly
  client.terminate();
});
