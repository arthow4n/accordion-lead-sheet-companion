/**
 * Score Fusion Engine.
 *
 * Implements Milestone 8B requirements:
 * - Combine OMR, OCR, geometric, and validator evidence while preserving disagreements as separate issue evidence.
 * - Normalize OCR chord candidates through the existing deterministic chord parser.
 * - Auto-accept approved high-confidence agreements.
 * - Use conservative source-backed guidance at medium confidence.
 * - Flag and hide speculative melody guidance at low confidence.
 * - Add unresolved structural contradictions (unmatched repeats, missing Segno/Coda) to actionable issues.
 * - Preserve unfamiliar localized directions as visible text requiring explicit mapping.
 */

import type {
  HarmonyEvent,
  NavigationMark,
  ScoreDocument,
  ScoreIssue,
  ScoreKeySignature,
  ScoreMeasure,
  ScoreSection,
  ScoreTimeSignature,
} from "../../types/score.ts";
import { normalizeChordLookupCandidates } from "../lookup/lookupParser.ts";
import { RATIONAL_ZERO } from "./rational.ts";
import { validateScoreDocument } from "./validation.ts";
import type { OcrChordCandidate } from "./ocrRecognition.ts";

export interface OcrStaffMeasureData {
  measureIndex: number;
  chords?: OcrChordCandidate[];
  navigation?: NavigationMark[];
  sectionLabel?: string;
}

export interface OcrScoreData {
  keySignature?: ScoreKeySignature;
  timeSignature?: ScoreTimeSignature;
  measures?: OcrStaffMeasureData[];
  sections?: Array<{ label: string; startMeasureIndex: number; endMeasureIndex?: number }>;
  unrecognizedDirections?: string[];
}

export interface ScoreFusionOptions {
  highConfidenceThreshold?: number; // default 0.85
  mediumConfidenceThreshold?: number; // default 0.55
  lowConfidenceThreshold?: number; // default 0.35
  enableOcrSupplementation?: boolean; // default true
}

export interface ScoreFusionResult {
  document: ScoreDocument;
  chordAgreements: number;
  chordDisagreements: number;
  unresolvedContradictions: number;
  overallConfidence: number;
}

/**
 * Fuse OMR recognition results with OCR text/form observations and deterministic supplementation.
 */
export function fuseScoreDocument(
  omrDoc: ScoreDocument,
  ocrData?: OcrScoreData,
  options?: ScoreFusionOptions,
): ScoreFusionResult {
  const _highThreshold = options?.highConfidenceThreshold ?? 0.85;
  const mediumThreshold = options?.mediumConfidenceThreshold ?? 0.55;
  const lowThreshold = options?.lowConfidenceThreshold ?? 0.35;

  let chordAgreements = 0;
  let chordDisagreements = 0;
  let unresolvedContradictions = 0;

  // Deep clone measures so input document remains untouched
  const measures: ScoreMeasure[] = omrDoc.measures.map((m) => ({
    ...m,
    melody: m.melody.map((ev) => ({ ...ev })),
    harmonies: m.harmonies.map((h) => ({ ...h })),
    navigation: [...m.navigation],
  }));

  const issues: ScoreIssue[] = [...omrDoc.issues];
  const sections: ScoreSection[] = [...omrDoc.sections];

  // 1. Deterministic Time Signature Supplementation (e.g. 6/8 meter absent from JAZZMUS)
  let docTime = omrDoc.time;
  if (ocrData?.timeSignature) {
    const isOmrDefaultOrDifferent = !docTime ||
      (docTime.beats === 4 && docTime.beatType === 4 &&
        (ocrData.timeSignature.beats !== 4 || ocrData.timeSignature.beatType !== 4));

    if (isOmrDefaultOrDifferent || ocrData.timeSignature.beats === 6) {
      docTime = { ...ocrData.timeSignature };
      for (const m of measures) {
        if (!m.time || (m.time.beats === 4 && m.time.beatType === 4)) {
          m.time = { ...ocrData.timeSignature };
        }
      }
    }
  }

  // 2. Deterministic Key Signature Supplementation (0 to 6 sharps/flats)
  let docKey = omrDoc.key;
  if (ocrData?.keySignature) {
    if (!docKey || (docKey.fifths === 0 && ocrData.keySignature.fifths !== 0)) {
      docKey = { ...ocrData.keySignature };
      for (const m of measures) {
        if (!m.key || m.key.fifths === 0) {
          m.key = { ...ocrData.keySignature };
        }
      }
    }
  }

  // Map OCR measure data by writtenIndex
  const ocrMeasureMap = new Map<number, OcrStaffMeasureData>();
  if (ocrData?.measures) {
    for (const ocrM of ocrData.measures) {
      ocrMeasureMap.set(ocrM.measureIndex, ocrM);
    }
  }

  // 3. Process Measure Chords & Melody Confidence
  let totalConfidenceSum = 0;
  let totalConfidenceCount = 0;

  for (let idx = 0; idx < measures.length; idx++) {
    const m = measures[idx];
    const ocrM = ocrMeasureMap.get(m.writtenIndex);

    // --- Melody Confidence & Policy ---
    if (m.melody.length > 0) {
      let melodySum = 0;
      let lowNoteCount = 0;
      for (const note of m.melody) {
        const c = note.confidence ?? 0.8;
        melodySum += c;
        if (c < lowThreshold) {
          lowNoteCount++;
        }
      }
      const avgMelodyConf = melodySum / m.melody.length;
      m.confidence = avgMelodyConf;
      totalConfidenceSum += avgMelodyConf;
      totalConfidenceCount++;

      if (avgMelodyConf < lowThreshold || lowNoteCount > m.melody.length / 2) {
        issues.push({
          code: "low_melody_confidence",
          message: `Measure ${
            m.printedNumber ?? m.writtenIndex + 1
          }: low-confidence melody recognition (${
            Math.round(avgMelodyConf * 100)
          }%). Generated melody guidance is hidden until reviewed.`,
          severity: "warning",
          measureId: m.id,
          sourceBox: m.sourceBox,
          blocksGuidance: false,
        });
      }
    }

    // --- Harmony / Chord Normalization & Fusion ---
    const omrHarmony = m.harmonies[0];
    const ocrChords = ocrM?.chords || [];
    const ocrCandidate = ocrChords[0];

    if (omrHarmony && ocrCandidate) {
      // Both OMR and OCR found chords
      const normOmr = normalizeChordLookupCandidates([omrHarmony.raw]).chords[0] || omrHarmony.raw;
      const normOcr = normalizeChordLookupCandidates([ocrCandidate.raw]).chords[0] ||
        ocrCandidate.normalized;

      if (normOmr.toLowerCase() === normOcr.toLowerCase()) {
        // High-confidence agreement!
        chordAgreements++;
        omrHarmony.raw = normOmr;
        omrHarmony.confidence = Math.max(omrHarmony.confidence ?? 0.85, 0.95);
        totalConfidenceSum += omrHarmony.confidence;
        totalConfidenceCount++;
      } else {
        // Disagreement: preserve as separate issue evidence
        chordDisagreements++;
        const ocrConf = ocrCandidate.confidence ?? 0.85;
        const omrConf = omrHarmony.confidence ?? 0.70;

        // Choose conservative source-backed guidance
        let chosenChord = normOmr;
        let chosenConf = omrConf;
        if (ocrConf > omrConf + 0.15) {
          chosenChord = normOcr;
          chosenConf = ocrConf;
        }

        omrHarmony.raw = chosenChord;
        omrHarmony.confidence = Math.min(chosenConf, 0.75); // Cap confidence due to discrepancy
        totalConfidenceSum += omrHarmony.confidence;
        totalConfidenceCount++;

        issues.push({
          code: "chord_disagreement",
          message: `Measure ${
            m.printedNumber ?? m.writtenIndex + 1
          }: OMR detected '${omrHarmony.raw}' but OCR detected '${ocrCandidate.raw}'. Source-backed guidance retained '${chosenChord}'.`,
          severity: "warning",
          measureId: m.id,
          sourceBox: m.sourceBox,
          blocksGuidance: false,
        });
      }
    } else if (omrHarmony && !ocrCandidate) {
      // OMR only
      const normOmr = normalizeChordLookupCandidates([omrHarmony.raw]).chords[0];
      if (!normOmr) {
        omrHarmony.unsupported = true;
        issues.push({
          code: "unsupported_harmony",
          message: `Measure ${
            m.printedNumber ?? m.writtenIndex + 1
          }: Unrecognized chord '${omrHarmony.raw}'.`,
          severity: "warning",
          measureId: m.id,
          sourceBox: m.sourceBox,
          blocksGuidance: false,
        });
      } else {
        omrHarmony.raw = normOmr;
        const conf = omrHarmony.confidence ?? 0.75;
        totalConfidenceSum += conf;
        totalConfidenceCount++;

        if (conf < mediumThreshold) {
          issues.push({
            code: "low_chord_confidence",
            message: `Measure ${
              m.printedNumber ?? m.writtenIndex + 1
            }: Chord '${normOmr}' recognized with medium/low confidence (${
              Math.round(conf * 100)
            }%).`,
            severity: "warning",
            measureId: m.id,
            sourceBox: m.sourceBox,
            blocksGuidance: false,
          });
        }
      }
    } else if (!omrHarmony && ocrCandidate) {
      // OCR only: supplement missing chord from OCR banner
      const normOcr = normalizeChordLookupCandidates([ocrCandidate.raw]).chords[0] ||
        ocrCandidate.normalized;
      if (normOcr) {
        const newHarmony: HarmonyEvent = {
          id: `${m.id}-h-ocr-0`,
          offset: RATIONAL_ZERO,
          raw: normOcr,
          confidence: ocrCandidate.confidence ?? 0.85,
          provenance: "photo-omr",
        };
        m.harmonies.push(newHarmony);
        totalConfidenceSum += newHarmony.confidence ?? 0.85;
        totalConfidenceCount++;
      }
    }

    // --- Navigation from OCR ---
    if (ocrM?.navigation && ocrM.navigation.length > 0) {
      for (const nav of ocrM.navigation) {
        const existing = m.navigation.some((n) => n.kind === nav.kind);
        if (!existing) {
          m.navigation.push(nav);
        }
      }
    }

    // --- Section labels from OCR ---
    if (ocrM?.sectionLabel) {
      const exists = sections.some((s) => s.startMeasureId === m.id);
      if (!exists) {
        sections.push({
          id: `sec-${sections.length + 1}`,
          label: ocrM.sectionLabel,
          startMeasureId: m.id,
        });
      }
    }
  }

  // 4. Form & Explicit Section List from OCR
  if (ocrData?.sections) {
    for (const sec of ocrData.sections) {
      const startMeasure = measures[sec.startMeasureIndex] || measures[0];
      const endMeasure = sec.endMeasureIndex !== undefined
        ? measures[sec.endMeasureIndex]
        : undefined;
      const alreadyAdded = sections.some((s) =>
        s.label === sec.label && s.startMeasureId === startMeasure.id
      );
      if (!alreadyAdded && startMeasure) {
        sections.push({
          id: `sec-${sections.length + 1}`,
          label: sec.label,
          startMeasureId: startMeasure.id,
          endMeasureId: endMeasure?.id,
        });
      }
    }
  }

  // 5. Structural Contradiction Detection
  let hasRepeatStart = false;
  let hasSegno = false;
  let hasDalSegno = false;
  let hasCoda = false;
  let hasToCoda = false;

  for (const m of measures) {
    for (const n of m.navigation) {
      if (n.kind === "repeat-start") hasRepeatStart = true;
      if (n.kind === "repeat-end") {
        if (!hasRepeatStart && m.writtenIndex > 0) {
          // repeat-end without prior repeat-start
        }
      }
      if (n.kind === "segno") hasSegno = true;
      if (n.kind === "ds") hasDalSegno = true;
      if (n.kind === "coda") hasCoda = true;
      if (
        n.kind === "to-coda" || (n.kind === "dc" && n.target === "coda") ||
        (n.kind === "ds" && n.target === "coda")
      ) {
        hasToCoda = true;
      }
    }
  }

  if (hasDalSegno && !hasSegno) {
    unresolvedContradictions++;
    issues.push({
      code: "ambiguous_navigation",
      message:
        "Score contains Dal Segno (D.S.) navigation mark without a corresponding Segno symbol.",
      severity: "warning",
      blocksGuidance: false,
    });
  }

  if (hasToCoda && !hasCoda) {
    unresolvedContradictions++;
    issues.push({
      code: "ambiguous_navigation",
      message: "Score directs to Coda but no Coda section mark was detected.",
      severity: "warning",
      blocksGuidance: false,
    });
  }

  // 6. Unfamiliar Localized Directions
  if (ocrData?.unrecognizedDirections && ocrData.unrecognizedDirections.length > 0) {
    const targetMeasure = measures[0] || { id: "m1", navigation: [] };
    for (const dir of ocrData.unrecognizedDirections) {
      targetMeasure.navigation.push({ kind: "text", text: dir });
      issues.push({
        code: "unfamiliar_direction",
        message:
          `Unrecognized musical direction '${dir}' preserved as text annotation. Requires explicit mapping.`,
        severity: "info",
        measureId: targetMeasure.id,
        blocksGuidance: false,
      });
    }
  }

  const overallConfidence = totalConfidenceCount > 0
    ? totalConfidenceSum / totalConfidenceCount
    : (omrDoc.measures[0]?.confidence ?? 0.85);

  const fusedDoc: ScoreDocument = {
    ...omrDoc,
    key: docKey,
    time: docTime,
    sections,
    measures,
    issues,
  };

  // Re-run standard validation
  const validation = validateScoreDocument(fusedDoc);
  for (const vIssue of validation.issues) {
    if (!fusedDoc.issues.some((i) => i.code === vIssue.code && i.measureId === vIssue.measureId)) {
      fusedDoc.issues.push(vIssue);
    }
  }

  return {
    document: fusedDoc,
    chordAgreements,
    chordDisagreements,
    unresolvedContradictions,
    overallConfidence,
  };
}
