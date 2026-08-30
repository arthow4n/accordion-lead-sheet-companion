import type {
  CbaButtonCoord,
  CbaGrip,
  ChordQuality,
  NoteSpelling,
  ParsedChord,
} from "../../types/index.ts";
import { getPitchClass, normalizePitchClass, parseChord } from "../capo/transposition.ts";
import { getNoteName } from "../capo/enharmonics.ts";
import {
  computeCbaCentroid,
  createCbaButtonCoord,
  getCbaPositionsForNote,
  getCbaRowForPitchClass,
} from "./grid.ts";

/**
 * Get note pitch classes for a given chord root and quality
 */
export function getChordPitchClasses(
  rootPc: number,
  quality: ChordQuality,
): number[] {
  const root = normalizePitchClass(rootPc);
  switch (quality) {
    case "power5":
      return [root, (root + 7) % 12];
    case "minor":
      return [root, (root + 3) % 12, (root + 7) % 12];
    case "minorMajor7":
      return [root, (root + 3) % 12, (root + 7) % 12, (root + 11) % 12];
    case "dominant7Sus4":
      return [root, (root + 5) % 12, (root + 7) % 12, (root + 10) % 12];
    case "dominant11":
      return [root, (root + 10) % 12, (root + 2) % 12, (root + 5) % 12];
    case "minor11":
      return [root, (root + 3) % 12, (root + 10) % 12, (root + 5) % 12];
    case "dominant7":
      return [root, (root + 4) % 12, (root + 7) % 12, (root + 10) % 12];
    case "major7":
      return [root, (root + 4) % 12, (root + 7) % 12, (root + 11) % 12];
    case "minor7":
      return [root, (root + 3) % 12, (root + 7) % 12, (root + 10) % 12];
    case "diminished":
    case "diminished7":
      return [root, (root + 3) % 12, (root + 6) % 12, (root + 9) % 12];
    case "halfDiminished7":
      return [root, (root + 3) % 12, (root + 6) % 12, (root + 10) % 12];
    case "six":
      return [root, (root + 4) % 12, (root + 7) % 12, (root + 9) % 12];
    case "minorSix":
      return [root, (root + 3) % 12, (root + 7) % 12, (root + 9) % 12];
    case "dominant9":
      return [(root + 4) % 12, (root + 7) % 12, (root + 10) % 12, (root + 2) % 12];
    case "major9":
      return [(root + 4) % 12, (root + 7) % 12, (root + 11) % 12, (root + 2) % 12];
    case "minor9":
      return [(root + 3) % 12, (root + 7) % 12, (root + 10) % 12, (root + 2) % 12];
    case "dominant13":
      return [root, (root + 4) % 12, (root + 10) % 12, (root + 9) % 12];
    case "sevenSharpEleven":
      return [root, (root + 4) % 12, (root + 6) % 12, (root + 10) % 12];
    case "sevenFlatNine":
      return [root, (root + 4) % 12, (root + 10) % 12, (root + 1) % 12];
    case "sevenSharpNine":
      return [root, (root + 4) % 12, (root + 10) % 12, (root + 3) % 12];
    case "sevenSharpFive":
      return [root, (root + 4) % 12, (root + 8) % 12, (root + 10) % 12];
    case "sixNine":
      return [root, (root + 4) % 12, (root + 9) % 12, (root + 2) % 12];
    case "altered":
      return [root, (root + 4) % 12, (root + 6) % 12, (root + 10) % 12];
    case "sus4":
      return [root, (root + 5) % 12, (root + 7) % 12];
    case "sus2":
      return [root, (root + 2) % 12, (root + 7) % 12];
    case "add9":
      return [root, (root + 2) % 12, (root + 4) % 12, (root + 7) % 12];
    case "add4":
      return [root, (root + 4) % 12, (root + 5) % 12, (root + 7) % 12];
    case "augmented":
      return [root, (root + 4) % 12, (root + 8) % 12];
    case "major":
    default:
      return [root, (root + 4) % 12, (root + 7) % 12];
  }
}

/**
 * Get spelled note names for a chord
 */
export function getChordNotes(
  chord: ParsedChord,
  noteSpelling: NoteSpelling = "auto",
): string[] {
  const rootPc = chord.rootPitchClass;
  const pitchClasses = getChordPitchClasses(rootPc, chord.quality);

  if (noteSpelling !== "auto") {
    return pitchClasses.map((pc) => getNoteName(pc, noteSpelling === "flats"));
  }

  return pitchClasses.map((pc) => {
    let preferFlats = false;
    if (chord.quality === "sevenSharpNine" && pc === (rootPc + 3) % 12) {
      preferFlats = false;
    } else if (chord.quality === "sevenSharpFive" && pc === (rootPc + 8) % 12) {
      preferFlats = false;
    } else if (chord.quality === "sevenFlatNine" && pc === (rootPc + 1) % 12) {
      preferFlats = true;
    } else if (chord.quality === "sevenSharpEleven" && pc === (rootPc + 6) % 12) {
      preferFlats = false;
    } else if (pc === 10) { // Bb / A#
      preferFlats = !["B", "E", "F#", "C#", "G#"].includes(chord.root);
    } else if (pc === 3) { // Eb / D#
      preferFlats = !["B", "E", "F#", "C#", "G#", "D#"].includes(chord.root);
    } else if (pc === 8) { // Ab / G#
      preferFlats = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Fm", "Bbm", "Ebm", "Cm", "C"].includes(
        chord.root,
      );
    } else if (pc === 1) { // Db / C#
      preferFlats = ["Db", "Gb", "Ab", "Eb", "Bbm", "Fm", "C", "F"].includes(chord.root);
    } else if (pc === 6) { // Gb / F#
      preferFlats = ["Gb", "Db", "Ab", "Ebm", "Bb", "Eb"].includes(chord.root);
    }
    return getNoteName(pc, preferFlats);
  });
}

/**
 * Re-order notes for a given inversion (0 = root, 1 = 1st inv, 2 = 2nd inv, 3 = 3rd inv)
 */
export function invertNotes<T>(items: T[], inversion: number): T[] {
  const n = items.length;
  const shift = ((inversion % n) + n) % n;
  if (shift === 0) return [...items];
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/**
 * Biomechanical check: verifies if a set of button coordinates is physically playable
 * by a human right hand on a CBA keyboard.
 */
export function isBiochemicallyFeasible(
  buttons: Array<{ row: number; column: number }>,
): boolean {
  if (buttons.length <= 1) return true;

  const cols = buttons.map((b) => b.column);
  const rows = buttons.map((b) => b.row);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);

  // 1. Column Span: Human hand span on CBA is max 3 columns (4 for 4-note extended chords)
  const maxAllowedSpan = buttons.length >= 4 ? 3 : 2;
  if (maxCol - minCol > maxAllowedSpan) return false;

  // 2. Row Tier: Hand arches across a contiguous 3-row band (maxRow - minRow <= 2)
  if (maxRow - minRow > 2) return false;

  return true;
}

/**
 * Find the most compact, physically ergonomic button coordinate set for a sequence of chord notes.
 */
export function findBestCoordinateCluster(
  notes: string[],
  targetColumnCenter = 5,
  maxRow = 5,
): CbaButtonCoord[] {
  const notePositions = notes.map((note) => {
    const pc = getPitchClass(note);
    const positions = getCbaPositionsForNote(pc, maxRow);
    return { note, pc, positions };
  });

  const combinations: Array<Array<{ row: number; column: number; note: string }>> = [];

  function search(
    index: number,
    current: Array<{ row: number; column: number; note: string }>,
  ) {
    if (index === notePositions.length) {
      if (isBiochemicallyFeasible(current)) {
        combinations.push([...current]);
      }
      return;
    }

    const { note, positions } = notePositions[index];

    for (const pos of positions) {
      // Must not collide on the exact same (row, column) button
      const hasCollision = current.some((c) => c.row === pos.row && c.column === pos.column);
      if (hasCollision) continue;

      current.push({ ...pos, note });
      search(index + 1, current);
      current.pop();
    }
  }

  search(0, []);

  // Fallback if no strict feasible combination found: relax constraints
  if (combinations.length === 0) {
    const fallbackCombinations: Array<Array<{ row: number; column: number; note: string }>> = [];
    const searchFallback = (
      index: number,
      current: Array<{ row: number; column: number; note: string }>,
    ) => {
      if (index === notePositions.length) {
        fallbackCombinations.push([...current]);
        return;
      }
      const { note, positions } = notePositions[index];
      for (const pos of positions) {
        const hasCollision = current.some((c) => c.row === pos.row && c.column === pos.column);
        if (hasCollision) continue;
        current.push({ ...pos, note });
        searchFallback(index + 1, current);
        current.pop();
      }
    };
    searchFallback(0, []);
    combinations.push(...fallbackCombinations);
  }

  // Score candidate combinations by compactness, sweet-spot center, and row tier cohesion
  let best = combinations[0];
  let bestScore = Infinity;

  for (const combo of combinations) {
    const cols = combo.map((c) => c.column);
    const rows = combo.map((c) => c.row);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const minRow = Math.min(...rows);
    const maxRowVal = Math.max(...rows);

    const colSpread = maxCol - minCol;
    const rowSpread = maxRowVal - minRow;
    const avgCol = cols.reduce((a, b) => a + b, 0) / cols.length;
    const centerDist = Math.abs(avgCol - targetColumnCenter);

    // Keep hand near the comfortable playing center (columns 3-8)
    let outOfBoundsPenalty = 0;
    if (minCol < 2) outOfBoundsPenalty += (2 - minCol) * 25;
    if (maxCol > 9) outOfBoundsPenalty += (maxCol - 9) * 25;

    // Compactness & tier score
    const spreadScore = colSpread * 15 + rowSpread * 20;
    const centerScore = centerDist * 8;

    const totalScore = spreadScore + centerScore + outOfBoundsPenalty;

    if (totalScore < bestScore) {
      bestScore = totalScore;
      best = combo;
    }
  }

  if (!best) {
    return notePositions.map(({ note, positions }, i) => {
      const closest = positions[0];
      return createCbaButtonCoord(closest?.row ?? 1, closest?.column ?? 4, note, i + 1);
    });
  }

  // Assign standard isomorphic fingerings
  const numNotes = best.length;
  let fingers = [1, 2, 4];
  if (numNotes === 3) {
    fingers = [1, 2, 4];
  } else if (numNotes === 4) {
    fingers = [1, 2, 4, 5];
  } else {
    fingers = best.map((_, i) => Math.min(5, i + 1));
  }

  return best.map((b, idx) => {
    return createCbaButtonCoord(b.row, b.column, b.note, fingers[idx] || idx + 1);
  });
}

/**
 * Generate CBA C-System Grip with standard fingerings and 5-row auxiliary optimization
 */
export function generateCbaGrip(
  chordInput: string | ParsedChord,
  inversion = 0,
  targetColumnCenter = 5,
  maxRow = 5,
  noteSpelling: NoteSpelling = "auto",
): CbaGrip {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const baseNotes = getChordNotes(parsed, noteSpelling);
  const invertedNotes = invertNotes(baseNotes, inversion);

  const coords = findBestCoordinateCluster(invertedNotes, targetColumnCenter, maxRow);

  let fingeringPattern = "1-2-4";
  const numNotes = invertedNotes.length;

  if (numNotes === 3) {
    if (inversion === 0) {
      fingeringPattern = "1-2-4";
      coords[0].finger = 1;
      coords[1].finger = 2;
      coords[2].finger = 4;
    } else if (inversion === 1) {
      fingeringPattern = "1-2-5";
      coords[0].finger = 1;
      coords[1].finger = 2;
      coords[2].finger = 5;
    } else if (inversion === 2) {
      fingeringPattern = "1-3-5";
      coords[0].finger = 1;
      coords[1].finger = 3;
      coords[2].finger = 5;
    }
  } else if (numNotes === 4) {
    fingeringPattern = "1-2-4-5";
    coords[0].finger = 1;
    coords[1].finger = 2;
    coords[2].finger = 4;
    coords[3].finger = 5;
  } else if (numNotes === 2) {
    fingeringPattern = "1-2";
    coords[0].finger = 1;
    coords[1].finger = 2;
  }

  const { column: centroid, row: centroidRow } = computeCbaCentroid(coords);

  return {
    chord: parsed.raw || parsed.root,
    chordName: parsed.raw || parsed.root,
    notes: invertedNotes,
    buttons: coords,
    buttonCoords: coords,
    fingeringPattern,
    centroidColumn: centroid,
    centroidRow,
    isRootGrip: inversion === 0,
    rootButtonCoord: inversion === 0 ? coords[0] : undefined,
    inversion,
  };
}

/**
 * Generates the canonical, 100% predictable isomorphic root-position chord grip
 * on the 5-row CBA C-System, ensuring invariant muscle memory across all 12 keys.
 */
export function generateCanonicalRootGrip(
  chordInput: string | ParsedChord,
  targetColumnCenter = 5,
  rowTierMode: "3row" | "5row" = "5row",
  noteSpelling: NoteSpelling = "auto",
): CbaGrip {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const rootPc = parsed.rootPitchClass;
  const baseRow = getCbaRowForPitchClass(rootPc);

  // Find root position nearest targetColumnCenter
  const rootPositions = getCbaPositionsForNote(rootPc).filter((p) => p.row === baseRow);
  const rootPos = rootPositions.reduce(
    (prev, curr) =>
      Math.abs(curr.column - targetColumnCenter) < Math.abs(prev.column - targetColumnCenter)
        ? curr
        : prev,
    rootPositions[0] || { row: baseRow, column: targetColumnCenter },
  );

  const chordNotes = getChordNotes(parsed, noteSpelling);
  const coords: CbaButtonCoord[] = [
    createCbaButtonCoord(rootPos.row, rootPos.column, chordNotes[0], 1),
  ];

  const minRow = rowTierMode === "3row" ? 1 : baseRow;
  const maxRow = rowTierMode === "3row" ? 3 : Math.min(5, baseRow + 2);

  for (let i = 1; i < chordNotes.length; i++) {
    const note = chordNotes[i];
    const pc = getPitchClass(note);
    const candidatePositions = getCbaPositionsForNote(pc);

    let bestPos = candidatePositions[0];
    let bestDist = Infinity;

    for (const pos of candidatePositions) {
      if (pos.row < minRow || pos.row > maxRow) continue;
      if (pos.column < rootPos.column - 2 || pos.column > rootPos.column + 2) continue;

      const currentCols = [...coords.map((c) => c.column), pos.column];
      const colSpan = Math.max(...currentCols) - Math.min(...currentCols);
      const dist = colSpan * 100 + Math.abs(pos.column - rootPos.column) * 10 +
        Math.abs(pos.row - rootPos.row) * 5;

      if (dist < bestDist) {
        bestDist = dist;
        bestPos = pos;
      }
    }

    const finger = chordNotes.length >= 4 ? (i === 1 ? 2 : i === 2 ? 4 : 5) : (i === 1 ? 2 : 4);
    coords.push(createCbaButtonCoord(bestPos.row, bestPos.column, note, finger));
  }

  const { column: centroid, row: centroidRow } = computeCbaCentroid(coords);
  const fingeringPattern = coords.length >= 4 ? "1-2-4-5" : coords.length === 2 ? "1-2" : "1-2-4";

  return {
    chord: parsed.raw || parsed.root,
    chordName: parsed.raw || parsed.root,
    notes: chordNotes,
    buttons: coords,
    buttonCoords: coords,
    fingeringPattern,
    centroidColumn: centroid,
    centroidRow,
    isRootGrip: true,
    rootButtonCoord: coords[0],
    inversion: 0,
  };
}
