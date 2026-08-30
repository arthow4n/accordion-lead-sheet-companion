/**
 * Stradella Accompaniment Grooves and Rhythmic Step Solver (Strategy C)
 * Path: src/lib/stradella/grooves.ts
 */

import type {
  AccordionSize,
  ParsedChord,
  StradellaButton,
  StradellaGroovePattern,
  StradellaGrooveStep,
  StradellaGrooveType,
  StradellaVoicing,
} from "../../types/index.ts";
import {
  COLUMN_TO_BASS_NOTE,
  createStradellaButton,
  isColumnOutOfRange,
  NOTE_TO_COLUMN,
} from "./layout.ts";

export interface GroovePresetDefinition {
  id: StradellaGrooveType;
  name: string;
  timeSignature: "4/4" | "3/4" | "6/8" | "Free";
  description: string;
}

export const STRADELLA_GROOVES: GroovePresetDefinition[] = [
  {
    id: "boom_chick",
    name: "Folk Boom-Chick",
    timeSignature: "4/4",
    description: "Alternating Bass + Chord (1: Root, 2: Chord, 3: 5th Alt, 4: Chord)",
  },
  {
    id: "offbeat_chop",
    name: "Offbeat Chop",
    timeSignature: "4/4",
    description: "Acoustic / Reggae staccato chops on the offbeats (1&, 2&, 3&, 4&)",
  },
  {
    id: "waltz",
    name: "Waltz Oom-Pah-Pah",
    timeSignature: "3/4",
    description: "Classic 3/4 waltz (1: Root Bass, 2: Chord, 3: Chord)",
  },
  {
    id: "six_eight",
    name: "6/8 Ballad / Jig",
    timeSignature: "6/8",
    description: "Flowing 6/8 compound rhythm (1: Bass, 2-3: Chords, 4: Alt Bass, 5-6: Chords)",
  },
  {
    id: "none",
    name: "Off (Voicing Only)",
    timeSignature: "Free",
    description: "Standard single chord button display without rhythmic pulse ribbon",
  },
];

/**
 * Returns all available groove presets for the UI dropdown/stepper.
 */
export function getGroovePresetList(): GroovePresetDefinition[] {
  return STRADELLA_GROOVES;
}

/**
 * Solves the alternating bass button and concrete rhythmic pulse steps
 * for a sounding chord and Stradella voicing.
 */
export function solveStradellaGroove(
  soundingChord: ParsedChord | undefined,
  voicing: StradellaVoicing | undefined,
  grooveType: StradellaGrooveType,
  accordionSize: AccordionSize = "120-bass",
): StradellaGroovePattern | null {
  if (grooveType === "none" || !soundingChord || !voicing) {
    return null;
  }

  // A bass-only voicing intentionally has no truthful chord/chop step. Do not
  // synthesize a root-major label for it.
  if (!voicing.chordButton) {
    return null;
  }

  const preset = STRADELLA_GROOVES.find((g) => g.id === grooveType) || STRADELLA_GROOVES[0];

  // 1. Identify Fundamental Bass button & column
  const rootCol = voicing.rootButton?.column ??
    voicing.columnOffset ??
    NOTE_TO_COLUMN[soundingChord.root] ??
    0;

  const rootBassButtonName = voicing.rootButton?.note ??
    voicing.primaryBass ??
    COLUMN_TO_BASS_NOTE[rootCol] ??
    soundingChord.root;

  // 2. Identify Chord Button Name and Row
  const chordButtonName = voicing.chordButton?.label ??
    voicing.chordButton?.note ??
    `${rootBassButtonName}M`;

  const chordRow = voicing.chordButton?.row ?? "major";

  // 3. Compute 5th Alternating Bass button (Col +1 clockwise on Circle of Fifths)
  let altCol = rootCol + 1;
  if (isColumnOutOfRange(altCol, accordionSize)) {
    // If 5th is out of range, fallback to 4th subdominant (Col -1)
    altCol = rootCol - 1;
  }

  const altBassNote = COLUMN_TO_BASS_NOTE[altCol] || `${rootBassButtonName} (5th)`;
  const altBassButton: StradellaButton = createStradellaButton(
    "bass",
    altCol,
    altBassNote,
    2,
  );

  // 4. Construct Rhythmic Pulse Steps
  let steps: StradellaGrooveStep[] = [];

  switch (grooveType) {
    case "boom_chick":
      steps = [
        {
          beat: "1",
          label: "Bass",
          buttonName: rootBassButtonName,
          type: "bass",
          colOffset: rootCol,
          row: voicing.rootButton?.row ?? "bass",
          fingering: 4,
        },
        {
          beat: "2",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
        {
          beat: "3",
          label: "5th Alt",
          buttonName: altBassNote,
          type: "alt_bass",
          colOffset: altCol,
          row: "bass",
          fingering: 2,
        },
        {
          beat: "4",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
      ];
      break;

    case "offbeat_chop":
      steps = [
        {
          beat: "1",
          label: "Rest",
          buttonName: "-",
          type: "rest",
        },
        {
          beat: "1&",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
        {
          beat: "2",
          label: "Rest",
          buttonName: "-",
          type: "rest",
        },
        {
          beat: "2&",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
        {
          beat: "3",
          label: "Rest",
          buttonName: "-",
          type: "rest",
        },
        {
          beat: "3&",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
        {
          beat: "4",
          label: "Rest",
          buttonName: "-",
          type: "rest",
        },
        {
          beat: "4&",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
      ];
      break;

    case "waltz":
      steps = [
        {
          beat: "1",
          label: "Bass",
          buttonName: rootBassButtonName,
          type: "bass",
          colOffset: rootCol,
          row: voicing.rootButton?.row ?? "bass",
          fingering: 4,
        },
        {
          beat: "2",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
        {
          beat: "3",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
      ];
      break;

    case "six_eight":
      steps = [
        {
          beat: "1",
          label: "Bass",
          buttonName: rootBassButtonName,
          type: "bass",
          colOffset: rootCol,
          row: voicing.rootButton?.row ?? "bass",
          fingering: 4,
        },
        {
          beat: "2-3",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
        {
          beat: "4",
          label: "5th Alt",
          buttonName: altBassNote,
          type: "alt_bass",
          colOffset: altCol,
          row: "bass",
          fingering: 2,
        },
        {
          beat: "5-6",
          label: "Chop",
          buttonName: chordButtonName,
          type: "chord",
          colOffset: voicing.chordButton?.column ?? rootCol,
          row: chordRow,
          fingering: 3,
        },
      ];
      break;
  }

  return {
    id: grooveType,
    name: preset.name,
    timeSignature: preset.timeSignature,
    description: preset.description,
    steps,
    altBassButton,
  };
}
