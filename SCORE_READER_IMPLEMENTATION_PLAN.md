# Score Reader and Accordion Guidance — Sequential Implementation Plan

**Status:** Proposal; no feature implementation has started\
**Execution model:** One primary coding agent working sequentially\
**Review model:** One read-only review sub-agent only at the named checkpoints\
**Primary outcome:** A musician can photograph or import a printed melody-and-chord score, press
Play, and receive measure-aware CBA and Stradella guidance without first operating a notation
editor.

## 1. Product decision

This feature extends the existing Lead Sheet Companion. It does not create a parallel score-reading
application.

The recognition layer answers:

- What notes, chords, beats, measures, and navigation marks are printed?
- When does each event occur?
- Which part of the source image corresponds to each measure?

The existing accordion engines continue to answer:

- Which Stradella bass and chord buttons play the harmony?
- Which accompaniment groove fits the meter?
- How does the left hand move between chords?
- Which CBA chord grip is ergonomic?
- How should chord grips be voice-led?
- How should capo and enharmonic spelling be handled?

Only one new accordion-theory engine is required: a sequential CBA melody fingering/path solver.

### Intended musician workflow

```text
Take photo or import MusicXML
          ↓
Automatic local preparation and recognition
          ↓
Preview: key, meter, form, and unique chords
          ↓
Press Play
          ↓
Original measure + current accordion guidance + next destination
          ↓
Optionally correct questionable measures after playing
```

Correction is never a mandatory gate to the initial playing experience. When recognition is
uncertain, the original measure crop remains the visual ground truth and questionable generated
guidance is hidden or presented conservatively.

## 2. Scope

### In scope

- Printed, single-treble-staff, predominantly monophonic melody sheets with chord symbols.
- JPEG, PNG, WebP, MusicXML, and compressed MXL input.
- Fully browser-side processing after assets have been downloaded.
- Mobile-first current/next-measure presentation.
- Existing Stradella voicings, transitions, grooves, sizes, chord cards, and drawer.
- Existing CBA chord grips, 3/5-row preferences, voice leading, grids, and note spelling.
- New CBA melody fingering across a chronological note sequence.
- Written-order and performance-order repeat/ending navigation.
- Confidence-aware, optional correction.
- Offline reuse through IndexedDB and Cache Storage.
- Optional, explicit cloud assistance through the existing scan API.

### Not in the first release

- Handwritten notation.
- Dense piano, orchestral, or multi-staff scores.
- General-purpose notation editing or engraving.
- Guaranteed recognition of lyrics, articulations, dynamics, ornaments, or arbitrary localized
  directions.
- Microphone-based live score following.
- Training a general OMR model from scratch.
- Making WebGPU a requirement.
- Persisting source photographs by default.

## 3. Decisions and selected stack

| Concern                        | Decision                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application shell              | Keep React 19, Vite 6, Tailwind 4, and Deno 2.                                                                                                        |
| Dependency declarations        | Add npm dependencies only through `deno.json`; never add `package.json`.                                                                              |
| Canonical application data     | Add a compact TypeScript `ScoreDocument`; MusicXML remains an interchange format.                                                                     |
| Preferred input                | MusicXML/MXL when available; photographs are the fallback.                                                                                            |
| Score display                  | OpenSheetMusicDisplay (OSMD), SVG backend, restricted to current/next measures.                                                                       |
| Photo preprocessing            | Lazy-loaded OpenCV.js in a worker; begin with geometric staff/barline slicing.                                                                        |
| OMR runtime                    | `onnxruntime-web`; WASM baseline and WebGPU acceleration where supported.                                                                             |
| Initial OMR candidate          | JAZZMUS melody-plus-chord model, subject to evaluation, license confirmation, ONNX export, and quantization gates.                                    |
| Browser architecture reference | KomaVision's Apache-2.0 page-slicing and encoder/decoder pattern; reuse only with notices and a recorded provenance review.                           |
| Local text OCR                 | Tesseract.js, limited to chord/header/navigation regions and loaded lazily.                                                                           |
| Recognition policy             | OMR supplies candidates; deterministic validators and confidence decide what may be shown.                                                            |
| Cloud policy                   | Existing Gemini endpoint is an optional recovery path requiring explicit user action.                                                                 |
| Model distribution             | Do not commit weights. Publish versioned external artifacts with a checked-in manifest, SHA-256, byte size, vocabulary version, and license metadata. |
| Model caching                  | Cache on demand at runtime; exclude model weights from the Workbox precache.                                                                          |
| Source image privacy           | Hold the photo in memory during a scan. Persist only when the user explicitly requests it.                                                            |

### Candidate fallback order

1. JAZZMUS exported to quantized ONNX.
2. Another permissively licensed lead-sheet or monophonic Western OMR model that passes the same
   evaluation harness.
3. A browser port of selected model components from an existing OMR project only after license
   review.
4. Guided-photo mode without melody recognition.

Homr is a useful accuracy benchmark, but its Python pipeline and AGPL-3.0 license make it unsuitable
as the default code-integration path without a separate license decision. LEGATO is not a mobile
candidate because its full model requires a large vision backbone and substantial GPU memory.

## 4. Architecture boundaries

```text
Input
├── MusicXML/MXL ─────────────────────────────┐
└── Photo                                     │
    ├── page preparation                      │
    ├── staff/measure slicing                 │
    ├── OMR melody + chord candidates         │
    └── OCR text/navigation candidates        │
                                               ▼
                                      ScoreDocument
                                      ├── written order
                                      ├── performance order
                                      ├── source geometry
                                      └── confidence/issues
                                               │
                  ┌────────────────────────────┼─────────────────────────┐
                  ▼                            ▼                         ▼
           Harmony adapter              Melody adapter           Form navigator
                  │                            │                         │
       existing chord enrichment      new CBA melody path       measure-aware player
       ├── capo/enharmonics            existing CBA geometry    ├── tempo clock
       ├── Stradella solver            new fingering solver     ├── auto advance
       ├── Stradella transitions                               └── pedal advance
       ├── groove engine
       └── CBA chord grips
```

### Required internal contracts

The precise shape must be agreed through tests before UI or OMR work. At minimum:

```typescript
interface ScoreDocument {
  schemaVersion: 1;
  title?: string;
  sourceKind: "musicxml" | "photo";
  key?: ScoreKeySignature;
  time?: ScoreTimeSignature;
  sections: ScoreSection[];
  measures: ScoreMeasure[];
  issues: ScoreIssue[];
}

interface ScoreMeasure {
  id: string;
  printedNumber?: number;
  writtenIndex: number;
  time?: ScoreTimeSignature;
  key?: ScoreKeySignature;
  melody: MelodyEvent[];
  harmonies: HarmonyEvent[];
  navigation: NavigationMark[];
  sourceBox?: ImageBox;
  confidence?: number;
}

interface MelodyEvent {
  id: string;
  offset: RationalDuration;
  duration: RationalDuration;
  pitch?: SpelledPitch;
  rest: boolean;
  tie?: "start" | "continue" | "stop";
  confidence?: number;
  sourceBox?: ImageBox;
}
```

Use rational durations, not floating-point beats. Preserve written pitch spelling independently from
pitch class. Every persisted format needs a `schemaVersion` and backward-compatible normalization.

## 5. Sequential execution rules

- [ ] Work through milestones in order. Do not begin a later milestone before the current
      milestone's exit criteria and review checkpoint, when present, are satisfied.
- [ ] The primary agent performs all implementation. Do not delegate implementation tasks.
- [ ] Do not spawn exploratory, implementation, test-writing, or documentation sub-agents.
- [ ] Spawn exactly one read-only reviewer only at each explicitly labeled review checkpoint.
- [ ] For every review checkpoint, omit `model` and `reasoning_effort` overrides so the reviewer
      inherits the primary agent's actual model and reasoning effort. Do not hard-code a marketing
      model name because the executing environment may change.
- [ ] Give the reviewer the relevant diff, requirements, tests, and a request for findings ordered
      by severity. The reviewer must not edit files.
- [ ] Resolve every blocking/high finding, record the disposition, rerun the milestone checks, and
      only then mark the checkpoint complete.
- [ ] Preserve unrelated user changes in a dirty worktree.
- [ ] Never copy the class photograph or other private/copyrighted sheets into the repository,
      fixtures, commits, logs, screenshots, or agent work directories.
- [ ] Use authored synthetic scores or clearly licensed/public-domain fixtures in committed tests.
- [ ] Keep default tests hermetic and network-free. Model downloads and real-photo evaluations must
      be explicit opt-in tasks outside `deno task test`.
- [ ] Do not modify `.github/workflows/` unless the user explicitly requests it.
- [ ] Before every commit/push, pass, in order: `deno fmt --check`, `deno lint`, `deno task test`,
      and `deno task build`.
- [ ] Make atomic Conventional Commits and push verified work to `origin/master` as required by
      `AGENTS.md`.

## 6. Milestone checklist

### Milestone 0 — Baseline, evidence, and privacy guardrails

- [ ] Re-read `AGENTS.md`, this plan, and the current worktree before implementation.
- [ ] Run the four mandatory baseline quality checks and record any pre-existing failure separately.
- [ ] Inventory the existing reusable paths:
  - `src/lib/capo/`
  - `src/lib/stradella/`
  - `src/lib/cba/`
  - `src/components/LeadSheetReader.tsx`
  - `src/components/LineRenderer.tsx`
  - `src/components/ChordBadge.tsx`
  - `src/components/MiniGripDrawer.tsx`
  - `src/hooks/useAutoScroll.ts`
  - `src/hooks/usePedalNavigation.ts`
  - `src/hooks/useWakeLock.ts`
- [ ] Define a committed fixture policy covering provenance, copyright, generated scores, and
      private local evaluation data.
- [ ] Ensure private evaluation paths and downloaded weights remain ignored without broad ignore
      patterns that could hide application code.
- [ ] Create an opt-in local evaluation command only when the first evaluation harness exists; it
      must not be imported by the default test task.

**Exit criteria**

- [ ] Baseline checks are green.
- [ ] No private image exists under the repository root or Git index.
- [ ] Fixture and model-artifact policies are documented.

### Milestone 1 — Score domain model and compatibility boundary

- [ ] Add score-domain types under `src/types/` without changing the meaning of existing
      `LeadSheetSong.lines`.
- [ ] Add optional `score?: ScoreDocument` support to `LeadSheetSong`.
- [ ] Represent rational time, spelled pitches, measure offsets, ties, rests, harmonies, sections,
      repeats, voltas/endings, jumps, fine/end markers, confidence, and source boxes.
- [ ] Define written-order versus performance-order contracts explicitly.
- [ ] Add versioned normalization for persisted score documents and returning users.
- [ ] Add pure builders/selectors for current measure, next written measure, and next performed
      measure.
- [ ] Add unit tests for pickups, meter changes, key changes, ties, repeat endings, and malformed
      navigation graphs.
- [ ] Add a pure harmony adapter that converts `HarmonyEvent`s into the existing enrichment path; do
      not duplicate capo, enharmonic, Stradella, or CBA chord logic.
- [ ] Prove with tests that an adapted harmony sequence receives the same `ChordDetail`, Stradella
      transitions, and CBA chord grips as an equivalent parsed lead sheet.

**Exit criteria**

- [ ] Existing lead-sheet behavior is unchanged.
- [ ] Score contracts and migrations have exhaustive pure tests.
- [ ] Harmony reuse is demonstrated by equality tests.

#### Review checkpoint 1 — Architecture and regression boundary

- [ ] Spawn one read-only reviewer inheriting the primary model and reasoning effort.
- [ ] Ask it to inspect the score schema, migration behavior, written/performance ordering, harmony
      adapter, and risks of duplicating existing engines.
- [ ] Resolve high/blocking findings and add regression tests.
- [ ] Rerun the four mandatory checks.
- [ ] Record the review disposition in the eventual commit/PR notes.

### Milestone 2 — MusicXML/MXL import before photograph recognition

- [ ] Add MusicXML and MXL file choices to the existing import experience.
- [ ] Add dependencies through `deno.json` only and pin versions.
- [ ] Parse the supported single-staff subset into `ScoreDocument`.
- [ ] For MXL, unpack the container in-browser with a small, audited ZIP library; reject unsafe
      paths and bounded-resource violations.
- [ ] Preserve clef, key, meter, measures, note/rest duration, accidentals, ties, chord harmonies,
      repeats, endings, and supported navigation text.
- [ ] Return structured, user-readable issues for unsupported polyphony or malformed documents.
- [ ] Add authored MusicXML fixtures for every supported construct.
- [ ] Add round-trip or semantic-equivalence tests where export is supported.
- [ ] Integrate OpenSheetMusicDisplay lazily using its SVG backend.
- [ ] Render only a bounded current/next range on mobile; do not render an entire long score on
      every navigation step.
- [ ] Add cursor and measure-highlight tests at the abstraction boundary rather than snapshotting
      volatile SVG internals.

**Exit criteria**

- [ ] A supported MusicXML/MXL file opens offline and creates the same harmony guidance as an
      equivalent lead sheet.
- [ ] Unsupported inputs fail safely without corrupting the songbook.
- [ ] No photograph or OMR dependency is required for this path.

### Milestone 3 — Measure-aware playing experience

- [ ] Add `preview`, `learn`, and `perform` score experiences without adding a second application
      shell.
- [ ] Keep the unified responsive configuration bar and reuse existing view preferences.
- [ ] Preview automatically shows key, meter, written form, performance route, and existing unique
      chord mini-cards.
- [ ] Learn mode shows the current measure prominently, the next measure as context, a count-in,
      tempo, phrase loop, and the selected accordion guidance.
- [ ] Perform mode removes nonessential controls and keeps the current measure, next destination,
      and minimal hand guidance visible.
- [ ] Reuse `ChordBadge`, `StradellaMiniCard`, `CbaMiniCard`, and `MiniGripDrawer`; do not fork
      score-specific copies of them.
- [ ] Feed measure harmony through existing Stradella display modes: badges, line cards, and micro
      grids.
- [ ] Retain existing CBA chord-grip modes for preview, chord taps, and optional harmony playing.
- [ ] Default jam fills off during faithful melody-score reading.
- [ ] Extend auto-scroll with a musical clock based on tempo, time signature, and measure duration;
      retain touch pause/resume.
- [ ] Extend pedal navigation so callbacks advance exactly one measure or phrase in score mode while
      preserving viewport paging for classic lead sheets.
- [ ] Reuse wake lock unchanged except for integration tests.
- [ ] Ensure chord/grid taps stop propagation and never trigger navigation.
- [ ] Add unit and UX tests for repeat-aware next destination, count-in, looping, touch pause, pedal
      direction, drawer interaction, and switching back to classic lead sheets.
- [ ] Run the UI audit at 360, 390, and 430 px widths.

**Exit criteria**

- [ ] A MusicXML score can be played hands-free using existing LH/RH guidance.
- [ ] Classic lead sheets behave exactly as before.
- [ ] There is no horizontal document overflow and interactive targets remain at least 44 by 44 px.

### Milestone 4 — CBA melody-path mathematical model

This milestone changes core CBA geometry behavior and therefore requires the mathematical validation
mandated by `AGENTS.md` before production implementation.

#### Milestone 4A — Specification and tests first

- [ ] Write a short mathematical specification for melodic path optimization without production
      implementation.
- [ ] Enumerate every physical location for each written pitch across active 3-row and 5-row
      layouts.
- [ ] Define state as at least button coordinate, finger, hand-position estimate, and previous
      transition.
- [ ] Define transition costs for column travel, row travel, repeated-note fingering, thumb policy,
      finger crossing, stretch, position reset after rests, and future look-ahead.
- [ ] Preserve pitch spelling for display while using pitch class/octave for physical location.
- [ ] Define deterministic tie-breaking so tests and persisted results remain stable.
- [ ] Specify how user-locked fingerings constrain subsequent optimization.
- [ ] Write table-driven expected paths covering all 12 pitch classes, ascending and descending
      scales, repeated notes, chromatic runs, leaps, rests, ties, phrase boundaries, 3-row layouts,
      and 5-row auxiliary-row choices.
- [ ] Add invariants: every output button sounds the input pitch, no impossible finger is emitted,
      locked choices are preserved, and identical input/preferences produce identical output.

#### Review checkpoint 2 — Pre-implementation domain validation

- [ ] Before writing the solver, spawn one read-only reviewer inheriting the primary model and
      reasoning effort.
- [ ] Ask it to validate the mathematical model over all 12 chromatic keys, octave handling, 3/5-row
      geometry, fingering constraints, and adversarial melodic contours.
- [ ] Resolve every mathematical or physical-playability concern in the specification/tests.
- [ ] Do not start Milestone 4B until the review is complete.

#### Milestone 4B — Solver and presentation

- [ ] Implement the melody path as a pure dynamic-programming/Viterbi-style optimizer under
      `src/lib/cba/`; do not use an LLM.
- [ ] Keep melody-path logic separate from chord-grip voice leading while sharing grid geometry.
- [ ] Return per-event coordinate, finger, transition, confidence/ambiguity, and locked status.
- [ ] Add a melody-focused CBA visualization by extending shared grid primitives rather than
      duplicating the full grid.
- [ ] Show current, next, and optionally previous melody buttons; keep the established semantic
      color hierarchy intact.
- [ ] Make assistance density configurable: notation only, note names, finger numbers, or button
      path.
- [ ] Add exhaustive unit tests and focused mobile component tests.

**Exit criteria**

- [ ] All mathematical fixtures pass on both 3-row and 5-row layouts.
- [ ] The solver is deterministic and independent of UI/OMR code.
- [ ] Existing chord-grip voice leading remains unchanged.

### Milestone 5 — Guided photograph mode without full OMR

- [ ] Add camera/gallery input with existing MIME and size protections.
- [ ] Decode into an `ImageBitmap` and normalize EXIF orientation where required.
- [ ] Lazy-load OpenCV.js and keep its work outside initial application startup.
- [ ] Move expensive preprocessing into a dedicated worker or bounded worker pipeline.
- [ ] Implement conservative grayscale, illumination normalization, page boundary detection,
      perspective correction, deskew, staff grouping, and barline detection.
- [ ] Split systems into approximately two-to-three-measure strips while retaining source geometry.
- [ ] Provide a manual boundary adjustment only when automatic slicing is visibly wrong.
- [ ] Allow immediate guided-photo playing using original strips plus manually entered or currently
      scanned chord symbols.
- [ ] Do not require melody recognition or score correction to use this mode.
- [ ] Revoke object URLs, release OpenCV matrices/canvases, support cancellation, and cap decoded
      dimensions to prevent memory exhaustion.
- [ ] Store source images only after explicit opt-in; derived score data can use the existing
      songbook persistence path with a schema migration.
- [ ] Test skew, perspective, shadows, faint staff lines, missing page edges, rotation,
      cancellation, and memory cleanup using generated/licensed fixtures.

**Exit criteria**

- [ ] A user can photograph a page and play from mobile-sized original measure strips.
- [ ] The flow remains valuable even when no OMR model is installed.
- [ ] Source-image privacy behavior is explicit and tested.

### Milestone 6 — OMR model evaluation and browser feasibility gate

Do not integrate a production model until this milestone passes. Conduct model conversion tooling
outside the application runtime; generated weights must remain outside Git.

- [ ] Confirm in writing the redistribution and usage license for the exact model weights,
      vocabulary, tokenizer, and required preprocessing—not only the source repository.
- [ ] Build a local evaluation manifest that refers to private samples outside the repository and
      committed authored/public-domain samples inside it.
- [ ] Establish ground truth for pitch, rhythm, chord symbols, key signature, meter, barlines,
      repeats, endings, and supported navigation.
- [ ] Evaluate unmodified JAZZMUS against representative printed single-staff class sheets.
- [ ] Run homr only as a local comparison baseline; do not copy its AGPL implementation into this
      project during evaluation.
- [ ] Measure staff-detection yield, pitch error, rhythm error, chord exact match, navigation exact
      match, invalid-measure rate, processing time, peak memory, and corrections per page.
- [ ] Export the JAZZMUS encoder, initial decoder, cached decoder, and optional staff detector to
      ONNX.
- [ ] Prove token-for-token parity between PyTorch and ONNX on a fixed authored corpus.
- [ ] Quantize to INT8 and measure accuracy loss before accepting the smaller artifact.
- [ ] Prove that all operators execute in `onnxruntime-web` WASM; treat WebGPU only as an optional
      acceleration.
- [ ] Produce a model manifest containing artifact URL, byte length, SHA-256, schema version,
      vocabulary version, expected input dimensions, license, and attribution.
- [ ] Define explicit go/no-go thresholds before looking at final evaluation results.
- [ ] If thresholds fail, stop OMR integration and ship/continue guided-photo plus MusicXML mode.

**Suggested product gate**

- [ ] Almost all valid staff systems and barlines are detected on the target document class.
- [ ] No rhythm-invalid measure is silently marked reliable.
- [ ] A normal one-page target score requires only a small review queue rather than transcription.
- [ ] Cold model download and peak memory are acceptable on a representative mid-range phone.
- [ ] Quantized browser output is materially equivalent to the reference model.

**Exit criteria**

- [ ] A signed-off model decision or a documented no-go decision exists.
- [ ] Model files are external, versioned, checksummed, and absent from Git.

### Milestone 7 — Browser OMR vertical slice

- [ ] Add `onnxruntime-web` through `deno.json` only.
- [ ] Implement a lazily created OMR Web Worker with typed request, progress, result, cancellation,
      timeout, and error contracts.
- [ ] Download artifacts only after the user starts local recognition and confirms any large first-
      use download.
- [ ] Verify manifest size and SHA-256 before opening an inference session.
- [ ] Cache verified artifacts using a versioned runtime cache independent of the PWA precache.
- [ ] Feed the existing two-to-three-measure strips to the model sequentially or with strictly
      bounded concurrency.
- [ ] Implement the tokenizer and autoregressive decode loop with cached decoder state.
- [ ] Retain token log probabilities and map them to measure-level confidence/issues.
- [ ] Parse the supported Humdrum `**kern`/`**mxhm` subset directly into `ScoreDocument`; reject or
      flag unsupported tokens rather than guessing.
- [ ] Stitch strips using barlines as re-synchronization points so one bad strip cannot shift the
      remainder of the page.
- [ ] Add golden parity tests using stored model outputs, not live downloads, to keep default tests
      hermetic.
- [ ] Add an explicit opt-in browser/model test command outside the default suite.
- [ ] Ensure failures fall back to guided-photo mode rather than losing the import.

**Exit criteria**

- [ ] A supported authored page becomes a `ScoreDocument` locally in a browser.
- [ ] UI remains responsive and cancellation releases sessions and image memory.
- [ ] Offline recognition works after the first successful artifact cache.

#### Review checkpoint 3 — OMR, privacy, security, and performance

- [ ] Spawn one read-only reviewer inheriting the primary model and reasoning effort.
- [ ] Ask it to inspect untrusted image/MXL handling, ZIP limits, worker isolation, model integrity,
      cache invalidation, memory cleanup, offline behavior, licensing notices, and graceful
      fallback.
- [ ] Resolve high/blocking findings and add adversarial tests.
- [ ] Rerun the four mandatory checks plus the opt-in local model smoke test.
- [ ] Record the review disposition.

### Milestone 8 — Local text/form recognition and confidence fusion

- [ ] Add Tesseract.js lazily and only after measuring whether JAZZMUS chord recognition alone is
      insufficient.
- [ ] OCR only bounded regions likely to contain chord symbols, section labels, and directions; do
      not run text OCR over the entire page without need.
- [ ] Normalize OCR chord candidates through the existing deterministic chord parser.
- [ ] Combine OMR, OCR, geometric, and music-validator evidence without allowing one confidence
      number to conceal disagreements.
- [ ] Auto-accept high-confidence agreements.
- [ ] Use conservative guidance or the original image for medium confidence.
- [ ] Hide generated melody guidance for low confidence.
- [ ] Add unresolved structural contradictions to the optional review queue.
- [ ] Support a small editable navigation vocabulary first: section labels, repeat start/end,
      endings, Fine/Slut, D.C., D.S., Segno, and Coda.
- [ ] Keep unfamiliar localized directions as visible source text requiring explicit mapping.
- [ ] Make the existing Gemini scan an optional `Assist this scan` action with clear notice that the
      image leaves the device.
- [ ] Never invoke cloud assistance automatically.

**Exit criteria**

- [ ] Chord/form disagreements are visible and recoverable.
- [ ] Low-confidence output cannot masquerade as verified accordion guidance.
- [ ] Fully local operation remains the default.

### Milestone 9 — Optional correction without pre-play friction

- [ ] Default successful scans to `Start playing`, not `Review score`.
- [ ] Show the original source crop whenever generated notation or assistance is uncertain.
- [ ] Create a review queue containing only actionable measure-level issues.
- [ ] Provide compact operations for pitch up/down, octave, duration, rest/note, accidental, tie,
      chord, barline, and navigation destination.
- [ ] Let users hide a questionable hint without correcting the underlying notation.
- [ ] Re-run measure validation, CBA melody paths, Stradella transitions, and performance routing
      incrementally after an edit.
- [ ] Preserve explicit user corrections and locked fingerings across rescans and schema migrations.
- [ ] Never overwrite a user correction with a later automatic pass.
- [ ] Add undo/redo for the active review session.
- [ ] Add tests proving that a user can skip review, play, return later, correct one item, and
      resume at the same location.

**Exit criteria**

- [ ] The normal flow is photograph → play.
- [ ] Correction is optional, scoped, reversible, and persistent.

### Milestone 10 — Integrated mobile hardening and release

- [ ] Verify preview, learn, and perform flows for MusicXML, guided photo, local OMR, and OMR
      failure fallback.
- [ ] Verify Stradella badges/cards/micro-grids and CBA chord/melody modes at 360–430 px.
- [ ] Verify drawers stay within the repository's occlusion budget and touch targets remain at least
      44 by 44 px.
- [ ] Verify no horizontal overflow with long chord names, localized directions, large fonts, and
      first/second endings.
- [ ] Verify tempo changes, pickups, fermata/manual holds, repeats, endings, and phrase loops.
- [ ] Verify wake-lock re-acquisition and pedal behavior throughout navigation and overlays.
- [ ] Verify classic lead-sheet import, songbook, capo, URL state, auto-scroll, and all four
      existing view modes have no regression.
- [ ] Audit accessibility: focus order, names, contrast, reduced motion, progress announcements, and
      keyboard correction controls.
- [ ] Audit storage quotas, model-cache deletion, score deletion, optional source-image deletion,
      and export/import migrations.
- [ ] Document supported notation, known limitations, privacy modes, first-use model download,
      offline behavior, and how to obtain MusicXML from a teacher.
- [ ] Run `deno task audit:ui` and perform exploratory Chromium checks on representative mobile and
      desktop sizes.
- [ ] Run the mandatory quality gate in order.

#### Review checkpoint 4 — Final integrated code review

- [ ] Spawn one read-only reviewer inheriting the primary model and reasoning effort.
- [ ] Ask it for severity-ordered findings across architecture, music correctness, reuse of existing
      engines, privacy, security, accessibility, mobile ergonomics, performance, tests, and
      maintenance.
- [ ] Resolve every blocking/high finding and document any accepted lower-risk finding.
- [ ] Rerun UI audit, focused OMR smoke tests, and the four mandatory checks.
- [ ] Confirm the Git diff contains no private score image, downloaded model, generated scan output,
      or unrelated user file.
- [ ] Commit atomically and push to `origin/master`.

**Release exit criteria**

- [ ] A new user can import MusicXML or photograph a supported page and reach Play without mandatory
      editing.
- [ ] The original measure remains available as ground truth for every photographed score.
- [ ] Harmony uses the existing Stradella/CBA enrichment path, not a duplicate implementation.
- [ ] CBA melody guidance is mathematically validated and optional.
- [ ] The experience is hands-free after count-in through tempo clock or pedal navigation.
- [ ] Fully local operation works offline after initial assets are cached.
- [ ] Cloud processing occurs only after explicit user action.
- [ ] Classic lead-sheet behavior and all repository quality gates remain green.

## 7. Required test strategy

### Hermetic default tests

- Pure score schema normalization and migrations.
- MusicXML subset parsing using authored fixtures.
- Repeat/ending performance-route expansion.
- Harmony-event equivalence with existing lead-sheet enrichment.
- CBA melody solver tables and invariants over all chromatic keys.
- Stradella transition/groove equivalence.
- OMR tokenizer/parser tests using stored synthetic token sequences.
- Confidence fusion and issue classification.
- Worker message contracts with a fake inference adapter.
- Storage and preference events.
- Component behavior using generated score/image fixtures.

### Opt-in local tests

- ONNX Runtime WASM/WebGPU parity.
- Model checksum/download/cache lifecycle.
- Representative private photo evaluation.
- Cold/warm inference time and peak memory.
- Live optional Gemini fallback.

Private evaluation results may be summarized numerically, but neither inputs nor reconstructable
outputs may be committed without explicit permission and provenance review.

### Browser/UI checks

- 360, 390, and 430 px portrait viewports.
- No horizontal document overflow.
- At least 44 by 44 px touch targets.
- Current measure dominates; next measure remains legible.
- Chords stay associated with their measures/beats.
- Drawer occlusion remains within the repository standard.
- Touching guidance pauses/resumes safely and never turns a page accidentally.
- Pedal actions move by measure/phrase in score mode and by viewport in classic mode.

## 8. Research references and provenance

- JAZZMUS model and limitations: <https://huggingface.co/JuanCarlosMartinezSevilla/jazzmus-model>
- JAZZMUS MIT source: <https://github.com/JuanCarlosMartinezSevilla/ISMIR-Jazzmus>
- KomaVision browser OMR pipeline and Apache-2.0 source:
  <https://github.com/EmreDikimen/Turkish_note_to_solfeggio_converter>
- ONNX Runtime Web: <https://github.com/microsoft/onnxruntime/tree/main/js/web>
- OpenCV.js: <https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html>
- Tesseract.js: <https://github.com/naptha/tesseract.js>
- OpenSheetMusicDisplay: <https://github.com/opensheetmusicdisplay/opensheetmusicdisplay>
- Homr comparison baseline: <https://github.com/liebharc/homr>

Re-check versions, licenses, model availability, and browser compatibility at the milestone where a
dependency or artifact is first introduced. Research links are evidence for the proposal, not an
instruction to copy code without reviewing its license and provenance.

## 9. Explicit stop conditions

Stop the sequential implementation and request user direction if any of the following occurs:

- The chosen model weights cannot be redistributed under acceptable terms.
- Browser WASM parity cannot be achieved without server execution.
- Representative pages require transcription-like correction effort.
- The implementation would require adding a Node `package.json` or weakening Deno permissions.
- The default test suite would require network access.
- The design requires duplicating or materially changing established Stradella/CBA behavior without
  a reviewed migration.
- Private or copyrighted source material would need to enter Git, CI, or a third-party service
  without explicit authorization.

In a model no-go, preserve the delivered MusicXML and guided-photo experience and treat automatic
melody recognition as deferred research rather than blocking the useful product.
