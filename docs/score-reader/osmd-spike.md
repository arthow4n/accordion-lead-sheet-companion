# OSMD rendering spike

The score reader uses a bounded MusicXML excerpt as the OSMD input. For the active measure it
selects one or two written measures, copies the most recent preceding `<attributes>` block into the
excerpt when needed, and renders the result with OSMD's public `load()`/`render()` API and SVG
backend. The parser remains the authority for measure order, timing, and guidance; OSMD is only a
visual notation layer.

## Strategies considered

- **Bounded excerpt (selected):** bounded work and memory, stable public OSMD calls, and no need to
  inspect private cursor or SVG measure internals. The implementation is covered by an excerpt
  semantic test, including carried key/clef/divisions attributes.
- **Full-score render plus crop:** rejected for the first release because reliable measure/system
  boxes would require coupling overlays to renderer-specific SVG geometry and would render the
  entire document on every score import.
- **Incremental OSMD rendering:** rejected for the first release because the incremental cursor and
  layout hooks are not a documented stable contract. A future benchmark may revisit it behind a
  capability flag.

Current/next highlighting is therefore implemented by the score-domain route and measure cards, not
by OSMD cursor state or private SVG node identifiers. Mobile performance and visual fidelity remain
part of the browser audit; a failed audit must not silently fall back to a full-score render.
