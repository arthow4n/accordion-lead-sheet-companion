# Score reader decision and authority log

This records the product and authority choices an implementation agent must not silently change.
There are no pending product, license, size-policy, hosting, privacy, keyboard, or model-selection
choices for the planned v1 path. Unfinished checklist items require implementation evidence, not a
new user decision. The owner is the user/project owner unless changed explicitly.

| Decision                            | Owner              | Status   | Required evidence or approval                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported CBA keyboard profiles     | User/project owner | approved | FR-1XB target and the existing app CBA grid are authoritative. Approved profile is `roland-fr-1xb-c-griff-europe-v1`: 5 rows with bounds 4..15, 3..15, 3..14, 3..15, 3..14 (62 buttons), row 1/column 5 = C4/MIDI 60, F#3–G6 (MIDI 54–91), rows 4/5 duplicate rows 1/2, right-hand outer-to-inner rows and low-to-high columns. Sources: Roland FR-1XB support/specifications and FR-1x owner manual pp. 49–50; project reference MIDI range G3–G6.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Fixture and private-data provenance | User/project owner | approved | The implementation agent may commit authored synthetic or clearly licensed/public-domain fixtures with complete manifest entries. Private or copyright-uncertain sheets, including the supplied class photograph, remain outside Git, CI, logs, screenshots, third-party services, and agent work directories. Authorized local evaluation inputs may be referenced only from paths outside the repository.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Dependency licenses and notices     | User/project owner | approved | Retain OSMD 2.1.2 (BSD-3-Clause), fflate 0.8.3 (MIT), and @xmldom/xmldom 0.9.12 (MIT). Add only `@techstark/opencv-js@5.0.0-release.1` (Apache-2.0; npm integrity `sha512-PIm+eB0MFtieXoNC2GRao0dv/02sehG+Nv2nSW5D6pQm6J/4WqvDHm0RyoqOmGYQm67jdGiaOdIeTShCY3PIUg==`), `onnxruntime-web@1.29.0` (MIT; `sha512-LuQlpX6MFLJZu756erwUeb1mNfoJGbs1kzDwJGNlf5RvfYMdqhcY3vNpDPK40CUV2HoWTkIj+uS0o36GFHjeYw==`), and `tesseract.js@7.0.0` (Apache-2.0; `sha512-exPBkd+z+wM1BuMkx/Bjv43OeLBxhL5kKWsz/9JY+DXcXdiBjiAch0V49QR3oAJqCaL5qURE0vx9Eo+G5YE7mA==`) through `deno.json`. Preserve notices and let `deno.lock` verify resolved dependency integrity.                                                                                                                                                                                                          |
| User-facing score experience        | User/project owner | approved | Provide one Score Reader. Photograph and digital-file selection are input choices, not persistent modes. Normal UI uses musical language and reveals controls based on available structured data; OMR/ONNX/internal schema terms remain out of the playing workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Photograph release requirement      | User/project owner | approved | A supported photograph must automatically produce a structured first draft containing melody, rhythm, harmony, measure timing, and supported navigation, then feed the existing FR-1XB/Stradella guidance. Manual note/chord transcription is correction/recovery only and cannot satisfy release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Supported v1 photograph profile     | User/project owner | approved | Machine-printed, single-treble-staff, predominantly monophonic lead sheets matching the exact profile in Section 2 of the plan: FR-1XB-range melody; zero through six sharps/flats; 2/4, 3/4, 4/4, or 6/8; pickups; whole through sixteenth notes/rests, dots, ties, common accidentals; chords supported by the existing parser; listed repeat/navigation marks; and a complete unobscured page at least 1,200 px on its longer edge with up to 15 degrees rotation plus normal perspective, shadow, and contrast loss. An in-profile recognition failure may not be reclassified as unsupported.                                                                                                                                                                                                                                                         |
| OMR candidate and redistribution    | User/project owner | approved | Use only JAZZMUS revision `b38466e738548cf4d3826a0426d709a711533618` under the repository's explicit MIT license: `model.safetensors` is 64,547,148 bytes with SHA-256 `34588e1c6459517fdda3df24d06b3d9915fdd432d97e6ae4a01aac66097d8f3c`; `config.json` is 6,138 bytes with SHA-256 `935aee22d3326bd84dfc67d3f76d13d4ef34d04755e04d6efdd7d531f416d320` and contains the vocabulary. Reconstruct it only with MIT source commit `643b49cf4772a58027e8f2cf924f2be637b31fc4` and the exact conversion environment in the plan. Never use, convert, or distribute `yolo_staff_detector.pt` or Ultralytics code because their default AGPL-3.0 terms are excluded; OpenCV geometry replaces that detector. Do not access or reuse the gated CC-BY-NC-4.0 JAZZMUS dataset. Failure blocks this plan; there is no unspecified replacement or manual-only branch. |
| Benchmark device/profile            | User/project owner | approved | Mandatory OMR targets are Google Pixel 7 with stable Android Chrome and iPhone 13 with stable iOS Safari at evaluation time. Record exact OS/browser, CPU/RAM, artifact size, cold/warm timing, timeout rate, and memory method. Single-thread WASM must work on both; acceleration is optional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| OMR corpus and numeric gates        | User/project owner | approved | Freeze the exact v1 profile and a checksummed corpus of at least 20 in-profile pages, 10 works, and 5 engraving sources before complete-pipeline evaluation, balanced across scans/camera conditions, key classes, supported meters/chords, and navigation. Gates: staff recall ≥99%; measure F1 ≥98%; note pitch+rhythm error ≤5%; chord exact ≥90%; navigation exact ≥95%; every invalid duration flagged; every page produces a draft and reaches Play without mandatory entry; review queue median ≤3 measures, p95 ≤6, max ≤8 and ≤20% of any page; cold WASM ≤90 seconds/page; peak memory ≤512 MiB. Size is not a failure gate: record the exact final bytes and disclose them before download. No post-result exclusions or scope narrowing.                                                                                                       |
| First-use download experience       | User/project owner | approved | Known upstream assets are 64,553,286 bytes (about 61.6 MiB) for JAZZMUS weights plus config, or 68,666,374 bytes (about 65.5 MiB) including the pinned English OCR data, before ONNX conversion and browser-runtime packaging. The UI must use the final manifest total, say it downloads once and is retained for offline reuse, and offer Download, Not now/cancel, progress, retry, and deletion from storage. No arbitrary maximum is imposed.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Copyleft and non-commercial inputs  | User/project owner | rejected | Keep this repository MIT. Do not integrate or evaluate AGPL code/weights (including Ultralytics YOLO and Homr), and do not access, train on, redistribute, or add CC-BY-NC data to the recognizer or benchmark. AGPL allows commercial use but would impose source/license obligations on the covered combined application; expected non-commercial operation does not remove them. CC-BY-NC would restrict downstream commercial reuse and is unnecessary for inference with the separately MIT-licensed JAZZMUS model. OpenCV staff geometry plus authored/permissively licensed fixtures remain the approved path.                                                                                                                                                                                                                                      |
| Review checkpoint model             | User/project owner | approved | Run exactly one read-only reviewer per named checkpoint. Prefer `gpt-5.6-sol` at medium reasoning when available; otherwise use official stable `gemini-3.8-flash` at high reasoning/thinking. Give either model the same self-contained evidence and severity-ordered review request, record the actual backend and reasoning level, and never run both merely because both are available. Stop only if neither approved reviewer is available.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Artifact host/CORS/retention        | User/project owner | approved | M7–M10 use a repository-ignored local HTTP artifact origin. After the frozen complete-pipeline gates and R4 pass, publication of the exact reviewed, immutable, checksummed artifacts to project-owned GitHub Releases is already authorized; no later approval checkpoint is required. Then deploy and verify fetch/cache/offline behavior from GitHub Pages on both named devices. Retain every artifact referenced by a supported app version and never replace a versioned file. Weights remain outside Git history and Workbox precache.                                                                                                                                                                                                                                                                                                              |
| Reduced manual-photo release        | User/project owner | rejected | There is no `OMR_NO_GO` release branch. MusicXML support and the existing image/manual-chord scaffold may remain, but they do not complete the photographed-score requirement and must not be presented as automatic or fully playable photo import.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cloud score recognition             | User/project owner | rejected | Do not add cloud score-photo recognition in v1. Source images and recognition remain on-device; existing unrelated import behavior is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| OSMD fallback                       | User/project owner | approved | Use bounded one- or two-measure OSMD excerpts only. Reject full-score rendering as a fallback. On excerpt failure, preserve parsed measure data, report the issue clearly, and never invent notation or guidance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

The implementation agent may fill `evidence` in commit notes and change `status` only when the owner
has supplied approval in the project conversation or an explicitly recorded project decision.

## Automatic-recognition plan review

On 2026-09-14, one read-only `gpt-5.6-sol` reviewer at medium reasoning effort reviewed the full
plan and decision log against the user's photograph-to-playable requirement. Its first pass found
and the primary agent resolved seven material issues: a pre-Play correction loophole, premature
navigation gating, an artifact-publication/review cycle, an under-specified supported profile and
corpus, a missing real-browser end-to-end test, a missing artifact-size limit, and stale
slice/branch instructions. The same reviewer then re-read the corrected documents and returned
**Approved** with no remaining high- or medium-severity findings. This was a plan review only; no
feature code or model artifact was changed or published.

On 2026-09-14, the project owner replaced the reviewer's earlier fixed-size limit with the approved
first-use disclosure policy above. A primary-agent evidence sweep then locked the exact dependency
versions, JAZZMUS weights and source revisions and hashes, conversion-environment pins, OCR-data
revision and hash, excluded the AGPL Ultralytics detector, and made bounded OCR mandatory. These are
resolved implementation inputs, not deferred choices.

A subsequent read-only `gpt-5.6-sol` reviewer at medium reasoning effort found four gaps: an
unspecified replacement-model branch, stale size-gate wording, an unpinned model-implementation and
conversion environment, and incomplete OCR-artifact lifecycle coverage. The plan now blocks on a
failed JAZZMUS candidate, contains no size ceiling, pins the source/conversion inputs, and routes
OCR data through the same manifest, hosting, cache, offline, size-disclosure, and deletion
lifecycle. Because that reviewer's confirmation attempt hit a service usage limit, a fresh read-only
`gpt-5.6-sol` reviewer at medium reasoning effort performed the final re-read and returned
**Approved** with no high- or medium-severity findings.

## CBA profile research record

- [Roland FR-1XB support/specifications](https://www.roland.com/global/products/fr-1xb/support/): 62
  velocity-sensitive right-hand buttons and C-Griff Europe as a selectable treble mode.
- [Roland FR-1x owner manual](https://cdn.roland.com/assets/media/pdf/FR-1x_e02_W.pdf), pp. 49–50:
  the C-Griff Europe diagram labels the finite treble buttons with octave and MIDI assignments.
- [Reference MIDI practice project](https://github.com/arthow4n/accordion-fingering-practice-midi):
  treble input is assigned to MIDI channel 1 and the exercise range is G3–G6.
- In-app authority: `src/lib/cba/grid.ts` remains unchanged for pitch-class lookup and row
  staggering; the physical profile adapts it with an absolute octave anchor and finite row bounds.

## Photograph-source foundation record

- The first photograph slice is deliberately no-OMR and local-only: a bounded `ImageBitmap` is
  decoded with EXIF-aware orientation, then represented by a conservative full-page geometry strip.
  This keeps the original page as visual ground truth while avoiding guessed melody notes.
- Users may adjust the page boundary and enter timed chord labels using `Chord@beat` tokens (for
  example, `C@0, G@2, Em@3`). These harmonies are marked `photo-manual` and flow through the same
  Stradella/CBA guidance used by MusicXML and classic lead sheets. This is correction/recovery
  scaffolding only; normal photograph import must not require it.
- A source image is ephemeral by default. During the current tab it is held in memory only; an
  explicit “Keep the original photo” choice stores it as a separate IndexedDB asset. Songbook JSON
  exports contain only the reference, never image bytes. Missing ephemeral assets after reload are
  reported clearly and do not invalidate the saved timed chord guidance.
- Automatic staff/measure slicing, OpenCV preprocessing, OMR, and model artifact integration remain
  unfinished Milestones 5–7 under the approved decisions above. Photograph import is not
  release-complete until automatic recognition feeds the existing accordion guidance without
  transcription.

## Milestone 6 — OMR feasibility gate record

- **Status:** `OMR_CANDIDATE_FEASIBLE`
- **Model Candidate:** Upstream MIT JAZZMUS SMT model (revision
  `b38466e738548cf4d3826a0426d709a711533618`).
- **Implementation Source:** ISMIR-Jazzmus commit `643b49cf4772a58027e8f2cf924f2be637b31fc4`
  (`configuration_smt.py` sha256 `a864f654...`, `modeling_smt.py` sha256 `3c5e414a...`).
- **Ultralytics / YOLO Exclusion:** YOLO staff detector and CC-BY-NC dataset strictly excluded.
  Preprocessing is 100% deterministic OpenCV WASM geometry (`photoPreprocessing.ts`).
- **Conversion Environment:** Isolated CPython 3.11.11 venv with pins `torch==2.6.0`,
  `transformers==5.3.0`, `safetensors==0.5.3`, `numpy==2.2.3`, `einops==0.8.1`, `gin-config==0.5.0`,
  `onnx==1.17.0`, `onnxscript==0.2.2`. Full transitive hash lock committed as
  `docs/score-reader/conversion-provenance.txt`.
- **Model Weights Reconstruction:** State dict loaded with zero missing or unexpected keys using
  embedding layer shape adaptation (`embed_size = 20578`, `out_size = 153`,
  `Conv1d(config.d_model, out_size, 1)`).
- **Exported Artifacts:**
  - `encoder.onnx`: 22,241,555 bytes (~21.21 MiB), SHA-256
    `b667e2f4a22e24013814673dddfab62aec762b711988d5a13ae7bafe418c9164`.
  - `decoder.onnx`: 173,968,833 bytes (~165.91 MiB), SHA-256
    `6428e512cfdc4f5c3a805a13e87e289eab29726d19a906e3a4bae1fd8c270a17`.
  - Total first-use download size: ~187.12 MiB (uncompressed).
- **Parity & WASM Execution Verification:**
  - Verified in `onnxruntime-web@1.29.0` WASM in Deno.
  - 100% of operators execute in single-thread WASM.
  - Token-for-token parity: argmax matched token `131` (`<t>`) identically.
  - Max absolute difference vs PyTorch reference: `2.5630e-6` (encoder), `1.3828e-5` (decoder).
  - Timing: Cold load ~460 ms (encoder), ~625 ms (decoder). Step run: ~190 ms (encoder), ~30 ms/step
    (decoder).
  - Exit Gate: Feasibility passes and authorizes Milestone 7 browser OMR vertical slice
    implementation.

## Milestone 7 — Browser OMR vertical slice record

- **Status:** Completed and verified.
- **Model Adapter & Tokenizer:** `src/lib/score/omrTokenizer.ts` encapsulates the complete 153-token
  vocabulary from JAZZMUS MIT `config.json`. Untokenizer adheres to upstream delimiter conventions
  (`<t>` -> `\t`, `<n>` -> `\n`, `<s>` -> ``, stripping pitch/extension tags).
- **Humdrum Parser:** `src/lib/score/humdrumParser.ts` converts `**kern` and `**mxhm` notation
  directly into typed `ScoreDocument` (`ScoreMeasure`, `MelodyEvent`, `HarmonyEvent`,
  `NavigationMark`, `ScoreKeySignature`, `ScoreTimeSignature`).
  - Converts reciprocal durations to beats (`4/n`).
  - Parses scientific pitch octaves (`c`=4, `cc`=5, `C`=3, `CC`=2) and accidentals (`#`, `-`).
  - Maps `**mxhm` chords (`C:maj`, `A:min7`, `B:hdim7`, `C:maj/G`) to lead sheet symbols (`C`,
    `Am7`, `Bm7b5`, `C/G`).
  - Validates measures and flags duration mismatches without blocking guidance for well-formed
    measures.
- **Web Worker Architecture:** `src/workers/omr.worker.ts` executes ONNX Runtime Web in
  single-threaded WebAssembly (`ort.env.wasm.numThreads = 1`), with request-level cancellation via
  `AbortController`, progress callbacks, and memory cleanup.
- **Artifact Caching & Disclosure:** `src/lib/score/omrManifest.ts` and
  `src/components/OmrDownloadModal.tsx` enforce first-use consent disclosing exact uncompressed
  download bytes (~187.1 MB), store verified models in Cache Storage (`omr-artifacts-v1`), verify
  SHA-256 before inference, and provide granular cache deletion controls.
- **Opt-in Test Command:** `deno task test:omr` verifies live WASM execution against local models
  without polluting the hermetic offline default test suite.
- **Default Hermetic Test Suite:** All 330 tests pass with zero network access.
