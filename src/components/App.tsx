import React, { useState } from "react";
import { FolderOpen, Music, Plus, Settings } from "lucide-react";
import type { ViewMode } from "../types/index.ts";

export default function App(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>("stradella");
  const [capo, setCapo] = useState<number>(0);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-600 selection:text-white">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="Accordion">🪗</span>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              Accordion Companion
            </h1>
            <p className="text-xs text-zinc-400">Lead Sheet &amp; Grip Transposer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all text-zinc-300 hover:text-white"
            aria-label="Open Songbook"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-medium shadow-sm"
            aria-label="Import Tab"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto p-4 pb-24">
        {/* Sticky Capo & View Mode Bar */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Capo:
              </span>
              <div className="flex items-center bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                <button
                  type="button"
                  onClick={() => setCapo((c) => Math.max(0, c - 1))}
                  className="px-2 py-0.5 text-sm font-bold text-zinc-300 hover:text-white active:bg-zinc-700 rounded"
                  aria-label="Decrease Capo"
                >
                  -
                </button>
                <span className="px-2 text-sm font-mono font-bold text-blue-400 min-w-[2rem] text-center">
                  {capo}
                </span>
                <button
                  type="button"
                  onClick={() => setCapo((c) => Math.min(11, c + 1))}
                  className="px-2 py-0.5 text-sm font-bold text-zinc-300 hover:text-white active:bg-zinc-700 rounded"
                  aria-label="Increase Capo"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700 gap-1">
              <button
                type="button"
                onClick={() => setViewMode("stradella")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "stradella"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                🪗 LH
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cba")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "cba"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                🔘 RH
              </button>
              <button
                type="button"
                onClick={() => setViewMode("dual")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "dual"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                🎸 Dual
              </button>
            </div>
          </div>
        </section>

        {/* Lead Sheet Reader Placeholder */}
        <section className="flex-1 bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-4 pb-2 border-b border-zinc-800">
            <Music className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Sample Lead Sheet Ready</span>
          </div>

          <div className="space-y-4 font-mono text-sm leading-relaxed">
            <div className="text-zinc-500 font-semibold">[Verse 1]</div>
            <div className="space-y-2">
              <div className="inline-flex flex-wrap gap-x-4 gap-y-2">
                <div className="chord-lyric-segment">
                  <span className="chord-badge text-blue-400 text-base">G g</span>
                  <span className="text-zinc-100">Almost</span>
                </div>
                <div className="chord-lyric-segment">
                  <span className="chord-badge text-blue-400 text-base">D d</span>
                  <span className="text-zinc-100">heaven,</span>
                </div>
                <div className="chord-lyric-segment">
                  <span className="chord-badge text-blue-400 text-base">Em em</span>
                  <span className="text-zinc-100">West Virginia</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Controls Placeholder */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-2 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-lg text-xs font-semibold text-zinc-200"
          >
            ▶ Auto-Scroll
          </button>
        </div>
        <button
          type="button"
          className="p-1.5 text-zinc-400 hover:text-zinc-200"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
