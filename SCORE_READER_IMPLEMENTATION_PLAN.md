# Score Reader and Accordion Guidance — Sequential Implementation Plan

**Status:** Execution in progress; M0–M2 and the first measure-aware playback slice are implemented\
**Execution model:** One primary coding agent working sequentially\
**Review model:** Four named checkpoints, each using one read-only `gpt-5.6-sol` (`medium`)
sub-agent\
**Primary outcome:** On the full OMR branch, a musician can photograph or import a printed
melody-and-chord score, press Play, and receive measure-aware CBA and Stradella guidance without
first operating a notation editor. The explicitly reduced no-OMR release is defined separately.

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

| Concern                        | Decision                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application shell              | Keep React 19, Vite 6, Tailwind 4, and Deno 2.                                                                                                       |
| Dependency declarations        | Add npm dependencies only through `deno.json`; never add `package.json`.                                                                             |
| Canonical application data     | Add a compact TypeScript `ScoreDocument`; retain sanitized MusicXML as the render source for MusicXML imports.                                       |
| Preferred input                | MusicXML/MXL when available; photographs are the fallback.                                                                                           |
| Score display                  | OpenSheetMusicDisplay (OSMD), SVG backend. Prove bounded excerpts in an early spike; otherwise crop a cached full render by system/measure geometry. |
| Photo preprocessing            | Lazy-loaded OpenCV.js in a worker; begin with geometric staff/barline slicing.                                                                       |
| OMR runtime                    | `onnxruntime-web`; WASM baseline and WebGPU acceleration where supported.                                                                            |
| Initial OMR candidate          | JAZZMUS melody-plus-chord model, subject to evaluation, license confirmation, ONNX export, and quantization gates.                                   |
| Browser architecture reference | KomaVision's Apache-2.0 page-slicing and encoder/decoder pattern; reuse only with notices and a recorded provenance review.                          |
| Local text OCR                 | Tesseract.js, limited to chord/header/navigation regions and loaded lazily.                                                                          |
| Recognition policy             | OMR supplies candidates; deterministic validators and confidence decide what may be shown.                                                           |
| Cloud policy                   | Existing Gemini endpoint is an optional recovery path requiring explicit user action.                                                                |
| Model distribution             | Do not commit weights. Publish versioned external artifacts only after explicit user authorization; check in metadata, never weights.                |
| Model caching                  | Cache on demand at runtime; exclude model weights from the Workbox precache.                                                                         |
| Source image privacy           | Hold the photo in memory during a scan. Persist only when the user explicitly requests it.                                                           |

### Candidate decision and release branches

This implementation plan evaluates one preselected candidate: JAZZMUS exported to ONNX. It does not
authorize an open-ended model search or a port of other projects. If JAZZMUS fails, record
`OMR_NO_GO`; evaluating a different candidate requires a separately user-approved plan revision.
Guided-photo mode remains the product fallback without melody recognition.

Milestone 6 must record exactly one branch:

- `OMR_GO`: complete Milestones 7–9 and the full-OMR release checklist.
- `OMR_NO_GO`: skip Milestone 7 and the OMR-only portions of Milestones 8–10. This is a reduced v1
  with MusicXML melody guidance and guided-photo image/chord guidance only. It must never claim
  photographed-score melody guidance or offline OMR. Treating this reduced scope as a releasable v1
  requires explicit user approval at the Milestone 6 decision gate.

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
- [ ] Spawn exactly one read-only reviewer only at each explicitly labeled review checkpoint.
- [ ] At every checkpoint use the exact spawn contract `model: "gpt-5.6-sol"`,
      `reasoning_effort: "medium"`, and `fork_turns: "none"`. Give it a self-contained prompt with
      the absolute repository/plan paths, applicable requirements, base/head commits or diff,
      relevant tests, and a request for severity-ordered findings. It must remain read-only.
- [ ] If that exact model/effort cannot be created, stop the checkpoint and request user direction;
      never silently substitute another reviewer.
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

| ID  | Status   | Commit  | Checks                                  | Review disposition                    | Notes                                                                                                                                                                                                                                                                                            |
| --- | -------- | ------- | --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0  | complete | 464cb54 | fmt/lint/test/build green               | N/A                                   | Baseline, provenance policy, authority record, and reuse inventory.                                                                                                                                                                                                                              |
| M1A | complete | 2c8e738 | fmt/lint/test/build green               | N/A                                   | Versioned contracts, rational timing, and validation.                                                                                                                                                                                                                                            |
| M1B | complete | fad8be5 | fmt/lint/test/build green               | N/A                                   | Songbook envelope, migrations, quarantine, and cleanup hooks.                                                                                                                                                                                                                                    |
| M1C | complete | af09031 | fmt/lint/test/build green               | N/A                                   | Route, tempo, transposition, and shared harmony adapter.                                                                                                                                                                                                                                         |
| M2A | complete | d4523e0 | fmt/lint/test/build green               | R1 corrective slice                   | Bounded MusicXML/MXL parser, strict source limits, and semantic tests.                                                                                                                                                                                                                           |
| M2B | complete | d4523e0 | fmt/lint/test/build green               | R1 corrective slice                   | Lazy OSMD SVG adapter; source-only strategy remains explicit pending spike evidence.                                                                                                                                                                                                             |
| M2C | complete | caca12a | fmt/lint/test/build green               | R1 corrective slice                   | Existing import modal accepts MusicXML/MXL and preserves atomic preview state.                                                                                                                                                                                                                   |
| R1  | complete | b700e1e | fmt/lint/test/build green (281 passing) | APPROVED                              | Corrective parser/domain validation, nested-repeat rejection, bounded validation, and last-playable guidance continuity reviewed and approved by the exact `gpt-5.6-sol`/medium reviewer.                                                                                                        |
| M3A | complete | 0643c7e | fmt/lint/test/build green (282 passing) | N/A                                   | Musical clock, repeat-aware route, pedal measure stepping, manual-hold boundaries, visual count-in, and bounded phrase-loop playback are implemented and unit-tested.                                                                                                                            |
| M3B | complete | 2b29ec5 | fmt/lint/test/build green (282 passing) | N/A                                   | Preview/learn/perform score cards show current/next measure context, key/meter/form/tempo metadata, and the existing LH/RH guidance without a second application shell.                                                                                                                          |
| M3C | complete | 2b29ec5 | fmt/lint/test/build green (282 passing) | N/A                                   | Score reader controls expose 44px touch targets, live count-in status, loop state, and accessible current-measure semantics; mobile audit passed all 42 assertions at 360–1024 px.                                                                                                               |
| M4A | complete | 186e134 | fmt/lint/test/build green (292 passing) | R2 APPROVED (score_cba_domain_review) | FR‑1XB C‑Griff Europe profile, absolute pitch anchor, finite 62-button bounds, candidate enumeration, validated solver specification/tests, and explicit 1‑2‑4/2‑3‑5 regression evidence are committed; user-authorized current app layout is the coordinate authority.                          |
| M4B | complete | 2e9dfd7 | fmt/lint/test/build green (299 passing) | N/A                                   | Deterministic CBA melody DP, hard diagnostics/locks/ties/resets, shared compact RH path map, and configurable assistance density are implemented without changing existing chord voice leading.                                                                                                  |
| M5A | active   | e4fb5f2 | fmt/lint/test/build green (305 passing) | N/A                                   | Conservative local photo preparation is implemented: camera/gallery validation, EXIF-aware bounded `ImageBitmap` decode, one-page geometry, cancellation, object-URL cleanup, and an in-memory ephemeral asset path. OpenCV worker/preprocessing remains pending authority and dependency gates. |
| M5B | complete | e4fb5f2 | fmt/lint/test/build green (305 passing) | N/A                                   | Manual page-boundary adjustment and mobile source-strip rendering use the versioned `ScorePhotoLayout`; no OMR crop/model assumptions are frozen.                                                                                                                                                |
| M5C | complete | e4fb5f2 | fmt/lint/test/build green (305 passing) | N/A                                   | Timed manual chord assignment (`Chord@beat`) is provenance-marked and reuses existing harmony guidance. Explicit opt-in persists the original image separately; ephemeral/missing-source behavior is visible.                                                                                    |

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
   compatibility layer and solver; `M4C`: shared melody presentation.
6. `M5A`: bounded local photo decode and conservative page geometry (worker/OpenCV follow-up);
   `M5B`: measure crop/boundary UI; `M5C`: manual timed chord assignment and source lifecycle.
7. `M6A`: authority, model-input probe, frozen corpus and gates; `M6B`: reference/export/parity and
   browser benchmarks; `M6C`: recorded branch decision. On `OMR_NO_GO`, run combined photo/OMR
   review `R3` here.
8. On `OMR_GO`: `M7A` artifact/runtime loader, `M7B` model adapter/decode/parser, `M7C`
   cache/offline/failure UI and browser tests; then `R3`. On `OMR_NO_GO`, record skipped rows and go
   to the reduced portions of M8–M10.
9. `M8A`: bounded OCR if evidence requires it; `M8B`: confidence/form fusion; `M8C`: explicit cloud
   assist. Skip OMR-only slices on `OMR_NO_GO`.
10. `M9A`: issue queue and incremental recomputation; `M9B`: correction/locking/undo persistence.
    Skip recognition-derived review on `OMR_NO_GO`.
11. `M10A`: integration/accessibility/storage hardening; `M10B`: docs and branch-specific release
    evidence; then `R4`, corrective slices, and final gate.

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
      artifact licensing, artifact host/CORS/retention, external publication, and whether
      `OMR_NO_GO` is an acceptable v1.
- [x] Before M4A, obtain user approval for every supported `CbaKeyboardLayout`: display name, row
      and button counts, physical bounds, lowest/highest sounding pitch, reference coordinate and
      pitch, orientation, and authoritative source. If none is approved, v1 may use only an
      explicitly labeled abstract layout and must not claim instrument-specific reachability.
- [x] Record notices/provenance requirements for OSMD, the ZIP/XML parser, OpenCV.js, Tesseract.js,
      ONNX Runtime Web, KomaVision-derived logic, and every model artifact.

The primary agent may evaluate and recommend, but may not infer legal approval, upload/publish model
artifacts, acquire credentials, or choose a materially reduced product scope. Missing approval stops
at the relevant decision gate; it does not block earlier local work that is independent of it.

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
- [x] If no OSMD strategy meets public-API stability, measure mapping, bounded work, and mobile
      performance gates, stop for user direction. Authorized choices requiring explicit approval are
      sanitized full-score OSMD display or a separately scoped minimal notation renderer; photo
      inputs may continue to use source-image crops.
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

### Milestone 5 — Guided photograph mode without full OMR

The first deliverable is intentionally a conservative, useful no-OMR slice. It keeps the selected
page as visual ground truth, creates one bounded full-page strip, and lets the musician enter timed
chords. Automatic staff/barline slicing and any melody claim remain pending until the dependency,
model, and authority gates in Milestone 6 are satisfied.

- [x] Add camera/gallery input with existing MIME and size protections.
- [x] Decode into an `ImageBitmap` and normalize EXIF orientation where required.
- [ ] Lazy-load OpenCV.js and keep its work outside initial application startup.
- [ ] Move expensive preprocessing into a dedicated worker or bounded worker pipeline.
- [ ] Implement conservative grayscale, illumination normalization, page boundary detection,
      perspective correction, deskew, staff grouping, and barline detection.
- [x] Produce model-independent page/system/staff/measure geometry as a conservative full-page
      measure strip. Do not freeze OMR crop size, overlap, normalization, or stitching here; those
      belong to the selected model adapter.
- [x] Provide a manual boundary adjustment only when automatic slicing is visibly wrong.
- [x] Add a measure-level manual chord-assignment flow with beat offset/provenance. Do not treat the
      current scan API's unique `string[]` chord list as timed harmony; it remains chord lookup only
      unless its contract is deliberately extended and tested.
- [x] Allow immediate guided-photo playing using the original page strip plus assigned chords.
- [x] Do not require melody recognition or score correction to use this mode.
- [x] Revoke object URLs, release decoded bitmaps, support cancellation, and cap decoded dimensions
      to prevent memory exhaustion.
- [x] Keep the original photo blob ephemeral by default. On opt-in, persist it under a stable asset
      ID. Test missing/evicted assets, re-linking, export, song deletion, and derived-cache
      deletion; never promise an original crop after reload if the source was not retained.
- [ ] Test skew, perspective, shadows, faint staff lines, missing page edges, rotation,
      cancellation, and memory cleanup using generated/licensed fixtures.

**Exit criteria**

- [x] A user can photograph a page and play from a mobile-sized original page strip with manually
      assigned timed chords.
- [x] The flow remains valuable even when no OMR model is installed.
- [x] Source-image privacy behavior is explicit and lifecycle-tested for in-session ephemeral
      storage, explicit opt-in assets, missing-source messaging/re-linking, export references, song
      deletion, and derived-cache deletion.

### Milestone 6 — OMR model evaluation and browser feasibility gate

Do not integrate a production model until this milestone passes. Conduct model conversion tooling
outside the application runtime; generated weights must remain outside Git.

- [ ] Confirm in writing the redistribution and usage license for the exact model weights,
      vocabulary, tokenizer, and required preprocessing—not only the source repository.
- [ ] Build a local evaluation manifest that refers to private samples outside the repository and
      committed authored/public-domain samples inside it.
- [ ] Establish ground truth for pitch, rhythm, chord symbols, key signature, meter, barlines,
      repeats, endings, and supported navigation.
- [ ] Before the frozen final evaluation, run a small feasibility probe to determine each candidate
      model's required input unit (full system, fixed-height staff crop, measure window, overlap)
      and prevent the UI crop format from dictating model preprocessing.
- [ ] Freeze a versioned corpus split by musical work—not page—with at least 20 target pages (at
      least 10 scans and 10 camera photos) and no final-set tuning. Private paths remain outside
      Git.
- [ ] Before inspecting final-corpus results, obtain user approval for the corpus/profile and these
      default gates: staff recall ≥99%, measure-boundary F1 ≥98%, note pitch+rhythm event error ≤5%,
      chord exact match ≥90%, navigation exact match ≥95%, 100% of duration-invalid measures
      flagged, median review queue ≤5 measures/page, cold WASM processing ≤90 seconds/page, and peak
      memory ≤512 MiB on the named representative device. Any changed gate requires approval and a
      fresh frozen evaluation—not post-hoc acceptance.
- [ ] Evaluate unmodified JAZZMUS against representative printed single-staff class sheets.
- [ ] Run homr only as a local comparison baseline; do not copy its AGPL implementation into this
      project during evaluation.
- [ ] Measure staff-detection yield, pitch error, rhythm error, chord exact match, navigation exact
      match, invalid-measure rate, processing time, peak memory, and corrections per page.
- [ ] Export the JAZZMUS encoder, initial decoder, cached decoder, and optional staff detector to
      ONNX.
- [ ] Prove token-for-token parity between PyTorch and ONNX on a fixed authored corpus.
- [ ] Quantize to INT8 and measure accuracy loss before accepting the smaller artifact.
- [ ] Require quantized output to remain within 1 percentage point of reference note-event error and
      chord exact match; otherwise ship the reference artifact only if its size/performance gates
      pass.
- [ ] Prove that all operators execute in `onnxruntime-web` WASM; treat WebGPU only as an optional
      acceleration.
- [ ] Record browser versions, device CPU/RAM, artifact bytes, cold/warm runs, timeout rate, peak
      memory method, and preprocessing version. Mandatory baseline: single-thread SIMD/non-SIMD WASM
      feature fallback on current Android Chromium and iPhone Safari; threads and WebGPU are
      optional.
- [ ] Produce a model manifest containing artifact URL, byte length, SHA-256, schema version,
      vocabulary/tokenizer version, preprocessing version and exact input-unit contract, expected
      dimensions, supported operators, license, attribution, and fixture/evaluation revision.
- [ ] Keep Python conversion/evaluation tooling outside this Deno repository. Commit only the
      browser integration, reproducible manifests/provenance, and non-private parity evidence.
- [ ] Do not publish/upload artifacts until the user approves the exact host, CORS/cache/retention
      policy, license record, and upload action.
- [ ] Record exactly `OMR_GO` if every approved gate passes, otherwise `OMR_NO_GO`. On no-go,
      request user approval before treating the reduced release as v1.

**Exit criteria**

- [ ] A user-approved `OMR_GO` or `OMR_NO_GO` branch decision exists with the frozen evidence.
- [ ] On `OMR_GO`, model files are externally authorized, versioned, checksummed, and absent from
      Git.
- [ ] On `OMR_NO_GO`, no OMR production dependency or claim remains reachable.

### Milestone 7 — Browser OMR vertical slice

- [ ] Add `onnxruntime-web` through `deno.json` only.
- [ ] Implement a lazily created OMR Web Worker with typed request, progress, result, cancellation,
      timeout, and error contracts.
- [ ] Download artifacts only after the user starts local recognition and confirms any large first-
      use download.
- [ ] Verify manifest size and SHA-256 before opening an inference session.
- [ ] Cache verified artifacts using a versioned runtime cache independent of the PWA precache.
- [ ] Make model-adapter-owned preprocessing consume page geometry and declare resizing,
      normalization, crop context, overlap, concurrency, and stitching exactly as frozen in the
      approved manifest.
- [ ] Implement the tokenizer and autoregressive decode loop with cached decoder state.
- [ ] Retain token log probabilities and map them to measure-level confidence/issues.
- [ ] Parse the supported Humdrum `**kern`/`**mxhm` subset directly into `ScoreDocument`; reject or
      flag unsupported tokens rather than guessing.
- [ ] Stitch strips using barlines as re-synchronization points so one bad strip cannot shift the
      remainder of the page.
- [ ] Add golden parity tests using stored model outputs, not live downloads, to keep default tests
      hermetic.
- [ ] Add an explicit opt-in browser/model test command outside the default suite.
- [ ] Resolve worker/WASM URLs under Vite's relative GitHub Pages base and smoke-test the deployed
      base-path shape. Detect SIMD, threads/cross-origin isolation, and WebGPU independently; a
      single-thread WASM fallback is mandatory.
- [ ] Ensure failures fall back to guided-photo mode rather than losing the import.

**Exit criteria**

- [ ] A supported authored page becomes a `ScoreDocument` locally in a browser.
- [ ] UI remains responsive and cancellation releases sessions and image memory.
- [ ] Offline recognition works after the first successful artifact cache.

#### Review checkpoint 3 — OMR, privacy, security, and performance

- [ ] On `OMR_GO`, invoke the exact Section 5 reviewer contract after Milestone 7. On `OMR_NO_GO`,
      invoke it immediately after the Milestone 6 branch decision; this remains one checkpoint, not
      two reviews.
- [ ] On both branches, ask it to inspect hostile image handling, OpenCV bounds, worker
      cancellation, object-URL/memory cleanup, source persistence/deletion/export, fixture
      provenance, and manual chord assignment.
- [ ] On `OMR_GO`, additionally inspect model adapter/preprocessing fidelity, model integrity,
      GitHub Pages asset resolution, capability fallbacks, cache invalidation, offline behavior,
      licensing notices, and graceful fallback.
- [ ] On `OMR_NO_GO`, additionally verify that OMR dependencies and product claims remain absent and
      that guided-photo fallback behavior is complete.
- [ ] Resolve high/blocking findings and add adversarial tests.
- [ ] Rerun the four mandatory checks plus the opt-in local model smoke test.
- [ ] Record the review disposition.

### Milestone 8 — Local text/form recognition and confidence fusion

`[BOTH]` means both release branches. The reduced branch deliberately has no local OCR in v1; chords
and form remain manual or explicitly cloud-assisted.

- [ ] `[OMR_GO]` Add Tesseract.js lazily only if frozen evidence shows JAZZMUS chord/form
      recognition is insufficient.
- [ ] `[OMR_GO]` OCR only bounded chord/section/direction regions; never run whole-page text OCR
      without a separately measured need.
- [ ] `[OMR_GO]` Normalize OCR chord candidates through the existing deterministic chord parser.
- [ ] `[OMR_GO]` Combine OMR, OCR, geometric, and validator evidence while preserving disagreements
      as separate issue evidence.
- [ ] `[OMR_GO]` Auto-accept approved high-confidence agreements, use conservative source-backed
      guidance at medium confidence, and hide generated melody guidance at low confidence.
- [ ] `[OMR_GO]` Add unresolved structural contradictions to the optional review queue.
- [ ] `[BOTH]` Support editable section labels, repeat start/end, endings, Fine/Slut, D.C., D.S.,
      Segno, and Coda.
- [ ] `[BOTH]` Keep unfamiliar localized directions visible and require explicit mapping.
- [ ] `[BOTH]` Make Gemini an optional `Assist this scan` action with notice that the image leaves
      the device; never invoke it automatically.
- [ ] `[BOTH]` Keep Gemini as chord lookup unless a separately reviewed server contract adds
      per-measure/beat boxes, confidence, form, and provenance. A unique `string[]` cannot become
      timed score harmony.

**Exit criteria**

- [ ] `[BOTH]` Chord/form uncertainty is visible and recoverable; fully local operation is default.
- [ ] `[OMR_GO]` Low-confidence output cannot masquerade as verified accordion guidance.
- [ ] `[OMR_NO_GO]` No local-OCR or recognized-melody claim/control is present.

### Milestone 9 — Optional correction without pre-play friction

On `OMR_NO_GO`, only user-entered chords/form and persisted MusicXML are editable.

- [ ] `[BOTH]` Default completed imports to `Start playing`, not `Review score`.
- [ ] `[BOTH]` Show a resolvable source crop for uncertain assistance; otherwise show an explicit
      re-link action, never a broken crop.
- [ ] `[OMR_GO]` Create a review queue containing only actionable recognition issues.
- [ ] `[BOTH]` Provide compact operations for pitch, octave, duration, rest/note, accidental, tie,
      chord, barline, and navigation destination, limited to data available on the active branch.
- [ ] `[OMR_GO]` Let users hide a questionable recognition hint without editing notation.
- [ ] `[BOTH]` Re-run validation, melody paths, harmony transitions, and routing incrementally after
      an edit.
- [ ] `[BOTH]` Preserve user corrections and locked fingerings across schema migrations; never
      overwrite them automatically.
- [ ] `[OMR_GO]` Preserve corrections/locks across rescans.
- [ ] `[BOTH]` Add undo/redo for the active correction session.
- [ ] `[BOTH]` Test skip-review, play, later single-item correction, and location restoration.

**Exit criteria**

- [ ] `[BOTH]` The normal flow is import/photograph → play.
- [ ] `[BOTH]` Correction is optional, scoped, reversible, and persistent.

### Milestone 10 — Integrated mobile hardening and release

- [ ] Verify preview, learn, and perform flows for MusicXML and guided photo on both branches;
      verify local OMR, offline artifact reuse, and OMR failure fallback only on `OMR_GO`.
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
- [ ] Extend the UI audit with authored MusicXML and generated image scenarios. Add a separate
      opt-in real-browser score task for OSMD SVG, `ImageBitmap`, workers, WASM/base-path loading,
      Cache Storage, IndexedDB quota/deletion, and cancellation cleanup. Document its narrowly
      scoped permissions in `AGENTS.md`; keep it outside the hermetic default suite.
- [ ] Run the mandatory quality gate in order.

#### Review checkpoint 4 — Final integrated code review

- [ ] Invoke the exact Section 5 reviewer contract.
- [ ] Ask it for severity-ordered findings across architecture, music correctness, reuse of existing
      engines, privacy, security, accessibility, mobile ergonomics, performance, tests, and
      maintenance.
- [ ] Resolve every blocking/high finding and document any accepted lower-risk finding.
- [ ] Rerun UI audit, focused OMR smoke tests, and the four mandatory checks.
- [ ] Confirm the Git diff contains no private score image, downloaded model, generated scan output,
      or unrelated user file.
- [ ] Commit atomically and push to `origin/master`.

**Shared release exit criteria**

- [ ] A new user can import MusicXML or photograph a supported page and reach Play without mandatory
      editing.
- [ ] Original photographed measures remain available during the import session and after reload
      only when the user opted into source persistence; missing assets produce a clear re-link flow.
- [ ] Harmony uses the existing Stradella/CBA enrichment path, not a duplicate implementation.
- [ ] CBA melody guidance is mathematically validated and optional.
- [ ] The experience is hands-free after count-in through tempo clock or pedal navigation.
- [ ] Cloud processing occurs only after explicit user action.
- [ ] Classic lead-sheet behavior and all repository quality gates remain green.

**Additional `OMR_GO` release criteria**

- [ ] A supported photograph produces confidence-gated melody, harmony, and form guidance locally.
- [ ] The approved accuracy, correction-effort, time, artifact-size, and memory gates pass.
- [ ] Local photo recognition works offline after the authorized model assets are cached.
- [ ] Recognition failure always preserves guided-photo mode and never loses the import.

**Additional user-approved `OMR_NO_GO` release criteria**

- [ ] MusicXML provides melody, harmony, route, and CBA/Stradella guidance offline.
- [ ] Guided-photo mode provides mobile source crops and manually assigned/scanned chord guidance.
- [ ] UI, documentation, and tests make no photographed-melody-recognition or offline-OMR claim.
- [ ] OMR-only dependencies, controls, caches, and release tests are skipped or unreachable.

## 7. Required test strategy

### Hermetic default tests

- `[BOTH]` Pure score schema normalization and migrations.
- `[BOTH]` MusicXML support-matrix parsing using authored fixtures.
- `[BOTH]` Repeat/ending performance-route expansion.
- `[BOTH]` Harmony-event equivalence with existing lead-sheet enrichment.
- `[BOTH]` CBA melody solver tables and invariants over all chromatic keys.
- `[BOTH]` Absolute CBA layout anchors, ranges, duplicated rows, orientation, and out-of-range
  rejection for every supported instrument profile.
- `[BOTH]` Stradella transition/groove equivalence.
- `[BOTH]` Tempo maps, holds, pickups, transposition invariants, and bounded malformed routes.
- `[BOTH]` Source persistence/re-link/deletion/export behavior and hostile XML/MXL limits.
- `[OMR_GO]` OMR tokenizer/parser tests using stored synthetic token sequences.
- `[OMR_GO]` Confidence fusion and recognition-issue classification.
- `[BOTH]` Image-worker contracts; `[OMR_GO]` inference-worker contracts with fake adapters.
- `[BOTH]` Storage/preference events and generated score/image component behavior.

### Opt-in local tests

- `[OMR_GO]` ONNX Runtime WASM/WebGPU parity.
- `[OMR_GO]` Model checksum/download/cache lifecycle.
- `[OMR_GO]` Representative private photo evaluation.
- `[OMR_GO]` Cold/warm inference time and peak memory.
- `[BOTH]` Live optional Gemini fallback.

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
- OpenSheetMusicDisplay: <https://github.com/opensheetmusicdisplay/opensheetmusicdisplay>
- OSMD incremental-render contract:
  <https://opensheetmusicdisplay.github.io/classdoc/interfaces/IRenderNextOptions.html>
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
- The exact `gpt-5.6-sol`/medium read-only reviewer cannot be spawned at a named checkpoint.
- A required legal, artifact-publication, credential, benchmark-device, numeric-gate, or reduced-v1
  decision lacks its named user's approval.

In a model no-go, preserve the delivered MusicXML and guided-photo experience and treat automatic
melody recognition as deferred research rather than blocking the useful product.
