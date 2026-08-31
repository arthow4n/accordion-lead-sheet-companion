/**
 * Score Photo & Chord Lookup Types and Error Codes
 * Path: src/types/scan.ts
 */

export type ScanErrorCode =
  // Server HTTP & validation codes
  | "SCAN_METHOD_NOT_ALLOWED"
  | "SCAN_ORIGIN_NOT_ALLOWED"
  | "SCAN_BAD_CONTENT_TYPE"
  | "SCAN_MULTIPART_INVALID"
  | "SCAN_IMAGE_MISSING"
  | "SCAN_IMAGE_TYPE_UNSUPPORTED"
  | "SCAN_IMAGE_TOO_LARGE"
  | "SCAN_IMAGE_EMPTY"
  | "SCAN_API_KEY_MISSING"
  | "SCAN_PROVIDER_REQUEST_FAILED"
  | "SCAN_PROVIDER_RATE_LIMITED"
  | "SCAN_PROVIDER_RESPONSE_INVALID"
  | "SCAN_NO_CHORDS_FOUND"
  | "SCAN_INTERNAL_ERROR"
  // Browser-only transport & validation codes
  | "SCAN_NETWORK_ERROR"
  | "SCAN_CLIENT_RESPONSE_INVALID";

export interface ScanChordsSuccess {
  success: true;
  chords: string[];
}

export interface ScanChordsFailure {
  success: false;
  code: ScanErrorCode;
  error: string;
}

export type ScanChordsResponse = ScanChordsSuccess | ScanChordsFailure;

export interface ParsedChordLookupList {
  chords: string[];
  invalid: string[];
}

export const MAX_SCAN_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export const ALLOWED_SCAN_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedScanImageMimeType = typeof ALLOWED_SCAN_IMAGE_MIME_TYPES[number];
