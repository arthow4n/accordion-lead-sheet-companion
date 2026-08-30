# Score Photo Chord Lookup Implementation Plan

## Purpose

Implement a deliberately small **Photo Chord Lookup** feature for purchased/printed score pages:

```text
photo OR manual chord list
  -> extract/normalize chord symbols
  -> show unique clickable chord chips
  -> reuse existing MiniGripDrawer for LH/RH/Dual lookup
```

This is not score OCR, not MusicXML, not notation recognition, and not song import. The score image and scan result are temporary for the current interaction only.

Read `AGENTS.md`, `SPEC.md`, and `CHORD_COVERAGE_IMPLEMENTATION_PLAN.md` before implementing. The chord-coverage plan should ideally land first so extracted score chords are not silently misinterpreted by the deterministic engine.

## Locked MVP outcome

The existing Import modal gains one new workflow for temporary chord lookup with **two input methods**:

1. **Photo** — choose/take one score-page image, POST it to the Deno scan endpoint, receive chord strings, and render them as clickable lookup chips.
2. **Manual list** — paste/type chord symbols separated by commas and/or newlines, parse them locally, and render the same clickable lookup chips without calling the network.

Examples of accepted manual input:

```text
C, G/B, Am7, C/D
G(add2), Em, Em(maj7)/D#
C#m7b5
```

or:

```text
C
G/B
Am7
C/D
G(add2)
```

The UI normalizes whitespace, removes empty entries, preserves first-seen order, and deduplicates identical normalized chord strings.

Tapping a result must reuse the existing `MiniGripDrawer` and the current view mode. Do not create a new grip UI.

## Non-goals

Do not implement any of the following in this milestone:

- image persistence;
- scan-result persistence;
- score/page coordinates or bounding boxes;
- drawing overlays on the source image;
- lyric OCR;
- staff/note recognition;
- MusicXML/MIDI generation;
- title/artist/key extraction;
- automatic songbook creation;
- multi-page scan management;
- automatic difficulty scoring;
- a general chat interface;
- a provider abstraction for multiple LLM vendors;
- server-side database/session storage.

Closing the lookup UI may discard the selected image and all extracted chords.

## Existing architecture to reuse

Relevant code:

- `src/components/App.tsx` — owns `activeChord` and `MiniGripDrawer`; already pauses auto-scroll when a chord is selected.
- `src/components/ImportModal.tsx` — existing import entry point and server-base URL pattern.
- `src/components/MiniGripDrawer.tsx` — accepts `ChordDetail | string | null`; a plain chord string is enriched through `enrichChord()`.
- `src/lib/parser/tokenizer.ts` — `enrichChord()` and deterministic chord parsing pipeline.
- `src/lib/parser/twoline.ts` — `cleanChordToken()` / `isChordToken()` are suitable validation helpers for manual/API strings.
- `api/import.ts` — existing Deno Deploy CORS and response conventions; use as precedent, not as a place to mix scan logic.
- `deno.json` — Deno-native dependency/import and permission source of truth.

Do not route scan results through `LeadSheetSong`, `LeadSheetLine`, the text lead-sheet parser, IndexedDB, or songbook storage. This feature is a temporary chord lookup tool.

## UX design

### 1. Entry point

Extend `ImportModal` with a fourth tab named **Photo / Chords** (exact short label may be adjusted for mobile width, e.g. `Lookup`). Keep the existing URL, clipboard, and manual lead-sheet import flows unchanged.

The new tab is functionally separate from “Manual Text” lead-sheet import. It is specifically for chord lookup and never creates a song.

Recommended layout:

```text
Photo / Chords

[ Take / choose score photo ]

or

Chord list
[ C, G/B, Am7, C/D          ]
[ G(add2), Em, C#m7b5       ]
[ Look up ]

Found chords
[C] [G/B] [Am7] [C/D] ...
```

### 2. File input

Use a normal browser file input suitable for mobile camera/gallery:

```html
<input type="file" accept="image/*" capture="environment">
```

`capture` is only a hint; gallery selection must still work where supported.

For MVP:

- accept exactly one image per request;
- reject non-image MIME types client-side;
- enforce a frontend size ceiling that matches the backend ceiling;
- do not crop, OCR locally, persist, or generate thumbnails unless necessary for basic selected-file feedback.

A small label such as filename + size is enough to confirm selection. The score image itself does not need to be displayed.

### 3. Manual list parsing

Create a small pure helper, preferably under `src/lib/lookup/` or another focused library path, rather than embedding parsing rules in JSX.

Required behavior:

```ts
parseChordLookupInput(input: string): string[]
```

Algorithm:

1. Split on commas and line breaks (`/[,\r\n]+/`).
2. Trim each token.
3. Drop empty tokens.
4. Normalize Unicode accidentals through the existing chord parser/token helpers rather than maintaining a second music parser.
5. Validate each token with existing chord-token semantics.
6. Preserve first-seen order.
7. Dedupe on the normalized/display chord string.

If one or more tokens are invalid, do not silently discard them. Return structured validation information so the UI can say, for example:

```text
Could not recognize: H7, hello
```

Valid entries should still be usable; invalid entries need not block the entire manual lookup.

### 4. Result interaction

Display returned valid chords as compact touch-friendly chips/buttons. Each must:

- have a >=44px effective touch target per repository mobile UX rules;
- call a callback such as `onLookupChord(chord: string)`;
- stop event propagation where necessary;
- open the existing global `MiniGripDrawer` through `App.tsx`'s `activeChord` state;
- preserve the current LH/RH/Guitar/Dual view mode and current note-spelling preference.

The Photo / Chords tab must not show the existing “Save to Songbook” action. Either hide/replace the footer action while this tab is active or structure the lookup tab so only Close/Cancel is applicable.

## Frontend component/API contract

### Recommended `ImportModal` prop change

Add a callback dedicated to temporary chord lookup:

```ts
export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSong: (song: LeadSheetSong) => void;
  onLookupChord: (chord: string) => void;
}
```

In `App.tsx`:

```ts
<ImportModal
  ...
  onLookupChord={(chord) => {
    if (autoScroll.isPlaying) autoScroll.stop();
    setActiveChord(chord);
  }}
/>
```

Do not duplicate drawer ownership inside `ImportModal`.

### Recommended state for the lookup tab

Keep lookup state local to `ImportModal`:

```ts
selectedImage: File | null
manualChordInput: string
lookupChords: string[]
invalidManualTokens: string[]
isScanning: boolean
scanError: ScanFrontendError | null
```

Reset transient lookup state when appropriate on modal close/reopen. Do not persist to IndexedDB/localStorage.

## Deno scan endpoint

### 1. Endpoint

Add a separate endpoint file, e.g.:

```text
api/scan-chords.ts
```

The intended HTTP contract is:

```text
POST /api/scan-chords
Content-Type: multipart/form-data
field: image=<File>
```

Do not overload `GET /api/import`.

### 2. Google SDK

Use the official **`@google/genai`** SDK as requested. Add it through `deno.json` imports using Deno's npm resolution; do not introduce `package.json`.

Example dependency shape (agent must confirm the currently locked/compatible version at implementation time):

```json
"@google/genai": "npm:@google/genai@<pinned-compatible-version>"
```

The API key must be read server-side from an environment variable, recommended:

```text
GOOGLE_GENAI_API_KEY
```

Never expose this key through `VITE_*`, frontend code, response bodies, logs, or committed files.

Update the local API task permissions so the scan endpoint can read only the required environment variable. Follow the least-privilege rules in `AGENTS.md`; do not replace task permissions with `-A`.

If a shared local API router is introduced so both `/api/import` and `/api/scan-chords` can be served by one task, keep the refactor small and preserve all existing import tests/contracts. If routing is unnecessary in the deployment environment, a separate handler is acceptable. The coding agent should choose the smallest architecture consistent with Deno Deploy and local testing.

### 3. Model/prompt

Keep the model request narrowly scoped. The model is an extraction component, not the source of music theory.

System/task intent:

```text
Inspect this image of a printed music score or lead sheet.
Return only chord symbols that are explicitly printed as chord symbols above/around the staff,
in normal reading order. Do not infer harmony from notes. Do not transcribe lyrics, melody,
measure numbers, titles, or other text. Preserve accidentals, slash basses, parentheses and
extensions as accurately as possible.
```

Use the SDK's structured-output/schema capability if supported by the pinned SDK/model version. Target logical response:

```json
{
  "chords": ["C", "G/B", "Am7", "Em(maj7)/D#", "C#m7b5"]
}
```

Do not request coordinates, confidence scores, score metadata, or prose.

The backend must validate model output rather than trusting JSON blindly:

- response object exists;
- `chords` is an array;
- entries are strings;
- trim/drop empties;
- apply a conservative maximum count/length;
- validate each candidate with the deterministic chord-token parser semantics;
- normalize/dedupe while preserving first occurrence;
- return unrecognized model strings separately if useful for diagnostics, but do not present them as valid clickable chords.

### 4. Image limits

Define one shared/documented contract and test it. Recommended MVP limits:

- exactly one file;
- MIME must start with `image/` and preferably whitelist common browser formats (`image/jpeg`, `image/png`, `image/webp`);
- maximum upload size: **10 MiB**;
- empty file rejected.

Do not implement server-side image persistence.

The request body should be allowed to become unreachable immediately after the model request finishes; no file writes are required.

## Error contract

The user explicitly needs errors that identify **which stage failed**, visible in the frontend.

Use a stable machine-readable error code enum rather than exposing raw SDK exceptions.

Recommended response union:

```ts
export interface ScanChordsSuccess {
  success: true;
  chords: string[];
}

export interface ScanChordsFailure {
  success: false;
  code: ScanErrorCode;
  error: string; // safe, concise user-facing message
}
```

Recommended `ScanErrorCode` values:

```text
SCAN_METHOD_NOT_ALLOWED
SCAN_ORIGIN_NOT_ALLOWED
SCAN_BAD_CONTENT_TYPE
SCAN_IMAGE_MISSING
SCAN_IMAGE_TYPE_UNSUPPORTED
SCAN_IMAGE_TOO_LARGE
SCAN_IMAGE_EMPTY
SCAN_API_KEY_MISSING
SCAN_PROVIDER_REQUEST_FAILED
SCAN_PROVIDER_RATE_LIMITED
SCAN_PROVIDER_RESPONSE_INVALID
SCAN_NO_CHORDS_FOUND
SCAN_INTERNAL_ERROR
```

Use HTTP status independently from stage code:

| Code family | Suggested HTTP |
| --- | --- |
| method | 405 |
| CORS/origin | 403 |
| bad/missing/unsupported/too-large image | 400 / 413 |
| missing server config/key | 500 |
| provider rate/quota | 429 or provider-equivalent mapped status |
| provider request/upstream failure | 502 |
| invalid provider structured response | 502 |
| no explicit chords found | 422 |
| unexpected internal | 500 |

### Error-stage mapping requirements

Wrap the flow in distinct validation/provider/parse stages so errors are classifiable.

- Failures before SDK invocation must never be labeled as provider failures.
- SDK rate/quota errors should map to `SCAN_PROVIDER_RATE_LIMITED` where they can be identified safely.
- Generic SDK/network/model failures map to `SCAN_PROVIDER_REQUEST_FAILED`.
- A successful SDK call whose payload cannot satisfy the response schema maps to `SCAN_PROVIDER_RESPONSE_INVALID`.
- A valid response with zero valid explicit chord strings maps to `SCAN_NO_CHORDS_FOUND`.
- Raw provider error bodies, API keys, stack traces, and internal configuration must never be returned to the browser.

The frontend should display both a friendly message and the stable code, for example:

```text
Could not scan this page.
Provider quota/rate limit reached. Try again later.
Code: SCAN_PROVIDER_RATE_LIMITED
```

This makes diagnosis possible without exposing secrets.

## CORS and security

Reuse/refactor the same allowed-origin policy currently used by `api/import.ts` so scan and import do not drift into inconsistent CORS rules. A small shared helper under `api/` is preferable if it reduces duplication cleanly.

Important: browser CORS is not authentication. The deployed scan endpoint has a server-side paid/free-quota API key, so a public endpoint can be invoked outside the browser despite CORS.

For this personal-use MVP, do **not** build a full account/auth system, but document this limitation explicitly in `SPEC.md`/deployment notes. Add basic abuse resistance that remains small, such as strict request-size limits and method/content-type validation. Do not claim CORS protects quota.

If the owner later exposes the app broadly or quota abuse occurs, authentication/rate limiting becomes a follow-up milestone rather than silently expanding this MVP.

## Backend testability

Do not make hermetic tests call Google.

Structure `api/scan-chords.ts` so the provider invocation can be injected/mocked at the handler/helper boundary. Examples acceptable in this codebase:

```ts
handleScanRequest(req, { extractChords })
```

or a small exported pure/provider function that can be replaced in tests.

Default `deno task test` must remain offline with no `--allow-net` and no Google key requirement.

Required backend tests:

- OPTIONS/preflight behavior if applicable;
- GET -> `SCAN_METHOD_NOT_ALLOWED`;
- disallowed Origin -> `SCAN_ORIGIN_NOT_ALLOWED`;
- non-multipart -> `SCAN_BAD_CONTENT_TYPE`;
- missing image -> `SCAN_IMAGE_MISSING`;
- unsupported MIME -> `SCAN_IMAGE_TYPE_UNSUPPORTED`;
- empty image -> `SCAN_IMAGE_EMPTY`;
- >10 MiB -> `SCAN_IMAGE_TOO_LARGE` without provider invocation;
- missing API key/provider configuration -> `SCAN_API_KEY_MISSING` where configuration is evaluated;
- mocked provider success -> normalized unique chord array;
- mocked provider rate error -> `SCAN_PROVIDER_RATE_LIMITED`;
- mocked provider generic failure -> `SCAN_PROVIDER_REQUEST_FAILED`;
- malformed provider result -> `SCAN_PROVIDER_RESPONSE_INVALID`;
- valid zero-chord result -> `SCAN_NO_CHORDS_FOUND`;
- provider returns mixed valid/invalid strings -> only deterministic valid chords become clickable response entries (and behavior for invalid entries is explicitly tested).

No test fixture should contain or commit the user's supplied score images. Use tiny synthetic `Blob`/`File` objects or generated bytes in tests.

## Frontend error handling

Create a small typed response contract shared/importable by frontend and API if repository layering permits without pulling server-only SDK dependencies into the browser. Otherwise duplicate only the error-code type in a neutral `src/types`/shared file.

Frontend flow:

1. User selects image.
2. Clear prior scan error.
3. Validate file locally.
4. Build `FormData`.
5. POST scan request.
6. Attempt JSON parse.
7. If transport itself fails, show a local frontend code such as `SCAN_NETWORK_ERROR` (frontend-only is fine).
8. If HTTP/response says failure, show server `code` + `error`.
9. If success has zero chords unexpectedly, treat it as invalid response rather than rendering an empty success state.
10. Render results.

Do not show raw exception objects.

Keep retry simple: the existing scan button can be pressed again. No exponential retry scheduler is needed for MVP.

## Manual lookup behavior and validation contract

Manual lookup is a first-class MVP path and must work with no API key, no network, and offline PWA mode.

Recommended result type:

```ts
interface ParsedChordLookupList {
  chords: string[];
  invalid: string[];
}
```

Required test examples:

```text
"C,G/B, Am7" -> ["C", "G/B", "Am7"]
"C\nG/B\nAm7" -> same
"C,\nG/B,,Am7\n" -> same
"C, C, G/B, C" -> ["C", "G/B"]
" C♯m7 , Db " -> normalized valid entries according to existing parser/display rules
"C, hello, H7, Am" -> valid ["C", "Am"], invalid ["hello", "H7"]
"Em(maj7)/D#" -> one valid chord after the chord-coverage milestone
```

Do not split on `/`; slash chords must remain intact.

## Client/API base URL

Reuse the existing production/local API base selection logic instead of creating another hard-coded environment decision inside the lookup JSX. Prefer extracting a tiny `getApiBaseUrl()` helper if both existing URL import and score scanning need the same logic.

Do not change production deployment topology unnecessarily.

## Deployment/config documentation

Document the required Deno Deploy environment variable:

```text
GOOGLE_GENAI_API_KEY=<secret>
```

Never commit a real key or sample secret.

Update `deno.json` tasks/imports and `README.md` deployment guidance only as required. If local serving now needs both import and scan routes, document the exact local command and least-privilege permissions.

## Required frontend/component tests

Add tests following existing component/UX test patterns for:

- lookup tab is reachable without breaking the existing three import tabs;
- manual comma/newline parsing;
- invalid manual tokens are reported while valid tokens still render;
- photo file validation errors appear without network call;
- mocked successful scan response renders deduplicated chord buttons;
- server error renders friendly message and stable error code;
- clicking a result invokes `onLookupChord` with the correct raw/normalized chord;
- lookup mode does not enable “Save to Songbook” and does not call `onSaveSong`;
- modal close/reopen does not persist score image/result accidentally.

Add a focused `App` integration test if needed to prove `onLookupChord` opens the existing global `MiniGripDrawer`; do not duplicate deep drawer/music-theory tests already covered elsewhere.

## UI validation

Because this changes `ImportModal` on mobile:

- verify widths 360px–430px;
- no horizontal document overflow;
- tab labels remain usable;
- chord result buttons have >=44px effective targets;
- long chord names such as `Em(maj7)/D#` and `C#m7b5` wrap/fit without clipping;
- error codes/messages remain readable;
- opening the existing chord drawer from the modal does not create an unusable two-overlay stack. Preferred behavior: close the import modal immediately before/when opening the drawer, or otherwise ensure only one modal layer is active. The implementation should choose and test the simpler single-overlay behavior.

Use the repository-prescribed `agent-browser` / `deno task audit:ui` workflow for meaningful UI changes.

## Suggested implementation sequence

1. Land `CHORD_COVERAGE_IMPLEMENTATION_PLAN.md` implementation first, or explicitly record that scan testing is temporarily limited until it lands.
2. Add neutral scan response/error types and the pure manual chord-list parser with unit tests.
3. Add `@google/genai` dependency and implement the injectable `POST /api/scan-chords` handler with hermetic mocked tests.
4. Refactor shared API-base/CORS helpers only if this avoids cleanly identifiable duplication; preserve `api/import.ts` behavior.
5. Add the Photo / Chords tab and manual lookup UI.
6. Wire scan upload/error/result flow.
7. Wire result click -> `App.activeChord` -> existing `MiniGripDrawer`, using one overlay at a time.
8. Run component/unit/regression tests and mobile UI audit.
9. Update `SPEC.md`, README/deployment config docs and test matrix.
10. Independent review gate and remediation.

## Completion checklist

- [ ] Read `AGENTS.md`, `SPEC.md`, this plan, `CHORD_COVERAGE_IMPLEMENTATION_PLAN.md`, and the existing `ImportModal`/API tests before editing.
- [ ] Add a pure comma/newline manual chord-list parser that preserves slash chords, deduplicates in first-seen order, and reports invalid tokens without blocking valid ones.
- [ ] Add the temporary Photo / Chords workflow to `ImportModal`; do not create/save `LeadSheetSong` records and do not persist files/results.
- [ ] Add `onLookupChord(chord)` wiring through `App.tsx` so result chips reuse the existing `MiniGripDrawer` and only one overlay is active at a time.
- [ ] Add `@google/genai` through `deno.json` only; use `GOOGLE_GENAI_API_KEY` server-side and keep least-privilege Deno permissions.
- [ ] Implement `POST /api/scan-chords` with one multipart image, <=10 MiB, MIME/empty validation, no disk/database storage, and a narrow structured-output prompt that extracts explicit chord strings only.
- [ ] Implement the stable server error-code contract exactly enough to distinguish validation, configuration, provider request/rate-limit, provider-response, no-chords, and internal stages; surface friendly message + code in the frontend.
- [ ] Ensure malformed/model-generated chord strings are revalidated by the deterministic parser before becoming clickable results.
- [ ] Keep default tests hermetic/offline by mocking provider invocation; never require Google network access or an API key in `deno task test`.
- [ ] Add backend tests for every error stage and frontend/component tests for manual input, scan success/failure, click wiring, no-save behavior, and transient state.
- [ ] Do not add, copy, encode, fixture, or otherwise commit any score/photo images supplied during planning; verify the final diff contains no image assets or base64 score data.
- [ ] Update `SPEC.md`, test matrices, and deployment/README documentation for the scan endpoint, `GOOGLE_GENAI_API_KEY`, temporary/no-storage semantics, and the fact that CORS is not quota authentication.
- [ ] Run the repository quality gate from `AGENTS.md`: `deno fmt --check`, `deno lint`, `deno task test`, `deno task build`; also run the required mobile UI audit / `deno task audit:ui`, then `git diff --check`.
- [ ] **Final review gate:** invoke a fresh, read-only reviewer subagent before declaring the implementation complete. Follow the independent reviewer pattern used by `arthow4n/did-it-become-what-you-like` (`AGENTS.md` and `.agents/skills/implementation-planning/SKILL.md`): provide this plan, repo `AGENTS.md`, the complete final diff, and exact validation evidence; ask the reviewer to audit scope discipline, API-key secrecy, Deno permissions, error-stage correctness, model-output validation, hermetic tests, mobile UX, and confirmation that no supplied score images were committed. The primary coding agent must remediate all material findings, rerun affected checks, and only then commit/push the completed feature.

## Ready-to-use delegation prompt

```text
Implement SCORE_SCAN_IMPLEMENTATION_PLAN.md as the single primary coding agent.
Read AGENTS.md and SPEC.md first, and confirm the chord-coverage milestone status. Keep the MVP
strictly temporary: photo/manual input -> validated chord list -> existing MiniGripDrawer. No image
storage, coordinates, score OCR, songbook save, or score reconstruction. Use @google/genai in the
Deno endpoint with GOOGLE_GENAI_API_KEY server-side, stable stage-specific error codes, and hermetic
mocked tests. Never commit any supplied score images. Run all required validation and mobile UI audit.
Before completion invoke a fresh read-only reviewer subagent as required by the last checklist item,
fix all material findings, rerun affected checks, then commit and push.
```
