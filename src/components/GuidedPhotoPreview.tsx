import React, { useEffect, useState } from "react";
import type { ScorePhotoLayout } from "../types/score.ts";
import {
  adjustPhotoMeasureBox,
  createInitialPhotoLayout,
  decodePhotoForGuidance,
} from "../lib/score/photoGuidance.ts";

export interface GuidedPhotoPreviewProps {
  file: File;
  layout?: ScorePhotoLayout;
  onLayoutChange?: (layout: ScorePhotoLayout) => void;
}

/** Local-only photo preview and manual page/measure boundary adjustment. */
export const GuidedPhotoPreview: React.FC<GuidedPhotoPreviewProps> = ({
  file,
  layout,
  onLayoutChange,
}) => {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [activeLayout, setActiveLayout] = useState<ScorePhotoLayout | undefined>(layout);
  const [status, setStatus] = useState<"decoding" | "ready" | "error">("decoding");
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setStatus("decoding");
    decodePhotoForGuidance(file).then(async (decoded) => {
      if (cancelled) {
        decoded.close();
        return;
      }
      let nextLayout = layout;
      if (!nextLayout) {
        try {
          const { preprocessScorePhoto } = await import("../lib/score/photoPreprocessing.ts");
          const result = await preprocessScorePhoto(decoded.bitmap);
          if (!cancelled && !result.usedFallback && result.layout.measures.length > 0) {
            nextLayout = result.layout;
          }
        } catch {
          // Fallback to single-measure layout on preprocessing failure
        }
      }
      if (!nextLayout) {
        nextLayout = createInitialPhotoLayout(decoded.width, decoded.height);
      }
      if (cancelled) {
        decoded.close();
        return;
      }
      setActiveLayout(nextLayout);
      onLayoutChange?.(nextLayout);
      decoded.close();
      setStatus("ready");
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const measure = activeLayout?.measures[selectedMeasureIndex] || activeLayout?.measures[0];
  const updateBox = (field: "x" | "y" | "width" | "height", value: number) => {
    if (!activeLayout || !measure || !Number.isFinite(value)) return;
    const next = adjustPhotoMeasureBox(activeLayout, measure.id, {
      ...measure.box,
      [field]: value,
    });
    setActiveLayout(next);
    onLayoutChange?.(next);
  };

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5">
      <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black">
        {objectUrl && (
          <img
            src={objectUrl}
            alt="Selected score page"
            className="block max-h-72 w-full object-contain"
          />
        )}
        {activeLayout && activeLayout.measures.map((m, idx) => {
          const isSelected = idx === selectedMeasureIndex;
          return (
            <div
              key={m.id}
              className={`pointer-events-none absolute border-2 ${
                isSelected ? "border-amber-300/90 z-10" : "border-sky-400/40 border-dashed"
              }`}
              style={{
                left: `${(m.box.x / activeLayout.page.width) * 100}%`,
                top: `${(m.box.y / activeLayout.page.height) * 100}%`,
                width: `${(m.box.width / activeLayout.page.width) * 100}%`,
                height: `${(m.box.height / activeLayout.page.height) * 100}%`,
              }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          {status === "decoding"
            ? "Preparing local photo…"
            : status === "error"
            ? "Local decode unavailable"
            : activeLayout && activeLayout.measures.length > 1
            ? `Guided photo · ${activeLayout.measures.length} measures detected`
            : "Guided photo · one page strip"}
        </span>
        {activeLayout && <span>{activeLayout.page.width} × {activeLayout.page.height}px</span>}
      </div>
      {measure && activeLayout && (
        <details>
          <summary className="cursor-pointer text-[11px] font-semibold text-zinc-300 min-h-[44px] flex items-center">
            Adjust measure boundary {activeLayout.measures.length > 1 &&
              `(${selectedMeasureIndex + 1}/${activeLayout.measures.length})`}
          </summary>
          {activeLayout.measures.length > 1 && (
            <div className="mt-2">
              <label className="text-[10px] text-zinc-500 block mb-1">
                Select measure to adjust:
                <select
                  value={selectedMeasureIndex}
                  onChange={(e) => setSelectedMeasureIndex(Number(e.target.value))}
                  className="mt-0.5 min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
                >
                  {activeLayout.measures.map((m, idx) => (
                    <option key={m.id} value={idx}>
                      Measure {idx + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label key={field} className="text-[10px] text-zinc-500">
                {field}
                <input
                  type="number"
                  min={0}
                  value={Math.round(measure.box[field])}
                  onChange={(event) =>
                    updateBox(field, Number(event.target.value))}
                  className="mt-0.5 min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
                />
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
