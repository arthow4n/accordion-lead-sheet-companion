import type {
  BarlineGeometry,
  ImageBox,
  ScorePhotoLayout,
  ScorePhotoMeasureGeometry,
  ScorePhotoPreprocessingResult,
  StaffGeometry,
  SystemGeometry,
} from "../../types/score.ts";
import { createInitialPhotoLayout } from "./photoGuidance.ts";

/**
 * Capability gate for automatic photograph melody recognition.
 * Kept false until Milestone 7 browser feasibility and OMR validation pass.
 */
export const PHOTO_OMR_CAPABILITY_ENABLED = true;

export interface DeletableMat {
  delete(): void;
  rows: number;
  cols: number;
  data: Uint8Array | Uint8ClampedArray;
  data32S?: Int32Array;
  roi?(rect: unknown): DeletableMat;
  [key: string]: unknown;
}

export interface OpenCvInstance {
  Mat: new (...args: unknown[]) => DeletableMat;
  Point: new (x: number, y: number) => unknown;
  Size: new (width: number, height: number) => unknown;
  Rect: new (x: number, y: number, width: number, height: number) => unknown;
  Scalar: new (...args: number[]) => unknown;
  CV_8UC1: number;
  CV_8UC4: number;
  CV_32S: number;
  COLOR_RGBA2GRAY: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  THRESH_BINARY_INV: number;
  MORPH_RECT: number;
  MORPH_OPEN: number;
  REDUCE_SUM: number;
  INTER_NEAREST: number;
  BORDER_CONSTANT: number;
  cvtColor(src: unknown, dst: unknown, code: number): void;
  adaptiveThreshold(
    src: unknown,
    dst: unknown,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    C: number,
  ): void;
  getRotationMatrix2D(center: unknown, angle: number, scale: number): unknown;
  warpAffine(
    src: unknown,
    dst: unknown,
    M: unknown,
    dsize: unknown,
    flags?: number,
    borderMode?: number,
    borderValue?: unknown,
  ): void;
  getStructuringElement(shape: number, ksize: unknown): unknown;
  morphologyEx(src: unknown, dst: unknown, op: number, kernel: unknown): void;
  reduce(src: unknown, dst: unknown, dim: number, rtype: number, dtype?: number): void;
  resize(
    src: unknown,
    dst: unknown,
    dsize: unknown,
    fx?: number,
    fy?: number,
    interpolation?: number,
  ): void;
  [key: string]: unknown;
}

export interface ScorePreprocessingOptions {
  enableDeskew?: boolean;
  maxDeskewAngleDegrees?: number;
  deskewStepDegrees?: number;
  adaptiveBlockSize?: number;
  adaptiveC?: number;
  minStaffLines?: number;
  lineSpacingTolerance?: number;
  signal?: AbortSignal;
}

export interface RawImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Helper to track and deterministically delete all created OpenCV Mat instances. */
export class MatTracker {
  private mats: DeletableMat[] = [];

  track<T extends DeletableMat>(mat: T): T {
    this.mats.push(mat);
    return mat;
  }

  releaseAll(): void {
    for (const m of this.mats) {
      try {
        if (m && typeof m.delete === "function") {
          m.delete();
        }
      } catch {
        // Ignore deletion errors
      }
    }
    this.mats = [];
  }
}

let openCvPromise: Promise<OpenCvInstance> | null = null;

/** Lazy-load @techstark/opencv-js outside of initial app startup. */
export async function loadOpenCv(): Promise<OpenCvInstance> {
  const g = globalThis as unknown as { cv?: OpenCvInstance };
  if (g.cv?.Mat) {
    return g.cv;
  }
  if (!openCvPromise) {
    openCvPromise = (async (): Promise<OpenCvInstance> => {
      const cvModule = await import("@techstark/opencv-js") as {
        default?: { ready?: Promise<OpenCvInstance> } | OpenCvInstance;
      };
      const cvObj = cvModule.default || cvModule;
      if (cvObj && typeof cvObj === "object" && "ready" in cvObj && cvObj.ready) {
        return (await cvObj.ready) as OpenCvInstance;
      }
      return cvObj as OpenCvInstance;
    })();
  }
  const cv = await openCvPromise;
  return cv;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Photo preprocessing was aborted.", "AbortError");
  }
}

/**
 * Estimate skew angle within [-maxAngle, maxAngle] by finding the angle that
 * maximizes the variance of the horizontal projection profile.
 */
export function estimateSkewAngle(
  cv: OpenCvInstance,
  tracker: MatTracker,
  binaryInvMat: DeletableMat,
  maxAngle = 15,
  step = 0.5,
): number {
  const width = binaryInvMat.cols;
  const height = binaryInvMat.rows;

  // Downscale for speed if image is large
  const scale = Math.min(1.0, 800 / Math.max(width, height));
  let sampleMat = binaryInvMat;
  if (scale < 0.95) {
    const smallW = Math.max(10, Math.round(width * scale));
    const smallH = Math.max(10, Math.round(height * scale));
    sampleMat = tracker.track(new cv.Mat());
    cv.resize(
      binaryInvMat,
      sampleMat,
      new cv.Size(smallW, smallH),
      0,
      0,
      cv.INTER_NEAREST,
    );
  }

  const center = new cv.Point(sampleMat.cols / 2, sampleMat.rows / 2);
  let bestAngle = 0;
  let maxVariance = -1;

  for (let angle = -maxAngle; angle <= maxAngle; angle += step) {
    const rotM = tracker.track(
      cv.getRotationMatrix2D(center, angle, 1.0) as DeletableMat,
    );
    const rotated = tracker.track(new cv.Mat());
    cv.warpAffine(
      sampleMat,
      rotated,
      rotM,
      new cv.Size(sampleMat.cols, sampleMat.rows),
      cv.INTER_NEAREST,
      cv.BORDER_CONSTANT,
      new cv.Scalar(0, 0, 0, 0),
    );

    const proj = tracker.track(new cv.Mat());
    cv.reduce(rotated, proj, 1, cv.REDUCE_SUM, cv.CV_32S);
    const data = proj.data32S;
    if (!data) continue;

    let sum = 0;
    let sumSq = 0;
    const n = data.length;
    for (let i = 0; i < n; i++) {
      const v = data[i];
      sum += v;
      sumSq += v * v;
    }
    const variance = sumSq / n - (sum / n) * (sum / n);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }

  // If skew is negligible (< 0.25 deg), consider it straight
  return Math.abs(bestAngle) < 0.25 ? 0 : bestAngle;
}

/**
 * Group horizontal lines into 5-line staves based on vertical spacing consistency.
 */
export function groupLinesIntoStaves(
  linesY: number[],
  pageWidth: number,
  pageHeight: number,
  tolerance = 0.35,
): StaffGeometry[] {
  if (linesY.length < 5) return [];

  const sorted = [...linesY].sort((a, b) => a - b);
  // Remove duplicate/adjacent lines within 3px
  const deduped: number[] = [];
  for (const y of sorted) {
    if (deduped.length === 0 || y - deduped[deduped.length - 1] > 3) {
      deduped.push(y);
    }
  }

  if (deduped.length < 5) return [];

  // Compute differences between consecutive lines
  const diffs: number[] = [];
  for (let i = 0; i < deduped.length - 1; i++) {
    const d = deduped[i + 1] - deduped[i];
    if (d >= 4 && d <= 60) {
      diffs.push(d);
    }
  }

  if (diffs.length < 4) return [];

  diffs.sort((a, b) => a - b);
  const medianSpacing = diffs[Math.floor(diffs.length / 2)];

  const staves: StaffGeometry[] = [];
  let i = 0;
  while (i <= deduped.length - 5) {
    const cluster = [deduped[i]];
    let isStaff = true;
    for (let k = 1; k < 5; k++) {
      const d = deduped[i + k] - deduped[i + k - 1];
      if (Math.abs(d - medianSpacing) > medianSpacing * tolerance) {
        isStaff = false;
        break;
      }
      cluster.push(deduped[i + k]);
    }

    if (isStaff) {
      const topY = cluster[0];
      const bottomY = cluster[4];
      const staffHeight = bottomY - topY;
      const lineSpacing = staffHeight / 4;

      // Expand box with headroom for chord symbols and footroom for lyrics
      const headroom = Math.round(staffHeight * 1.5);
      const footroom = Math.round(staffHeight * 0.8);
      const boxY = Math.max(0, topY - headroom);
      const boxH = Math.min(pageHeight - boxY, staffHeight + headroom + footroom);

      const box: ImageBox = {
        x: 0,
        y: boxY,
        width: pageWidth,
        height: boxH,
        sourceWidth: pageWidth,
        sourceHeight: pageHeight,
      };

      staves.push({
        id: `staff-${staves.length + 1}`,
        systemIndex: staves.length,
        box,
        lineYCoordinates: cluster,
        lineSpacing,
      });

      i += 5; // advance past this staff
    } else {
      i++;
    }
  }

  return staves;
}

/**
 * Refine the horizontal bounding box of staves using column projections on horizMat.
 * Tightens staff boundaries to the sheet paper, eliminating dark stand margins.
 */
export function refineStaffHorizontalBounds(
  cv: OpenCvInstance,
  tracker: MatTracker,
  horizMat: DeletableMat,
  staves: StaffGeometry[],
  width: number,
): void {
  if (!horizMat.roi) return;

  for (const staff of staves) {
    const topY = staff.lineYCoordinates[0];
    const bottomY = staff.lineYCoordinates[4];
    const staffH = bottomY - topY;
    if (staffH < 4) continue;

    try {
      const roiRect = new cv.Rect(0, topY, width, staffH);
      const roi = tracker.track(horizMat.roi(roiRect));
      const colProj = tracker.track(new cv.Mat());
      cv.reduce(roi, colProj, 0, cv.REDUCE_SUM, cv.CV_32S);
      const colSums = colProj.data32S;
      if (!colSums) continue;

      const windowSize = Math.max(10, Math.round(staff.lineSpacing * 1.5));
      let minX = -1;
      let maxX = -1;

      // Scan from left to right for sustained staff lines
      for (let x = 0; x <= width - windowSize; x++) {
        let active = 0;
        for (let k = 0; k < windowSize; k++) {
          if (colSums[x + k] >= 200) active++;
        }
        if (active >= windowSize * 0.5) {
          minX = x;
          break;
        }
      }

      // Scan from right to left for sustained staff lines
      for (let x = width - 1; x >= windowSize; x--) {
        let active = 0;
        for (let k = 0; k < windowSize; k++) {
          if (colSums[x - k] >= 200) active++;
        }
        if (active >= windowSize * 0.5) {
          maxX = x;
          break;
        }
      }

      if (
        minX >= 0 && maxX > minX &&
        (maxX - minX) >= Math.max(width * 0.2, staff.lineSpacing * 8)
      ) {
        const pad = Math.round(staff.lineSpacing * 1.5);
        const left = Math.max(0, minX - pad);
        const right = Math.min(width, maxX + pad);
        staff.box.x = left;
        staff.box.width = right - left;
      }
    } catch {
      // If projection refinement fails, retain default width
    }
  }
}

/**
 * Detect vertical barlines across a staff and divide it into measures.
 */
export function detectBarlinesAndSliceMeasures(
  cv: OpenCvInstance,
  tracker: MatTracker,
  binaryInvMat: DeletableMat,
  staves: StaffGeometry[],
  pageWidth: number,
  pageHeight: number,
): { barlines: BarlineGeometry[]; measures: ScorePhotoMeasureGeometry[] } {
  const allBarlines: BarlineGeometry[] = [];
  const allMeasures: ScorePhotoMeasureGeometry[] = [];

  for (let sIdx = 0; sIdx < staves.length; sIdx++) {
    const staff = staves[sIdx];
    const topY = staff.lineYCoordinates[0];
    const bottomY = staff.lineYCoordinates[4];
    const staffH = bottomY - topY;
    const staffX = Math.max(0, staff.box.x);
    const staffW = Math.min(pageWidth - staffX, staff.box.width);
    if (staffH < 4 || staffW < 20) continue;

    if (!binaryInvMat.roi) continue;
    // Crop binaryInv strictly to the staff lines region on the paper
    const roiRect = new cv.Rect(staffX, topY, staffW, staffH);
    const roi = tracker.track(binaryInvMat.roi(roiRect));

    // Vertical morphological kernel to isolate barlines spanning the staff
    const vertKernelH = Math.min(staffH, Math.max(1, Math.round(staffH * 0.65)));
    const vertKernel = tracker.track(
      cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(1, vertKernelH),
      ) as DeletableMat,
    );
    const vertFiltered = tracker.track(new cv.Mat());
    cv.morphologyEx(roi, vertFiltered, cv.MORPH_OPEN, vertKernel);

    // Horizontal reduce: sum along columns within the staff ROI
    const vertProj = tracker.track(new cv.Mat());
    cv.reduce(vertFiltered, vertProj, 0, cv.REDUCE_SUM, cv.CV_32S);
    const colSums = vertProj.data32S;
    if (!colSums) continue;

    // Detect barline peaks
    const minInk = staffH * 255 * 0.55;
    const barlineXs: number[] = [];
    let inBarline = false;
    let startX = 0;

    for (let x = 0; x < staffW; x++) {
      if (colSums[x] >= minInk) {
        if (!inBarline) {
          inBarline = true;
          startX = x;
        }
      } else {
        if (inBarline) {
          inBarline = false;
          barlineXs.push(staffX + Math.round((startX + x - 1) / 2));
        }
      }
    }
    if (inBarline) {
      barlineXs.push(staffX + Math.round((startX + staffW - 1) / 2));
    }

    // Filter barlines: deduplicate adjacent barlines within 8px
    const filteredXs: number[] = [];
    for (const bx of barlineXs) {
      if (filteredXs.length === 0 || bx - filteredXs[filteredXs.length - 1] > 8) {
        filteredXs.push(bx);
      }
    }

    // Record barlines
    for (let bIdx = 0; bIdx < filteredXs.length; bIdx++) {
      const bx = filteredXs[bIdx];
      const barlineGeom: BarlineGeometry = {
        id: `barline-${sIdx + 1}-${bIdx + 1}`,
        systemIndex: staff.systemIndex,
        x: bx,
        topY,
        bottomY,
        type: "single",
      };
      allBarlines.push(barlineGeom);
    }

    // Slice staff into measures within the staff horizontal bounds
    const boundaries = [...filteredXs];
    const pad = Math.round(staff.lineSpacing * 2);
    if (boundaries.length === 0 || boundaries[0] > staffX + pad) {
      boundaries.unshift(staffX);
    }
    if (boundaries[boundaries.length - 1] < staffX + staffW - pad) {
      boundaries.push(staffX + staffW);
    }

    boundaries.sort((a, b) => a - b);
    const minMeasureWidth = Math.max(35, Math.round(staff.lineSpacing * 3.5));
    const validBoundaries = boundaries.filter((v, idx, arr) =>
      idx === 0 || v - arr[idx - 1] >= minMeasureWidth
    );

    for (let mIdx = 0; mIdx < validBoundaries.length - 1; mIdx++) {
      const x0 = validBoundaries[mIdx];
      const x1 = validBoundaries[mIdx + 1];
      const mWidth = x1 - x0;
      if (mWidth < minMeasureWidth) continue;

      const measureBox: ImageBox = {
        x: x0,
        y: staff.box.y,
        width: mWidth,
        height: staff.box.height,
        sourceWidth: pageWidth,
        sourceHeight: pageHeight,
      };

      allMeasures.push({
        id: `photo-measure-${allMeasures.length + 1}`,
        writtenIndex: allMeasures.length,
        box: measureBox,
        source: "automatic",
      });
    }
  }

  return { barlines: allBarlines, measures: allMeasures };
}

/**
 * Execute the full deterministic OpenCV computer vision pipeline on a raw image buffer.
 */
export function processScoreImageWithCv(
  cv: OpenCvInstance,
  imageData: RawImageData,
  options?: ScorePreprocessingOptions,
): ScorePhotoPreprocessingResult {
  const startTime = Date.now();
  const tracker = new MatTracker();

  checkAborted(options?.signal);

  try {
    const { width, height } = imageData;
    if (width < 32 || height < 32) {
      return {
        layout: createInitialPhotoLayout(Math.max(1, width), Math.max(1, height)),
        systems: [],
        staves: [],
        barlines: [],
        deskewAngleDegrees: 0,
        processingTimeMs: Date.now() - startTime,
        usedFallback: true,
      };
    }

    const srcMat = tracker.track(new cv.Mat(height, width, cv.CV_8UC4));
    srcMat.data.set(imageData.data);

    checkAborted(options?.signal);

    // 1. Grayscale conversion
    const grayMat = tracker.track(new cv.Mat());
    cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);

    checkAborted(options?.signal);

    // 2. Illumination normalization & adaptive thresholding
    const blockSize = options?.adaptiveBlockSize ?? 25;
    const c = options?.adaptiveC ?? 10;
    const binaryInvMat = tracker.track(new cv.Mat());
    cv.adaptiveThreshold(
      grayMat,
      binaryInvMat,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      blockSize,
      c,
    );

    checkAborted(options?.signal);

    // 3. Deskew angle detection & correction
    let deskewAngle = 0;
    let workingBinaryInv = binaryInvMat;

    if (options?.enableDeskew !== false) {
      deskewAngle = estimateSkewAngle(
        cv,
        tracker,
        binaryInvMat,
        options?.maxDeskewAngleDegrees ?? 15,
        options?.deskewStepDegrees ?? 0.5,
      );

      if (Math.abs(deskewAngle) >= 0.25) {
        const center = new cv.Point(width / 2, height / 2);
        const rotM = tracker.track(
          cv.getRotationMatrix2D(center, -deskewAngle, 1.0) as DeletableMat,
        );
        const deskewed = tracker.track(new cv.Mat());
        cv.warpAffine(
          binaryInvMat,
          deskewed,
          rotM,
          new cv.Size(width, height),
          cv.INTER_NEAREST,
          cv.BORDER_CONSTANT,
          new cv.Scalar(0, 0, 0, 0),
        );
        workingBinaryInv = deskewed;
      }
    }

    checkAborted(options?.signal);

    // 4. Horizontal morphological opening to isolate staff lines
    const kernelWidth = Math.min(width, Math.max(3, Math.floor(width / 35)));
    const horizKernel = tracker.track(
      cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(kernelWidth, 1),
      ) as DeletableMat,
    );
    const horizMat = tracker.track(new cv.Mat());
    cv.morphologyEx(workingBinaryInv, horizMat, cv.MORPH_OPEN, horizKernel);

    checkAborted(options?.signal);

    // 5. Horizontal projection & peak detection
    const proj = tracker.track(new cv.Mat());
    cv.reduce(horizMat, proj, 1, cv.REDUCE_SUM, cv.CV_32S);
    const rowSums = proj.data32S;
    if (!rowSums) {
      throw new Error("Could not compute horizontal projection profile.");
    }

    const minLineInk = width * 255 * 0.15;
    const detectedLineYs: number[] = [];
    let inLine = false;
    let startY = 0;

    for (let y = 0; y < height; y++) {
      if (rowSums[y] >= minLineInk) {
        if (!inLine) {
          inLine = true;
          startY = y;
        }
      } else {
        if (inLine) {
          inLine = false;
          detectedLineYs.push(Math.round((startY + y - 1) / 2));
        }
      }
    }
    if (inLine) {
      detectedLineYs.push(Math.round((startY + height - 1) / 2));
    }

    // 6. Group lines into staves
    const staves = groupLinesIntoStaves(
      detectedLineYs,
      width,
      height,
      options?.lineSpacingTolerance ?? 0.35,
    );

    // Refine horizontal boundaries to isolate the sheet from dark stand margins
    refineStaffHorizontalBounds(cv, tracker, horizMat, staves, width);

    checkAborted(options?.signal);

    // 7. Detect barlines and slice measures
    const { barlines, measures } = detectBarlinesAndSliceMeasures(
      cv,
      tracker,
      workingBinaryInv,
      staves,
      width,
      height,
    );

    const systems: SystemGeometry[] = staves.map((staff, idx) => ({
      id: `system-${idx + 1}`,
      index: idx,
      box: staff.box,
      staves: [staff],
    }));

    if (staves.length > 0 && measures.length > 0) {
      const layout: ScorePhotoLayout = {
        schemaVersion: 1,
        page: { width, height },
        measures,
      };

      return {
        layout,
        systems,
        staves,
        barlines,
        deskewAngleDegrees: deskewAngle,
        processingTimeMs: Date.now() - startTime,
        usedFallback: false,
      };
    }

    // Safe fallback
    const fallbackLayout = createInitialPhotoLayout(width, height);
    return {
      layout: fallbackLayout,
      systems: [],
      staves: [],
      barlines: [],
      deskewAngleDegrees: 0,
      processingTimeMs: Date.now() - startTime,
      usedFallback: true,
    };
  } finally {
    tracker.releaseAll();
  }
}

/**
 * Top-level typed preparation entry point.
 * Accepts an ImageBitmap or RawImageData and returns the preprocessed score layout.
 */
export async function preprocessScorePhoto(
  input: RawImageData | ImageBitmap,
  options?: ScorePreprocessingOptions,
): Promise<ScorePhotoPreprocessingResult> {
  checkAborted(options?.signal);

  let raw: RawImageData;
  if ("data" in input && input.data instanceof Uint8ClampedArray) {
    raw = input;
  } else if (typeof OffscreenCanvas !== "undefined") {
    const bitmap = input as ImageBitmap;
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create OffscreenCanvas 2D context.");
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    raw = { data: imgData.data, width: bitmap.width, height: bitmap.height };
  } else {
    throw new Error("Cannot extract pixels from ImageBitmap in this environment.");
  }

  checkAborted(options?.signal);

  const cv = await loadOpenCv();
  return processScoreImageWithCv(cv, raw, options);
}
