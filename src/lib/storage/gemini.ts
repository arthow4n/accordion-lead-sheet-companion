/** Device-local Gemini settings. Credentials never enter songbook records or exports. */
export const GEMINI_KEY_STORAGE_KEY = "accordion-lead-sheet-companion:v1:gemini-api-key";
export const GEMINI_SETTINGS_STORAGE_KEY = "accordion-lead-sheet-companion:v1:gemini-settings";
export const GEMINI_SETTINGS_EVENT = "geminiSettingsChanged";
export const GEMINI_THINKING_LEVELS = ["auto", "minimal", "low", "medium", "high"] as const;
export type GeminiThinking = typeof GEMINI_THINKING_LEVELS[number];
export interface GeminiSettings {
  model: string;
  thinking: GeminiThinking;
}
export type GeminiStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function getGeminiKey(storage?: GeminiStorage): string {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(GEMINI_KEY_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}
export function getGeminiSettings(storage?: GeminiStorage): GeminiSettings {
  const fallback: GeminiSettings = { model: "", thinking: "auto" };
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(GEMINI_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return {
      model: typeof value?.model === "string" ? value.model : "",
      thinking: GEMINI_THINKING_LEVELS.includes(value?.thinking) ? value.thinking : "auto",
    };
  } catch {
    return fallback;
  }
}
function changed(keyChanged: boolean): void {
  globalThis.dispatchEvent?.(new CustomEvent(GEMINI_SETTINGS_EVENT, { detail: { keyChanged } }));
}
export function saveGeminiKey(key: string, storage?: GeminiStorage): void {
  if (!key.trim()) throw new Error("Enter your Gemini API key.");
  try {
    (storage ?? globalThis.localStorage).setItem(GEMINI_KEY_STORAGE_KEY, key.trim());
  } catch {
    throw new Error("Could not save the key on this device. Check browser storage permissions.");
  }
  changed(true);
}
export function removeGeminiKey(storage?: GeminiStorage): void {
  try {
    (storage ?? globalThis.localStorage).removeItem(GEMINI_KEY_STORAGE_KEY);
  } catch {
    throw new Error("Could not remove the key from this device.");
  }
  changed(true);
}
export function saveGeminiSettings(settings: GeminiSettings, storage?: GeminiStorage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(
      GEMINI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ model: settings.model, thinking: settings.thinking }),
    );
  } catch {
    throw new Error("Could not save Gemini settings on this device.");
  }
  changed(false);
}
