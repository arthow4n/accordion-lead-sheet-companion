import { useEffect, useRef, useState } from "react";
import {
  geminiChordText,
  geminiErrorMessage,
  type GeminiModel,
  listGeminiModels,
  recognizeGeminiChords,
} from "../lib/gemini/client.ts";
import { prepareGeminiImage } from "../lib/gemini/image.ts";
import {
  GEMINI_KEY_STORAGE_KEY,
  GEMINI_SETTINGS_EVENT,
  GEMINI_SETTINGS_STORAGE_KEY,
  GEMINI_THINKING_LEVELS,
  type GeminiSettings,
  type GeminiThinking,
  getGeminiKey,
  getGeminiSettings,
  removeGeminiKey,
  saveGeminiKey,
  saveGeminiSettings,
} from "../lib/storage/gemini.ts";

interface GeminiPhotoImportProps {
  file: File | null;
  onOpenSheet: (text: string, title: string) => void;
}
const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100";
const buttonClass =
  "min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-40";

export function GeminiPhotoImport({ file, onOpenSheet }: GeminiPhotoImportProps) {
  const [settings, setSettings] = useState(getGeminiSettings);
  const [maskedKey, setMaskedKey] = useState(() => {
    const key = getGeminiKey();
    return key ? `••••••••${key.slice(-4)}` : "";
  });
  const [keyInput, setKeyInput] = useState("");
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [busy, setBusy] = useState<"models" | "scan" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [chordText, setChordText] = useState("");
  const [result, setResult] = useState<{ title: string; warnings: string[] } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const cancel = () => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(null);
  };
  useEffect(() => {
    const refresh = (event: Event) => {
      const storageKey = event.type === "storage" ? (event as StorageEvent).key : undefined;
      if (
        storageKey !== undefined && storageKey !== null &&
        storageKey !== GEMINI_KEY_STORAGE_KEY && storageKey !== GEMINI_SETTINGS_STORAGE_KEY
      ) return;
      const keyChanged = event.type === "storage"
        ? storageKey === null || storageKey === GEMINI_KEY_STORAGE_KEY
        : (event as CustomEvent<{ keyChanged: boolean }>).detail?.keyChanged;
      cancel();
      const key = getGeminiKey();
      setMaskedKey(key ? `••••••••${key.slice(-4)}` : "");
      setSettings(getGeminiSettings());
      if (keyChanged) setModels([]);
      setError("");
      setResult(null);
      setChordText("");
    };
    globalThis.addEventListener(GEMINI_SETTINGS_EVENT, refresh);
    globalThis.addEventListener("storage", refresh);
    return () => {
      generation.current++;
      controller.current?.abort();
      globalThis.removeEventListener(GEMINI_SETTINGS_EVENT, refresh);
      globalThis.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    cancel();
    setResult(null);
    setChordText("");
    setError("");
  }, [file]);

  const begin = (kind: "models" | "scan") => {
    cancel();
    const request = new AbortController();
    controller.current = request;
    const id = generation.current;
    setBusy(kind);
    setError("");
    setNotice("");
    return {
      signal: request.signal,
      current: () => id === generation.current && !request.signal.aborted,
    };
  };
  const refreshModels = async () => {
    const request = begin("models");
    try {
      const next = await listGeminiModels(getGeminiKey(), request.signal);
      if (!request.current()) return;
      setModels(next);
      if (!next.length) {
        setNotice("No content-generation Gemini models were returned for this key.");
      } else if (settings.model && !next.some((model) => model.id === settings.model)) {
        setNotice("The saved model is not in this key’s list. Choose an available model.");
      }
    } catch (failure) {
      if (request.current()) setError(geminiErrorMessage(failure));
    } finally {
      if (request.current()) setBusy(null);
    }
  };
  const saveKey = async () => {
    try {
      saveGeminiKey(keyInput);
      setKeyInput("");
      await refreshModels();
    } catch {
      setError("Could not save the API key. Enter a key and check browser storage permissions.");
    }
  };
  const changeSettings = (next: GeminiSettings) => {
    try {
      saveGeminiSettings(next);
    } catch {
      setError("Could not save Gemini settings on this device.");
    }
  };
  const scan = async () => {
    if (!file) return;
    const request = begin("scan");
    setResult(null);
    setChordText("");
    try {
      const image = await prepareGeminiImage(file, request.signal);
      const found = await recognizeGeminiChords({
        key: getGeminiKey(),
        model: settings.model,
        thinking: settings.thinking,
        image,
        signal: request.signal,
      });
      if (!request.current()) return;
      setResult({
        title: found.title || file.name.replace(/\.[^.]+$/, ""),
        warnings: found.warnings,
      });
      setChordText(geminiChordText(found));
    } catch (failure) {
      if (request.current()) setError(geminiErrorMessage(failure));
    } finally {
      if (request.current()) setBusy(null);
    }
  };
  const removeKey = () => {
    try {
      removeGeminiKey();
      setKeyInput("");
    } catch {
      setError("Could not remove the API key from this device.");
    }
  };
  const savedModelMissing = !!settings.model && models.length > 0 &&
    !models.some((m) => m.id === settings.model);

  return (
    <section
      className="min-w-0 space-y-3 rounded-xl border border-blue-800/60 bg-blue-950/20 p-3"
      aria-label="Gemini photo recognition"
    >
      <h3 className="text-sm font-bold text-zinc-100">Gemini photo recognition</h3>
      <p className="text-xs text-zinc-300">
        Use your own Gemini API key. The selected photo goes directly from this browser to Google
        only when you press Recognize with Gemini. No app backend is needed.
      </p>
      {maskedKey
        ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-300">Saved key: {maskedKey}</span>
              <button type="button" className={buttonClass} onClick={removeKey}>
                Remove Gemini key
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Stored only in this app’s device-local settings, outside songbook exports. Code
              running on this origin can read browser storage.
            </p>
          </div>
        )
        : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Gemini API key
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonClass}
                disabled={!keyInput.trim() || !!busy}
                onClick={saveKey}
              >
                Save key and load models
              </button>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center text-xs text-blue-300 underline"
              >
                Get a Gemini API key
              </a>
            </div>
          </div>
        )}
      {maskedKey && (
        <>
          <label className="block text-xs font-semibold text-zinc-300">
            Gemini model
            <select
              value={settings.model}
              disabled={!!busy}
              className={`mt-1 ${fieldClass}`}
              onChange={(event) => changeSettings({ ...settings, model: event.target.value })}
            >
              <option value="">Choose a model</option>
              {settings.model && !models.some((m) => m.id === settings.model) && (
                <option value={settings.model}>{settings.model} (saved)</option>
              )}
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.name} · {model.id}</option>
              ))}
            </select>
          </label>
          <button type="button" className={buttonClass} disabled={!!busy} onClick={refreshModels}>
            {busy === "models" ? "Loading models..." : "Refresh available models"}
          </button>
          <p className="text-xs text-zinc-400">
            Models are listed using your key. Image and structured-output support is checked when
            you scan.
          </p>
          <label className="block text-xs font-semibold text-zinc-300">
            Thinking effort
            <select
              value={settings.thinking}
              disabled={!!busy}
              className={`mt-1 ${fieldClass}`}
              onChange={(event) =>
                changeSettings({ ...settings, thinking: event.target.value as GeminiThinking })}
            >
              {GEMINI_THINKING_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === "auto"
                    ? "Model default (recommended)"
                    : level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <p className="text-xs text-zinc-400">
        Photo metadata is removed locally before sending. Gemini usage may be billed to your Google
        project.
      </p>
      <button
        type="button"
        disabled={!file || !maskedKey || !settings.model || savedModelMissing || !!busy}
        onClick={scan}
        className="min-h-[44px] w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
      >
        {busy === "scan" ? "Recognizing with Gemini..." : "Recognize with Gemini"}
      </button>
      {busy && (
        <button type="button" className={buttonClass} onClick={cancel}>
          Cancel Gemini request
        </button>
      )}
      {error && <p role="alert" className="break-words text-xs text-rose-300">{error}</p>}
      {notice && <p role="status" className="text-xs text-amber-200">{notice}</p>}
      {result && (
        <div className="space-y-2 border-t border-zinc-700 pt-3">
          <p className="text-xs text-zinc-300">
            Review the symbols against your photo, especially slash basses and accidentals.
          </p>
          <label className="block text-xs font-semibold text-zinc-300">
            Gemini chord sheet
            <textarea
              rows={6}
              className={`mt-1 ${fieldClass} font-mono`}
              value={chordText}
              onChange={(event) => setChordText(event.target.value)}
            />
          </label>
          {result.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-200">
              {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>
          )}
          <button
            type="button"
            className={buttonClass}
            disabled={!chordText.trim()}
            onClick={() => onOpenSheet(chordText, result.title)}
          >
            Open chord sheet
          </button>
        </div>
      )}
    </section>
  );
}
