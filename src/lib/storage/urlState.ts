/**
 * Application URL and LocalStorage State Resolution Helpers
 * Path: src/lib/storage/urlState.ts
 */

import type { LeadSheetSong, ViewMode } from "../../types/index.ts";

export const LAST_VIEW_STORAGE_KEY = "accordion_companion_last_view_mode";
export const LAST_SONG_STORAGE_KEY = "accordion_companion_last_song_id";

/**
 * Parses and returns a song from URL query parameter (?song=...) or hash (#song=...)
 */
export function getSongFromUrl(
  availableSongs: LeadSheetSong[],
  urlString?: string,
): LeadSheetSong | undefined {
  try {
    let search = "";
    let hash = "";
    if (urlString) {
      if (urlString.startsWith("?")) {
        search = urlString;
      } else if (urlString.startsWith("#")) {
        hash = urlString;
      } else {
        const u = new URL(urlString, "http://localhost");
        search = u.search;
        hash = u.hash;
      }
    } else if (typeof globalThis.location !== "undefined") {
      search = globalThis.location.search;
      hash = globalThis.location.hash;
    } else {
      return undefined;
    }

    const params = new URLSearchParams(search);
    const songParam = params.get("song") ||
      (hash.startsWith("#song=") ? decodeURIComponent(hash.slice(6)) : null);
    if (!songParam) return undefined;

    const normalized = songParam.trim().toLowerCase();
    return availableSongs.find(
      (s) =>
        s.id === songParam ||
        s.id.toLowerCase() === normalized ||
        s.title.toLowerCase() === normalized,
    );
  } catch (_err) {
    return undefined;
  }
}

/**
 * Parses and returns the canonical ViewMode from URL query parameter (?view=...)
 */
export function getViewModeFromUrl(urlString?: string): ViewMode | undefined {
  try {
    let search = "";
    if (urlString) {
      if (urlString.startsWith("?")) {
        search = urlString;
      } else {
        const u = new URL(urlString, "http://localhost");
        search = u.search;
      }
    } else if (typeof globalThis.location !== "undefined") {
      search = globalThis.location.search;
    } else {
      return undefined;
    }

    const params = new URLSearchParams(search);
    const viewParam = params.get("view");
    if (
      viewParam === "stradella" ||
      viewParam === "cba" ||
      viewParam === "guitar" ||
      viewParam === "dual"
    ) {
      return viewParam;
    }
    return undefined;
  } catch (_err) {
    return undefined;
  }
}

/**
 * Retrieves the last persisted ViewMode from LocalStorage
 */
export function getLastPersistedViewMode(): ViewMode | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  try {
    const val = globalThis.localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    if (val === "stradella" || val === "cba" || val === "guitar" || val === "dual") {
      return val as ViewMode;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Persists the chosen ViewMode to LocalStorage
 */
export function persistLastViewMode(viewMode: ViewMode): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_VIEW_STORAGE_KEY, viewMode);
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

/**
 * Resolves the initial ViewMode based on priority:
 * 1. URL query parameter (?view=...)
 * 2. LocalStorage persistence
 * 3. Song default viewMode
 * 4. Fallback: "stradella"
 */
export function getInitialViewMode(
  initialSong?: LeadSheetSong,
  urlString?: string,
): ViewMode {
  // 1. Highest Priority: Explicit URL query param (?view=...)
  const fromUrl = getViewModeFromUrl(urlString);
  if (fromUrl) {
    persistLastViewMode(fromUrl);
    return fromUrl;
  }

  // 2. Second Priority: Last persisted view mode in localStorage
  const fromStorage = getLastPersistedViewMode();
  if (fromStorage) {
    return fromStorage;
  }

  // 3. Third Priority: Song default view mode
  if (initialSong?.viewMode) {
    return initialSong.viewMode;
  }

  // 4. Default: Stradella LH
  return "stradella";
}

/**
 * Updates URL search parameters for current song and view mode without triggering page reload
 */
export function updateAppUrl(song?: LeadSheetSong, viewMode?: ViewMode): void {
  if (typeof globalThis.location === "undefined" || typeof globalThis.history === "undefined") {
    return;
  }
  try {
    const url = new URL(globalThis.location.href);
    if (song?.id) {
      url.searchParams.set("song", song.id);
    } else {
      url.searchParams.delete("song");
    }
    if (viewMode) {
      url.searchParams.set("view", viewMode);
    } else {
      url.searchParams.delete("view");
    }
    globalThis.history.replaceState(null, "", url.toString());
  } catch (err) {
    console.warn("Failed to update URL search params:", err);
  }
}

/**
 * Retrieves the last persisted song ID from LocalStorage
 */
export function getLastPersistedSongId(): string | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  try {
    return globalThis.localStorage.getItem(LAST_SONG_STORAGE_KEY);
  } catch (_err) {
    return null;
  }
}

/**
 * Persists the last viewed song ID to LocalStorage
 */
export function persistLastSongId(songId: string): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_SONG_STORAGE_KEY, songId);
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

/**
 * Resolves the initial song based on priority:
 * 1. URL query parameter (?song=... or #song=...)
 * 2. LocalStorage persistence
 * 3. Fallback: First song in available list
 */
export function getInitialSong(
  availableSongs: LeadSheetSong[],
  urlString?: string,
): LeadSheetSong {
  // 1. Highest Priority: Explicit URL query param (?song=... or #song=...)
  const fromUrl = getSongFromUrl(availableSongs, urlString);
  if (fromUrl) {
    persistLastSongId(fromUrl.id);
    return fromUrl;
  }

  // 2. Second Priority: Last active song in PWA / LocalStorage
  const lastId = getLastPersistedSongId();
  if (lastId) {
    const fromStorage = availableSongs.find(
      (s) =>
        s.id === lastId ||
        s.id.toLowerCase() === lastId.toLowerCase() ||
        s.title.toLowerCase() === lastId.toLowerCase(),
    );
    if (fromStorage) {
      return fromStorage;
    }
  }

  // 3. Fallback: First song in available list
  return availableSongs[0];
}

export const LAST_CBA_GRIP_MODE_STORAGE_KEY = "cbaGripMode";

/**
 * Retrieves the last persisted CBA Grip Mode ("root_3row" | "root_5row" | "voice_led") from LocalStorage.
 * Defaults to "root_5row" for optimal 5-row ergonomics.
 */
export function getLastPersistedCbaGripMode(): "root_3row" | "root_5row" | "voice_led" {
  if (typeof globalThis.localStorage === "undefined") return "root_5row";
  try {
    const val = globalThis.localStorage.getItem(LAST_CBA_GRIP_MODE_STORAGE_KEY);
    if (val === "root_3row" || val === "root_5row" || val === "voice_led") {
      return val;
    }
    if (val === "root") {
      return "root_5row";
    }
    return "root_5row";
  } catch (_err) {
    return "root_5row";
  }
}

/**
 * Persists the CBA Grip Mode ("root_3row" | "root_5row" | "voice_led") to LocalStorage and notifies listeners.
 */
export function persistCbaGripMode(
  mode: "root_3row" | "root_5row" | "voice_led" | "root",
): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    const normalized = mode === "root" ? "root_5row" : mode;
    globalThis.localStorage.setItem(LAST_CBA_GRIP_MODE_STORAGE_KEY, normalized);
    globalThis.dispatchEvent(new Event("cbaGripModeChanged"));
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

export const LAST_CBA_DISPLAY_MODE_STORAGE_KEY = "cbaDisplayMode";

/**
 * Retrieves the last persisted CBA Display Mode ("badges" | "line_cards" | "micro_badges") from LocalStorage.
 * Defaults to "line_cards" for optimal whole-song chord glanceability.
 */
export function getLastPersistedCbaDisplayMode(): "badges" | "line_cards" | "micro_badges" {
  if (typeof globalThis.localStorage === "undefined") return "line_cards";
  try {
    const val = globalThis.localStorage.getItem(LAST_CBA_DISPLAY_MODE_STORAGE_KEY);
    if (val === "badges" || val === "line_cards" || val === "micro_badges") {
      return val;
    }
    return "line_cards";
  } catch (_err) {
    return "line_cards";
  }
}

/**
 * Persists the CBA Display Mode to LocalStorage and notifies listeners.
 */
export function persistCbaDisplayMode(
  mode: "badges" | "line_cards" | "micro_badges",
): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_CBA_DISPLAY_MODE_STORAGE_KEY, mode);
    globalThis.dispatchEvent(new Event("cbaDisplayModeChanged"));
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

export const LAST_STRADELLA_DISPLAY_MODE_STORAGE_KEY = "stradellaDisplayMode";

/**
 * Retrieves the last persisted Stradella Display Mode ("badges" | "line_cards" | "micro_badges") from LocalStorage.
 * Defaults to "badges" (clean) or "line_cards".
 */
export function getLastPersistedStradellaDisplayMode(): "badges" | "line_cards" | "micro_badges" {
  if (typeof globalThis.localStorage === "undefined") return "badges";
  try {
    const val = globalThis.localStorage.getItem(LAST_STRADELLA_DISPLAY_MODE_STORAGE_KEY);
    if (val === "badges" || val === "line_cards" || val === "micro_badges") {
      return val;
    }
    return "badges";
  } catch (_err) {
    return "badges";
  }
}

/**
 * Persists the Stradella Display Mode to LocalStorage and notifies listeners.
 */
export function persistStradellaDisplayMode(
  mode: "badges" | "line_cards" | "micro_badges",
): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_STRADELLA_DISPLAY_MODE_STORAGE_KEY, mode);
    globalThis.dispatchEvent(new Event("stradellaDisplayModeChanged"));
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

export const LAST_GROOVE_STORAGE_KEY = "accordion_groove";

/**
 * Retrieves the last persisted Stradella Groove mode from LocalStorage.
 * Defaults to "boom_chick".
 */
export function getLastPersistedGroove():
  | "boom_chick"
  | "offbeat_chop"
  | "waltz"
  | "six_eight"
  | "none" {
  if (typeof globalThis.localStorage === "undefined") return "boom_chick";
  try {
    const val = globalThis.localStorage.getItem(LAST_GROOVE_STORAGE_KEY);
    if (
      val === "boom_chick" ||
      val === "offbeat_chop" ||
      val === "waltz" ||
      val === "six_eight" ||
      val === "none"
    ) {
      return val;
    }
    return "boom_chick";
  } catch (_err) {
    return "boom_chick";
  }
}

/**
 * Persists the Stradella Groove mode to LocalStorage and notifies listeners.
 */
export function persistGroove(
  groove: "boom_chick" | "offbeat_chop" | "waltz" | "six_eight" | "none",
): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_GROOVE_STORAGE_KEY, groove);
    globalThis.dispatchEvent(new Event("grooveChanged"));
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

export const LAST_JAM_FILLS_STORAGE_KEY = "accordion_jam_fills";

/**
 * Retrieves the last persisted Jam Fills preference (true/false) from LocalStorage.
 * Defaults to false (off).
 */
export function getLastPersistedJamFills(): boolean {
  if (typeof globalThis.localStorage === "undefined") return false;
  try {
    return globalThis.localStorage.getItem(LAST_JAM_FILLS_STORAGE_KEY) === "true";
  } catch (_err) {
    return false;
  }
}

/**
 * Persists the Jam Fills preference (true/false) to LocalStorage and notifies listeners.
 */
export function persistJamFills(enabled: boolean): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_JAM_FILLS_STORAGE_KEY, enabled ? "true" : "false");
    globalThis.dispatchEvent(new Event("jamFillsChanged"));
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}
