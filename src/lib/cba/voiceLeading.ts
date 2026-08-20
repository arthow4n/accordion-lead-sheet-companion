import type { CbaGrip, ParsedChord } from "../../types/index.ts";
import { parseChord } from "../capo/transposition.ts";
import { generateCbaGrip, getChordNotes } from "./grips.ts";

/**
 * Optimize CBA voice leading by selecting the chord inversion that minimizes hand shift
 * (centroid column distance from the previous chord).
 */
export function optimizeVoiceLeading(
  chordInput: string | ParsedChord,
  previousGrip?: CbaGrip | number,
): CbaGrip {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const notes = getChordNotes(parsed);
  const numInversions = notes.length;

  const prevCentroid = typeof previousGrip === "number"
    ? previousGrip
    : previousGrip?.centroidColumn ?? 5;

  let bestGrip = generateCbaGrip(parsed, 0, prevCentroid);
  let minDelta = Math.abs((bestGrip.centroidColumn ?? 5) - prevCentroid);

  for (let inv = 1; inv < numInversions; inv++) {
    const candidate = generateCbaGrip(parsed, inv, prevCentroid);
    const delta = Math.abs((candidate.centroidColumn ?? 5) - prevCentroid);

    if (delta < minDelta) {
      minDelta = delta;
      bestGrip = candidate;
    }
  }

  return bestGrip;
}
