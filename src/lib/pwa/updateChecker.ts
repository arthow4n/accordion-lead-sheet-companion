/**
 * PWA Service Worker Update Checker & Lifecycle Controller
 * Path: src/lib/pwa/updateChecker.ts
 */

export interface UpdateCheckResult {
  hasUpdate: boolean;
  message: string;
}

let updateAvailableListener: (() => void) | null = null;
let isUpdateAvailable = false;

/**
 * Initializes Service Worker update listeners (visibility change, updatefound, controllerchange).
 */
export function initUpdateChecker(onUpdateAvailable: () => void): () => void {
  updateAvailableListener = onUpdateAvailable;

  if (typeof globalThis.navigator === "undefined" || !("serviceWorker" in globalThis.navigator)) {
    return () => {};
  }

  const nav = globalThis.navigator;

  const handleVisibilityChange = () => {
    if (globalThis.document && globalThis.document.visibilityState === "visible") {
      checkForAppUpdate();
    }
  };

  const handleControllerChange = () => {
    isUpdateAvailable = true;
    if (updateAvailableListener) {
      updateAvailableListener();
    }
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(new Event("pwaUpdateAvailable"));
    }
  };

  if (typeof globalThis.document !== "undefined") {
    globalThis.document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  nav.serviceWorker.addEventListener("controllerchange", handleControllerChange);

  // Check on initial load
  nav.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;

    if (reg.waiting) {
      isUpdateAvailable = true;
      onUpdateAvailable();
      return;
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && nav.serviceWorker.controller) {
          isUpdateAvailable = true;
          onUpdateAvailable();
          if (typeof globalThis.dispatchEvent === "function") {
            globalThis.dispatchEvent(new Event("pwaUpdateAvailable"));
          }
        }
      });
    });
  });

  return () => {
    if (typeof globalThis.document !== "undefined") {
      globalThis.document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    nav.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    updateAvailableListener = null;
  };
}

/**
 * Manually checks for Service Worker updates.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (typeof globalThis.navigator === "undefined" || !("serviceWorker" in globalThis.navigator)) {
    return { hasUpdate: false, message: "Service worker not supported in this environment" };
  }

  try {
    const reg = await globalThis.navigator.serviceWorker.getRegistration();
    if (!reg) {
      return { hasUpdate: false, message: "No active service worker found" };
    }

    if (reg.waiting) {
      isUpdateAvailable = true;
      if (updateAvailableListener) updateAvailableListener();
      return { hasUpdate: true, message: "New version ready to install" };
    }

    await reg.update();

    if (reg.installing || reg.waiting) {
      isUpdateAvailable = true;
      if (updateAvailableListener) updateAvailableListener();
      return { hasUpdate: true, message: "Update found and downloading" };
    }

    return {
      hasUpdate: isUpdateAvailable,
      message: isUpdateAvailable ? "New version ready" : "App is up to date",
    };
  } catch (err) {
    return {
      hasUpdate: false,
      message: `Update check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Immediately applies the update by posting skipWaiting and reloading the page.
 */
export function applyAppUpdate(): void {
  const reload = () => {
    if (typeof globalThis.location !== "undefined") {
      globalThis.location.reload();
    }
  };

  if (typeof globalThis.navigator !== "undefined" && "serviceWorker" in globalThis.navigator) {
    globalThis.navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      reload();
    }).catch(() => {
      reload();
    });
  } else {
    reload();
  }
}

/**
 * Returns whether an update is currently known to be available.
 */
export function getIsUpdateAvailable(): boolean {
  return isUpdateAvailable;
}
