import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoreCursor, ScoreDocument, ScoreMeasure } from "../types/score.ts";
import { expandPerformanceRoute, getTempoAtOffset } from "../lib/score/navigation.ts";
import { rational } from "../lib/score/rational.ts";

export interface ScorePlaybackReturn {
  isPlaying: boolean;
  isTouchPaused: boolean;
  countInBeats: number;
  loopEnabled: boolean;
  speed: number;
  setSpeed: (speed: number) => void;
  cursor: ScoreCursor | null;
  performanceIndex: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  nextMeasure: () => void;
  previousMeasure: () => void;
  toggleLoop: () => void;
  reset: () => void;
}

function measureLength(measure: ScoreMeasure, fallbackTime?: ScoreDocument["time"]): number {
  const time = measure.time || fallbackTime;
  if (time) return Math.max(0.25, time.beats * 4 / time.beatType);
  const eventEnd = [...measure.melody, ...measure.harmonies].reduce((latest, event) => {
    const end = event.offset.numerator / event.offset.denominator +
      ("duration" in event && event.duration
        ? event.duration.numerator / event.duration.denominator
        : 0);
    return Math.max(latest, end);
  }, 0);
  return Math.max(0.25, eventEnd || 1);
}

/** Keep the visual count-in bounded and aligned with the first measure's meter. */
export function getScoreCountInBeats(
  measure?: ScoreMeasure,
  fallbackTime?: ScoreDocument["time"],
): number {
  return Math.max(1, Math.min(4, measure?.time?.beats || fallbackTime?.beats || 4));
}

/** Resolve the contiguous phrase around a route cursor for deterministic practice looping. */
export function getPhraseLoopRange(
  measures: ScoreMeasure[],
  currentIndex: number,
): { start: number; end: number } | null {
  if (measures.length === 0) return null;
  const current = Math.max(0, Math.min(currentIndex, measures.length - 1));
  const phraseId = measures[current]?.phraseId;
  if (!phraseId) return { start: current, end: current };
  let start = current;
  while (start > 0 && measures[start - 1]?.phraseId === phraseId) start -= 1;
  let end = current;
  while (end + 1 < measures.length && measures[end + 1]?.phraseId === phraseId) end += 1;
  return { start, end };
}

/** Advance one route measure, wrapping only when the active practice loop reaches its end. */
export function getNextScorePlaybackIndex(
  currentIndex: number,
  measureCount: number,
  loopRange?: { start: number; end: number } | null,
): number {
  if (measureCount <= 0) return 0;
  if (loopRange && currentIndex >= loopRange.end) {
    return Math.max(0, Math.min(loopRange.start, measureCount - 1));
  }
  return currentIndex + 1;
}

/** Musical-clock playback for score mode; classic lead sheets continue using useAutoScroll. */
export function useScorePlayback(document?: ScoreDocument): ScorePlaybackReturn {
  const route = useMemo(() => document ? expandPerformanceRoute(document) : null, [document]);
  const measures = useMemo(() => {
    if (!document || !route) return [];
    return route.measures.map((ref) =>
      document.measures.find((measure) => measure.id === ref.measureId)
    )
      .filter((measure): measure is ScoreMeasure => Boolean(measure));
  }, [document, route]);
  const lengths = useMemo(
    () => measures.map((measure) => measureLength(measure, document?.time)),
    [document?.time, measures],
  );
  const writtenStarts = useMemo(() => {
    if (!document) return new Map<string, number>();
    const sorted = [...document.measures].sort((a, b) => a.writtenIndex - b.writtenIndex);
    let cursor = 0;
    const starts = new Map<string, number>();
    for (const measure of sorted) {
      starts.set(measure.id, cursor);
      cursor += measureLength(measure, document.time);
    }
    return starts;
  }, [document]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTouchPaused, setIsTouchPaused] = useState(false);
  const [countInBeats, setCountInBeats] = useState(0);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [performanceIndex, setPerformanceIndex] = useState(0);
  const [offsetBeats, setOffsetBeats] = useState(0);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const indexRef = useRef(0);
  const offsetRef = useRef(0);
  const countInRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const stop = useCallback(() => {
    playingRef.current = false;
    pausedRef.current = false;
    countInRef.current = 0;
    setIsPlaying(false);
    setIsTouchPaused(false);
    setCountInBeats(0);
    if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    lastTimestampRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    indexRef.current = 0;
    offsetRef.current = 0;
    setLoopRange(null);
    setPerformanceIndex(0);
    setOffsetBeats(0);
  }, [stop]);

  useEffect(() => {
    reset();
  }, [document, reset]);

  const start = useCallback(() => {
    if (!route || route.measures.length === 0) return;
    if (indexRef.current < lengths.length && offsetRef.current >= lengths[indexRef.current]) {
      indexRef.current = getNextScorePlaybackIndex(
        indexRef.current,
        route.measures.length,
        loopRange,
      );
      offsetRef.current = 0;
      if (indexRef.current >= route.measures.length) indexRef.current = 0;
      setPerformanceIndex(indexRef.current);
      setOffsetBeats(0);
    }
    if (indexRef.current >= route.measures.length) {
      indexRef.current = 0;
      offsetRef.current = 0;
      setPerformanceIndex(0);
      setOffsetBeats(0);
    }
    playingRef.current = true;
    pausedRef.current = false;
    const countInLength = indexRef.current === 0 && offsetRef.current === 0
      ? getScoreCountInBeats(measures[0], document?.time)
      : 0;
    countInRef.current = countInLength;
    setCountInBeats(countInLength);
    setIsPlaying(true);
    setIsTouchPaused(false);
    lastTimestampRef.current = null;
  }, [document?.time?.beats, lengths, loopRange, measures, route]);

  const toggle = useCallback(() => {
    if (playingRef.current) stop();
    else start();
  }, [start, stop]);

  const move = useCallback((delta: number) => {
    if (!route || route.measures.length === 0) return;
    const next = Math.max(0, Math.min(route.measures.length - 1, indexRef.current + delta));
    indexRef.current = next;
    offsetRef.current = 0;
    setPerformanceIndex(next);
    setOffsetBeats(0);
  }, [route]);

  const nextMeasure = useCallback(() => move(1), [move]);
  const previousMeasure = useCallback(() => move(-1), [move]);

  const toggleLoop = useCallback(() => {
    if (!route || measures.length === 0) return;
    if (loopRange) {
      setLoopRange(null);
      return;
    }
    setLoopRange(getPhraseLoopRange(measures, indexRef.current));
  }, [loopRange, measures, route]);

  useEffect(() => {
    if (
      !isPlaying || isTouchPaused || !route || !document ||
      typeof requestAnimationFrame !== "function"
    ) {
      return;
    }
    const step = (timestamp: number) => {
      if (!playingRef.current || pausedRef.current || !route || !document) return;
      if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp;
      let deltaSeconds = Math.min(0.1, Math.max(0, (timestamp - lastTimestampRef.current) / 1000));
      lastTimestampRef.current = timestamp;
      if (countInRef.current > 0) {
        const tempo = getTempoAtOffset(document, rational(0));
        const countInSeconds = countInRef.current * 60 / Math.max(1, tempo.bpm * speedRef.current);
        if (deltaSeconds < countInSeconds) {
          countInRef.current -= deltaSeconds * tempo.bpm / 60 * speedRef.current;
          setCountInBeats(Math.max(1, Math.ceil(countInRef.current)));
          deltaSeconds = 0;
        } else {
          deltaSeconds -= countInSeconds;
          countInRef.current = 0;
          setCountInBeats(0);
        }
      }
      while (deltaSeconds > 0 && indexRef.current < lengths.length) {
        const index = indexRef.current;
        const ref = route.measures[index];
        const measure = measures[index];
        if (!measure || !ref) break;
        const writtenOffset = writtenStarts.get(measure.id) || 0;
        const tempo = getTempoAtOffset(
          document,
          rational(Math.round((writtenOffset + offsetRef.current) * 1_000), 1_000),
        );
        const beatsAvailable = deltaSeconds * tempo.bpm / 60 * speedRef.current;
        const remaining = Math.max(0, lengths[index] - offsetRef.current);
        if (remaining <= 0) {
          if (measure.manualHold) {
            stop();
            indexRef.current = index;
            offsetRef.current = lengths[index];
            deltaSeconds = 0;
            break;
          }
          offsetRef.current = 0;
          indexRef.current = getNextScorePlaybackIndex(index, lengths.length, loopRange);
          if (indexRef.current >= lengths.length) {
            stop();
            indexRef.current = Math.max(0, lengths.length - 1);
            offsetRef.current = lengths.at(-1) || 0;
            deltaSeconds = 0;
            break;
          }
        } else if (beatsAvailable < remaining) {
          offsetRef.current += beatsAvailable;
          deltaSeconds = 0;
        } else {
          deltaSeconds -= remaining * 60 / Math.max(1, tempo.bpm * speedRef.current);
          offsetRef.current = 0;
          if (measure.manualHold) {
            // A fermata/manual hold is an explicit human-controlled stop at the measure boundary.
            // Keep the cursor on that measure so the player does not silently advance past it.
            stop();
            indexRef.current = index;
            offsetRef.current = lengths[index];
            deltaSeconds = 0;
            break;
          }
          indexRef.current = getNextScorePlaybackIndex(index, lengths.length, loopRange);
          if (indexRef.current >= lengths.length) {
            stop();
            indexRef.current = Math.max(0, lengths.length - 1);
            offsetRef.current = lengths.at(-1) || 0;
          }
        }
      }
      setPerformanceIndex(indexRef.current);
      setOffsetBeats(offsetRef.current);
      if (playingRef.current && typeof requestAnimationFrame === "function") {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      lastTimestampRef.current = null;
    };
  }, [
    document,
    isPlaying,
    isTouchPaused,
    lengths,
    loopRange,
    measures,
    route,
    stop,
    writtenStarts,
  ]);

  useEffect(() => {
    if (typeof globalThis === "undefined") return;
    const pause = () => {
      if (!playingRef.current) return;
      pausedRef.current = true;
      setIsTouchPaused(true);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
        setIsTouchPaused(false);
        lastTimestampRef.current = null;
      }, 3500);
    };
    globalThis.addEventListener("touchstart", pause, { passive: true });
    globalThis.addEventListener("wheel", pause, { passive: true });
    globalThis.addEventListener("pointerdown", pause, { passive: true });
    return () => {
      globalThis.removeEventListener("touchstart", pause);
      globalThis.removeEventListener("wheel", pause);
      globalThis.removeEventListener("pointerdown", pause);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  const cursor = route?.measures[performanceIndex]
    ? {
      performanceIndex,
      measureId: route.measures[performanceIndex].measureId,
      offset: rational(Math.max(0, Math.round(offsetBeats * 1_000)), 1_000),
    }
    : null;

  return {
    isPlaying,
    isTouchPaused,
    countInBeats,
    loopEnabled: loopRange !== null,
    speed,
    setSpeed,
    cursor,
    performanceIndex,
    start,
    stop,
    toggle,
    nextMeasure,
    previousMeasure,
    toggleLoop,
    reset,
  };
}
