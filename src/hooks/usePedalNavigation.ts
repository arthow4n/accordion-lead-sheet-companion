import { useCallback, useEffect } from "react";

export interface UsePedalNavigationOptions {
  scrollFraction?: number; // Default 0.8 (80% of viewport height)
  enabled?: boolean;
  onPageTurn?: (direction: "down" | "up") => void;
}

export function usePedalNavigation({
  scrollFraction = 0.8,
  enabled = true,
  onPageTurn,
}: UsePedalNavigationOptions = {}): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Defensive guard: ignore keystrokes when focused on input, textarea, or contentEditable
      if (typeof document !== "undefined") {
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.isContentEditable)
        ) {
          return;
        }
      }

      if (typeof globalThis === "undefined") return;

      const viewportHeight = globalThis.innerHeight ?? 800;
      const scrollDistance = viewportHeight * scrollFraction;

      switch (e.key) {
        case "PageDown":
        case " ": // Spacebar
        case "ArrowDown": {
          e.preventDefault();
          globalThis.scrollBy({ top: scrollDistance, behavior: "smooth" });
          if (onPageTurn) onPageTurn("down");
          break;
        }
        case "PageUp":
        case "ArrowUp": {
          e.preventDefault();
          globalThis.scrollBy({ top: -scrollDistance, behavior: "smooth" });
          if (onPageTurn) onPageTurn("up");
          break;
        }
        default:
          break;
      }
    },
    [enabled, scrollFraction, onPageTurn],
  );

  useEffect(() => {
    if (typeof globalThis === "undefined" || typeof globalThis.addEventListener === "undefined") {
      return;
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
