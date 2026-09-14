import { useState } from "react";
import { AlertCircle, CheckCircle2, Download, HardDrive, Loader2, Trash2, X } from "lucide-react";
import {
  deleteCachedOmrArtifacts,
  OMR_FIRST_USE_DISCLOSURE,
  type OmrDownloadProgress,
} from "../lib/score/omrManifest.ts";
import { downloadOmrModels } from "../lib/score/omrClient.ts";

interface OmrDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OmrDownloadModal({ isOpen, onClose, onSuccess }: OmrDownloadModalProps) {
  const [status, setStatus] = useState<"disclosure" | "downloading" | "complete" | "error">(
    "disclosure",
  );
  const [progress, setProgress] = useState<OmrDownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setStatus("downloading");
    setErrorMsg(null);

    try {
      await downloadOmrModels({
        signal: controller.signal,
        onProgress: (p: OmrDownloadProgress) => setProgress(p),
      });
      setStatus("complete");
      setTimeout(() => {
        onSuccess();
      }, 750);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("disclosure");
      } else {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      setAbortController(null);
    }
  };

  const handleCancelDownload = () => {
    if (abortController) {
      abortController.abort();
    }
    setStatus("disclosure");
    setProgress(null);
  };

  const handleDeleteCache = async () => {
    await deleteCachedOmrArtifacts();
    setStatus("disclosure");
    setProgress(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl text-zinc-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">
              {OMR_FIRST_USE_DISCLOSURE.title}
            </h3>
            <p className="text-xs text-zinc-400">
              On-device AI model ({OMR_FIRST_USE_DISCLOSURE.formattedSize})
            </p>
          </div>
        </div>

        {status === "disclosure" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              {OMR_FIRST_USE_DISCLOSURE.message}
            </p>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-1.5 text-xs text-zinc-400">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span>Download size:</span>
                <span className="text-zinc-200 font-semibold">
                  {OMR_FIRST_USE_DISCLOSURE.formattedSize}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span>Storage location:</span>
                <span className="text-zinc-200 font-semibold">Browser Cache Storage</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span>Network privacy:</span>
                <span className="text-emerald-400 font-semibold">100% On-Device</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download & Start
              </button>
            </div>
          </div>
        )}

        {status === "downloading" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                Downloading model files...
              </span>
              <span className="font-mono font-bold text-blue-400">
                {progress ? `${Math.round(progress.percent)}%` : "0%"}
              </span>
            </div>

            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                style={{ width: `${progress?.percent || 0}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] font-mono text-zinc-500">
              <span>
                {progress
                  ? `${(progress.loadedBytes / (1024 * 1024)).toFixed(1)} / ${
                    (progress.totalBytes / (1024 * 1024)).toFixed(1)
                  } MB`
                  : "Connecting..."}
              </span>
              <span>{progress?.currentArtifact || ""}</span>
            </div>

            <button
              type="button"
              onClick={handleCancelDownload}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel Download
            </button>
          </div>
        )}

        {status === "complete" && (
          <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-100">Models Ready Offline!</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Starting local score recognition...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg || "Failed to download model artifacts."}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteCache}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-zinc-800 hover:bg-red-950/40 hover:text-red-300 text-zinc-400 text-xs rounded-xl transition-colors cursor-pointer"
                title="Clear partially downloaded files"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={handleStartDownload}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Retry Download
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
