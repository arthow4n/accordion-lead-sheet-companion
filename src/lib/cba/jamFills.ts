/**
 * CBA C-System Jam Fill Scale Calculator (Strategy D)
 * Path: src/lib/cba/jamFills.ts
 */

import type {
  CbaButtonCoord,
  CbaJamFillScale,
  JamFillScaleType,
  ParsedChord,
} from "../../types/index.ts";
import { getNoteName } from "../capo/enharmonics.ts";
import { getPitchClass } from "../capo/transposition.ts";
import { createCbaButtonCoord, getPitchClassAt } from "./grid.ts";

/**
 * Computes the improvisation fill scale (notes, pitch classes, and 5-row button coordinates)
 * for a sounding chord on the CBA C-System keyboard.
 */
export function computeCbaJamFills(soundingChord: ParsedChord | undefined): CbaJamFillScale | null {
  if (!soundingChord || !soundingChord.root) {
    return null;
  }

  const rootPitchClass = getPitchClass(soundingChord.root);
  const quality = soundingChord.quality || "major";

  let scaleType: JamFillScaleType = "major_blues";
  let scaleName = `${soundingChord.root} Major Blues Pentatonic`;
  let intervals: number[] = [0, 2, 3, 4, 7, 9]; // Major Blues

  if (
    quality === "minor" ||
    quality === "minor7" ||
    quality === "minorSix" ||
    quality === "minor9"
  ) {
    scaleType = "minor_blues";
    scaleName = `${soundingChord.root} Minor Blues Pentatonic`;
    intervals = [0, 3, 5, 6, 7, 10]; // Minor Blues: 1, b3, 4, b5, 5, b7
  } else if (
    quality === "dominant7" ||
    quality === "dominant9" ||
    quality === "dominant13" ||
    quality === "sevenSharpEleven" ||
    quality === "sevenFlatNine" ||
    quality === "altered"
  ) {
    scaleType = "dominant_blues";
    scaleName = `${soundingChord.root} Dominant Blues`;
    intervals = [0, 4, 5, 6, 7, 10]; // Mixolydian Blues: 1, 3, 4, b5, 5, b7
  } else if (
    quality === "diminished" ||
    quality === "diminished7" ||
    quality === "halfDiminished7"
  ) {
    scaleType = "diminished";
    scaleName = `${soundingChord.root} Diminished Blues`;
    intervals = [0, 3, 5, 6, 10]; // Locrian Blues: 1, b3, 4, b5, b7
  } else if (quality === "sus4" || quality === "sus2") {
    scaleType = "dominant_blues";
    scaleName = `${soundingChord.root} Pentatonic`;
    intervals = [0, 2, 5, 7, 10]; // 1, 2, 4, 5, b7
  }

  const preferFlats = soundingChord.root.includes("b") ||
    quality === "minor" ||
    quality === "minor7";

  const pitchClasses = intervals.map((int) => (rootPitchClass + int) % 12);
  const notes = pitchClasses.map((pc) => getNoteName(pc, preferFlats));

  // Find all coordinates matching these pitch classes across the 5-row lattice (Cols 1..12)
  const fillButtonCoords: CbaButtonCoord[] = [];
  const pcSet = new Set(pitchClasses);

  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 12; c++) {
      const pc = getPitchClassAt(r, c);
      if (pcSet.has(pc)) {
        const note = getNoteName(pc, preferFlats);
        fillButtonCoords.push(createCbaButtonCoord(r, c, note, 0));
      }
    }
  }

  return {
    root: soundingChord.root,
    scaleType,
    scaleName,
    notes,
    pitchClasses,
    fillButtonCoords,
  };
}

/**
 * Checks if a given button coordinate is part of the jam fill scale.
 */
export function isJamFillButton(
  row: number,
  col: number,
  jamFills: CbaJamFillScale | null | undefined,
): boolean {
  if (!jamFills) return false;
  const pc = getPitchClassAt(row, col);
  return jamFills.pitchClasses.includes(pc);
}
