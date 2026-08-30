# Score Photo Chord Lookup Implementation Plan

## Purpose

Implement a deliberately small **Photo Chord Lookup** feature for purchased/printed score pages:

```text
photo OR manual chord list
  -> extract/normalize chord symbols
  -> show unique clickable chord chips
  -> reuse existing MiniGripDrawer for LH/RH/Dual lookup
```

This is not score OCR, not MusicXML, not notation recognition, and not song import. The score image
and scan result are temporary for the current interaction only.

Read `AGENTS.md`, `SPEC.md`, and `CHORD_COVERAGE_IMPLEMENTATION_PLAN.md` before implementing.
Development may proceed independently, but **final acceptance is blocked until the chord-coverage
milestone is complete**. Do not weaken scan/manual lookup tests for score-style chords such as
`Em(maj7)/D#` just because that prerequisite has not landed yet.

## Locked MVP outcome

The existing Import modal gains one new workflow for temporary chord lookup with **two input
methods**:

1. **Photo** — choose/take one score-page image, explicitly tap **Scan chords**, POST it to the Deno
   scan endpoint, receive chord strings, and render them as clickable lookup chips.
2. **Manual list** — paste/type chord symbols separated by commas and/or newlines, parse them
   locally, and render the same clickable lookup chips without calling the network.

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

The UI normalizes whitespace and Unicode accidentals through the existing deterministic chord
parser, removes empty entries, preserves first-seen order, and deduplicates identical
parser-normalized chord strings.

Each successful Photo scan or Manual lookup **replaces** the current result list; do not merge
separate operations into an accumulated session history. Failed scans/manual validation may report
errors without persisting anything.

Tapping a result must reuse the existing `MiniGripDrawer` and the current view mode. Do not create a
new grip UI.

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
- server-side database/session storage;
- automatic image cropping/deskewing/enhancement;
- a model picker or user-facing AI configuration UI.

Closing the lookup UI discards the selected image and all extracted chords.

## Existing architecture to reuse

Relevant code:

- `src/components/App.tsx` — owns `activeChord` and `MiniGripDrawer`; already pauses auto-scroll
  when a chord is selected.
- `src/components/ImportModal.tsx` — existing import entry point and server-base URL pattern.
- `src/components/MiniGripDrawer.tsx` — accepts `ChordDetail | string | null`; a plain chord string
  is enriched through `enrichChord()`.
- `src/lib/parser/tokenizer.ts` — `enrichChord()` and deterministic chord parsing pipeline.
- `src/lib/parser/twoline.ts` — `cleanChordToken()` / `isChordToken()` are suitable validation
  helpers for manual/API strings.
- `api/import.ts` — current Deno Deploy entrypoint and import handler; preserve its production
  entrypoint role so this MVP does not require a deployment-topology change.
- `deno.json` — Deno-native dependency/import and permission source of truth.

Do not route scan results through `LeadSheetSong`, `LeadSheetLine`, the text lead-sheet parser,
IndexedDB, or songbook storage. This feature is a temporary chord lookup tool.

## UX design

### 1. Entry point

Extend `ImportModal` with a fourth tab labeled **Lookup**. Use this short locked label rather than
squeezing “Photo / Chords” into the mobile tab row. Inside the tab, a heading such as **Photo /
Chords** is fine.

Keep the existing URL, clipboard, and manual lead-sheet import flows unchanged. The new Lookup tab
is functionally separate from “Manual Text” lead-sheet import and never creates a song.

Recommended layout:

```text
Lookup

Photo / Chords
[ Take / choose score photo ]
selected-score.jpg · 2.8 MiB
[ Scan chords ]

or

Chord list
[ C, G/B, Am7, C/D          ]
[ G(add2), Em, C#m7b5       ]
[ Look up ]

Found chords
[C] [G/B] [Am7] [C/D] ...
```

Do not automatically spend API quota immediately when a file is selected. Selection and scan
submission are separate actions.

### 2. File input

Use a normal browser file input suitable for mobile camera/gallery:

```html
<input type="file" accept="image/*" capture="environment">
```

`capture` is only a hint; gallery selection must still work where supported.

For MVP:

- accept exactly one image per request;
- whitelist the same MIME types client and server use;
- enforce the same 10 MiB file-size ceiling client and server use;
- do not crop, OCR locally, persist, or generate thumbnails;
- show filename + size as selected-file feedback;
- expose an explicit **Scan chords** action disabled until a valid image is selected.

Selecting a different image clears the prior photo-validation/provider error and prior result list.
It does not trigger a request automatically.

### 3. Shared chord-candidate normalization

Do not implement separate normalization rules for manual input and model output. Add one pure helper
layer, preferably under `src/lib/lookup/`, with two responsibilities conceptually equivalent to:

```ts
normalizeChordLookupCandidates(candidates: Iterable<string>): ParsedChordLookupList
parseChordLookupInput(input: string): ParsedChordLookupList
```

`parseChordLookupInput()` only handles comma/newline splitting and then delegates to the shared
candidate normalizer. The scan backend uses the same candidate-normalization semantics on the
model-returned strings.

Recommended result contract:

```ts
interface ParsedChordLookupList {
  chords: string[];
  invalid: string[];
}
```

Normalization algorithm:

1. For manual text only, split on commas and line breaks (`/[,\r\n]+/`). Never split on `/`; slash
   chords must remain intact.
2. Trim each candidate and drop empties.
3. Apply existing token cleanup / Unicode accidental normalization; do not create a second music
   parser.
4. Validate with `isChordToken()` before treating a candidate as a chord.
5. Parse valid tokens through the existing chord parser and use its normalized `raw` representation
   as the lookup/display value.
6. Preserve first-seen order.
7. Dedupe by that parser-normalized `raw` string.
8. Preserve invalid original trimmed strings for the Manual UI; the scan API need not expose invalid
   model strings to the browser.

This intentionally does **not** invent a new alias-canonicalization engine. For example, if two
different valid aliases remain different in the existing parser's normalized `raw` representation,
this MVP may keep them distinct. The purpose is consistent reuse, not a second chord-normalization
subsystem.

If one or more manual tokens are invalid, do not silently discard them. Valid entries still render;
the UI may say:

```text
Could not recognize: H7, hello
```

### 4. Result interaction

Display returned valid chords as compact touch-friendly chips/buttons. Each must:

- have a >=44px effective touch target per repository mobile UX rules;
- call `onLookupChord(chord: string)`;
- stop event propagation where necessary;
- preserve the current LH/RH/Guitar/Dual view mode and current note-spelling preference.

Use a single-overlay flow. In `App.tsx`, the lookup callback must close the Import modal
before/while selecting the chord, then open the already-owned `MiniGripDrawer` through
`activeChord`. Do not render the drawer inside `ImportModal` and do not leave the Import modal
behind it.

The Lookup tab must never show or enable the existing “Save to Songbook” action, even if
`previewSong` was populated on another tab before the user switched to Lookup.

## Frontend component/API contract

### `ImportModal` prop change

Add a callback dedicated to temporary chord lookup:

```ts
export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSong: (song: LeadSheetSong) => void;
  onLookupChord: (chord: string) => void;
}
```

In `App.tsx`, prefer one explicit handler:

```ts
const handleLookupChord = (chord: string) => {
  setIsImportOpen(false);
  if (autoScroll.isPlaying) autoScroll.stop();
  setActiveChord(chord);
};
```

Pass that handler to `ImportModal`. Do not duplicate drawer ownership inside the modal.

### Lookup-tab transient state

Keep lookup state local to `ImportModal`:

```ts
selectedImage: File | null
manualChordInput: string
lookupChords: string[]
invalidManualTokens: string[]
isScanning: boolean
scanError: ScanFrontendError | null
```

Reset all transient lookup state on modal close/reopen. Do not persist to IndexedDB/localStorage.

A successful Manual lookup clears photo scan errors. Starting a Photo scan clears manual
invalid-token feedback. Do not maintain separate result histories.

## Deno scan endpoint

### 1. Endpoint and deployment topology

Add the scan logic in a separate file:

```text
api/scan-chords.ts
```

HTTP contract:

```text
POST /api/scan-chords
Content-Type: multipart/form-data
field: image=<File>
```

Do not overload the semantics of `GET /api/import`.

**Keep `api/import.ts` as the deployed Deno entrypoint.** The existing deployment documentation
points Deno Deploy at this file, so changing to a new server entrypoint would add needless
operational work. Refactor only enough for `api/import.ts`'s top-level request handler to dispatch
`/api/scan-chords` to the separately implemented scan handler before running the existing import
flow. Preserve existing import behavior and exports required by tests.

Recommended dependency shape:

```text
api/import.ts              deployed Deno.serve entrypoint + very small path dispatch
  -> existing import handler logic
  -> handleScanChordsRequest() from api/scan-chords.ts

api/cors.ts                shared parameterized CORS helper
api/scan-chords.ts         scan validation + Google provider invocation
```

Move/refactor the current CORS helper into `api/cors.ts` so there is no circular import. It must
accept the allowed methods (or equivalent configuration):

```text
import route: GET, OPTIONS
scan route:   POST, OPTIONS
```

Do not accidentally reuse the current `GET, OPTIONS` header for the scan route.

Unknown/unrelated paths should not be made broader than the existing service behavior merely for
this feature. The key acceptance condition is that current `/api/import?...` requests and new
`/api/scan-chords` requests both work through the same deployed entrypoint.

### 2. Google SDK and lazy configuration

Use the official **`@google/genai`** SDK as requested. Add it through `deno.json` imports using
Deno's npm resolution; do not introduce `package.json`.

Dependency policy:

```json
"@google/genai": "npm:@google/genai@<pinned-compatible-version>"
```

At implementation time, verify the currently supported official package version and choose a stable,
image-capable **Gemini Flash-family model that is covered by the owner's free Gemini API quota**. Do
not use a deprecated or preview-only model when a stable free-tier Flash model is available. Keep
the chosen model ID in one server-side constant such as `SCORE_SCAN_MODEL`; no model picker is
needed. Record the chosen model/version in `SPEC.md` so future maintainers know what is deployed.

The API key must be read server-side from:

```text
GOOGLE_GENAI_API_KEY
```

Never expose this key through `VITE_*`, frontend code, response bodies, logs, or committed files.

**Do not read `Deno.env`, construct `GoogleGenAI`, or otherwise evaluate provider configuration at
module import time.** Configuration/provider creation must be lazy, after request validation and
only when no test dependency is injected. This is required so `deno task test` can import the
handler with no env/network permissions.

Update the local API task to keep the current entrypoint while adding only the needed environment
permission, conceptually:

```text
deno run --allow-net --allow-env=GOOGLE_GENAI_API_KEY api/import.ts
```

Do not replace this with `-A`.

### 3. Model input/output contract

Keep the model request narrowly scoped. The model is an extraction component, not the source of
music theory.

Prompt intent:

```text
Inspect this image of a printed music score or lead sheet.
Return only chord symbols that are explicitly printed as chord symbols above/around the staff,
in normal reading order. Do not infer harmony from notes. Do not transcribe lyrics, melody,
measure numbers, titles, or other text. Preserve accidentals, slash basses, parentheses and
extensions as accurately as possible.
```

Use the `@google/genai` structured JSON-output capability. With SDK versions exposing
`responseJsonSchema`, use `responseMimeType: "application/json"` plus a schema equivalent to:

```json
{
  "type": "object",
  "properties": {
    "chords": {
      "type": "array",
      "maxItems": 256,
      "items": { "type": "string", "maxLength": 64 }
    }
  },
  "required": ["chords"],
  "additionalProperties": false
}
```

If the pinned SDK has replaced `responseJsonSchema` with its documented direct successor, use that
successor while preserving exactly the same logical schema. Do not fall back to unstructured prose
parsing unless the owner explicitly approves a scope change.

Target logical result:

```json
{
  "chords": ["C", "G/B", "Am7", "Em(maj7)/D#", "C#m7b5"]
}
```

Do not request coordinates, confidence scores, score metadata, or prose.

For this temporary one-image request, use **inline image data**, not the Gemini Files API. Read the
validated `File` bytes, base64-encode them for the SDK's `inlineData`/equivalent part together with
the validated MIME type, call the model once, then release request-local references. The Files API
is unnecessary because the image is neither reused nor persisted. Google currently documents inline
image input for requests under 20 MB; the 10 MiB raw-file ceiling keeps base64 + prompt comfortably
below that guidance.

Official references for implementation-time verification:

- `https://ai.google.dev/gemini-api/docs/image-understanding`
- `https://googleapis.github.io/js-genai/`

### 4. Provider-output validation

The backend must validate model output rather than trusting structured JSON blindly:

- response object/text exists;
- JSON parses successfully;
- `chords` is an array;
- no more than 256 entries;
- entries are strings no longer than 64 characters;
- trim/drop empties;
- run every candidate through the shared deterministic chord-candidate normalizer;
- normalize/dedupe while preserving first occurrence;
- return only deterministic valid chords to the browser.

Domain-invalid model strings do not become clickable results. If structured JSON is valid and at
least one deterministic chord remains, return success with those valid chords. If structured JSON is
valid but zero deterministic chords remain, return `SCAN_NO_CHORDS_FOUND`. Reserve
`SCAN_PROVIDER_RESPONSE_INVALID` for malformed/missing structured provider output, not merely for
one bad chord candidate inside an otherwise valid result.

### 5. Image limits and MIME whitelist

Use one locked client/server contract:

- exactly one file;
- empty file rejected;
- maximum file size: **10 MiB** (`10 * 1024 * 1024` bytes);
- supported MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/heic`
  - `image/heif`

These image types are currently documented by Gemini's image-understanding API and cover common
phone-camera formats. Verify the official list against the selected model/SDK when implementing; if
a listed format is no longer accepted, update the plan/spec rather than silently accepting it
client-side and failing later.

The authoritative file-size check is `File.size` after multipart parsing. An early `Content-Length`
guard may reject obviously oversized requests, but multipart overhead means it must not use the 10
MiB file limit as an exact whole-request limit.

Do not implement server-side image persistence. No disk/database writes are required.

## Stable error contract

The user needs errors that identify **which stage failed**, visible in the frontend whenever the
browser can read the response.

Use a stable machine-readable error code enum rather than exposing raw SDK exceptions.

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

Server `ScanErrorCode` values:

```text
SCAN_METHOD_NOT_ALLOWED
SCAN_ORIGIN_NOT_ALLOWED
SCAN_BAD_CONTENT_TYPE
SCAN_MULTIPART_INVALID
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

Suggested HTTP mapping:

| Code                             | HTTP |
| -------------------------------- | ---: |
| `SCAN_METHOD_NOT_ALLOWED`        |  405 |
| `SCAN_ORIGIN_NOT_ALLOWED`        |  403 |
| `SCAN_BAD_CONTENT_TYPE`          |  400 |
| `SCAN_MULTIPART_INVALID`         |  400 |
| `SCAN_IMAGE_MISSING`             |  400 |
| `SCAN_IMAGE_TYPE_UNSUPPORTED`    |  415 |
| `SCAN_IMAGE_TOO_LARGE`           |  413 |
| `SCAN_IMAGE_EMPTY`               |  400 |
| `SCAN_API_KEY_MISSING`           |  500 |
| `SCAN_PROVIDER_RATE_LIMITED`     |  429 |
| `SCAN_PROVIDER_REQUEST_FAILED`   |  502 |
| `SCAN_PROVIDER_RESPONSE_INVALID` |  502 |
| `SCAN_NO_CHORDS_FOUND`           |  422 |
| `SCAN_INTERNAL_ERROR`            |  500 |

### Error-stage precedence

Process and classify failures in this order:

```text
route/method/origin/content-type
  -> multipart parse
  -> image presence/type/size/empty validation
  -> API-key/provider creation
  -> provider call
  -> provider structured-output parse/schema validation
  -> deterministic chord validation
```

Consequences:

- A bad image request must report its image/validation failure even if the server API key is
  missing; do not read the key before request validation.
- Multipart parsing exceptions map to `SCAN_MULTIPART_INVALID`.
- Validation failures must never invoke the provider.
- Missing key maps to `SCAN_API_KEY_MISSING`.
- When the SDK exposes structured status information, map HTTP/status `429` / resource-exhausted
  quota errors to `SCAN_PROVIDER_RATE_LIMITED`; do not depend primarily on brittle human-message
  substring matching.
- Generic SDK/network/model failures map to `SCAN_PROVIDER_REQUEST_FAILED`.
- A successful SDK call whose structured payload is absent/malformed maps to
  `SCAN_PROVIDER_RESPONSE_INVALID`.
- Valid structured output with zero deterministic chord strings maps to `SCAN_NO_CHORDS_FOUND`.
- Raw provider error bodies, API keys, stack traces, and internal configuration must never be
  returned to the browser.

Frontend display example:

```text
Could not scan this page.
Provider quota/rate limit reached. Try again later.
Code: SCAN_PROVIDER_RATE_LIMITED
```

### Browser-only error codes

The frontend may additionally use these local codes without sending them to the server:

```text
SCAN_NETWORK_ERROR
SCAN_CLIENT_RESPONSE_INVALID
```

`SCAN_NETWORK_ERROR` covers fetch/transport failures. `SCAN_CLIENT_RESPONSE_INVALID` covers a server
response the client cannot parse/validate against the documented success/failure union.

A disallowed-origin response deserves special note: browser CORS rules may prevent JavaScript from
reading the server's `SCAN_ORIGIN_NOT_ALLOWED` body at all. In that case the frontend will
necessarily surface `SCAN_NETWORK_ERROR`. The server-side code remains valuable for direct tests/log
diagnosis. Do not claim the browser can always display a CORS-rejected response code.

## CORS and security

Refactor the existing allowed-origin logic into the shared method-aware helper described above so
import and scan do not drift.

Preserve the current production/local origin allowlist semantics unless the repository configuration
has legitimately changed by implementation time. For requests without an `Origin` header, preserve
the existing direct/CLI behavior rather than inventing authentication in this milestone.

Important: browser CORS is not authentication. The deployed scan endpoint has a server-side
free-quota API key, so a public endpoint can still be invoked outside the browser despite CORS.

For this personal-use MVP, do **not** build a full account/auth system. Document the quota-abuse
limitation explicitly in `SPEC.md`/deployment notes. Basic resistance is limited to strict
method/content-type/MIME/count/length/file-size validation and the narrow endpoint contract. If
quota abuse occurs or the app is deliberately exposed broadly, authentication/rate limiting is a
follow-up milestone.

## Backend testability

Do not make hermetic tests call Google or require Deno environment permission.

Structure `api/scan-chords.ts` so the provider invocation can be injected/mocked. A suitable shape
is:

```ts
handleScanChordsRequest(req, { extractChords }?)
```

The default dependency may be created lazily only after validation. Tests inject a fake
`extractChords`; they must never need `GOOGLE_GENAI_API_KEY`.

Default `deno task test` must remain offline with no `--allow-net` and no Google key requirement.

Required backend tests:

- import route regressions still pass after entrypoint dispatch/CORS refactor;
- OPTIONS/preflight behavior uses `POST, OPTIONS` for scan and preserves `GET, OPTIONS` for import;
- GET `/api/scan-chords` -> `SCAN_METHOD_NOT_ALLOWED`;
- disallowed Origin -> `SCAN_ORIGIN_NOT_ALLOWED` at handler level;
- non-multipart -> `SCAN_BAD_CONTENT_TYPE`;
- malformed multipart -> `SCAN_MULTIPART_INVALID`;
- missing image -> `SCAN_IMAGE_MISSING`;
- unsupported MIME -> `SCAN_IMAGE_TYPE_UNSUPPORTED`;
- empty image -> `SCAN_IMAGE_EMPTY`;
- 10 MiB file -> `SCAN_IMAGE_TOO_LARGE` without provider invocation;
- all validation failures assert provider invocation count remains zero;
- missing API key/default provider configuration -> `SCAN_API_KEY_MISSING`, but only after a valid
  image request reaches provider setup;
- mocked provider success -> normalized unique chord array preserving first-seen order;
- mocked provider rate error -> `SCAN_PROVIDER_RATE_LIMITED`;
- mocked provider generic failure -> `SCAN_PROVIDER_REQUEST_FAILED`;
- malformed/missing structured provider result -> `SCAN_PROVIDER_RESPONSE_INVALID`;
- valid empty array -> `SCAN_NO_CHORDS_FOUND`;
- provider returns only domain-invalid strings -> `SCAN_NO_CHORDS_FOUND`;
- provider returns mixed valid/invalid strings -> success containing only deterministic valid
  chords;
- duplicate valid provider strings -> one normalized result preserving first occurrence.

No test fixture may contain or commit the user's supplied score images. Use tiny synthetic
`Blob`/`File` objects or generated bytes in tests.

## Frontend scan flow and error handling

Put the neutral scan response/error-code contract somewhere importable by frontend/API without
importing `@google/genai` into the browser bundle. A focused shared type file is preferable to
duplicating the server enum.

Photo flow:

1. User selects an image.
2. Clear prior result/error state for the new selection.
3. Validate MIME/size/empty locally using the locked constants.
4. User taps **Scan chords**.
5. Build `FormData` with field name exactly `image`.
6. POST to `${apiBase}/api/scan-chords`.
7. Attempt JSON parse and runtime-shape validation.
8. Fetch/transport failure -> `SCAN_NETWORK_ERROR`.
9. Unparseable/unknown response union -> `SCAN_CLIENT_RESPONSE_INVALID`.
10. Server failure -> display safe `error` + stable server `code`.
11. Success -> replace `lookupChords` with returned chords.

Do not show raw exception objects. Keep retry simple: the user may press **Scan chords** again. No
background retries or scheduler are needed.

## Manual lookup behavior

Manual lookup is a first-class path and must work with no API key, no network, and offline PWA mode.

Required test examples:

```text
"C,G/B, Am7" -> ["C", "G/B", "Am7"]
"C\nG/B\nAm7" -> same
"C,\nG/B,,Am7\n" -> same
"C, C, G/B, C" -> ["C", "G/B"]
" C♯m7 , Db " -> parser-normalized valid entries
"C, hello, H7, Am" -> valid ["C", "Am"], invalid ["hello", "H7"]
"Em(maj7)/D#" -> one valid chord after the chord-coverage milestone
```

Do not add semicolon/space-only splitting in this MVP unless required by an existing parser helper.
The requested contract is comma and/or newline separation.

Manual **Look up** replaces `lookupChords` with valid results and reports invalid tokens from that
submission. It must not call the scan endpoint.

## Client/API base URL and local development

Reuse the existing production/local API base selection logic instead of creating another hard-coded
environment decision inside Lookup JSX. Extract a tiny `getApiBaseUrl()` helper if both URL import
and score scanning need the same logic.

Keep the current production Deno Deploy base URL and `api/import.ts` deployment entrypoint. The new
path is served by that same Deno app.

For local end-to-end development, the existing frontend supports `VITE_API_BASE_URL`. Document the
concrete two-process workflow rather than assuming Vite serves Deno functions:

```text
# terminal 1 (Deno API; default Deno.serve port 8000)
GOOGLE_GENAI_API_KEY=... deno task serve:api

# terminal 2
VITE_API_BASE_URL=http://localhost:8000 deno task dev
```

Do not commit either value. Manual lookup continues to work without either process/network.

## Deployment/config documentation

Document the required Deno Deploy environment variable:

```text
GOOGLE_GENAI_API_KEY=<secret>
```

Never commit a real key or sample secret value. The existing Deno Deploy dynamic entrypoint remains
`api/import.ts`; do not instruct the user to change deployment topology for this feature.

Update `deno.json` imports/tasks and `README.md` deployment guidance as required. The local
`serve:api` task must retain least privilege (`--allow-net` plus only
`--allow-env=GOOGLE_GENAI_API_KEY`).

## Required frontend/component tests

Add tests following existing component/UX test patterns for:

- fourth `Lookup` tab is reachable without breaking the existing three import tabs;
- manual comma/newline parsing and shared normalization;
- invalid manual tokens are reported while valid tokens still render;
- manual lookup performs no fetch/network call;
- photo selection does not automatically call the API;
- frontend MIME/empty/size validation errors appear without network call;
- Scan button disabled until a valid selected file exists and disabled while scanning;
- mocked successful scan response replaces results with deduplicated chord buttons;
- server error renders friendly message and stable error code;
- transport failure renders `SCAN_NETWORK_ERROR`;
- malformed server JSON/union renders `SCAN_CLIENT_RESPONSE_INVALID`;
- clicking a result invokes `onLookupChord` with the normalized chord and closes the Import modal
  before the existing drawer is shown;
- Lookup mode never enables “Save to Songbook”, including after switching from another tab that
  already has a `previewSong`;
- `onSaveSong` is never called from Lookup mode;
- modal close/reopen clears selected score image, results, invalid tokens, and errors.

Add a focused `App` integration test if needed to prove `onLookupChord` opens the existing global
`MiniGripDrawer`; do not duplicate deep drawer/music-theory tests already covered elsewhere.

## UI validation

Because this changes `ImportModal` on mobile:

- verify widths 360px–430px;
- no horizontal document overflow;
- four tab labels remain usable, with the new short `Lookup` label;
- chord result buttons have >=44px effective targets;
- long chord names such as `Em(maj7)/D#` and `C#m7b5` wrap/fit without clipping;
- filename/size and Scan button remain usable on narrow screens;
- error codes/messages remain readable;
- tapping a chord produces the locked single-overlay transition: Import modal gone, existing grip
  drawer open.

Use the repository-prescribed `agent-browser` / `deno task audit:ui` workflow for meaningful UI
changes.

## Suggested implementation sequence

1. Confirm the chord-coverage milestone status. If incomplete, implementation may proceed but final
   acceptance remains blocked; never relax its dependent tests.
2. Add neutral shared scan types/constants and the pure shared chord-candidate/manual-list parser
   with unit tests.
3. Add `@google/genai`; implement the lazily configured injectable `api/scan-chords.ts` handler and
   hermetic mocked tests.
4. Refactor CORS into a method-aware `api/cors.ts` and add the minimal `/api/scan-chords` dispatch
   at the existing `api/import.ts` entrypoint; rerun all import API tests before continuing.
5. Extract/reuse the API-base helper if useful, then add the fourth Lookup tab and manual lookup UI.
6. Wire photo selection, explicit Scan action, upload/error/result flow.
7. Wire result click -> close Import modal -> `App.activeChord` -> existing `MiniGripDrawer`.
8. Run component/unit/regression tests and mobile UI audit.
9. Update `SPEC.md`, README/deployment config docs and test matrix.
10. Independent review gate and remediation.

## Completion checklist

- [ ] Read `AGENTS.md`, `SPEC.md`, this plan, `CHORD_COVERAGE_IMPLEMENTATION_PLAN.md`, and the
      existing `ImportModal`/API tests before editing.
- [ ] Treat completed chord coverage as a final-acceptance dependency; do not weaken `Em(maj7)/D#`
      or other prerequisite-sensitive tests.
- [ ] Add one shared deterministic candidate normalizer plus a pure comma/newline manual chord-list
      parser; preserve slash chords, first-seen order, parser-normalized deduplication, and invalid
      manual tokens.
- [ ] Add the temporary fourth `Lookup` tab to `ImportModal`; keep photo/manual lookup transient and
      never create/save `LeadSheetSong` records.
- [ ] Add `onLookupChord(chord)` wiring through `App.tsx` with the locked single-overlay behavior:
      close Import modal, pause auto-scroll if needed, then reuse the existing `MiniGripDrawer`.
- [ ] Add `@google/genai` through `deno.json` only; choose/record a stable image-capable free-tier
      Gemini Flash model, use `GOOGLE_GENAI_API_KEY` server-side, and keep provider/env
      initialization lazy.
- [ ] Keep `api/import.ts` as the deployed entrypoint; add only a small path dispatch to the
      separate `api/scan-chords.ts` handler and refactor shared method-aware CORS without regressing
      existing import behavior.
- [ ] Implement `POST /api/scan-chords` with one explicit Scan action, one multipart `image` file,
      the exact JPEG/PNG/WEBP/HEIC/HEIF whitelist, <=10 MiB file limit, no
      disk/database/provider-file persistence, and inline image data sent through `@google/genai`
      structured JSON output.
- [ ] Implement the stable error contract and precedence, including `SCAN_MULTIPART_INVALID`,
      provider rate-limit mapping, and frontend-only `SCAN_NETWORK_ERROR` /
      `SCAN_CLIENT_RESPONSE_INVALID`; surface friendly message + code whenever browser CORS permits
      reading the response.
- [ ] Revalidate every model chord through the shared deterministic normalizer; mixed bad model
      strings must not poison valid results, and zero valid strings must become
      `SCAN_NO_CHORDS_FOUND`.
- [ ] Keep default tests hermetic/offline by injecting provider behavior; module import must not
      read env or require network, and validation-failure tests must prove the provider was not
      called.
- [ ] Add backend tests for route/CORS regression and every scan error stage plus frontend/component
      tests for manual input, no-auto-scan, scan success/failure, click wiring, stale-preview
      no-save behavior, and full transient-state reset.
- [ ] Do not add, copy, encode, fixture, or otherwise commit any score/photo images supplied during
      planning; verify the final diff contains no image assets or base64 score data.
- [ ] Update `SPEC.md`, test matrices, and README/deployment documentation for the scan route,
      selected Gemini model, `GOOGLE_GENAI_API_KEY`, local two-process workflow,
      temporary/no-storage semantics, and the fact that CORS is not quota authentication.
- [ ] Run the repository quality gate from `AGENTS.md`: `deno fmt --check`, `deno lint`,
      `deno task test`, `deno task build`; also run the required mobile UI audit /
      `deno task audit:ui`, then `git diff --check`.
- [ ] **Final review gate:** invoke a fresh, read-only reviewer subagent before declaring the
      implementation complete. Follow the independent reviewer pattern used by
      `arthow4n/did-it-become-what-you-like` (`AGENTS.md` and
      `.agents/skills/implementation-planning/SKILL.md`): provide this plan, repo `AGENTS.md`, the
      complete final diff, and exact validation evidence; ask the reviewer to audit scope
      discipline, deployment-entrypoint compatibility, API-key secrecy, lazy Deno
      permissions/configuration, method-aware CORS, error-stage precedence, provider
      structured-output validation, hermetic tests, mobile single-overlay UX, and confirmation that
      no supplied score images were committed. The primary coding agent must remediate all material
      findings, rerun affected checks, and only then commit/push the completed feature.

## Ready-to-use delegation prompt

```text
Implement SCORE_SCAN_IMPLEMENTATION_PLAN.md as the single primary coding agent.
Read AGENTS.md and SPEC.md first, and confirm the chord-coverage milestone status. Keep the MVP
strictly temporary: photo/manual input -> validated chord list -> existing MiniGripDrawer. No image
storage, coordinates, score OCR, songbook save, or score reconstruction. Keep api/import.ts as the
Deno Deploy entrypoint and route /api/scan-chords to a separate handler. Use @google/genai with a
stable image-capable free-tier Flash model, GOOGLE_GENAI_API_KEY server-side, inline image bytes,
structured JSON output, lazy provider initialization, stable stage-specific error codes, and hermetic
mocked tests. Never commit any supplied score images. Run all required validation and mobile UI audit.
Before completion invoke a fresh read-only reviewer subagent as required by the last checklist item,
fix all material findings, rerun affected checks, then commit and push.
```
