import type { ImageBox, ScorePhotoLayout } from "../../types/score.ts";

export const MAX_PHOTO_DIMENSION = 8_192;
export const MAX_PHOTO_DECODED_PIXELS = 24_000_000;

export interface DecodedPhoto {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  close: () => void;
}

/** Decode a selected photo with EXIF-aware orientation and bounded decoded memory. */
export async function decodePhotoForGuidance(file: Blob): Promise<DecodedPhoto> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot decode photos locally.");
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (
    bitmap.width <= 0 || bitmap.height <= 0 || bitmap.width > MAX_PHOTO_DIMENSION ||
    bitmap.height > MAX_PHOTO_DIMENSION || bitmap.width * bitmap.height > MAX_PHOTO_DECODED_PIXELS
  ) {
    bitmap.close();
    throw new Error("Photo dimensions exceed the safe local processing limit.");
  }
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  };
}

function boundedBox(box: ImageBox, pageWidth: number, pageHeight: number): ImageBox {
  const x = Math.min(Math.max(0, box.x), Math.max(0, pageWidth - 1));
  const y = Math.min(Math.max(0, box.y), Math.max(0, pageHeight - 1));
  const width = Math.min(Math.max(1, box.width), pageWidth - x);
  const height = Math.min(Math.max(1, box.height), pageHeight - y);
  return { x, y, width, height, sourceWidth: pageWidth, sourceHeight: pageHeight };
}

/** Conservative no-OMR fallback: begin with one full-page measure strip. */
export function createInitialPhotoLayout(width: number, height: number): ScorePhotoLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Photo dimensions must be positive finite values.");
  }
  const pageWidth = Math.min(width, MAX_PHOTO_DIMENSION);
  const pageHeight = Math.min(height, MAX_PHOTO_DIMENSION);
  return {
    schemaVersion: 1,
    page: { width: pageWidth, height: pageHeight },
    measures: [{
      id: "photo-measure-1",
      writtenIndex: 0,
      box: boundedBox({ x: 0, y: 0, width: pageWidth, height: pageHeight }, pageWidth, pageHeight),
      source: "automatic",
    }],
  };
}

/** Apply a manually adjusted box while preserving page bounds and provenance. */
export function adjustPhotoMeasureBox(
  layout: ScorePhotoLayout,
  measureId: string,
  box: ImageBox,
): ScorePhotoLayout {
  return {
    ...layout,
    measures: layout.measures.map((measure) =>
      measure.id === measureId
        ? {
          ...measure,
          box: boundedBox(box, layout.page.width, layout.page.height),
          source: "manual",
        }
        : measure
    ),
  };
}
