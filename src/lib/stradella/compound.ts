import type {
  AccordionSize,
  ChordQuality,
  ParsedChord,
  StradellaButton,
  StradellaVoicing,
} from "../../types/index.ts";
import { normalizePitchClass } from "../capo/transposition.ts";
import { createStradellaButton, getStradellaColumn, isColumnOutOfRange } from "./layout.ts";

/**
 * Compound voicing mapping definition
 */
export interface CompoundRule {
  chordRow: "major" | "minor" | "seventh" | "diminished";
  chordPitchClassOffset: number; // semitone offset from root for the upper chord button
  columnDelta: number; // Circle of Fifths column delta from fundamental root column
  explanation: string;
}

export const COMPOUND_RULES: Partial<Record<ChordQuality, CompoundRule>> = {
  minorMajor7: {
    chordRow: "minor",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Root minor chord; RH adds major 7",
  },
  major7: {
    chordRow: "minor",
    chordPitchClassOffset: 4, // 3rd above root (e.g. C -> em)
    columnDelta: 4,
    explanation: "Fundamental bass + minor chord on 3rd (1-3-5-7)",
  },
  minor7: {
    chordRow: "major",
    chordPitchClassOffset: 3, // b3 above root (e.g. A -> c)
    columnDelta: -3,
    explanation: "Fundamental bass + major chord on b3 (1-b3-5-b7)",
  },
  halfDiminished7: {
    chordRow: "minor",
    chordPitchClassOffset: 3, // b3 above root (e.g. B -> dm)
    columnDelta: -3,
    explanation: "Fundamental bass + minor chord on b3 (1-b3-b5-b7)",
  },
  six: {
    chordRow: "minor",
    chordPitchClassOffset: 9, // 6th above root (e.g. C -> am)
    columnDelta: 3,
    explanation: "Fundamental bass + minor chord on 6th (1-3-5-6)",
  },
  minorSix: {
    chordRow: "diminished",
    chordPitchClassOffset: 0, // root dim button (e.g. C -> cdim gives 1-b3-6)
    columnDelta: 0,
    explanation: "Fundamental bass + diminished chord on root (1-b3-5-6)",
  },
  dominant9: {
    chordRow: "minor",
    chordPitchClassOffset: 7, // 5th above root (e.g. C -> gm gives 1-5-b7-9)
    columnDelta: 1,
    explanation: "Fundamental bass + minor chord on 5th (1-5-b7-9)",
  },
  dominant11: {
    chordRow: "minor",
    chordPitchClassOffset: 7,
    columnDelta: 1,
    explanation: "Minor chord on 5th; RH adds 11",
  },
  minor11: {
    chordRow: "major",
    chordPitchClassOffset: 3,
    columnDelta: -3,
    explanation: "Major chord on b3; RH adds 11/9",
  },
  sevenSharpNine: {
    chordRow: "seventh",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Root seventh chord; RH adds #9",
  },
  sevenSharpFive: {
    chordRow: "seventh",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Root seventh chord; RH adds #5",
  },
  major9: {
    chordRow: "major",
    chordPitchClassOffset: 7, // 5th above root (e.g. C -> g gives 1-5-7-9)
    columnDelta: 1,
    explanation: "Fundamental bass + major chord on 5th (1-5-7-9)",
  },
  minor9: {
    chordRow: "major",
    chordPitchClassOffset: 3, // b3 above root (e.g. C -> eb)
    columnDelta: -3,
    explanation: "Fundamental bass + major chord on b3 (1-b3-5-b7)",
  },
  dominant13: {
    chordRow: "minor",
    chordPitchClassOffset: 7, // 5th above root (e.g. C -> gm gives 1-5-b7-9/13)
    columnDelta: 1,
    explanation: "Fundamental bass + minor chord on 5th (1-5-b7-9/13)",
  },
  sevenSharpEleven: {
    chordRow: "diminished",
    chordPitchClassOffset: 0, // root dim button (e.g. C -> cdim gives 1-b5/#11)
    columnDelta: 0,
    explanation: "Fundamental bass + diminished chord on root (1-b5/#11)",
  },
  sevenFlatNine: {
    chordRow: "diminished",
    chordPitchClassOffset: 1, // dim button half-step up (e.g. C -> dbdim gives 1-b9-3-5-b7)
    columnDelta: -5,
    explanation: "Fundamental bass + diminished chord half-step up (1-b9-3-5-b7)",
  },
  sixNine: {
    chordRow: "major",
    chordPitchClassOffset: 7, // 5th above root (e.g. C -> g gives 1-5-6-9)
    columnDelta: 1,
    explanation: "Fundamental bass + major chord on 5th (1-5-6-9)",
  },
  altered: {
    chordRow: "diminished",
    chordPitchClassOffset: 0, // root dim button (e.g. C -> cdim gives altered color)
    columnDelta: 0,
    explanation: "Fundamental bass + diminished chord on root (altered color 1-b5-#9)",
  },
  sus4: {
    chordRow: "major",
    chordPitchClassOffset: 5, // 4th above root (e.g. C -> f gives F/C sus color)
    columnDelta: -1,
    explanation: "Fundamental bass + major chord on 4th (1-4-5 / F/C)",
  },
  sus2: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Fundamental bass + major chord (RH voices sus2)",
  },
  add9: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Fundamental bass + major chord (RH voices 9)",
  },
  add4: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Root major chord; RH adds 4/11",
  },
  augmented: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    columnDelta: 0,
    explanation: "Fundamental bass + major chord (RH voices aug #5)",
  },
};

export const COMPOUND_QUALITIES: ChordQuality[] = Object.keys(COMPOUND_RULES) as ChordQuality[];

/**
 * Solve compound voicing for extended chords
 */
export function solveCompoundChord(
  chord: ParsedChord,
  accordionSize: AccordionSize = "120-bass",
): StradellaVoicing {
  const rootPc = normalizePitchClass(chord.rootPitchClass);
  const rootCol = chord.root ? getStradellaColumn(chord.root) : getStradellaColumn(rootPc);
  const bassBtn = createStradellaButton("bass", rootCol, chord.root, 4);

  const rule = COMPOUND_RULES[chord.quality];

  let chordBtn: StradellaButton;
  let explanation: string;

  if (rule) {
    let chordCol = rootCol + rule.columnDelta;
    if (chordCol < -6) {
      chordCol += 12;
    } else if (chordCol > 10) {
      chordCol -= 12;
    }
    chordBtn = createStradellaButton(rule.chordRow, chordCol);
    explanation = `${bassBtn.label} + ${chordBtn.label}: ${rule.explanation}`;
  } else {
    // Default fallback
    chordBtn = createStradellaButton("major", rootCol);
    explanation = `${bassBtn.label} + ${chordBtn.label}`;
  }

  const isOutOfRange = isColumnOutOfRange(rootCol, accordionSize);

  return {
    rootButton: bassBtn,
    chordButton: chordBtn,
    primaryBass: bassBtn.label,
    isCounterBass: false,
    fingering: "4 + 3",
    explanation,
    columnOffset: rootCol,
    isOutOfRange,
  };
}
