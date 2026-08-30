import type { ChordQuality } from "../../types/index.ts";

/** Chord qualities for which a Stradella chord button would introduce a conflict. */
export const BASS_ONLY_QUALITIES: ChordQuality[] = ["power5", "dominant7Sus4"];

export function isBassOnlyQuality(quality: ChordQuality): boolean {
  return BASS_ONLY_QUALITIES.includes(quality);
}
