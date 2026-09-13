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

function elementChildren(element: Element): Element[] {
  if (element.children) return Array.from(element.children);
  return Array.from(element.childNodes || []).filter((node) => node.nodeType === 1) as Element[];
}

/**
 * Build a bounded, public-API MusicXML excerpt for a current/next measure preview. The parser
 * remains the source of truth; this helper never reaches into OSMD's private cursor or SVG nodes.
 */
export function createMusicXmlExcerpt(
  xml: string,
  startMeasure = 0,
  count = 2,
): string | undefined {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return undefined;
  const boundedStart = Math.max(0, Math.trunc(startMeasure));
  const boundedCount = Math.max(1, Math.min(4, Math.trunc(count)));
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) return undefined;
  const root = document.documentElement;
  const part = Array.from(root?.getElementsByTagName("part") || [])[0];
  if (!root || !part) return undefined;
  const measures = Array.from(part.getElementsByTagName("measure"));
  const selected = measures.slice(boundedStart, boundedStart + boundedCount);
  if (selected.length === 0) return undefined;
  const excerptRoot = root.cloneNode(false) as Element;
  const excerptPart = part.cloneNode(false) as Element;
  for (const rootChild of elementChildren(root)) {
    if (rootChild.localName === "part-list") excerptRoot.appendChild(rootChild.cloneNode(true));
    else if (rootChild.localName === "part") excerptRoot.appendChild(excerptPart);
    else if (rootChild.localName === "work" || rootChild.localName === "movement-title") {
      excerptRoot.appendChild(rootChild.cloneNode(true));
    }
  }
  const inheritedAttributes = new Map<string, Element>();
  for (const measure of measures.slice(0, boundedStart)) {
    const attributes = elementChildren(measure).find((child) => child.localName === "attributes");
    if (!attributes) continue;
    for (const attribute of elementChildren(attributes)) {
      inheritedAttributes.set(attribute.localName, attribute);
    }
  }
  for (const child of Array.from(excerptPart.childNodes)) excerptPart.removeChild(child);
  selected.forEach((measure, index) => {
    const clone = measure.cloneNode(true) as Element;
    if (index === 0 && inheritedAttributes.size > 0) {
      let attributes = elementChildren(clone).find((child) => child.localName === "attributes");
      if (!attributes) {
        attributes = clone.ownerDocument.createElementNS(
          root.namespaceURI,
          "attributes",
        );
        clone.insertBefore(attributes, clone.firstChild);
      }
      const present = new Set(elementChildren(attributes).map((child) => child.localName));
      for (const [name, inherited] of inheritedAttributes) {
        if (!present.has(name)) attributes.appendChild(inherited.cloneNode(true));
      }
    }
    excerptPart.appendChild(clone);
  });
  return new XMLSerializer().serializeToString(excerptRoot);
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
