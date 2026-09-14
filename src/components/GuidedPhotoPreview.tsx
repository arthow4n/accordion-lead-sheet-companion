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

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setStatus("decoding");
    decodePhotoForGuidance(file).then((decoded) => {
      if (cancelled) {
        decoded.close();
        return;
      }
      const nextLayout = layout || createInitialPhotoLayout(decoded.width, decoded.height);
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

  const measure = activeLayout?.measures[0];
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
        {measure && activeLayout && (
          <div
            className="pointer-events-none absolute border-2 border-amber-300/90"
            style={{
              left: `${measure.box.x / activeLayout.page.width * 100}%`,
              top: `${measure.box.y / activeLayout.page.height * 100}%`,
              width: `${measure.box.width / activeLayout.page.width * 100}%`,
              height: `${measure.box.height / activeLayout.page.height * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          {status === "decoding"
            ? "Preparing local photo…"
            : status === "error"
            ? "Local decode unavailable"
            : "Guided photo · one page strip"}
        </span>
        {activeLayout && <span>{activeLayout.page.width} × {activeLayout.page.height}px</span>}
      </div>
      {measure && activeLayout && (
        <details>
          <summary className="cursor-pointer text-[11px] font-semibold text-zinc-300">
            Adjust page boundary
          </summary>
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
                  className="mt-0.5 min-h-[36px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
                />
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
