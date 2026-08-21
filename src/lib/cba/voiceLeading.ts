import type { CbaGrip, ParsedChord } from "../../types/index.ts";
import { parseChord } from "../capo/transposition.ts";
import { generateCbaGrip, getChordNotes } from "./grips.ts";

/**
 * Optimize CBA voice leading across consecutive chords by selecting the chord inversion
 * and row tier that minimizes hand shift (centroid column distance), maximizes common tone
 * retention, and preserves natural physical hand biomechanics.
 */
export function optimizeVoiceLeading(
  chordInput: string | ParsedChord,
  previousGrip?: CbaGrip | number,
  maxRow = 5,
): CbaGrip {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const notes = getChordNotes(parsed);
  const numInversions = notes.length;

  const prevCentroid = typeof previousGrip === "number"
    ? previousGrip
    : previousGrip?.centroidColumn ?? 5;

  const prevButtons = typeof previousGrip === "object" && previousGrip !== null
    ? (previousGrip.buttonCoords || previousGrip.buttons || [])
    : [];

  let bestGrip = generateCbaGrip(parsed, 0, prevCentroid, maxRow);
  let bestScore = evaluateVoiceLeadingCost(bestGrip, prevCentroid, prevButtons);

  for (let inv = 1; inv < numInversions; inv++) {
    const candidate = generateCbaGrip(parsed, inv, prevCentroid, maxRow);
    const score = evaluateVoiceLeadingCost(candidate, prevCentroid, prevButtons);

    if (score < bestScore) {
      bestScore = score;
      bestGrip = candidate;
    }
  }

  return bestGrip;
}

/**
 * Evaluates the ergonomic cost of transitioning from previous grip to candidate grip
 */
function evaluateVoiceLeadingCost(
  candidate: CbaGrip,
  prevCentroid: number,
  prevButtons: Array<{ row: number; column: number; note: string }>,
): number {
  const candidateButtons = candidate.buttonCoords || candidate.buttons || [];
  const candidateCentroid = candidate.centroidColumn ?? 5;

  // 1. Hand centroid delta (distance between hand centers)
  const centroidDelta = Math.abs(candidateCentroid - prevCentroid);

  // 2. Common tone retention reward (holding identical physical buttons stationary)
  let commonToneReward = 0;
  if (prevButtons.length > 0) {
    for (const b of candidateButtons) {
      if (prevButtons.some((pb) => pb.row === b.row && pb.column === b.column)) {
        commonToneReward += 15; // Reward holding common tone
      }
    }
  }

  // 3. Ergonomic Sweet Spot Bias (keep hand naturally resting in columns 4-7)
  const sweetSpotOffset = Math.abs(candidateCentroid - 5.5);

  return centroidDelta * 25 + sweetSpotOffset * 4 - commonToneReward;
}
