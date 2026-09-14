import { del, get, set } from "idb-keyval";
import type { LeadSheetSong } from "../../types/index.ts";
import { PRESET_SONGS } from "./presets.ts";
import { validateScoreDocument } from "../score/validation.ts";
import type { ScoreDocument } from "../../types/score.ts";

const SONGBOOK_STORAGE_KEY = "accordion_songbook_records";
const SONGBOOK_QUARANTINE_KEY = "accordion_songbook_quarantine";
const SONGBOOK_SCHEMA_VERSION = 2;
const MAX_SONGBOOK_BYTES = 10 * 1024 * 1024;
const SOURCE_ASSET_KEY_PREFIX = "accordion_score_source_";
const DERIVED_CACHE_KEY_PREFIX = "accordion_score_derived_";

// In-memory fallback for non-IndexedDB environments (e.g. headless unit tests)
const memoryStore = new Map<string, unknown>();
// Ephemeral photo sources intentionally never enter IndexedDB. They remain available only for
// the current tab/session so a just-imported guided photo can be played before a reload.
const ephemeralScoreAssets = new Map<string, Blob>();

interface SongbookEnvelope {
  version: number;
  songs: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeScore(value: unknown): ScoreDocument | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.source)) return undefined;
  const candidate = value as unknown as ScoreDocument;
  try {
    const result = validateScoreDocument(candidate);
    return result.valid ? candidate : undefined;
  } catch {
    // Imported JSON is untrusted; malformed nested values must be quarantined, not crash reads.
    return undefined;
  }
}

/** Normalize legacy and current song records without mutating the input. */
export function normalizeSongRecord(value: unknown): LeadSheetSong | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string" || !value.id.trim() || typeof value.title !== "string") {
    return undefined;
  }
  if (typeof value.rawText !== "string" || !Array.isArray(value.lines)) return undefined;
  if (value.lines.length > 100_000) return undefined;
  const capoRaw = typeof value.capoFret === "number" && Number.isFinite(value.capoFret)
    ? value.capoFret
    : 0;
  const capoFret = ((Math.trunc(capoRaw) % 12) + 12) % 12;
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
    ? value.updatedAt
    : Date.now();
  const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
    ? value.createdAt
    : updatedAt;
  let score: ScoreDocument | undefined;
  if (value.score !== undefined) {
    score = normalizeScore(value.score);
    if (!score) return undefined;
  }
  return {
    ...(value as unknown as LeadSheetSong),
    id: value.id,
    title: value.title,
    capoFret,
    capo: capoFret,
    rawText: value.rawText,
    lines: value.lines as LeadSheetSong["lines"],
    score,
    createdAt,
    updatedAt,
  };
}

function unwrapSongs(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.songs)) return value.songs;
  return [];
}

async function quarantine(records: unknown[]): Promise<void> {
  if (records.length === 0) return;
  const existing = isIndexedDbAvailable()
    ? await get<unknown[]>(SONGBOOK_QUARANTINE_KEY) || []
    : (memoryStore.get(SONGBOOK_QUARANTINE_KEY) as unknown[] | undefined) || [];
  const bounded = [...existing, ...records].slice(-100);
  if (isIndexedDbAvailable()) await set(SONGBOOK_QUARANTINE_KEY, bounded);
  else memoryStore.set(SONGBOOK_QUARANTINE_KEY, bounded);
}

async function readStoredSongs(): Promise<LeadSheetSong[]> {
  let stored: unknown;
  if (isIndexedDbAvailable()) stored = await get<unknown>(SONGBOOK_STORAGE_KEY);
  else stored = memoryStore.get(SONGBOOK_STORAGE_KEY);
  const rawSongs = unwrapSongs(stored);
  const valid: LeadSheetSong[] = [];
  const invalid: unknown[] = [];
  for (const raw of rawSongs) {
    const normalized = normalizeSongRecord(raw);
    if (normalized) valid.push(normalized);
    else invalid.push(raw);
  }
  await quarantine(invalid);
  return valid;
}

async function writeSongs(songs: LeadSheetSong[]): Promise<void> {
  const envelope: SongbookEnvelope = { version: SONGBOOK_SCHEMA_VERSION, songs };
  if (isIndexedDbAvailable()) await set(SONGBOOK_STORAGE_KEY, envelope);
  else memoryStore.set(SONGBOOK_STORAGE_KEY, envelope);
}

function isIndexedDbAvailable(): boolean {
  return typeof globalThis !== "undefined" &&
    typeof (globalThis as unknown as { indexedDB?: unknown }).indexedDB !== "undefined";
}

/**
 * Fetch all saved lead sheets from IndexedDB or memory fallback
 */
export async function getSongs(): Promise<LeadSheetSong[]> {
  try {
    return await readStoredSongs();
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

  await writeSongs(newSongs);
}

/**
 * Delete a song by ID from IndexedDB
 */
export async function deleteSong(id: string): Promise<void> {
  const songs = await getSongs();
  const deleted = songs.find((song) => song.id === id);
  const filtered = songs.filter((s) => s.id !== id);

  await writeSongs(filtered);
  if (deleted?.score?.source.kind === "photo" && deleted.score.source.assetId) {
    await deleteScoreAsset(deleted.score.source.assetId);
  }
  await deleteScoreDerivedCaches(id);
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

  await writeSongs(merged);

  return merged;
}

/**
 * Export entire songbook as JSON string
 */
export async function exportSongbook(): Promise<string> {
  const songs = await getSongs();
  return JSON.stringify(
    {
      version: SONGBOOK_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sourcePolicy: "photo-assets-are-references-only",
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
  if (new TextEncoder().encode(jsonString).byteLength > MAX_SONGBOOK_BYTES) {
    throw new Error("Invalid songbook JSON: file exceeds the 10 MiB import limit.");
  }
  const parsed = JSON.parse(jsonString);
  const rawSongs = unwrapSongs(parsed);
  const incomingSongs: LeadSheetSong[] = [];
  const invalid: unknown[] = [];
  for (const raw of rawSongs) {
    const normalized = normalizeSongRecord(raw);
    if (normalized) incomingSongs.push(normalized);
    else invalid.push(raw);
  }

  if (!incomingSongs.length) {
    throw new Error("Invalid songbook JSON: No valid songs found.");
  }
  if (invalid.length) {
    await quarantine(invalid);
    throw new Error(`Invalid songbook JSON: ${invalid.length} malformed record(s) rejected.`);
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

  await writeSongs(finalSongs);

  return finalSongs;
}

/**
 * Clear storage (useful in tests)
 */
export async function clearSongbook(): Promise<void> {
  if (isIndexedDbAvailable()) {
    await del(SONGBOOK_STORAGE_KEY);
    await del(SONGBOOK_QUARANTINE_KEY);
  } else {
    memoryStore.delete(SONGBOOK_STORAGE_KEY);
    memoryStore.delete(SONGBOOK_QUARANTINE_KEY);
  }
}

/** Remove an opted-in photo source asset when its owning score is deleted. */
export async function deleteScoreAsset(assetId: string): Promise<void> {
  if (!assetId.trim()) return;
  ephemeralScoreAssets.delete(assetId);
  const key = `${SOURCE_ASSET_KEY_PREFIX}${assetId}`;
  if (isIndexedDbAvailable()) await del(key);
  else memoryStore.delete(key);
}

/** Keep a photo available for the current session without persisting its bytes. */
export function registerEphemeralScoreAsset(assetId: string, blob: Blob): void {
  if (!assetId.trim()) throw new Error("Photo asset ID is required.");
  if (typeof Blob === "undefined" || !(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Photo asset must be a non-empty Blob.");
  }
  ephemeralScoreAssets.set(assetId, blob);
}

/** Persist an opted-in original photo outside the songbook JSON envelope. */
export async function saveScoreAsset(assetId: string, blob: Blob): Promise<void> {
  if (!assetId.trim()) throw new Error("Photo asset ID is required.");
  if (
    typeof Blob === "undefined" || !(blob instanceof Blob) || blob.size === 0 ||
    blob.size > 10 * 1024 * 1024
  ) {
    throw new Error("Photo asset must be between 1 byte and 10 MiB.");
  }
  const key = `${SOURCE_ASSET_KEY_PREFIX}${assetId}`;
  if (isIndexedDbAvailable()) await set(key, blob);
  else memoryStore.set(key, blob);
}

/** Read an opted-in original photo; missing assets are an expected recoverable state. */
export async function getScoreAsset(assetId: string): Promise<Blob | undefined> {
  if (!assetId.trim()) return undefined;
  const ephemeral = ephemeralScoreAssets.get(assetId);
  if (ephemeral) return ephemeral;
  const key = `${SOURCE_ASSET_KEY_PREFIX}${assetId}`;
  if (isIndexedDbAvailable()) return await get<Blob>(key);
  return memoryStore.get(key) as Blob | undefined;
}

/** Remove score-derived caches while leaving shared model artifacts untouched. */
export async function deleteScoreDerivedCaches(songId: string): Promise<void> {
  if (!songId.trim()) return;
  const key = `${DERIVED_CACHE_KEY_PREFIX}${songId}`;
  if (isIndexedDbAvailable()) await del(key);
  else memoryStore.delete(key);
}
