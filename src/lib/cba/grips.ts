import type { CbaButtonCoord, CbaGrip, ChordQuality, ParsedChord } from "../../types/index.ts";
import { getPitchClass, normalizePitchClass, parseChord } from "../capo/transposition.ts";
import { getNoteName } from "../capo/enharmonics.ts";
import { createCbaButtonCoord, getCbaPositionsForNote } from "./grid.ts";

/**
 * Get note pitch classes for a given chord root and quality
 */
export function getChordPitchClasses(
  rootPc: number,
  quality: ChordQuality,
): number[] {
  const root = normalizePitchClass(rootPc);
  switch (quality) {
    case "minor":
      return [root, (root + 3) % 12, (root + 7) % 12];
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
    case "sus4":
      return [root, (root + 5) % 12, (root + 7) % 12];
    case "sus2":
      return [root, (root + 2) % 12, (root + 7) % 12];
    case "add9":
      return [root, (root + 2) % 12, (root + 4) % 12, (root + 7) % 12];
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
export function getChordNotes(chord: ParsedChord): string[] {
  const rootPc = chord.rootPitchClass;
  const pitchClasses = getChordPitchClasses(rootPc, chord.quality);

  return pitchClasses.map((pc) => {
    let preferFlats = false;
    if (pc === 10) { // Bb / A#
      preferFlats = !["B", "E", "F#", "C#", "G#"].includes(chord.root);
    } else if (pc === 3) { // Eb / D#
      preferFlats = !["B", "E", "F#", "C#", "G#", "D#"].includes(chord.root);
    } else if (pc === 8) { // Ab / G#
      preferFlats = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Fm", "Bbm", "Ebm", "Cm"].includes(
        chord.root,
      );
    } else if (pc === 1) { // Db / C#
      preferFlats = ["Db", "Gb", "Ab", "Eb", "Bbm", "Fm"].includes(chord.root);
    } else if (pc === 6) { // Gb / F#
      preferFlats = ["Gb", "Db", "Ab", "Ebm"].includes(chord.root);
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
 * Find the most compact button coordinate set for a sequence of chord notes
 */
export function findBestCoordinateCluster(
  notes: string[],
  targetColumnCenter = 5,
): CbaButtonCoord[] {
  const notePositions = notes.map((note) => {
    const pc = getPitchClass(note);
    const positions = getCbaPositionsForNote(pc);
    return { note, pc, positions };
  });

  const combinations: Array<Array<{ row: number; column: number; note: string }>> = [];

  function search(
    index: number,
    current: Array<{ row: number; column: number; note: string }>,
  ) {
    if (index === notePositions.length) {
      combinations.push([...current]);
      return;
    }

    const { note, positions } = notePositions[index];
    const prev = current.length > 0 ? current[current.length - 1] : null;

    for (const pos of positions) {
      // Must not collide on the exact same (row, column) button with previous notes
      const hasCollision = current.some((c) => c.row === pos.row && c.column === pos.column);
      if (hasCollision) continue;

      // On same row, columns must be strictly increasing
      if (prev && prev.row === pos.row && pos.column <= prev.column) {
        continue;
      }

      // Column must be within reasonable reach of previous note
      if (!prev || (pos.column >= prev.column - 1 && pos.column <= prev.column + 3)) {
        current.push({ ...pos, note });
        search(index + 1, current);
        current.pop();
      }
    }
  }

  search(0, []);

  if (combinations.length === 0) {
    // Fallback: take closest position for each note to targetColumnCenter
    return notePositions.map(({ note, positions }, i) => {
      let closest = positions[0];
      let minDist = 999;
      for (const p of positions) {
        const dist = Math.abs(p.column - (targetColumnCenter + i));
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      }
      return createCbaButtonCoord(closest.row, closest.column, note, i + 1);
    });
  }

  // Score combinations by compactness (maxCol - minCol) and proximity to targetColumnCenter
  let best = combinations[0];
  let bestScore = Infinity;

  for (const combo of combinations) {
    const cols = combo.map((c) => c.column);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const spread = maxCol - minCol;
    const avgCol = cols.reduce((a, b) => a + b, 0) / cols.length;
    const centerDist = Math.abs(avgCol - targetColumnCenter);

    // Score: center distance + spread + penalty for column out of bounds 2..8
    let outOfBoundsPenalty = 0;
    if (minCol < 2) outOfBoundsPenalty += (2 - minCol) * 15;
    if (maxCol > 9) outOfBoundsPenalty += (maxCol - 9) * 15;

    const score = centerDist * 10 + spread * 5 + outOfBoundsPenalty;

    if (score < bestScore) {
      bestScore = score;
      best = combo;
    }
  }

  return best.map((b, idx) => {
    return createCbaButtonCoord(b.row, b.column, b.note, idx + 1);
  });
}

/**
 * Generate CBA C-System Grip with standard fingerings
 */
export function generateCbaGrip(
  chordInput: string | ParsedChord,
  inversion = 0,
  targetColumnCenter = 5,
): CbaGrip {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const baseNotes = getChordNotes(parsed);
  const invertedNotes = invertNotes(baseNotes, inversion);

  const coords = findBestCoordinateCluster(invertedNotes, targetColumnCenter);

  // Assign standard fingerings based on chord type and inversion
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
  }

  const centroid = coords.reduce((acc, c) => acc + c.column, 0) / coords.length;

  return {
    chord: parsed.raw,
    chordName: parsed.raw,
    notes: invertedNotes,
    buttons: coords,
    buttonCoords: coords,
    fingeringPattern,
    centroidColumn: centroid,
  };
}
