import { del, get, set } from "idb-keyval";
import type { LeadSheetSong } from "../../types/index.ts";
import { PRESET_SONGS } from "./presets.ts";

const SONGBOOK_STORAGE_KEY = "accordion_songbook_records";

// In-memory fallback for non-IndexedDB environments (e.g. headless unit tests)
const memoryStore = new Map<string, LeadSheetSong[]>();

function isIndexedDbAvailable(): boolean {
  return typeof globalThis !== "undefined" &&
    typeof (globalThis as unknown as { indexedDB?: unknown }).indexedDB !== "undefined";
}

/**
 * Fetch all saved lead sheets from IndexedDB or memory fallback
 */
export async function getSongs(): Promise<LeadSheetSong[]> {
  try {
    if (isIndexedDbAvailable()) {
      const stored = await get<LeadSheetSong[]>(SONGBOOK_STORAGE_KEY);
      if (Array.isArray(stored)) {
        return stored;
      }
    } else {
      const stored = memoryStore.get(SONGBOOK_STORAGE_KEY);
      if (Array.isArray(stored)) {
        return stored;
      }
    }
  } catch (err) {
    console.warn("Error reading songs from IndexedDB:", err);
  }
  return [];
}

/**
 * Fetch a single lead sheet by ID
 */
export async function getSong(id: string): Promise<LeadSheetSong | undefined> {
  const songs = await getSongs();
  return songs.find((s) => s.id === id);
}

/**
 * Save or update a song in IndexedDB
 */
export async function saveSong(song: LeadSheetSong): Promise<void> {
  const songs = await getSongs();
  const index = songs.findIndex((s) => s.id === song.id);
  const updatedSong: LeadSheetSong = {
    ...song,
    updatedAt: Date.now(),
    createdAt: song.createdAt || Date.now(),
  };

  let newSongs: LeadSheetSong[];
  if (index >= 0) {
    newSongs = [...songs];
    newSongs[index] = updatedSong;
  } else {
    newSongs = [updatedSong, ...songs];
  }

  if (isIndexedDbAvailable()) {
    await set(SONGBOOK_STORAGE_KEY, newSongs);
  } else {
    memoryStore.set(SONGBOOK_STORAGE_KEY, newSongs);
  }
}

/**
 * Delete a song by ID from IndexedDB
 */
export async function deleteSong(id: string): Promise<void> {
  const songs = await getSongs();
  const filtered = songs.filter((s) => s.id !== id);

  if (isIndexedDbAvailable()) {
    await set(SONGBOOK_STORAGE_KEY, filtered);
  } else {
    memoryStore.set(SONGBOOK_STORAGE_KEY, filtered);
  }
}

/**
 * Initialize built-in presets into IndexedDB if empty or force=true
 */
export async function initPresets(force = false): Promise<LeadSheetSong[]> {
  const currentSongs = await getSongs();
  if (currentSongs.length > 0 && !force) {
    return currentSongs;
  }

  const merged = force
    ? [...PRESET_SONGS, ...currentSongs.filter((s) => !s.id.startsWith("preset_"))]
    : [...PRESET_SONGS];

  if (isIndexedDbAvailable()) {
    await set(SONGBOOK_STORAGE_KEY, merged);
  } else {
    memoryStore.set(SONGBOOK_STORAGE_KEY, merged);
  }

  return merged;
}

/**
 * Export entire songbook as JSON string
 */
export async function exportSongbook(): Promise<string> {
  const songs = await getSongs();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      songs,
    },
    null,
    2,
  );
}

/**
 * Import a JSON songbook string, merging with or replacing current songs
 */
export async function importSongbook(
  jsonString: string,
  mode: "merge" | "replace" = "merge",
): Promise<LeadSheetSong[]> {
  const parsed = JSON.parse(jsonString);
  const incomingSongs: LeadSheetSong[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.songs)
    ? parsed.songs
    : [];

  if (!incomingSongs.length) {
    throw new Error("Invalid songbook JSON: No valid songs found.");
  }

  let finalSongs: LeadSheetSong[];
  if (mode === "replace") {
    finalSongs = incomingSongs;
  } else {
    const existing = await getSongs();
    const existingMap = new Map(existing.map((s) => [s.id, s]));
    for (const song of incomingSongs) {
      existingMap.set(song.id, song);
    }
    finalSongs = Array.from(existingMap.values());
  }

  if (isIndexedDbAvailable()) {
    await set(SONGBOOK_STORAGE_KEY, finalSongs);
  } else {
    memoryStore.set(SONGBOOK_STORAGE_KEY, finalSongs);
  }

  return finalSongs;
}

/**
 * Clear storage (useful in tests)
 */
export async function clearSongbook(): Promise<void> {
  if (isIndexedDbAvailable()) {
    await del(SONGBOOK_STORAGE_KEY);
  } else {
    memoryStore.delete(SONGBOOK_STORAGE_KEY);
  }
}
