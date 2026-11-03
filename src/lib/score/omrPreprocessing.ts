/**
 * OMR Input Preprocessing for JAZZMUS SMT model.
 *
 * Prepares segmented staff crops according to upstream JAZZMUS specification:
 * - Fixed height: 128px
 * - Maximum width: 1000px
 * - Single-channel grayscale normalized to [0.0, 1.0] (Float32Array)
 */

import type { ImageBox } from "../../types/score.ts";
import type { RawImageData } from "./photoPreprocessing.ts";

export const OMR_FIXED_HEIGHT = 128;
export const OMR_MAX_WIDTH = 1000;
export const OMR_MIN_WIDTH = 32;

export interface StaffCropTensor {
  id: string;
  data: Float32Array;
  width: number;
  height: number;
}

export interface StaffCropOptions {
  headroomRatio?: number; // Default 0.65 to capture chord banner situated 35-60px above staff
  footroomRatio?: number; // Default 0.25 for ledger lines below staff
  /** Rotation applied by layout detection, in OpenCV's image-coordinate convention. */
  deskewAngleDegrees?: number;
}

/**
 * Extract and resize a bounded staff region into normalized Float32Array tensor.
 * Includes headroom padding (default 0.65) so chord symbols above staff lines are preserved
 * for JAZZMUS SMT model, and footroom padding (default 0.25) for ledger lines below staff.
 */
export function extractStaffCropTensor(
  source: RawImageData,
  box: ImageBox,
  id: string,
  optionsOrPadding: number | StaffCropOptions = { headroomRatio: 0.65, footroomRatio: 0.25 },
): StaffCropTensor {
  let headroomRatio = 0.65;
  let footroomRatio = 0.25;
  let deskewAngleDegrees = 0;

  if (typeof optionsOrPadding === "number") {
    headroomRatio = Math.max(0.65, optionsOrPadding);
    footroomRatio = optionsOrPadding;
  } else if (typeof optionsOrPadding === "object" && optionsOrPadding !== null) {
    headroomRatio = optionsOrPadding.headroomRatio ?? 0.65;
    footroomRatio = optionsOrPadding.footroomRatio ?? 0.25;
    deskewAngleDegrees = optionsOrPadding.deskewAngleDegrees ?? 0;
  }

  // Boxes belong to the resized, deskewed layout, not necessarily the input pixels.
  const layoutWidth = box.sourceWidth ?? source.width;
  const layoutHeight = box.sourceHeight ?? source.height;
  const padTop = Math.round(box.height * headroomRatio);
  const padBottom = Math.round(box.height * footroomRatio);
  const cropX = Math.max(0, Math.floor(box.x));
  const cropY = Math.max(0, Math.floor(box.y - padTop));
  const cropRight = Math.min(layoutWidth, Math.ceil(box.x + box.width));
  const cropBottom = Math.min(layoutHeight, Math.ceil(box.y + box.height + padBottom));

  const cropW = Math.max(1, cropRight - cropX);
  const cropH = Math.max(1, cropBottom - cropY);

  const targetHeight = OMR_FIXED_HEIGHT;
  const scaledWidth = Math.ceil((cropW * targetHeight) / cropH);
  const targetWidth = Math.max(OMR_MIN_WIDTH, Math.min(OMR_MAX_WIDTH, scaledWidth));

  const tensorData = new Float32Array(targetHeight * targetWidth);

  // Bilinear sampling from source image
  const scaleX = cropW / targetWidth;
  const scaleY = cropH / targetHeight;
  const sourceScaleX = source.width / layoutWidth;
  const sourceScaleY = source.height / layoutHeight;
  const angle = deskewAngleDegrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = layoutWidth / 2;
  const centerY = layoutHeight / 2;

  for (let ty = 0; ty < targetHeight; ty++) {
    for (let tx = 0; tx < targetWidth; tx++) {
      const layoutX = cropX + (tx + 0.5) * scaleX - 0.5;
      const layoutY = cropY + (ty + 0.5) * scaleY - 0.5;
      // Invert the layout rotation before sampling the original photo.
      const srcX = (centerX + cos * (layoutX - centerX) - sin * (layoutY - centerY) + 0.5) *
          sourceScaleX - 0.5;
      const srcY = (centerY + sin * (layoutX - centerX) + cos * (layoutY - centerY) + 0.5) *
          sourceScaleY - 0.5;
      if (srcX < 0 || srcX > source.width - 1 || srcY < 0 || srcY > source.height - 1) {
        tensorData[ty * targetWidth + tx] = 1;
        continue;
      }
      const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(srcX)));
      const x1 = Math.max(0, Math.min(source.width - 1, x0 + 1));
      const dx = Math.max(0, Math.min(1, srcX - x0));
      const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(srcY)));
      const y1 = Math.max(0, Math.min(source.height - 1, y0 + 1));
      const dy = Math.max(0, Math.min(1, srcY - y0));

      // Sample 4 neighbor pixels (RGBA)
      const idx00 = (y0 * source.width + x0) * 4;
      const idx10 = (y0 * source.width + x1) * 4;
      const idx01 = (y1 * source.width + x0) * 4;
      const idx11 = (y1 * source.width + x1) * 4;

      const g00 = (source.data[idx00] * 0.299 + source.data[idx00 + 1] * 0.587 +
        source.data[idx00 + 2] * 0.114) / 255.0;
      const g10 = (source.data[idx10] * 0.299 + source.data[idx10 + 1] * 0.587 +
        source.data[idx10 + 2] * 0.114) / 255.0;
      const g01 = (source.data[idx01] * 0.299 + source.data[idx01 + 1] * 0.587 +
        source.data[idx01 + 2] * 0.114) / 255.0;
      const g11 = (source.data[idx11] * 0.299 + source.data[idx11 + 1] * 0.587 +
        source.data[idx11 + 2] * 0.114) / 255.0;

      const top = g00 * (1 - dx) + g10 * dx;
      const bot = g01 * (1 - dx) + g11 * dx;
      const val = top * (1 - dy) + bot * dy;

      tensorData[ty * targetWidth + tx] = Math.max(0.0, Math.min(1.0, val));
    }
  }

  return {
    id,
    data: tensorData,
    width: targetWidth,
    height: targetHeight,
  };
}
