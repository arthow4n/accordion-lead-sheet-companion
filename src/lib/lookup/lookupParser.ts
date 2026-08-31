import type { ParsedChordLookupList } from "../../types/scan.ts";
import { parseChord } from "../capo/transposition.ts";
import { cleanChordToken, isChordToken } from "../parser/twoline.ts";

/**
 * Normalizes an iterable of candidate chord strings (from manual input or model output)
 * through the deterministic chord parser, preserving first-seen order, deduplicating,
 * and separating valid chords from unrecognized tokens.
 */
export function normalizeChordLookupCandidates(
  candidates: Iterable<string>,
): ParsedChordLookupList {
  const chords: string[] = [];
  const invalid: string[] = [];
  const seenChords = new Set<string>();
  const seenInvalid = new Set<string>();

  for (const candidate of candidates) {
    const raw = typeof candidate === "string" ? candidate : String(candidate ?? "");
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const cleaned = cleanChordToken(trimmed);
    if (!cleaned || !isChordToken(cleaned)) {
      if (!seenInvalid.has(trimmed)) {
        seenInvalid.add(trimmed);
        invalid.push(trimmed);
      }
      continue;
    }

    const parsed = parseChord(cleaned);
    if (parsed.quality === "unknown" || !parsed.root) {
      if (!seenInvalid.has(trimmed)) {
        seenInvalid.add(trimmed);
        invalid.push(trimmed);
      }
      continue;
    }

    const normalizedRaw = parsed.raw;
    if (!seenChords.has(normalizedRaw)) {
      seenChords.add(normalizedRaw);
      chords.push(normalizedRaw);
    }
  }

  return { chords, invalid };
}

/**
 * Splits manual comma and/or newline separated text into chord candidates,
 * preserving slash chords, and returns normalized chords and invalid tokens.
 */
export function parseChordLookupInput(input: string): ParsedChordLookupList {
  if (!input || !input.trim()) {
    return { chords: [], invalid: [] };
  }

  const candidates = input.split(/[,\r\n]+/);
  return normalizeChordLookupCandidates(candidates);
}
