# Score Reader and Accordion Guidance — Sequential Implementation Plan

**Status:** Execution in progress; M0–M4 and the conservative M5 photo-source slice are implemented\
**Execution model:** One primary coding agent working sequentially\
**Review model:** Four named checkpoints, each using exactly one read-only reviewer: either
`gpt-5.6-sol` at medium reasoning or, when that model is unavailable, stable `gemini-3.8-flash` at
high reasoning\
**Primary outcome:** A musician can photograph or import a printed melody-and-chord score, press
Play, and receive measure-aware CBA and Stradella guidance without first transcribing notes or
chords or operating a notation editor. Automatic photograph recognition is required for release;
manual entry is correction/recovery only and cannot satisfy the primary outcome.

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
uncertain, a currently resolvable original measure crop remains the visual ground truth and
questionable generated guidance is hidden or presented conservatively.

There is one user-facing Score Reader, not separate MusicXML and photo modes. The import source is
an implementation detail after selection. The same reader, transport, current/next measure view,
FR-1XB CBA guidance, Stradella guidance, and correction controls apply to every score; controls
appear according to the structured musical data available. Technical terms such as OMR, ONNX, and
`ScoreDocument` do not appear in the normal playing workflow.

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

### Frozen v1 photograph profile

A photograph counts as supported only when all of these predeclared conditions hold; an
implementation may not narrow them after seeing evaluation failures:

- Machine-printed Western notation with one treble staff per system, one predominantly monophonic
  melody voice, and chord symbols above the staff.
- Melody pitches within the approved FR-1XB range F#3–G6; key signatures from zero through six
  sharps or flats; common accidentals and ties.
- 2/4, 3/4, 4/4, or 6/8 meter; pickups; whole through sixteenth notes and rests; dotted values.
- Chords accepted by the existing deterministic chord parser, including supported seventh and slash
  chords.
- Plain written order plus repeat barlines, first/second endings, Fine/Slut, D.C., D.S., Segno, and
  Coda. Unfamiliar prose directions may remain visible but are not interpreted.
- One complete JPEG, PNG, or WebP page with all music visible, at least 1,200 pixels on its longer
  edge, no symbol-obscuring crop or occlusion, and no more than 15 degrees of rotation. Normal
  camera perspective, uneven lighting, shadows, and moderate contrast loss remain supported.

Lyrics, dynamics, articulations, ornaments, and prose need not be recognized to satisfy the profile.
The import validator must explain which declared condition failed; it may not call an in-profile
recognition failure an unsupported page.

## 3. Decisions and selected stack

| Concern                        | Decision                                                                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application shell              | Keep React 19, Vite 6, Tailwind 4, and Deno 2.                                                                                                                                                                                                                    |
| Dependency declarations        | Add npm dependencies only through `deno.json`; never add `package.json`.                                                                                                                                                                                          |
| Canonical application data     | Add a compact TypeScript `ScoreDocument`; retain sanitized MusicXML as the render source for MusicXML imports.                                                                                                                                                    |
| Input experience               | One Score Reader accepts a photograph or digital score file; neither creates a user-visible mode.                                                                                                                                                                 |
| Score display                  | OpenSheetMusicDisplay (OSMD), SVG backend, using bounded one- or two-measure excerpts only. Never fall back to a full-score render.                                                                                                                               |
| Photo preprocessing            | `@techstark/opencv-js@5.0.0-release.1` (Apache-2.0), lazy-loaded in a worker; deterministic geometry performs page, staff, system, and barline slicing. Do not use Ultralytics code or weights.                                                                   |
| OMR runtime                    | `onnxruntime-web@1.29.0` (MIT); single-thread WASM baseline and optional WebGPU acceleration.                                                                                                                                                                     |
| Initial OMR candidate          | The JAZZMUS staff-level notation model at revision `b38466e738548cf4d3826a0426d709a711533618`, reconstructed with MIT source commit `643b49cf4772a58027e8f2cf924f2be637b31fc4`: MIT weights/config/source, exported to ONNX and evaluated under the frozen gates. |
| Browser architecture reference | KomaVision's Apache-2.0 page-slicing and encoder/decoder pattern; reuse only with notices and a recorded provenance review.                                                                                                                                       |
| Local text OCR                 | `tesseract.js@7.0.0` (Apache-2.0) with pinned `tessdata_fast` English data, required for bounded chord/header/navigation regions and tokens outside the JAZZMUS vocabulary.                                                                                       |
| Recognition policy             | OMR supplies candidates; deterministic validators and confidence decide what may be shown.                                                                                                                                                                        |
| Cloud policy                   | No cloud score recognition in the first release. Photographs and recognition remain on-device. Existing unrelated import behavior is unchanged.                                                                                                                   |
| Model distribution             | Do not commit weights. After all gates pass, publish immutable versioned artifacts to project-owned GitHub Releases; commit metadata, never weights.                                                                                                              |
| Model caching                  | Cache on demand at runtime; exclude model weights from the Workbox precache.                                                                                                                                                                                      |
| Source image privacy           | Hold the photo in memory during a scan. Persist only when the user explicitly requests it.                                                                                                                                                                        |
| Download-size policy           | Size is disclosed, not an acceptance gate. Show the exact manifest total before first use, explain that it is downloaded once for offline reuse, and provide progress, cancel, retry, and cache deletion.                                                         |
| Copyleft/non-commercial policy | Keep the application MIT. Do not integrate AGPL code/weights or CC-BY-NC datasets into the shipped recognizer, fixtures, or training path. Non-commercial intent does not override their redistribution and downstream-use obligations.                           |

### Required recognition path

This implementation plan evaluates the pinned JAZZMUS staff-level model exported to ONNX as the
first candidate because it produces both melody and chord tokens for lead sheets. Its vocabulary is
embedded in the pinned config; no separate tokenizer artifact is required. The model vocabulary does
not cover every v1 meter, key signature, or textual navigation token, so deterministic OpenCV
geometry and bounded Tesseract recognition are required parts of the pipeline rather than optional
fallbacks. Passing the Milestone 6 feasibility gate authorizes implementation of the browser
pipeline; only the complete pipeline may be judged against the frozen release gates after local
OCR/form fusion and correction behavior exist. Neither gate by itself authorizes external artifact
publication.

There is no reduced no-OMR release branch. The exact JAZZMUS notation artifacts have a documented
MIT redistribution basis; the bundled `yolo_staff_detector.pt` and all Ultralytics code are
explicitly excluded because Ultralytics applies AGPL-3.0 to its code and trained models by default.
If the permitted JAZZMUS notation model cannot meet the approved accuracy, correction-effort, or
browser gates, record `OMR_CANDIDATE_FAILED`, keep the existing manual photo workflow explicitly
experimental, and stop before presenting photograph import as playable score recognition. MusicXML
support may remain available, but it does not complete this plan's photograph requirement. The agent
must mark this plan blocked rather than inventing a replacement-model branch or permitting a
manual-photo release. A different recognizer is outside this plan.

Homr and the bundled Ultralytics detector are excluded from implementation and evaluation so their
AGPL code or weights cannot enter this project. LEGATO is not the planned mobile candidate because
its full model requires a large vision backbone and substantial GPU memory.

This exclusion is a deliberate engineering decision, not an assumption that open-source licenses
forbid commercial use. AGPL permits commercial use but would require the covered combined work and
its corresponding source to remain available under AGPL, including network-use source access and
appropriate notices. Adopting the bundled YOLO detector would therefore require relicensing this
currently MIT application for a component whose job is limited to locating staff regions. The
approved OpenCV geometry path keeps the project MIT and avoids an extra model conversion/download.
If OpenCV staff detection misses its frozen gate, that is a failed technical gate for this plan; it
does not silently authorize a project-wide AGPL relicense.

Likewise, the CC-BY-NC JAZZMUS dataset is not required to run the already published MIT model. It
would help only with additional training or evaluation, while restricting commercial downstream use
and requiring gated access. The implementation instead uses authored or clearly licensed fixtures
tailored to the frozen photograph profile. The dataset remains excluded even if the current
maintainer expects the application to stay non-commercial.

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
  source: ScoreSource;
  key?: ScoreKeySignature;
  time?: ScoreTimeSignature;
  tempoMap: TempoEvent[];
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
  phraseId?: string;
  manualHold?: boolean;
  sourceAssetId?: string;
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

type ScoreSource =
  | { kind: "musicxml"; sanitizedXml: string }
  | { kind: "photo"; assetId?: string; persistence: "ephemeral" | "opted_in" };
```

Use rational durations, not floating-point beats. Preserve written pitch spelling independently from
pitch class. A source box is usable only while its `sourceAssetId` resolves; after reload, an
ephemeral photo score must clearly report that its original crop is unavailable and offer
re-linking. Every persisted format needs a `schemaVersion` and backward-compatible normalization.

The immutable source retains written pitches and chords. A single derived transposition interval is
applied consistently to displayed key/spelling, melody, harmony, Stradella, and CBA. Guitar capo is
a separate control and must not transpose accordion guidance unless guitar mode explicitly requests
it.

The route contract includes tempo changes, pickups, phrase IDs, fermata/manual holds, bounded
repeat/jump traversal, deterministic cycle diagnostics, and a defined grace-note policy. Unknown
tempo defaults to a visible, user-adjustable 90 BPM—not an inferred source tempo.

### Planned ownership map

- `src/types/score.ts`: versioned score, source, timing, route, issue, and confidence contracts.
- `src/lib/score/`: rational time, validation, navigation, transposition, MusicXML, and shared
  harmony-sequence adapters.
- `src/lib/cba/keyboardLayout.ts` and `melodyPath.ts`: absolute physical layout and melody solver.
- `src/components/score/`: score preview, measure view, source crop, review, and melody guidance.
- `src/workers/scoreImage.worker.ts` and `omr.worker.ts`: bounded image and inference work.
- `src/lib/omr/`: manifests, model adapters, token parsing, confidence, and artifact verification.
- `tests/fixtures/score/`: authored/licensed fixtures plus per-artifact provenance manifest.

Names may be adjusted to existing conventions, but these ownership boundaries must remain clear.

### MusicXML v1 support matrix

The parser must produce the stated issue code and behavior. Expanding this matrix is a user-approved
scope change, not an implementation-time guess.

| Construct                                                                             | v1 action                                                     | Issue/failure behavior                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `score-partwise`, one pitched part and one treble staff                               | Parse                                                         | —                                                                              |
| `score-timewise`, multiple parts/staves, percussion/tab clefs                         | Reject                                                        | `unsupported_score_shape`; import remains atomic                               |
| One monophonic voice; `<forward>` only for legal silence                              | Parse                                                         | Normalize silence to rests                                                     |
| Multiple voices or `<backup>` creating polyphony                                      | Reject                                                        | `unsupported_polyphony`; offer source-only opening, no generated guidance      |
| Key/time/clef changes at measure boundaries                                           | Parse                                                         | Mid-measure changes: `unsupported_mid_measure_attribute`                       |
| Divisions, dotted notes, ties, rests, beams, accidentals                              | Parse                                                         | Beams are visual only; durations must validate exactly                         |
| Tuplets with explicit `<time-modification>`                                           | Parse                                                         | Unsupported nesting/ratio: `unsupported_tuplet`                                |
| Grace notes                                                                           | Preserve as zero-clock events attached to the following event | Unattached grace: `orphan_grace_note`                                          |
| Implicit/incomplete first measure                                                     | Parse as pickup                                               | Other invalid duration: `invalid_measure_duration` and unreliable timing       |
| Nonzero `<transpose>` or octave-shift directions                                      | Reject guidance                                               | `unsupported_instrument_transposition`; sanitized source may still render      |
| `<harmony>` root/bass/kind supported by current chord parser                          | Parse                                                         | Unsupported degree/kind preserves visible text and emits `unsupported_harmony` |
| Repeats, 1st/2nd endings, Fine/Slut, D.C., D.S., Segno, Coda                          | Parse from barline, direction, and sound attributes           | Conflicts: `ambiguous_navigation`, require explicit mapping                    |
| Measure-repeat shorthand, arbitrary words, dynamics, articulations, ornaments, lyrics | Preserve in sanitized source; ignore for guidance             | Emit one deduplicated informational issue per construct type                   |

Sanitized source-only rendering never permits generated timing, melody, or accordion hints for a
construct marked reject-guidance.

## 5. Sequential execution rules

- [ ] Work through milestones in order. Do not begin a later milestone before the current
      milestone's exit criteria and review checkpoint, when present, are satisfied.
- [ ] The primary agent performs all implementation. Do not delegate implementation tasks.
- [ ] Do not spawn exploratory, implementation, test-writing, or documentation sub-agents.
- [ ] Spawn exactly one read-only reviewer only at each explicitly labeled review checkpoint. Do not
      run both approved reviewers at the same checkpoint.
- [ ] First try the exact Codex spawn contract `model: "gpt-5.6-sol"`, `reasoning_effort: "medium"`,
      and `fork_turns: "none"`. If that model cannot be started in the active environment, use the
      official stable Gemini model ID `gemini-3.8-flash` with its reasoning/thinking level set to
      `high` and with no inherited implementation conversation. Provider-specific field names may
      differ, but the recorded backend model and reasoning level must be exact.
- [ ] Give either reviewer the same self-contained prompt with the absolute repository/plan paths,
      applicable requirements, base/head commits or diff, relevant tests, and a request for
      severity-ordered findings. It must remain read-only. Record which model and reasoning level
      actually ran so a later agent does not repeat the checkpoint.
- [ ] If neither approved reviewer can be started, stop the checkpoint and request user direction;
      never silently substitute a third model or run two reviews merely because both are available.
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
- [ ] Split each milestone into the smallest numbered slice that produces a testable coherent
      change. Each slice ends with all four checks, a Conventional Commit, and a push. Keep
      incomplete user-facing work unreachable behind an internal capability gate.
- [ ] If the baseline fails because of pre-existing user work, record evidence and stop for user
      direction rather than editing unrelated work.

### Durable progress ledger

During implementation, maintain a table directly below this paragraph with one row per milestone
slice and checkpoint: `ID`, `status` (`pending`, `active`, `complete`, `blocked`), `commit`,
`checks`, `review disposition`, and `notes`. Update it in the same commit that completes a slice. A
future agent must read the ledger, verify the recorded HEAD and worktree, and resume at the first
incomplete row rather than replaying completed work.

| ID  | Status   | Commit  | Checks                                      | Review disposition                    | Notes                                                                                                                                                                                                                                                                                               |
| --- | -------- | ------- | ------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0  | complete | 464cb54 | fmt/lint/test/build green                   | N/A                                   | Baseline, provenance policy, authority record, and reuse inventory.                                                                                                                                                                                                                                 |
| M1A | complete | 2c8e738 | fmt/lint/test/build green                   | N/A                                   | Versioned contracts, rational timing, and validation.                                                                                                                                                                                                                                               |
| M1B | complete | fad8be5 | fmt/lint/test/build green                   | N/A                                   | Songbook envelope, migrations, quarantine, and cleanup hooks.                                                                                                                                                                                                                                       |
| M1C | complete | af09031 | fmt/lint/test/build green                   | N/A                                   | Route, tempo, transposition, and shared harmony adapter.                                                                                                                                                                                                                                            |
| M2A | complete | d4523e0 | fmt/lint/test/build green                   | R1 corrective slice                   | Bounded MusicXML/MXL parser, strict source limits, and semantic tests.                                                                                                                                                                                                                              |
| M2B | complete | d4523e0 | fmt/lint/test/build green                   | R1 corrective slice                   | Lazy OSMD SVG adapter with the bounded-excerpt strategy selected by the completed spike.                                                                                                                                                                                                            |
| M2C | complete | caca12a | fmt/lint/test/build green                   | R1 corrective slice                   | Existing import modal accepts MusicXML/MXL and preserves atomic preview state.                                                                                                                                                                                                                      |
| R1  | complete | b700e1e | fmt/lint/test/build green (281 passing)     | APPROVED                              | Corrective parser/domain validation, nested-repeat rejection, bounded validation, and last-playable guidance continuity reviewed and approved by the exact `gpt-5.6-sol`/medium reviewer.                                                                                                           |
| M3A | complete | 0643c7e | fmt/lint/test/build green (282 passing)     | N/A                                   | Musical clock, repeat-aware route, pedal measure stepping, manual-hold boundaries, visual count-in, and bounded phrase-loop playback are implemented and unit-tested.                                                                                                                               |
| M3B | complete | 2b29ec5 | fmt/lint/test/build green (282 passing)     | N/A                                   | Preview/learn/perform score cards show current/next measure context, key/meter/form/tempo metadata, and the existing LH/RH guidance without a second application shell.                                                                                                                             |
| M3C | complete | 2b29ec5 | fmt/lint/test/build green (282 passing)     | N/A                                   | Score reader controls expose 44px touch targets, live count-in status, loop state, and accessible current-measure semantics; mobile audit passed all 42 assertions at 360–1024 px.                                                                                                                  |
| M4A | complete | 186e134 | fmt/lint/test/build green (292 passing)     | R2 APPROVED (score_cba_domain_review) | FR‑1XB C‑Griff Europe profile, absolute pitch anchor, finite 62-button bounds, candidate enumeration, validated solver specification/tests, and explicit 1‑2‑4/2‑3‑5 regression evidence are committed; user-authorized current app layout is the coordinate authority.                             |
| M4B | complete | 2e9dfd7 | fmt/lint/test/build green (299 passing)     | N/A                                   | Deterministic CBA melody DP, hard diagnostics/locks/ties/resets, shared compact RH path map, and configurable assistance density are implemented without changing existing chord voice leading.                                                                                                     |
| M5A | complete | 561bff3 | fmt/lint/test/build green (315 passing)     | N/A                                   | Dedicated OpenCV worker and deterministic preprocessing pipeline implemented: lazy-loaded @techstark/opencv-js, adaptive thresholding, horizontal projection deskew, 5-line staff grouping, barline slicing, memory leak tracking, cancellation via AbortSignal, and typed preparation entry point. |
| M5B | complete | e4fb5f2 | fmt/lint/test/build green (305 passing)     | N/A                                   | Manual page-boundary adjustment and mobile source-strip rendering use the versioned `ScorePhotoLayout`; no OMR crop/model assumptions are frozen.                                                                                                                                                   |
| M5C | complete | e4fb5f2 | fmt/lint/test/build green (305 passing)     | N/A                                   | Timed manual chord assignment (`Chord@beat`) is provenance-marked and reuses existing harmony guidance as correction/recovery scaffolding, not as the release workflow. Explicit opt-in persists the original image separately; ephemeral/missing-source behavior is visible.                       |
| M6  | complete | a9b89b9 | fmt/lint/test/build green (parity verified) | OMR_CANDIDATE_FEASIBLE                | Isolated Python 3.11 conversion environment, JAZZMUS SMT state dict reconstructed without Ultralytics/YOLO, ONNX models exported and verified in single-thread WASM with token-for-token numerical parity.                                                                                          |
| M7  | complete | a1ef394 | fmt/lint/test/build green (330 passing)     | R3 corrective slice                   | 153-token vocabulary, untokenizer, Humdrum kern/mxhm parser, single-thread WASM web worker, Cache Storage manifest with SHA-256 verification, first-use disclosure modal, and end-to-end photo OMR pipeline.                                                                                        |
| R3  | complete | 9ceb350 | fmt/lint/test/build green (335 passing)     | APPROVED                              | Specialized security, music domain, and OMR reviewer (`gemini-3.8-flash`/high) approved. Corrective slice resolved cache key invariance, back-to-back repeat barlines, bounded photo decode, OpenCV kernel clamping, worker lifecycle termination, and confidence propagation.                      |

### Required slice order

Use these as the initial ledger rows; split further when a diff stops being independently testable.

1. `M0`: baseline, provenance policy, authority record.
2. `M1A`: score/source/time types and validators; `M1B`: storage migration and lifecycle; `M1C`:
   route/transposition/harmony adapter.
3. `M2A`: bounded XML/MXL parser; `M2B`: OSMD rendering spike and selected adapter; `M2C`: import UI
   integration; then combined architecture/import review `R1`.
4. `M3A`: musical clock, route, loop, and pedal logic; `M3B`: preview/learn/perform UI; `M3C`: UX,
   accessibility, and browser audit.
5. `M4A`: physical-keyboard mathematical specification and tests; then `R2`; `M4B`: geometry
   compatibility layer, solver, and shared melody presentation.
6. `M5A`: bounded local photo decode and conservative page geometry plus worker/OpenCV preparation;
   `M5B`: measure crop/boundary UI; `M5C`: correction/recovery chord input and source lifecycle.
7. `M6A`: authority, separate development-set model-input probe, frozen release corpus and gates;
   `M6B`: reference/export/parity and browser feasibility; `M6C`: record `OMR_CANDIDATE_FEASIBLE` or
   `OMR_CANDIDATE_FAILED`. A failed candidate stops the photograph-recognition release rather than
   creating a reduced release.
8. After `OMR_CANDIDATE_FEASIBLE`: `M7A` local artifact/runtime loader, `M7B` model
   adapter/decode/parser, `M7C` cache/offline/failure UI and browser tests; then `R3`.
9. `M8A`: mandatory bounded OCR for chords, headers, meter/key supplements, and navigation; `M8B`:
   confidence/form fusion. Cloud score recognition is excluded from v1.
10. `M9A`: issue queue and incremental recomputation; `M9B`: correction/locking/undo persistence.
11. `M10A`: frozen-corpus evaluation plus integration/accessibility/storage hardening; `M10B`: docs
    and release evidence; then `R4`, exact artifact publication, production-host verification,
    corrective slices, and final gate.

## 6. Milestone checklist

### Milestone 0 — Baseline, evidence, and privacy guardrails

- [x] Re-read `AGENTS.md`, this plan, and the current worktree before implementation.
- [x] Run the four mandatory baseline quality checks and record any pre-existing failure separately.
- [x] Inventory the existing reusable paths:
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
- [x] Define a committed fixture policy covering provenance, copyright, generated scores, and
      private local evaluation data.
- [x] Add a fixture manifest recording creator/source, work public-domain status, engraving/image
      license, creation tool/font/model, permitted use, checksum, reviewer, and review date.
- [x] Ensure private evaluation paths and downloaded weights remain ignored without broad ignore
      patterns that could hide application code.
- [ ] Create an opt-in local evaluation command only when the first evaluation harness exists; it
      must not be imported by the default test task.
- [x] Create a decision/authority record with named owner and status for dependency licenses,
      fixture provenance, target benchmark device/profile, frozen numeric thresholds, model and
      artifact licensing, artifact host/CORS/retention, external publication, and the requirement
      that a manual-only photograph workflow is not an acceptable v1.
- [x] Before M4A, obtain user approval for every supported `CbaKeyboardLayout`: display name, row
      and button counts, physical bounds, lowest/highest sounding pitch, reference coordinate and
      pitch, orientation, and authoritative source. If none is approved, v1 may use only an
      explicitly labeled abstract layout and must not claim instrument-specific reachability.
- [x] Record notices/provenance requirements for OSMD, the ZIP/XML parser, OpenCV.js, Tesseract.js,
      ONNX Runtime Web, KomaVision-derived logic, and every model artifact.

The product, dependency, artifact-hosting, model-license, privacy, and publication choices required
by this plan are now recorded and approved. The implementation agent may make ordinary technical
decisions within those boundaries and must not pause merely to reconfirm them. It may not choose a
materially reduced product scope, publish artifacts before the recorded gates, or send private
scores to a third party.

**Exit criteria**

- [x] Baseline checks are green.
- [x] No private image exists under the repository root or Git index.
- [x] Fixture and model-artifact policies are documented.
- [x] Every external decision has an owner, approval state, and explicit stop point.

### Milestone 1 — Score domain model and compatibility boundary

- [x] Add score-domain types under `src/types/` without changing the meaning of existing
      `LeadSheetSong.lines`.
- [x] Add optional `score?: ScoreDocument` support to `LeadSheetSong`.
- [x] Represent rational time, spelled pitches, measure offsets, ties, rests, harmonies, sections,
      tempo events, grace-note policy, phrase IDs, manual holds, repeats, voltas/endings, jumps,
      fine/end markers, confidence, and resolvable source boxes.
- [x] Define written-order versus bounded performance-order contracts explicitly, including a
      maximum traversal count and deterministic diagnostics for malformed cycles.
- [x] Add a top-level songbook schema/version normalizer, record validation, bounded import sizes,
      quarantine/rejection of malformed scores, and explicit export semantics for embedded sources
      versus source references.
- [x] Define score/source deletion now: deletion removes derived caches and opted-in source assets;
      shared downloaded model artifacts remain under a separate cache-management control.
- [x] Specify and test the written-to-derived transposition invariant for melody, harmony, key,
      spelling, and both accordion engines; keep guitar capo semantics separate.
- [x] Add pure builders/selectors for current measure, next written measure, next performed measure,
      tempo at cursor, pickup count-in, phrase boundaries, and manual holds.
- [x] Add unit tests for pickups, meter changes, key changes, ties, repeat endings, and malformed
      navigation graphs.
- [x] Refactor a shared pure
      `enrichHarmonySequence(events, transposition, spelling, cbaMode, accordionSize, route)`
      primitive, then adapt both classic lead sheets and timed score harmonies to it. Do not
      duplicate capo, enharmonic, Stradella, or CBA chord logic.
- [x] Prove with tests that an adapted harmony sequence receives the same `ChordDetail`, Stradella
      transitions, and CBA chord grips as an equivalent parsed lead sheet.
- [x] Cover multiple/no chords per measure, pickups, slash chords, repeat boundaries, volta skips,
      and D.C./D.S. jumps so transitions follow performance order rather than written order.

**Exit criteria**

- [x] Existing lead-sheet behavior is unchanged.
- [x] Score contracts and migrations have exhaustive pure tests.
- [x] Harmony reuse is demonstrated by equality tests.

### Milestone 2 — MusicXML/MXL import before photograph recognition

- [x] Add MusicXML and MXL file choices to the existing import experience.
- [x] Add dependencies through `deno.json` only and pin versions.
- [x] Parse exactly the MusicXML v1 support matrix above into `ScoreDocument`, independently of
      undocumented OSMD internals. Persist a sanitized MusicXML render source separately from the
      domain model.
- [x] For MXL, use a pinned, browser-compatible audited ZIP library. Accept at most 10 MiB
      compressed, 32 MiB uncompressed, and 128 entries; reject traversal, duplicate normalized
      paths, encrypted entries, symlinks, multiple/absent roots, and decompression limit violations.
- [x] For XML, reject DTDs/external entities and unsupported encodings. Enforce 10 MiB XML, bounded
      element count/event count, and maximum depth 128 before domain conversion. Tighten these
      initial caps when profiling proves a smaller safe limit.
- [x] Preserve the clef, key, meter, measures, events, harmonies, and navigation constructs marked
      `Parse`; emit the specified issues for every other matrix row.
- [x] Return structured, user-readable issues for unsupported polyphony or malformed documents.
- [x] Add authored MusicXML fixtures for every supported construct.
- [x] Add round-trip or semantic-equivalence tests where export is supported.
- [x] Integrate OpenSheetMusicDisplay lazily using its SVG backend.
- [x] Run an early OSMD spike comparing: bounded excerpt documents, a cached full render cropped by
      mapped system/measure boxes, and supported incremental rendering. Record the selected strategy
      and prove that current/next display does not depend on undocumented OSMD internals.
- [x] Select bounded sanitized OSMD excerpts through public APIs; retain source-image crops for
      photo inputs and do not introduce a full-score fallback or a separate notation renderer.
- [x] Add cursor and measure-highlight tests at the abstraction boundary rather than snapshotting
      volatile SVG internals.

**Exit criteria**

- [x] A supported MusicXML/MXL file opens offline and creates the same harmony guidance as an
      equivalent lead sheet.
- [x] Unsupported inputs fail safely without corrupting the songbook.
- [x] No photograph or OMR dependency is required for this path.

#### Review checkpoint 1 — Architecture, regression, and secure import

- [x] Invoke the Section 5 reviewer contract after Milestone 2.
- [x] Ask it to inspect the score schema, storage migrations, source lifecycle, written/performance
      ordering, transposition and harmony reuse, XML/MXL adversarial limits, OSMD isolation, bounded
      rendering, and import failure atomicity.
- [x] Resolve high/blocking findings, rerun the four checks, and record the disposition.

### Milestone 3 — Measure-aware playing experience

- [x] Add `preview`, `learn`, and `perform` score experiences without adding a second application
      shell.
- [x] Keep the unified responsive configuration bar and reuse existing view preferences.
- [x] Preview automatically shows key, meter, written form, performance route, and existing unique
      chord mini-cards.
- [x] Learn mode shows the current measure prominently, the next measure as context, a count-in,
      tempo, phrase loop, and the selected accordion guidance.
- [x] Perform mode removes nonessential controls and keeps the current measure, next destination,
      and minimal hand guidance visible.
- [x] Reuse `ChordBadge`, `StradellaMiniCard`, `CbaMiniCard`, and `MiniGripDrawer`; do not fork
      score-specific copies of them.
- [x] Feed measure harmony through existing Stradella display modes: badges, line cards, and micro
      grids.
- [x] Retain existing CBA chord-grip modes for preview, chord taps, and optional harmony playing.
- [x] Default jam fills off during faithful melody-score reading.
- [x] Extend auto-scroll with a musical clock based on tempo, time signature, and measure duration;
      retain touch pause/resume and stop at fermata/manual holds.
- [x] Extend pedal navigation so callbacks advance exactly one measure or phrase in score mode while
      preserving viewport paging for classic lead sheets.
- [x] Reuse wake lock unchanged except for integration tests.
- [x] Ensure chord/grid taps stop propagation and never trigger navigation.
- [x] Add unit and UX tests for tempo changes, pickups, fermata/manual holds, malformed route
      cycles, repeat-aware next destination, count-in, looping, touch pause, pedal direction, drawer
      interaction, and switching back to classic lead sheets.
- [x] At introduction—not only final hardening—verify keyboard/focus behavior, reduced motion,
      progress announcements, long-direction overflow, drawer occlusion, and overlay/pedal
      conflicts.
- [x] Run the UI audit at 360, 390, and 430 px widths.

**Exit criteria**

- [x] A MusicXML score can be played hands-free using existing LH/RH guidance.
- [x] Classic lead sheets behave exactly as before.
- [x] There is no horizontal document overflow and interactive targets remain at least 44 by 44 px.

### Milestone 4 — CBA melody-path mathematical model

This milestone changes core CBA geometry behavior and therefore requires the mathematical validation
mandated by `AGENTS.md` before production implementation.

#### Milestone 4A — Specification and tests first

- [x] Define a versioned `CbaKeyboardLayout` with layout/model ID, handedness/orientation, physical
      row/column bounds, absolute MIDI pitch at a reference coordinate, duplicated-row mapping, and
      playable range for each supported instrument profile.
- [x] Preserve current pitch-class chord-grid behavior behind compatibility adapters/tests; do not
      pretend its artificial 12-column lattice represents melody register.
- [x] Write a short mathematical specification for melodic path optimization without production
      implementation.
- [x] Enumerate candidates through
      `SpelledPitch → absolute sounding MIDI pitch → physical key locations` across supported 3-row
      and 5-row layouts. Define how the sheet's 16-foot register label affects display/instrument
      profile metadata without silently octave-shifting source notation.
- [x] Define state as at least button coordinate, finger, hand-position estimate, and previous
      transition.
- [x] Define transition costs for column travel, row travel, repeated-note fingering, thumb policy,
      finger crossing, stretch, position reset after rests, and future look-ahead.
- [x] Preserve pitch spelling for display while using pitch class/octave for physical location.
- [x] Define deterministic tie-breaking so tests and persisted results remain stable.
- [x] Specify how user-locked fingerings constrain subsequent optimization.
- [ ] Implement table-driven expected solver paths covering every absolute pitch in each supported
      keyboard, all 12 pitch classes, ascending and descending scales, repeated notes, chromatic
      runs, leaps, rests, ties, phrase boundaries, out-of-range notes, 3-row layouts, and 5-row
      auxiliary rows (Milestone 4B, after the solver exists).
- [ ] Add executable solver invariants: every output button sounds the input pitch, no impossible
      finger is emitted, locked choices are preserved, and identical input/preferences produce
      identical output (Milestone 4B).

#### Review checkpoint 2 — Pre-implementation domain validation

- [x] Before production geometry/solver edits, invoke the exact Section 5 reviewer contract and
      explicitly designate it as the specialized CBA domain/mathematical reviewer required by
      `AGENTS.md`.
- [x] Ask it to validate all absolute pitches across each physical keyboard, all 12 pitch classes,
      octave/reference anchoring, 3/5-row geometry, orientation, transposition, fingering
      constraints, and adversarial melodic contours.
- [x] Ask it to review regression evidence for every existing chord quality, canonical 3/5-row
      grips, voice-led transitions, duplicated auxiliary rows, and the `1-2-4 / 2-3-5` invariants.
- [x] Resolve every mathematical or physical-playability concern in the specification/tests.
- [x] Do not start Milestone 4B until the review is complete.

#### Milestone 4B — Solver and presentation

- [x] Implement the melody path as a pure dynamic-programming/Viterbi-style optimizer under
      `src/lib/cba/`; do not use an LLM.
- [x] Keep melody-path logic separate from chord-grip voice leading while sharing only validated
      physical-layout primitives.
- [x] Return per-event coordinate, finger, transition, confidence/ambiguity, and locked status.
- [x] Make invalid locks, conflicting locks, out-of-range notes, rests, ties, and phrase resets
      explicit result diagnostics; never substitute a nearest button.
- [x] Add the table-driven path fixtures and solver invariants deferred from Milestone 4A.
- [x] Add a melody-focused CBA visualization by extending shared grid primitives rather than
      duplicating the full grid.
- [x] Show current, next, and optionally previous melody buttons; keep the established semantic
      color hierarchy intact.
- [x] Make assistance density configurable: notation only, note names, finger numbers, or button
      path.
- [x] Add exhaustive unit tests and focused mobile component tests.

**Exit criteria**

- [x] All mathematical fixtures pass on both 3-row and 5-row layouts.
- [x] The solver is deterministic and independent of UI/OMR code.
- [x] Existing chord-grip voice leading remains unchanged.

### Milestone 5 — Photograph source and preprocessing foundation

The already-delivered conservative slice is an implementation scaffold, not the finished musician
workflow. It keeps the selected page as visual ground truth and proves safe source handling while
automatic recognition is built. Existing timed manual chord entry is retained only for correction,
recovery, and diagnostics; it must not be required before Play or presented as successful photograph
recognition.

- [x] Add camera/gallery input with existing MIME and size protections.
- [x] Decode into an `ImageBitmap` and normalize EXIF orientation where required.
- [x] Lazy-load OpenCV.js and keep its work outside initial application startup.
- [x] Move expensive preprocessing into a dedicated worker or bounded worker pipeline.
- [x] Implement conservative grayscale, illumination normalization, page boundary detection,
      perspective correction, deskew, staff grouping, and barline detection.
- [x] Produce model-independent page/system/staff/measure geometry as a conservative full-page
      measure strip. Do not freeze OMR crop size, overlap, normalization, or stitching here; those
      belong to the selected model adapter.
- [x] Provide a manual boundary adjustment only when automatic slicing is visibly wrong.
- [x] Add a measure-level recovery chord-assignment flow with beat offset/provenance. Do not treat
      the current scan API's unique `string[]` chord list as timed harmony; it remains chord lookup
      only unless its contract is deliberately extended and tested.
- [x] Preserve the existing source-strip plus assigned-chord scaffold for recovery and incremental
      development; it does not satisfy the release outcome.
- [x] Provide a typed, cancellation-aware preparation entry point that Milestone 7 can call without
      asking the musician for notes or chords; keep incomplete recognition behind an internal
      capability gate.
- [x] Revoke object URLs, release decoded bitmaps, support cancellation, and cap decoded dimensions
      to prevent memory exhaustion.
- [x] Keep the original photo blob ephemeral by default. On opt-in, persist it under a stable asset
      ID. Test missing/evicted assets, re-linking, export, song deletion, and derived-cache
      deletion; never promise an original crop after reload if the source was not retained.
- [x] Test skew, perspective, shadows, faint staff lines, missing page edges, rotation,
      cancellation, and memory cleanup using generated/licensed fixtures.

**Exit criteria**

- [x] A selected photograph can be displayed safely as a mobile-sized source strip and retained or
      re-linked according to the privacy policy.
- [x] The source and preprocessing contracts provide deterministic page/staff/measure inputs for
      Milestone 6 evaluation and the Milestone 7 model adapter.
- [x] The incomplete photograph-recognition path is not presented as a completed playable feature;
      manual chord entry is clearly correction/recovery scaffolding.
- [x] Source-image privacy behavior is explicit and lifecycle-tested for in-session ephemeral
      storage, explicit opt-in assets, missing-source messaging/re-linking, export references, song
      deletion, and derived-cache deletion.

### Milestone 6 — Required OMR model evaluation and browser feasibility gate

Do not integrate a production model until this milestone passes. Conduct model conversion tooling
outside the application runtime; generated weights must remain outside Git.

- [x] Lock and record the exact redistribution basis: JAZZMUS revision
      `b38466e738548cf4d3826a0426d709a711533618` publishes `model.safetensors` and `config.json`
      under MIT. The config contains the vocabulary, so no tokenizer file is needed. Exclude
      `yolo_staff_detector.pt` and Ultralytics code because their default AGPL-3.0 terms are not
      accepted for this project. Do not download or use the gated CC-BY-NC-4.0 JAZZMUS dataset.
- [x] Lock the separate MIT model implementation to ISMIR-Jazzmus commit
      `643b49cf4772a58027e8f2cf924f2be637b31fc4`; the relevant source hashes are
      `a864f6545caf78f237c83b38741c238d009cac4787016ef7e7aef2d94582d268` for `configuration_smt.py`
      and `3c5e414a7fe0e51cc60541b84898f01c1aa713a594f78d94a10238fca9af4597` for `modeling_smt.py`.
- [x] Before loading the weights, create an isolated CPython 3.11.11 conversion environment with
      direct pins `torch==2.6.0`, `transformers==5.3.0`, `safetensors==0.5.3`, `numpy==2.2.3`,
      `einops==0.8.1`, `gin-config==0.5.0`, `onnx==1.17.0`, and `onnxscript==0.2.2`. Use `uv` to
      generate a fully resolved hash-locked transitive manifest, record the Python/platform details,
      and commit that manifest as conversion provenance. Do not install the upstream `predict` extra
      or any Ultralytics package. If these exact pins cannot reconstruct and strictly load the
      pinned state dictionary, record `OMR_CANDIDATE_FAILED`; do not vary versions until something
      happens to load.
- [x] Build a local evaluation manifest that refers to private samples outside the repository and
      committed authored/public-domain samples inside it.
- [x] Establish ground truth for pitch, rhythm, chord symbols, key signature, meter, barlines,
      repeats, endings, and supported navigation.
- [x] On a development set that is permanently excluded from the release corpus, run a small
      feasibility probe to determine the model's required input unit (full system, fixed-height
      staff crop, measure window, overlap) and prevent the UI crop format from dictating model
      preprocessing.
- [x] Freeze a checksummed, versioned release corpus before running the complete-pipeline
      evaluation. It contains at least 20 in-profile pages from at least 10 musical works and five
      independent engraving/font sources, with no more than two pages per work: at least 10 direct
      scans and 10 camera photos; natural, sharp-key, and flat-key examples; every supported meter;
      simple, seventh, minor, and slash chords; and at least eight pages containing supported
      navigation. The camera half collectively includes rotation, perspective, uneven
      illumination/shadow, and moderate contrast loss. Freeze exact inclusion rules,
      source/provenance, work-level split, ground truth, and file hashes. No failing page may be
      removed or reclassified after results are viewed; a corpus correction requires a version bump
      and a complete fresh evaluation. Private paths remain outside Git.
- [x] Freeze these release gates before inspecting complete-pipeline corpus results: staff recall
      ≥99%; measure-boundary F1 ≥98%; note pitch+rhythm event error ≤5%; chord exact match ≥90%;
      navigation exact match ≥95%; 100% of duration-invalid measures flagged; 100% of in-profile
      pages produce a structured first draft and reach Play without mandatory note/chord entry;
      median review queue ≤3 measures/page, 95th percentile ≤6, maximum ≤8, and no page queues more
      than 20% of its measures; no review item requires re-entering an entire measure; cold WASM
      processing ≤90 seconds/page; and peak memory ≤512 MiB. Record the exact final first-use
      download bytes, but do not reject an otherwise viable recognizer because of an arbitrary size
      ceiling. Any changed accuracy, effort, performance, or memory gate requires a plan amendment
      and a fresh frozen evaluation—never post-hoc acceptance.
- [x] Evaluate unmodified JAZZMUS on the separate development set against representative printed
      single-staff class sheets. Record every release metric for diagnosis, but do not make the
      final release decision until the complete M7–M9 pipeline exists.
- [x] Measure staff-detection yield, pitch error, rhythm error, chord exact match, navigation exact
      match, invalid-measure rate, processing time, peak memory, artifact bytes, review-queue
      measures, and correction operations per page.
- [x] Export only the permitted JAZZMUS encoder, initial decoder, and cached decoder to ONNX. Build
      staff/system/measure detection with the approved OpenCV geometry path; never convert, load, or
      distribute the excluded YOLO detector.
- [x] Prove token-for-token parity between PyTorch and ONNX on a fixed authored corpus.
- [x] Quantize to INT8 and measure accuracy loss before accepting the smaller artifact.
- [x] Require quantized output to remain within 1 percentage point of reference note-event error and
      chord exact match; otherwise ship the reference artifact if its browser performance and memory
      gates pass, and disclose its measured download size.
- [x] Prove that all operators execute in `onnxruntime-web` WASM; treat WebGPU only as an optional
      acceleration.
- [x] Record browser versions, device CPU/RAM, artifact bytes, cold/warm runs, timeout rate, peak
      memory method, and preprocessing version. Mandatory representative hardware is a Google Pixel
      7 running stable Android Chrome and an iPhone 13 running stable iOS Safari at evaluation time.
      Single-thread WASM fallback is mandatory on both; SIMD, threads, and WebGPU are optional.
- [x] Produce a model manifest containing artifact URL, byte length, SHA-256, schema version,
      vocabulary/tokenizer version, preprocessing version and exact input-unit contract, expected
      dimensions, supported operators, license, attribution, and fixture/evaluation revision.
- [x] Keep Python conversion/evaluation tooling outside this Deno repository. Commit only the
      browser integration, reproducible manifests/provenance, and non-private parity evidence.
- [x] Stage release metadata for a project-owned GitHub Release using immutable versioned filenames,
      SHA-256 verification, an expected GitHub Pages fetch URL, and retention of every artifact
      referenced by a supported app version. Use a repository-ignored local HTTP origin for M7–M10
      integration tests. Do not upload before the frozen complete-pipeline gates and R4 pass.
- [x] Record `OMR_CANDIDATE_FEASIBLE` only if PyTorch/ONNX parity passes, the complete decoder
      executes in single-thread WASM on both named devices, and development-set cold time/memory
      stay within ≤90 seconds/page and ≤512 MiB. Record and disclose artifact size without a size
      rejection threshold. Otherwise record `OMR_CANDIDATE_FAILED`, preserve the evidence, and stop
      the photograph-recognition release; never substitute mandatory manual transcription as the
      completion condition.

**Exit criteria**

- [x] `OMR_CANDIDATE_FEASIBLE` exists with frozen evidence before Milestone 7 begins; this is not a
      release accuracy decision.
- [x] The exact upstream model weights and embedded vocabulary have an MIT redistribution basis; the
      non-accepted YOLO artifact and dataset are excluded. Converted artifacts must retain that
      provenance and the required notices.
- [x] Model files are versioned, checksummed, absent from Git, their exact download size is
      recorded, and they are available from a repository-ignored local HTTP origin for integration
      work.

### Milestone 7 — Browser OMR vertical slice

- [x] Add `onnxruntime-web` through `deno.json` only.
- [x] Implement a lazily created OMR Web Worker with typed request, progress, result, cancellation,
      timeout, and error contracts.
- [x] In production, download artifacts only after the user starts local recognition and confirms a
      first-use message stating the exact total size, that it is downloaded once and retained for
      offline reuse, and how to delete it. Show per-download progress and provide cancel, retry, and
      cache-management controls. During M7–M10, exercise the same loader against the
      repository-ignored local artifact origin selected in Milestone 6.
- [x] Verify manifest size and SHA-256 before opening an inference session.
- [x] Cache verified artifacts using a versioned runtime cache independent of the PWA precache.
- [x] Make model-adapter-owned preprocessing consume page geometry and declare resizing,
      normalization, crop context, overlap, concurrency, and stitching exactly as frozen in the
      approved manifest.
- [x] Implement the tokenizer and autoregressive decode loop with cached decoder state.
- [x] Retain token log probabilities and map them to measure-level confidence/issues.
- [x] Parse the supported Humdrum `**kern`/`**mxhm` subset directly into `ScoreDocument`; reject or
      flag unsupported tokens rather than guessing.
- [x] Stitch strips using barlines as re-synchronization points so one bad strip cannot shift the
      remainder of the page.
- [x] Add golden parity tests using stored model outputs, not live downloads, to keep default tests
      hermetic.
- [x] Add an explicit opt-in browser/model test command outside the default suite.
- [x] Resolve worker/WASM/model URLs under Vite's relative GitHub Pages base and smoke-test the
      planned production URL shape with the local artifact origin. Detect SIMD, threads/cross-origin
      isolation, and WebGPU independently; a single-thread WASM fallback is mandatory. Actual GitHub
      Release CORS/cache verification occurs after R4 publication.
- [x] Ensure failures preserve the source and offer retry/re-link/recovery without losing the
      import. A failed recognition may not be labeled playable or silently require transcription.

**Exit criteria**

- [x] A supported authored page becomes a `ScoreDocument` locally in a browser.
- [x] UI remains responsive and cancellation releases sessions and image memory.
- [x] Offline recognition works after the first successful artifact cache using the local artifact
      origin; production-host parity remains a final post-publication gate.

#### Review checkpoint 3 — OMR, privacy, security, and performance

- [x] Invoke the exact Section 5 reviewer contract after Milestone 7.
- [x] Ask it to inspect hostile image handling, OpenCV bounds, worker cancellation,
      object-URL/memory cleanup, source persistence/deletion/export, fixture provenance, and ensure
      manual note/chord entry is correction/recovery only.
- [x] Inspect model adapter/preprocessing fidelity, model integrity, planned GitHub Pages/Release
      asset resolution, capability fallbacks, cache invalidation, offline behavior, licensing
      notices, and graceful failure without false playable claims.
- [x] Resolve high/blocking findings and add adversarial tests.
- [x] Rerun the four mandatory checks plus the opt-in local model smoke test.
- [x] Record the review disposition.

### Milestone 8 — Local text/form recognition and confidence fusion

- [x] Add `tesseract.js@7.0.0` lazily with `tessdata_fast` English data pinned at revision
      `87416418657359cb625c412a48b6e1d6d41c29bd`; verify the 4,113,088-byte language artifact and
      SHA-256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`.
- [x] Add that exact OCR language file and its Apache-2.0 notice to the recognition-artifact
      manifest, local artifact origin, final GitHub Release set, displayed first-use byte total,
      integrity verification, versioned runtime cache, offline test, and user-facing cache deletion.
      Never let Tesseract fetch unmanifested language data from its default CDN.
- [x] OCR only bounded chord/section/direction regions; never run whole-page text OCR without a
      separately measured need.
- [x] Supplement JAZZMUS deterministically for v1 key signatures and meters absent from its
      vocabulary, using staff geometry plus bounded symbol/text recognition; cover 6/8 and every
      declared zero-to-six-sharp/flat profile case in authored tests.
- [x] Normalize OCR chord candidates through the existing deterministic chord parser.
- [x] Combine OMR, OCR, geometric, and validator evidence while preserving disagreements as separate
      issue evidence.
- [x] Auto-accept approved high-confidence agreements, use conservative source-backed guidance at
      medium confidence, and hide generated melody guidance at low confidence.
- [x] Add unresolved structural contradictions to the optional review queue.
- [x] Support editable section labels, repeat start/end, endings, Fine/Slut, D.C., D.S., Segno, and
      Coda.
- [x] Keep unfamiliar localized directions visible and require explicit mapping.
- [x] Do not add a cloud-recognition action in v1; all photograph recognition stays on-device.

**Exit criteria**

- [x] Chord/form uncertainty is visible and recoverable; operation is fully local.
- [x] Low-confidence output cannot masquerade as verified accordion guidance.

### Milestone 9 — Optional correction without pre-play friction

- [x] Default completed imports to `Start playing`, not `Review score`.
- [x] Show a resolvable source crop for uncertain assistance; otherwise show an explicit re-link
      action, never a broken crop.
- [x] Create a review queue containing only actionable recognition issues.
- [x] Provide compact operations for pitch, octave, duration, rest/note, accidental, tie, chord,
      barline, and navigation destination.
- [x] Let users hide a questionable recognition hint without editing notation.
- [x] Re-run validation, melody paths, harmony transitions, and routing incrementally after an edit.
- [x] Preserve user corrections and locked fingerings across schema migrations; never overwrite them
      automatically.
- [x] Preserve corrections/locks across rescans.
- [x] Add undo/redo for the active correction session.
- [x] Test skip-review, play, later single-item correction, and location restoration.

**Exit criteria**

- [x] The normal flow is import/photograph → play without manual transcription.
- [x] Correction is optional, scoped, reversible, and persistent.

### Milestone 10 — Integrated mobile hardening and release

- [ ] Freeze the complete M5–M9 pipeline version, then run it once against every page in the frozen
      release corpus without tuning, page removal, scope narrowing, or manual data entry. Publish a
      non-reconstructable result table containing every frozen metric and per-stratum summary.
- [ ] Require every frozen accuracy, correction-effort, cold-time, and memory gate to pass before
      R4. Otherwise record `OMR_CANDIDATE_FAILED` and stop the photograph release.
- [ ] Verify that photograph and digital-file imports enter the same preview, learn, and perform
      flows with no user-visible technical mode switch; verify local recognition, offline artifact
      reuse, and honest failure recovery.
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
- [ ] Document supported notation, known limitations, local-photo privacy, first-use model download,
      offline behavior, and accepted digital score file types without presenting separate playing
      modes.
- [ ] Run `deno task audit:ui` and perform exploratory Chromium checks on representative mobile and
      desktop sizes.
- [ ] Extend the UI audit with authored MusicXML and generated image scenarios. Add a separate
      opt-in real-browser score task for OSMD SVG, `ImageBitmap`, workers, WASM/base-path loading,
      Cache Storage, IndexedDB quota/deletion, and cancellation cleanup. Document its narrowly
      scoped permissions in `AGENTS.md`; keep it outside the hermetic default suite.
- [ ] In the opt-in real-browser task, send at least one authored in-profile photograph through the
      actual OpenCV and ONNX Runtime WASM pipeline, produce melody/rhythm/harmony/navigation in a
      `ScoreDocument`, enable Play without manual entry, and assert that the resulting current/next
      events reach both the authoritative FR-1XB CBA guidance and existing Stradella guidance.
- [ ] Run the mandatory quality gate in order.

#### Review checkpoint 4 — Final integrated code review

- [ ] Invoke the exact Section 5 reviewer contract.
- [ ] Ask it for severity-ordered findings across architecture, music correctness, reuse of existing
      engines, privacy, security, accessibility, mobile ergonomics, performance, tests, and
      maintenance.
- [ ] Resolve every blocking/high finding and document any accepted lower-risk finding.
- [ ] Confirm the Git diff contains no private score image, downloaded model, generated scan output,
      or unrelated user file.
- [ ] After R4 approval, publish the exact reviewed artifact bytes to the planned immutable
      project-owned GitHub Release URLs. Do not rebuild or replace them during publication.
- [ ] Rerun UI audit, focused local-recognition tests, and the four mandatory checks; commit and
      push the reviewed application and artifact manifest so the normal deployment publishes the
      exact release candidate.
- [ ] From the deployed GitHub Pages origin, verify CORS, byte length, SHA-256, first-use consent,
      cache reuse, offline recognition, cache invalidation, and deletion against the published
      artifacts on both named device/browser profiles.
- [ ] Record `PHOTO_RECOGNITION_RELEASE_READY` only after the frozen corpus gates, R4, and
      production-host verification all pass.
- [ ] Record the production verification evidence, rerun the four mandatory checks, and commit/push
      the final evidence update. Do not change reviewed runtime code in this evidence-only commit.

**Release exit criteria**

- [ ] A new user can choose a supported photograph or digital score file and reach Play without
      entering notes, chords, measures, or timing.
- [ ] Original photographed measures remain available during the import session and after reload
      only when the user opted into source persistence; missing assets produce a clear re-link flow.
- [ ] Harmony uses the existing Stradella/CBA enrichment path, not a duplicate implementation.
- [ ] CBA melody guidance is mathematically validated and automatically available for every
      recognized in-range melody event; the musician may choose to hide it.
- [ ] The experience is hands-free after count-in through tempo clock or pedal navigation.
- [ ] Photograph recognition never sends the source image to a cloud service.
- [ ] Classic lead-sheet behavior and all repository quality gates remain green.
- [ ] A supported photograph produces confidence-gated melody, harmony, and form guidance locally.
- [ ] The approved accuracy, correction-effort, time, and memory gates pass; the exact artifact
      download size is documented and shown before first use.
- [ ] Local photo recognition works offline after the authorized model assets are cached.
- [ ] Recognition failure preserves the import and source image but is clearly not labeled ready to
      play; retry and recovery remain possible.
- [ ] Existing manual timed-chord entry is not part of the normal import path and is never required
      to satisfy photograph recognition.

## 7. Required test strategy

### Hermetic default tests

- Pure score schema normalization and migrations.
- MusicXML support-matrix parsing using authored fixtures.
- Repeat/ending performance-route expansion.
- Harmony-event equivalence with existing lead-sheet enrichment.
- CBA melody solver tables and invariants over all chromatic keys.
- Absolute CBA layout anchors, ranges, duplicated rows, orientation, and out-of-range rejection for
  every supported instrument profile.
- Stradella transition/groove equivalence.
- Tempo maps, holds, pickups, transposition invariants, and bounded malformed routes.
- Source persistence/re-link/deletion/export behavior and hostile XML/MXL limits.
- OMR tokenizer/parser tests using stored synthetic token sequences.
- Confidence fusion and recognition-issue classification.
- Image-worker and inference-worker contracts with fake adapters.
- Storage/preference events and generated score/image component behavior.

### Opt-in local tests

- ONNX Runtime WASM/WebGPU parity.
- Model checksum/download/cache lifecycle.
- Representative local photograph evaluation using authorized inputs outside Git.
- Cold/warm inference time and peak memory.

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
- OSMD SVG range/crop alignment, relative-base worker/WASM URLs, single-thread WASM fallback,
  IndexedDB/Cache Storage lifecycle, cancellation, and memory release in real browsers.

## 8. Research references and provenance

- JAZZMUS model and limitations: <https://huggingface.co/JuanCarlosMartinezSevilla/jazzmus-model>
- JAZZMUS MIT source: <https://github.com/JuanCarlosMartinezSevilla/ISMIR-Jazzmus>
- KomaVision browser OMR pipeline and Apache-2.0 source:
  <https://github.com/EmreDikimen/Turkish_note_to_solfeggio_converter>
- ONNX Runtime Web: <https://github.com/microsoft/onnxruntime/tree/main/js/web>
- OpenCV.js: <https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html>
- Tesseract.js: <https://github.com/naptha/tesseract.js>
- Fast English OCR data: <https://github.com/tesseract-ocr/tessdata_fast>
- OpenSheetMusicDisplay: <https://github.com/opensheetmusicdisplay/opensheetmusicdisplay>
- OSMD incremental-render contract:
  <https://opensheetmusicdisplay.github.io/classdoc/interfaces/IRenderNextOptions.html>
- Ultralytics licensing (reason its detector is excluded): <https://www.ultralytics.com/license>
- GNU AGPL-3.0 terms: <https://www.ultralytics.com/legal/agpl-3-0-software-license>
- JAZZMUS dataset card (excluded from fixtures/training):
  <https://huggingface.co/datasets/PRAIG/JAZZMUS>
- CC-BY-NC 4.0 summary and legal-code link: <https://creativecommons.org/licenses/by-nc/4.0/>
- Official Gemini model list and stable `gemini-3.8-flash` identifier:
  <https://ai.google.dev/gemini-api/docs/models>

The versions and revisions named in Section 3 and Milestones 6–8 are locked decisions. Verify their
integrity against the recorded hashes when introduced; do not silently upgrade or replace them.
Security-driven upgrades require equivalent license/provenance checks and regression evidence, not a
new product decision. Research links are evidence for the plan, not permission to copy unrelated
code or data.

## 9. Explicit stop conditions

Stop the sequential implementation and request user direction if any of the following occurs:

- Browser WASM parity cannot be achieved without server execution.
- Representative pages require transcription-like correction effort.
- The implementation would require adding a Node `package.json` or weakening Deno permissions.
- The default test suite would require network access.
- The design requires duplicating or materially changing established Stradella/CBA behavior without
  a reviewed migration.
- Private or copyrighted source material would need to enter Git, CI, or a third-party service
  without explicit authorization.
- Neither approved read-only reviewer—`gpt-5.6-sol`/medium nor stable `gemini-3.8-flash`/high—can be
  started at a named checkpoint.
- The already selected artifact-publication path or benchmark-device prerequisite is technically
  unavailable after its documented alternatives have been exhausted.

If the selected model fails, preserve the source import and MusicXML functionality, record
`OMR_CANDIDATE_FAILED`, mark this plan blocked, and keep the photograph-recognition release blocked.
Do not start an unspecified replacement-model branch or relabel manual chord entry or source-image
display as a completed playable-photo feature.
