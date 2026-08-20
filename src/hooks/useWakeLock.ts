import { useCallback, useEffect, useRef, useState } from "react";

export interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  toggle: () => Promise<void>;
}

// Minimal interface for WakeLockSentinel
interface WakeLockSentinelLike extends EventTarget {
  released: boolean;
  type: string;
  release(): Promise<void>;
  onrelease: ((this: WakeLockSentinelLike, ev: Event) => unknown) | null;
}

export function useWakeLock(enabledByDefault = true): UseWakeLockReturn {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const userRequestedRef = useRef(enabledByDefault);

  useEffect(() => {
    const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
    setIsSupported(supported);
  }, []);

  const requestLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (sentinelRef.current && !sentinelRef.current.released) return;

      const navigatorWithWakeLock = navigator as unknown as {
        wakeLock: {
          request(type: string): Promise<WakeLockSentinelLike>;
        };
      };

      const sentinel = await navigatorWithWakeLock.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener("release", () => {
        sentinelRef.current = null;
        setIsActive(false);
      });
    } catch (err) {
      console.warn("Wake Lock request failed:", err);
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  const releaseLock = useCallback(async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch (err) {
        console.warn("Wake Lock release error:", err);
      }
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  const enable = useCallback(async () => {
    userRequestedRef.current = true;
    await requestLock();
  }, [requestLock]);

  const disable = useCallback(async () => {
    userRequestedRef.current = false;
    await releaseLock();
  }, [releaseLock]);

  const toggle = useCallback(async () => {
    if (isActive) {
      await disable();
    } else {
      await enable();
    }
  }, [isActive, enable, disable]);

  // Lifecycle visibility change handler (UX-02)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && userRequestedRef.current) {
        await requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, [requestLock, releaseLock]);

  return { isSupported, isActive, enable, disable, toggle };
}
