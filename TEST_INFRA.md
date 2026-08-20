# E2E Test Infra: Accordion Lead Sheet Companion

## Test Philosophy

- **Requirement-Driven & Opaque-Box**: Test cases derive directly from `ORIGINAL_REQUEST.md` and
  `SPEC.md` without coupling to internal private state.
- **Multi-Tier Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise
  Combinatorial Testing + Real-World Workloads + Browser Automation.
- **Zero-Tolerance Quality Gates**: 100% test pass on `deno test`, zero warnings on `deno lint`,
  zero formatting discrepancies on `deno fmt --check`, zero TypeScript errors on `deno task build`.

---

## Feature Inventory & Test Coverage

| #       | Feature                       |      Test Tier 1       |      Test Tier 2       |          Test Tier 3           |        Test Tier 4 / E2E         |    Source Matrix     |
| ------- | ----------------------------- | :--------------------: | :--------------------: | :----------------------------: | :------------------------------: | :------------------: |
| F5      | Capo & Enharmonics            | CAPO-01..04 (5 tests)  | CAPO-05..08 (5 tests)  |    Transpose + Slash Chords    |   Key transposition scenarios    |  CAPO-01 to CAPO-08  |
| F6/F7   | Stradella Core & Slash Solver | STRAD-01..08 (8 tests) | STRAD-09..12 (5 tests) |   Slash Chords + Inversions    | Standard tunes (C/E, G/B, D/F#)  | STRAD-01 to STRAD-12 |
| F8      | Stradella Compound Voicings   | STRAD-13..16 (5 tests) | STRAD-17..19 (5 tests) |     Compound + Capo shifts     | Jazz lead sheets (maj7, m7b5, 9) | STRAD-13 to STRAD-19 |
| F9      | CBA C-System Treble Engine    |  CBA-01..03 (5 tests)  |  CBA-04..06 (5 tests)  |   3-row vs 5-row hand shifts   | Chord progression voice leading  |   CBA-01 to CBA-06   |
| F10     | Segmented Tokenizer           | PARSE-01..02 (5 tests) | PARSE-03..04 (5 tests) |     ChordPro + Tab staves      |    Multi-stanza chord sheets     | PARSE-01 to PARSE-04 |
| F12-F14 | Scraper API & Tab Ingestion   |  API-01..03 (5 tests)  |  API-04..05 (5 tests)  | CORS preflight + Origin checks |     Web tab import workloads     |   API-01 to API-05   |
| F16-F19 | Hardware & Offline Storage    |  UX-01..04 (5 tests)   |  UX-05..07 (5 tests)   | WakeLock + Pedal + AutoScroll  |  Airplane mode live performance  |    UX-01 to UX-07    |
| F20-F24 | UI Components & PWA           |  E2E-01..03 (3 specs)  |  E2E-04..06 (3 specs)  |  Mobile viewports (360-430px)  |    Full user session workflow    |   E2E-01 to E2E-06   |

---

## Test Architecture

1. **Unit & Engine Test Suite (`deno test`)**:
   - Location: `src/lib/**/*.test.ts`, `api/**/*.test.ts`, `tests/ux/**/*.test.ts`
   - Runner: Native Deno 2 test runner (`deno test --allow-read --allow-net`)
   - Assertion Style: Standard `@std/assert` or `@std/expect`
2. **Browser Automation E2E Suite (`tests/e2e/`)**:
   - Location: `tests/e2e/leadsheet.spec.ts`
   - Runner: Browser automation exercising rendered DOM in mobile viewports (360px–430px)
   - Test Scenarios:
     - `E2E-01`: Atomic flex-column layout validation without wrapping or drift on mobile viewports.
     - `E2E-02`: Real-time Capo transposition updates chord badges instantly.
     - `E2E-03`: Tapping chord badge opens `MiniGripDrawer` with visual button grid without page
       scrolling.
     - `E2E-04`: 1-Tap clipboard ingestion modal parses lead sheets and detects capo fret.
     - `E2E-05`: Delta-time auto-scroll initiates, pauses on user touch, and auto-resumes after
       3.5s.
     - `E2E-06`: Offline songbook loads and operates without network access (IndexedDB persistence).

---

## Real-World Application Scenarios (Tier 4)

| # | Scenario                                                  | Features Exercised        | Expected Outcome                                                                        |
| - | --------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| 1 | Standard Folk Lead Sheet ("Bella Ciao" in Am with Capo 2) | F5, F6, F7, F10, F20, F21 | Chords transpose to Bm, Stradella buttons map cleanly to Bm bass & F#7 counter-bass.    |
| 2 | Jazz Standard ("Autumn Leaves" with Slash Chords & m7b5)  | F7, F8, F9, F20, F22      | Compound voicings (Cm7 = C+eb, Am7b5 = A+cm, F#m7b5) render correct 4+3 fingerings.     |
| 3 | Live Stage Performance with Auto-Scroll & Pedal           | F17, F18, F19, F20        | Screen remains awake, auto-scroll runs smoothly, Bluetooth pedal advances 80% viewport. |
| 4 | Web Ingestion from Ultimate Guitar & Chordie              | F12, F13, F14, F23        | URL imported via edge proxy, chords parsed to ChordLyricSegment tokens, capo detected.  |
| 5 | Airplane Mode Performance & Offline IndexedDB Storage     | F16, F24, F20             | App loads from PWA cache, user songs load from IndexedDB without network requests.      |

---

## Coverage Thresholds

- **Tier 1 (Feature Coverage)**: ≥ 5 test cases per feature (Total ≥ 40 unit test cases across all
  engine modules).
- **Tier 2 (Boundary & Corner Cases)**: ≥ 5 test cases per feature covering out-of-range chords,
  empty lines, capo limits 0–11, invalid CORS origins, and touch collision boundaries.
- **Tier 3 (Cross-Feature Combinations)**: Complete pairwise tests combining Capo transposition +
  Stradella slash solving + CBA voicing + Segmented token rendering.
- **Tier 4 (Real-World Application Scenarios)**: 5 end-to-end full song application scenarios.
- **Tier 5 (Adversarial Hardening)**: White-box edge case testing for regression prevention.
