# 🏁 TEST_READY — Offline Score Reader Test Suite Complete

**Milestone**: Score Reader Stabilization & Offline Completion\
**Subagent**: Test Writer E2E (`test_writer_e2e`)\
**Parent Orchestrator ID**: `ca605b81-7f92-4291-96fe-91d887f0f68a`\
**Date**: 2026-09-23\
**Status**: ✅ **VERIFIED READY & PASSING (100% Hermetic Offline)**

---

## 1. Executive Summary

A comprehensive, requirement-driven, opaque-box test suite for the offline score reader has been
designed, implemented, and verified. The suite provides exhaustive coverage across all 4 tiers of
the test architecture without external network dependencies, mock bypasses, or fragile timing
band-aids.

- **Total Hermetic Tests**: **440 passed / 0 failed** across 23 test files (execution time: 8
  seconds).
- **New Tests Implemented in this Milestone**: **69 tests**
  - `tests/e2e/score_reader.test.ts`: **45 tests**
  - `tests/ux/score_reader_ux.test.tsx`: **24 tests**
- **Test Infrastructure Documentation**: `TEST_INFRA.md` published in repository root.

---

## 2. 4-Tier Test Coverage Breakdown

### Tier 1: Feature Coverage (>=5 tests per feature)

1. **Staves (6 tests)**:
   - `T1-STAVE-01`: Standard 5-line staff detection and line spacing calculation.
   - `T1-STAVE-02`: Multi-stave vertical grouping across vertical page gaps.
   - `T1-STAVE-03`: Noise rejection: stray lines (< 5 lines) and isolated artifacts ignored.
   - `T1-STAVE-04`: Staff bounding box calculation with headroom (chords) and footroom (lyrics).
   - `T1-STAVE-05`: `extractStaffCropTensor` produces normalized 128px-height tensor with valid
     dimension bounds.
   - `T1-STAVE-06`: Tolerance to slight line spacing variance (11–13px within staff).

2. **Barlines (6 tests)**:
   - `T1-BARLINE-01`: Full-height barline detection spanning lines 1 to 5.
   - `T1-BARLINE-02`: Short vertical stroke rejection: note stems and accidentals removed by
     `MORPH_OPEN`.
   - `T1-BARLINE-03`: Barline deduplication within 8px window merges double-thick engraved strokes.
   - `T1-BARLINE-04`: Sequential measure slicing produces strictly ordered `writtenIndex`.
   - `T1-BARLINE-05`: Minimum measure width threshold prevents runaway micro-slices.
   - `T1-BARLINE-06`: Final barline near right margin bounds last measure cleanly.

3. **Chords (6 tests)**:
   - `T1-CHORD-01`: `mxhmToChordSymbol` converts standard triads and dominant 7ths (`C`, `G7`, `Dm`,
     `F`, `Am7`).
   - `T1-CHORD-02`: Half-diminished and diminished mappings (`Bm7b5`, `F#m7b5`, `D#dim7`, `Gdim`).
   - `T1-CHORD-03`: Slash chord parsing with counter-bass and fundamental bass preservation (`C/G`,
     `Am7/E`, `G7/B`).
   - `T1-CHORD-04`: Extended jazz qualities (`Ebmaj7`, `Bbsus4`, `Gaug`, `C9`, `D11`, `E13`).
   - `T1-CHORD-05`: Every parsed chord resolves to playable Stradella button pairings.
   - `T1-CHORD-06`: Score fusion chord agreement upgrades confidence to 0.95.

4. **Meter (6 tests)**:
   - `T1-METER-01`: Standard simple meters (4/4, 3/4, 2/4) parsing via deterministic tokens.
   - `T1-METER-02`: Compound 6/8 meter recognition with rational beat conversion
     (`beats: 6, beatType: 8`).
   - `T1-METER-03`: Common time ("C", 4/4) and cut time ("C|", 2/2) translation.
   - `T1-METER-04`: Humdrum kern meter parsing (`*M4/4`, `*M3/4`, `*M6/8`).
   - `T1-METER-05`: `fuseScoreDocument` deterministically supplements 6/8 meter over default 4/4.
   - `T1-METER-06`: Multi-line stacked digit meter notation parsing ("6\n8", "3 4", "9/8").

5. **Key Signatures (6 tests)**:
   - `T1-KEY-01`: Key signatures with 1 to 6 sharps (`*k[f#]` to `*k[f#c#g#d#a#e#]`).
   - `T1-KEY-02`: Key signatures with 1 to 6 flats (`*k[b-]` to `*k[b-e-a-d-g-c-]`).
   - `T1-KEY-03`: Natural key verification (`*k[]`, C Major / A Minor, 0 fifths).
   - `T1-KEY-04`: Text key declaration parsing ("Key: G", "Bb Major", "F# Minor", "D Major").
   - `T1-KEY-05`: `fuseScoreDocument` supplements non-zero key signature across all measures.
   - `T1-KEY-06`: Minor key signatures properly offset relative major fifths (-3 fifths).

6. **Mobile Touch Targets (7 tests)**:
   - `T1-TOUCH-01`: `ScoreReviewQueue` "Review Issues" trigger button maintains
     $\ge 44 \times 44\text{px}$ touch target.
   - `T1-TOUCH-02`: `ScoreReviewQueue` primary interactive controls enforce `min-h-[44px]`.
   - `T1-TOUCH-03`: Multi-issue review queue container enforces `min-h-[44px]` accessibility
     classes.
   - `T1-TOUCH-04`: `ImportModal` action buttons ("Cancel", "Save to Songbook", "Fetch", Close)
     maintain $\ge 44\text{px}$.
   - `T1-TOUCH-05`: `ImportModal` 5-tab switcher buttons provide dedicated accessible touch targets.
   - `T1-TOUCH-06`: `GuidedPhotoPreview` `<details><summary>` and boundary adjustment controls meet
     accessibility standard.
   - `T1-TOUCH-07`: `LeadSheetReader` score reader controls enforce `min-h-[44px]` (Previous, Next,
     Loop, Count-in).

7. **Drawer Screen Occlusion (6 tests)**:
   - `T1-DRAWER-01`: `ScoreReviewQueue` closed state consumes $\le 10\%$ of standard mobile viewport
     height.
   - `T1-DRAWER-02`: Occlusion verification on compact 667px viewport (iPhone SE) strictly clamps to
     $\le 35\%$.
   - `T1-DRAWER-03`: Occlusion verification on 844px viewport (iPhone 12/13/14) strictly clamps to
     $\le 35\%$.
   - `T1-DRAWER-04`: Occlusion verification on 932px viewport (iPhone 14 Pro Max) strictly clamps to
     $\le 35\%$.
   - `T1-DRAWER-05`: Review queue renders non-blocking alongside score notation without pushing
     notation offscreen.
   - `T1-DRAWER-06`: `ScoreReviewQueue` renders null ($0\%$ occlusion) when zero actionable issues
     exist.

### Tier 2: Boundary & Corner Edge Cases (11 tests)

- `T2-EDGE-01` to `T2-EDGE-06`: Degenerate images (< 32x32), all-white / all-black frames, skew
  angle search ($\pm 15^\circ$), dense chord measures (4 chords/bar), multi-system scores (16
  measures), and altered jazz voicings (`C7#9`, `Ab13`).
- `T2-UX-EDGE-01` to `T2-UX-EDGE-05`: 360px viewport tab stability, 390px segmented guidance, 430px
  typography, 8+ issue count handling, and informational issue filtering.

### Tier 3: Cross-Feature Interactions (9 tests)

- `T3-XFEAT-01` to `T3-XFEAT-05`: Rhythm offset synchronization, 6/8 compound meter with stepwise
  chromatic slash bass (`C/B -> B_`), layout `sourceBox` measure linkage, speculative low-confidence
  melody isolation, and session undo/redo stack persistence.
- `T3-UX-XFEAT-01` to `T3-UX-XFEAT-04`: Real-time chord editing sync, photo preview layout
  dimensions, interactive playback controls during review, and non-blocking guidance workflow.

### Tier 4: Real-World Scenarios (6 tests)

- `T4-SCENARIO-01`: Folk Song Photo Import ("Bella Ciao" in Am, 4/4) $\rightarrow$ OMR Transcription
  $\rightarrow$ Immediate Playback.
- `T4-SCENARIO-02`: Jazz Standard ("Autumn Leaves" in G, 4/4) $\rightarrow$ Disagreement Resolution
  (`F#m7b5`) $\rightarrow$ Playback Ready.
- `T4-SCENARIO-03`: 3/4 Waltz with multi-measure repeat barlines (`=1|:`, `=:|!`) $\rightarrow$
  Route Navigation.
- `T4-SCENARIO-04`: Corrupted mobile camera capture $\rightarrow$ graceful fallback $\rightarrow$
  manual measure recovery.
- `T4-UX-SCENARIO-01`: End-to-end UX flow: `ImportModal` open $\rightarrow$ Score review queue
  $\rightarrow$ Playback ready.
- `T4-UX-SCENARIO-02`: Guided photo missing original image displays recoverable relink action.

---

## 3. Pre-Push Quality Gate Results

All commands executed from repository root and verified passing:

```bash
# 1. Format verification (148 files checked)
deno fmt --check
# Result: Checked 148 files (0 errors)

# 2. Static analysis & linter (128 files checked)
deno lint
# Result: Checked 128 files (0 errors or warnings)

# 3. Hermetic unit, component, UX, & E2E test suite (100% passing tests)
deno task test
# Result: ok | 440 passed | 0 failed (8s)
```
