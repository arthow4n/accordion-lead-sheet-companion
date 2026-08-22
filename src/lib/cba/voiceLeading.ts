import type { CbaGrip, ParsedChord } from "../../types/index.ts";
import { parseChord } from "../capo/transposition.ts";
import { computeCbaCentroid } from "./grid.ts";
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

  const enrichedGrip = computeCbaTransition(
    bestGrip,
    typeof previousGrip === "object" && previousGrip !== null ? previousGrip : undefined,
  );

  return enrichedGrip;
}

/**
 * Computes transition diff dynamics (shared buttons, entering strikes, exiting ghosts, and hand flow vector)
 * between consecutive CBA grips.
 */
export function computeCbaTransition(
  currGrip: CbaGrip,
  prevGrip?: CbaGrip,
): CbaGrip {
  const currBtns = currGrip.buttonCoords || currGrip.buttons || [];
  const { column: computedCurrCol, row: computedCurrRow } = computeCbaCentroid(currBtns);
  const currCentroidCol = currGrip.centroidColumn ?? computedCurrCol;
  const currCentroidRow = currGrip.centroidRow ?? computedCurrRow;

  if (!prevGrip) {
    return {
      ...currGrip,
      centroidColumn: currCentroidCol,
      centroidRow: currCentroidRow,
      flowVector: undefined,
      sharedCoords: [],
      enteringCoords: currBtns,
      exitingCoords: [],
    };
  }

  const prevBtns = prevGrip.buttonCoords || prevGrip.buttons || [];
  const { column: computedPrevCol, row: computedPrevRow } = computeCbaCentroid(prevBtns);
  const prevCentroidCol = prevGrip.centroidColumn ?? computedPrevCol;
  const prevCentroidRow = prevGrip.centroidRow ?? computedPrevRow;

  // Set Deltas
  const sharedCoords = currBtns.filter((cb) =>
    prevBtns.some((pb) => pb.row === cb.row && pb.column === cb.column)
  );
  const enteringCoords = currBtns.filter((cb) =>
    !prevBtns.some((pb) => pb.row === cb.row && pb.column === cb.column)
  );
  const exitingCoords = prevBtns.filter((pb) =>
    !currBtns.some((cb) => cb.row === pb.row && cb.column === pb.column)
  );

  // Centroid delta vectors
  const dRow = currCentroidRow - prevCentroidRow;
  const dCol = currCentroidCol - prevCentroidCol;

  let flowVector: "●" | "↗" | "↘" | "↖" | "↙" | "➔" | "⬅" = "●";

  if (Math.abs(dRow) < 0.35 && Math.abs(dCol) < 0.35) {
    flowVector = "●"; // Hand stationary / pivot
  } else if (dRow >= 0.35 && dCol >= 0.2) {
    flowVector = "↗"; // Shift inward / up-right
  } else if (dRow >= 0.35 && dCol <= -0.2) {
    flowVector = "↖"; // Shift inward / up-left
  } else if (dRow <= -0.35 && dCol >= 0.2) {
    flowVector = "↘"; // Shift outward / down-right
  } else if (dRow <= -0.35 && dCol <= -0.2) {
    flowVector = "↙"; // Shift outward / down-left
  } else if (dRow >= 0.35) {
    flowVector = "↗"; // General inward shift
  } else if (dRow <= -0.35) {
    flowVector = "↙"; // General outward shift
  } else if (dCol >= 0.35) {
    flowVector = "➔"; // Slide right
  } else if (dCol <= -0.35) {
    flowVector = "⬅"; // Slide left
  }

  return {
    ...currGrip,
    centroidColumn: currCentroidCol,
    centroidRow: currCentroidRow,
    flowVector,
    sharedCoords,
    enteringCoords,
    exitingCoords,
  };
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
