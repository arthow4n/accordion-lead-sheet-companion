import type { AccordionSize, StradellaButton, StradellaRow } from "../../types/index.ts";
import { getPitchClass, normalizePitchClass } from "../capo/transposition.ts";
import { getNoteName } from "../capo/enharmonics.ts";

/**
 * Standard Circle of Fifths column mapping for note names
 * Center C = 0
 */
export const NOTE_TO_COLUMN: Record<string, number> = {
  "Fb": -8,
  "Cb": -7,
  "Gb": -6,
  "Db": -5,
  "Ab": -4,
  "Eb": -3,
  "Bb": -2,
  "F": -1,
  "C": 0,
  "G": 1,
  "D": 2,
  "A": 3,
  "E": 4,
  "B": 5,
  "F#": 6,
  "C#": 7,
  "G#": 8,
  "D#": 9,
  "A#": 10,
  "E#": 11,
  "B#": 12,
};

/**
 * Pitch Class (0-11) to standard Stradella column index (-4 to +7)
 */
export const PITCH_CLASS_TO_COLUMN: Record<number, number> = {
  0: 0, // C
  7: 1, // G
  2: 2, // D
  9: 3, // A
  4: 4, // E
  11: 5, // B
  6: 6, // F# / Gb
  1: 7, // C# (or Db: -5)
  8: -4, // Ab / G#
  3: -3, // Eb / D#
  10: -2, // Bb / A#
  5: -1, // F
};

/**
 * Circle of Fifths column index to Fundamental Bass note name
 */
export const COLUMN_TO_BASS_NOTE: Record<number, string> = {
  [-8]: "Fb",
  [-7]: "Cb",
  [-6]: "Gb",
  [-5]: "Db",
  [-4]: "Ab",
  [-3]: "Eb",
  [-2]: "Bb",
  [-1]: "F",
  0: "C",
  1: "G",
  2: "D",
  3: "A",
  4: "E",
  5: "B",
  6: "F#",
  7: "C#",
  8: "G#",
  9: "D#",
  10: "A#",
  11: "E#",
  12: "B#",
};

/**
 * Accordion Size column boundaries
 */
export const ACCORDION_SIZE_BOUNDS: Record<
  AccordionSize,
  { minCol: number; maxCol: number }
> = {
  "48-bass": { minCol: -2, maxCol: 5 }, // Bb to B (8 cols)
  "72-bass": { minCol: -3, maxCol: 6 }, // Eb to F# (10 cols)
  "96-bass": { minCol: -4, maxCol: 7 }, // Ab to C# (12 cols)
  "120-bass": { minCol: -6, maxCol: 13 }, // Full 20 cols
};

/**
 * Check if a column is out of range for a given accordion size
 */
export function isColumnOutOfRange(
  column: number,
  size: AccordionSize = "120-bass",
): boolean {
  const bounds = ACCORDION_SIZE_BOUNDS[size] ?? ACCORDION_SIZE_BOUNDS["120-bass"];
  return column < bounds.minCol || column > bounds.maxCol;
}

/**
 * Get Circle of Fifths column for a given note name or pitch class
 */
export function getStradellaColumn(noteOrPitchClass: string | number): number {
  if (typeof noteOrPitchClass === "number") {
    const pc = normalizePitchClass(noteOrPitchClass);
    return PITCH_CLASS_TO_COLUMN[pc] ?? 0;
  }

  const clean = noteOrPitchClass.trim();
  if (NOTE_TO_COLUMN[clean] !== undefined) {
    return NOTE_TO_COLUMN[clean];
  }

  const pc = getPitchClass(clean);
  return PITCH_CLASS_TO_COLUMN[pc] ?? 0;
}

/**
 * Get fundamental bass note name for a column
 */
export function getBassNoteForColumn(column: number): string {
  return COLUMN_TO_BASS_NOTE[column] ?? getNoteName((column * 7) % 12 + 12);
}

/**
 * Get counter-bass note name (Major 3rd above fundamental) for a column
 */
export function getCounterBassNoteForColumn(column: number): string {
  const fundNote = getBassNoteForColumn(column);
  const fundPc = getPitchClass(fundNote);
  const counterPc = (fundPc + 4) % 12;
  // Choose spelling appropriate for the column
  const preferFlats = column < 0;
  return getNoteName(counterPc, preferFlats);
}

/**
 * Get Circle of Fifths column for the counter-bass button that produces a given note.
 * (Counter-bass produces a note 4 fifths sharp / Major 3rd above the fundamental bass of that column,
 * so the button producing note X is located at fundamentalCol - 4).
 */
export function getCounterBassColumn(fundamentalCol: number): number {
  return fundamentalCol - 4;
}

/**
 * Build a StradellaButton object
 */
export function createStradellaButton(
  row: StradellaRow,
  column: number,
  customLabel?: string,
  customFingering?: number,
): StradellaButton {
  const fundNote = getBassNoteForColumn(column);
  let note = fundNote;
  let label = customLabel;
  let fingering = customFingering ?? 3;

  switch (row) {
    case "counter-bass": {
      note = getCounterBassNoteForColumn(column);
      label = label ?? `${note}_`;
      fingering = customFingering ?? 2;
      break;
    }
    case "bass": {
      note = fundNote;
      label = label ?? fundNote;
      fingering = customFingering ?? 4;
      break;
    }
    case "major": {
      label = label ?? fundNote.toLowerCase();
      fingering = customFingering ?? 3;
      break;
    }
    case "minor": {
      label = label ?? `${fundNote.toLowerCase()}m`;
      fingering = customFingering ?? 3;
      break;
    }
    case "seventh": {
      label = label ?? `${fundNote.toLowerCase()}7`;
      fingering = customFingering ?? 3;
      break;
    }
    case "diminished": {
      label = label ?? `${fundNote.toLowerCase()}dim`;
      fingering = customFingering ?? 3;
      break;
    }
  }

  return {
    label: label ?? fundNote,
    row,
    column,
    note,
    fingering,
  };
}
