import { MAX_SCAN_IMAGE_SIZE_BYTES } from "../../types/scan.ts";
import { decodePhotoForGuidance } from "../score/photoGuidance.ts";
import { GeminiError, type GeminiImage } from "./client.ts";

/** Re-encode pixels locally: original EXIF/GPS and filename never enter the request. */
export async function prepareGeminiImage(file: File, signal?: AbortSignal): Promise<GeminiImage> {
  signal?.throwIfAborted();
  if (!file.size || file.size > MAX_SCAN_IMAGE_SIZE_BYTES) {
    throw new GeminiError("Choose a photo smaller than 10 MiB.");
  }
  let decoded;
  try {
    decoded = await decodePhotoForGuidance(file);
  } catch {
    throw new GeminiError(
      "This browser could not decode the photo. Try a JPEG, PNG, or WebP image.",
    );
  }
  try {
    signal?.throwIfAborted();
    const scale = Math.min(1, 4096 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new GeminiError("Photo preparation is not supported in this browser.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(decoded.bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new GeminiError("Could not prepare the photo.")),
          type,
          .95,
        )
      );
    let blob = await encode("image/png");
    if (blob.size > MAX_SCAN_IMAGE_SIZE_BYTES) blob = await encode("image/jpeg");
    if (blob.size > MAX_SCAN_IMAGE_SIZE_BYTES) {
      throw new GeminiError("The prepared image is too large. Crop the page and try again.");
    }
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return {
      mimeType: blob.type === "image/jpeg" ? "image/jpeg" : "image/png",
      data: btoa(binary),
    };
  } finally {
    decoded.close();
  }
}
