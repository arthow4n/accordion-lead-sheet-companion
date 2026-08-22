import React, { useEffect, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import {
  applyAppUpdate,
  getIsUpdateAvailable,
  initUpdateChecker,
} from "../lib/pwa/updateChecker.ts";

export interface UpdateToastProps {
  forceShow?: boolean;
  onUpdate?: () => void;
}

export const UpdateToast: React.FC<UpdateToastProps> = ({ forceShow = false, onUpdate }) => {
  const [show, setShow] = useState<boolean>(forceShow || getIsUpdateAvailable());
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (forceShow) {
      setShow(true);
      return;
    }

    const cleanup = initUpdateChecker(() => {
      setShow(true);
    });

    const handleEvent = () => setShow(true);
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("pwaUpdateAvailable", handleEvent);
    }

    return () => {
      cleanup();
      if (typeof globalThis.removeEventListener === "function") {
        globalThis.removeEventListener("pwaUpdateAvailable", handleEvent);
      }
    };
  }, [forceShow]);

  if (!show) return null;

  const handleApplyUpdate = () => {
    setIsUpdating(true);
    if (onUpdate) {
      onUpdate();
    } else {
      applyAppUpdate();
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShow(false);
  };

  return (
    <aside
      aria-label="PWA Update Notification"
      className="fixed bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm bg-blue-950/95 border border-blue-500/80 rounded-2xl p-2.5 sm:p-3 shadow-2xl shadow-blue-950/70 backdrop-blur-md flex items-center justify-between gap-2.5 text-white select-none transition-all"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-blue-600/40 border border-blue-400/60 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-blue-300 animate-pulse" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight leading-tight">
            New Update Ready!
          </span>
          <span className="text-[10px] sm:text-xs text-blue-200/90 leading-tight">
            Tap to load latest version
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleApplyUpdate}
          disabled={isUpdating}
          className="min-h-[34px] px-3 py-1 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-zinc-950 font-black text-xs font-mono rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          aria-label="Reload and Apply Update"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
          <span>{isUpdating ? "Updating..." : "Update 🚀"}</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg bg-blue-900/50 hover:bg-blue-800 text-blue-300 hover:text-white transition-all active:scale-95 cursor-pointer"
          aria-label="Dismiss Update Toast"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
