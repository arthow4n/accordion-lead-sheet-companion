import type {
  AccordionSize,
  CbaGripMode,
  ChordDetail,
  NoteSpelling,
  StradellaTransition,
} from "../../types/index.ts";
import type { HarmonyEvent } from "../../types/score.ts";
import { enrichChord } from "../parser/tokenizer.ts";
import {
  computeStradellaTransition,
  getStradellaMovementColumn,
} from "../stradella/transitions.ts";

export interface HarmonySequenceOptions {
  /** Derived score transposition in semitones. Guitar capo remains a separate UI concern. */
  transpositionSemitones?: number;
  keyContext?: string;
  noteSpelling?: NoteSpelling;
  cbaMode?: CbaGripMode;
  accordionSize?: AccordionSize;
}

export interface EnrichedHarmonyEvent extends HarmonyEvent {
  detail?: ChordDetail;
  issue?: "invalid-chord";
  stradellaTransition?: StradellaTransition;
}

/** Annotate an already performance-ordered sequence without changing event timing or spelling. */
export function annotateHarmonyTransitions(
  events: EnrichedHarmonyEvent[],
  initialColumn?: number,
): EnrichedHarmonyEvent[] {
  let previousColumn: number | undefined = initialColumn;
  return events.map((event) => {
    const currentColumn = getStradellaMovementColumn(event.detail);
    const stradellaTransition = computeStradellaTransition(previousColumn, currentColumn);
    if (currentColumn !== undefined) previousColumn = currentColumn;
    return { ...event, stradellaTransition };
  });
}

/**
 * Shared pure bridge from timed score harmony to the existing chord enrichment engines. Events are
 * sorted stably by rational offset and invalid/unsupported text remains visible but un-enriched.
 */
export function enrichHarmonySequence(
  events: HarmonyEvent[],
  options: HarmonySequenceOptions = {},
): EnrichedHarmonyEvent[] {
  const transposition = options.transpositionSemitones || 0;
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.offset.numerator * b.event.offset.denominator -
        b.event.offset.numerator * a.event.offset.denominator || a.index - b.index
    )
    .map(({ event }) => {
      if (event.unsupported || !event.raw.trim()) {
        return { ...event, issue: "invalid-chord" as const };
      }
      try {
        return {
          ...event,
          detail: enrichChord(
            event.raw,
            transposition,
            options.keyContext,
            options.noteSpelling || "auto",
          ),
        };
      } catch (_error) {
        return { ...event, issue: "invalid-chord" as const };
      }
    });
}
