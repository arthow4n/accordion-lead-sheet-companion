export type ScoreRenderStrategy = "bounded-excerpt" | "full-render-crop" | "source-only";

export interface ScoreRenderOptions {
  /** Must remain SVG so measure overlays and accessibility can inspect one DOM tree. */
  backend: "svg";
  drawTitle?: boolean;
  drawSubtitle?: boolean;
  strategy: ScoreRenderStrategy;
}

export interface ScoreRenderer {
  load(xml: string): Promise<void>;
  render(): void;
  clear(): void;
  strategy: ScoreRenderStrategy;
}

/** Lazily load OSMD so classic lead-sheet startup and offline use remain lightweight. */
export async function createScoreRenderer(
  container: HTMLElement,
  options: ScoreRenderOptions = { backend: "svg", strategy: "full-render-crop" },
): Promise<ScoreRenderer> {
  const module = await import("opensheetmusicdisplay");
  const display = new module.OpenSheetMusicDisplay(container, {
    backend: options.backend,
    drawTitle: options.drawTitle ?? false,
    drawSubtitle: options.drawSubtitle ?? false,
    autoResize: false,
  });
  return {
    strategy: options.strategy,
    load: async (xml: string) => {
      await display.load(xml);
    },
    render: () => display.render(),
    clear: () => display.clear(),
  };
}
