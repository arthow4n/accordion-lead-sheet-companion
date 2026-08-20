import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

export interface UseAutoScrollOptions {
  speedMultiplier?: number;
  autoResumeDelayMs?: number;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export interface UseAutoScrollReturn {
  isPlaying: boolean;
  isTouchPaused: boolean;
  speed: number;
  setSpeed: (speed: number) => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export function useAutoScroll({
  speedMultiplier = 1.0,
  autoResumeDelayMs = 3500,
  scrollContainerRef,
}: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTouchPaused, setIsTouchPaused] = useState(false);
  const [speed, setSpeed] = useState(speedMultiplier);

  const isPlayingRef = useRef(false);
  const isTouchPausedRef = useRef(false);
  const speedRef = useRef(speed);
  const animationFrameId = useRef<number | null>(null);
  const lastTimestamp = useRef<number | null>(null);
  const touchPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isTouchPausedRef.current = isTouchPaused;
  }, [isTouchPaused]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const getScrollElement = useCallback((): HTMLElement | typeof globalThis | null => {
    if (scrollContainerRef && scrollContainerRef.current) {
      return scrollContainerRef.current;
    }
    if (typeof globalThis !== "undefined") {
      return globalThis;
    }
    return null;
  }, [scrollContainerRef]);

  const step = useCallback((timestamp: number) => {
    if (!isPlayingRef.current || isTouchPausedRef.current) {
      lastTimestamp.current = null;
      return;
    }

    if (lastTimestamp.current === null) {
      lastTimestamp.current = timestamp;
    }

    const deltaTime = Math.min((timestamp - lastTimestamp.current) / 1000, 0.1);
    lastTimestamp.current = timestamp;

    const basePixelsPerSecond = 35;
    const scrollAmount = basePixelsPerSecond * speedRef.current * deltaTime;

    const target = getScrollElement();
    if (!target) return;

    if (target === globalThis) {
      if (typeof document !== "undefined") {
        globalThis.scrollBy({ top: scrollAmount, behavior: "instant" as ScrollBehavior });
        const atBottom = (globalThis.innerHeight ?? 0) + (globalThis.scrollY ?? 0) >=
          document.documentElement.scrollHeight - 2;
        if (atBottom) {
          setIsPlaying(false);
          lastTimestamp.current = null;
          return;
        }
      }
    } else {
      const el = target as HTMLElement;
      el.scrollTop += scrollAmount;
      const atBottom = el.clientHeight + el.scrollTop >= el.scrollHeight - 2;
      if (atBottom) {
        setIsPlaying(false);
        lastTimestamp.current = null;
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(step);
  }, [getScrollElement]);

  const start = useCallback(() => {
    setIsPlaying(true);
    setIsTouchPaused(false);
    isPlayingRef.current = true;
    isTouchPausedRef.current = false;
    lastTimestamp.current = null;
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsTouchPaused(false);
    isPlayingRef.current = false;
    isTouchPausedRef.current = false;
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (touchPauseTimer.current) {
      clearTimeout(touchPauseTimer.current);
      touchPauseTimer.current = null;
    }
    lastTimestamp.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  const scrollToTop = useCallback(() => {
    const target = getScrollElement();
    if (target === globalThis) {
      globalThis.scrollTo({ top: 0, behavior: "smooth" });
    } else if (target) {
      (target as HTMLElement).scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [getScrollElement]);

  const scrollToBottom = useCallback(() => {
    const target = getScrollElement();
    if (target === globalThis) {
      if (typeof document !== "undefined") {
        globalThis.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      }
    } else if (target) {
      const el = target as HTMLElement;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [getScrollElement]);

  // Main animation frame trigger
  useEffect(() => {
    if (isPlaying && !isTouchPaused) {
      lastTimestamp.current = null;
      animationFrameId.current = requestAnimationFrame(step);
    } else if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isPlaying, isTouchPaused, step]);

  // Touch & wheel pause gesture listener with 3.5s auto-resume (UX-04)
  useEffect(() => {
    if (typeof globalThis === "undefined" || typeof globalThis.addEventListener === "undefined") {
      return;
    }

    const handleUserInteraction = () => {
      if (!isPlayingRef.current) return;

      setIsTouchPaused(true);
      isTouchPausedRef.current = true;

      if (touchPauseTimer.current) {
        clearTimeout(touchPauseTimer.current);
      }

      touchPauseTimer.current = setTimeout(() => {
        setIsTouchPaused(false);
        isTouchPausedRef.current = false;
        lastTimestamp.current = null;
      }, autoResumeDelayMs);
    };

    globalThis.addEventListener("touchstart", handleUserInteraction, { passive: true });
    globalThis.addEventListener("wheel", handleUserInteraction, { passive: true });
    globalThis.addEventListener("pointerdown", handleUserInteraction, { passive: true });

    return () => {
      globalThis.removeEventListener("touchstart", handleUserInteraction);
      globalThis.removeEventListener("wheel", handleUserInteraction);
      globalThis.removeEventListener("pointerdown", handleUserInteraction);
      if (touchPauseTimer.current) {
        clearTimeout(touchPauseTimer.current);
      }
    };
  }, [autoResumeDelayMs]);

  return {
    isPlaying,
    isTouchPaused,
    speed,
    setSpeed,
    start,
    stop,
    toggle,
    scrollToTop,
    scrollToBottom,
  };
}
