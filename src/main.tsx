import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App.tsx";
import { initPresets } from "./lib/storage/songbook.ts";
import { PRESET_SONGS } from "./lib/storage/presets.ts";
import "./index.css";

// Check for Service Worker updates when returning to the app
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update();
      });
    }
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element with id 'root'");
}

// Resolve the complete song list before React mounts. This makes URL and PWA/local-storage
// selection available to the very first App render, instead of painting a preset and replacing
// it once IndexedDB finishes loading.
async function bootstrap() {
  let initialSongs = PRESET_SONGS;
  try {
    const loaded = await initPresets();
    if (loaded.length > 0) {
      initialSongs = loaded;
    }
  } catch (err) {
    console.warn("Failed to preload IndexedDB songbook:", err);
  }

  rootElement.removeAttribute("aria-busy");
  createRoot(rootElement).render(
    <React.StrictMode>
      <App initialSongs={initialSongs} />
    </React.StrictMode>,
  );
}

void bootstrap();
