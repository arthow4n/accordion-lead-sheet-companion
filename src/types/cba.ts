/**
 * Versioned physical CBA layout contracts.
 *
 * These contracts deliberately sit beside (rather than inside) the chord-grid types. The chord
 * grid is a pitch-class teaching lattice; a melody layout must additionally know which octave is
 * assigned to each physical button and which edge buttons are actually present on an instrument.
 */

import type { SpelledPitch } from "./score.ts";

export type CbaPhysicalRow = 1 | 2 | 3 | 4 | 5;

export interface CbaRowBounds {
  row: CbaPhysicalRow;
  minColumn: number;
  maxColumn: number;
}

export interface CbaKeyboardReference {
  row: CbaPhysicalRow;
  column: number;
  pitch: SpelledPitch;
  midi: number;
}

export interface CbaDuplicatedRow {
  row: 4 | 5;
  sourceRow: 1 | 2;
}

export interface CbaKeyboardLayout {
  /** Increment when the coordinate or pitch-assignment contract changes. */
  schemaVersion: 1;
  id: string;
  displayName: string;
  instrument: "roland-fr-1xb";
  trebleSystem: "c-griff-europe";
  hand: "right";
  orientation: {
    /** Coordinates used by the existing in-app CBA grid, not a new screen-specific coordinate system. */
    coordinateFrame: "app-cba-grid";
    /** Row 1 is the outer/fingertip side; row 5 is the innermost auxiliary side. */
    rowOrder: "outer-to-inner";
    /** Increasing columns follow the existing minor-third direction toward the high register. */
    columnOrder: "low-to-high";
  };
  rows: readonly CbaRowBounds[];
  reference: CbaKeyboardReference;
  duplicatedRows: readonly CbaDuplicatedRow[];
  playableMidi: {
    lowest: number;
    highest: number;
  };
}

export interface CbaPhysicalLocation {
  row: CbaPhysicalRow;
  column: number;
  midi: number;
  pitchClass: number;
}
