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
interface CompoundRule {
  chordRow: "major" | "minor" | "seventh" | "diminished";
  chordPitchClassOffset: number; // semitone offset from root for the upper chord button
  explanation: string;
}

const COMPOUND_RULES: Partial<Record<ChordQuality, CompoundRule>> = {
  major7: {
    chordRow: "minor",
    chordPitchClassOffset: 4, // 3rd above root (e.g. C -> em)
    explanation: "Fundamental bass + minor chord on 3rd (1-3-5-7)",
  },
  minor7: {
    chordRow: "major",
    chordPitchClassOffset: 3, // b3 above root (e.g. A -> c)
    explanation: "Fundamental bass + major chord on b3 (1-b3-5-b7)",
  },
  halfDiminished7: {
    chordRow: "minor",
    chordPitchClassOffset: 3, // b3 above root (e.g. B -> dm)
    explanation: "Fundamental bass + minor chord on b3 (1-b3-b5-b7)",
  },
  six: {
    chordRow: "minor",
    chordPitchClassOffset: 9, // 6th above root (e.g. C -> am)
    explanation: "Fundamental bass + minor chord on 6th (1-3-5-6)",
  },
  minorSix: {
    chordRow: "diminished",
    chordPitchClassOffset: 0, // root dim button (e.g. C -> cdim gives 1-b3-6)
    explanation: "Fundamental bass + diminished chord on root (1-b3-5-6)",
  },
  dominant9: {
    chordRow: "minor",
    chordPitchClassOffset: 7, // 5th above root (e.g. C -> gm gives 1-5-b7-9)
    explanation: "Fundamental bass + minor chord on 5th (1-5-b7-9)",
  },
  major9: {
    chordRow: "major",
    chordPitchClassOffset: 7, // 5th above root (e.g. C -> g gives 1-5-7-9)
    explanation: "Fundamental bass + major chord on 5th (1-5-7-9)",
  },
  sus4: {
    chordRow: "major",
    chordPitchClassOffset: 5, // 4th above root (e.g. C -> f gives F/C sus color)
    explanation: "Fundamental bass + major chord on 4th (1-4-5 / F/C)",
  },
  sus2: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    explanation: "Fundamental bass + major chord (RH voices sus2)",
  },
  add9: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    explanation: "Fundamental bass + major chord (RH voices 9)",
  },
  augmented: {
    chordRow: "major",
    chordPitchClassOffset: 0,
    explanation: "Fundamental bass + major chord (RH voices aug #5)",
  },
};

/**
 * Solve compound voicing for extended chords
 */
export function solveCompoundChord(
  chord: ParsedChord,
  accordionSize: AccordionSize = "120-bass",
): StradellaVoicing {
  const rootPc = normalizePitchClass(chord.rootPitchClass);
  const rootCol = getStradellaColumn(rootPc);
  const bassBtn = createStradellaButton("bass", rootCol, chord.root, 4);

  const rule = COMPOUND_RULES[chord.quality];

  let chordBtn: StradellaButton;
  let explanation: string;

  if (rule) {
    const chordPc = normalizePitchClass(rootPc + rule.chordPitchClassOffset);
    const chordCol = getStradellaColumn(chordPc);
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
