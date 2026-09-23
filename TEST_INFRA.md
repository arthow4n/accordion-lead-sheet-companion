# 🧪 Offline Score Reader Test Infrastructure & Architecture

**Project**: Score Reader Stabilization & Offline Completion\
**Standard**: 4-Tier Opaque-Box Test Architecture\
**Target Subsystems**: Staff Geometry, OMR/Chords, Meter/Key Recognition, Mobile Accessibility, and
Review Queue\
**Runtime**: Pure Deno 2 (Hermetic, Offline, Zero-Network)

---

## 1. 4-Tier Test Architecture Overview

The offline score reader test suite adheres to an opaque-box, requirement-driven 4-tier testing
hierarchy designed to guarantee stability, performance, and accessibility across diverse mobile
hardware and sheet music layouts.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Tier 4: Real-World Scenarios                      │
│   Full End-to-End Photo Import -> OMR Transcription -> Review Queue    │
│                     -> Immediate Playback Transition                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  Tier 3: Cross-Feature Interactions                    │
│   Chords + Melody Fusion · 6/8 Meter + Slash Chords · Camera Geometry  │
│          + Playback Highlighting · Session Correction Propagation      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                 Tier 2: Boundary & Corner Edge Cases                   │
│   Corrupted / Empty Images · Skew Angles (±15°) · Multi-System Scores   │
│         · Rapid Chord Progressions · Mobile Viewports 360px-430px      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                      Tier 1: Feature Coverage                          │
│   Staves (6) · Barlines (6) · Chords (6) · Meter (6) · Key Sigs (6)   │
│           · Touch Targets >= 44px (7) · Drawer Occlusion <= 35% (6)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test File Ownership & Organization

| Test Suite File                     | Domain Scope                                                                                                 | Test Count | Key Features Covered                                                                                                                                                                       |
| :---------------------------------- | :----------------------------------------------------------------------------------------------------------- | :--------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/score_reader.test.ts`    | End-to-end recognition pipeline, computer vision geometry, music theory fusion, and end-to-end user journeys |     45     | Staves, barlines, note-stem immunity, Humdrum chords, 6/8 meter, key signatures (0-6 sharps/flats), slash chords, multi-system scores, real-world songs (Bella Ciao, Autumn Leaves, Waltz) |
| `tests/ux/score_reader_ux.test.tsx` | Mobile UX, component layout, touch target accessibility, and screen occlusion                                |     24     | Mobile touch targets (`min-h-[44px]`), drawer screen occlusion ($\le 35\%$), mobile viewports (360px–430px), non-blocking review queue, and playback transition                            |

---

## 3. Feature Coverage Matrix (Tiers 1–4)

### Tier 1: Feature Coverage (>=5 tests per feature)

#### Feature 1: Staves (`tests/e2e/score_reader.test.ts`)

- `T1-STAVE-01`: Standard 5-line staff detection and line spacing calculation.
- `T1-STAVE-02`: Multi-stave vertical grouping across vertical page gaps.
- `T1-STAVE-03`: Noise rejection: stray lines (< 5 lines) and isolated artifacts ignored.
- `T1-STAVE-04`: Staff bounding box calculation with headroom (chords) and footroom (lyrics).
- `T1-STAVE-05`: `extractStaffCropTensor` produces normalized 128px-height tensor with valid
  dimension bounds.
- `T1-STAVE-06`: Tolerance to slight line spacing variance (11–13px within staff).

#### Feature 2: Barlines (`tests/e2e/score_reader.test.ts`)

- `T1-BARLINE-01`: Full-height barline detection spanning lines 1 to 5.
- `T1-BARLINE-02`: Short vertical stroke rejection: note stems and accidentals removed by
  `MORPH_OPEN`.
- `T1-BARLINE-03`: Barline deduplication within 8px window merges double-thick engraved strokes.
- `T1-BARLINE-04`: Sequential measure slicing produces strictly ordered `writtenIndex`.
- `T1-BARLINE-05`: Minimum measure width threshold prevents runaway micro-slices.
- `T1-BARLINE-06`: Final barline near right margin bounds last measure cleanly.

#### Feature 3: Chords (`tests/e2e/score_reader.test.ts`)

- `T1-CHORD-01`: `mxhmToChordSymbol` converts standard triads and dominant 7ths (`C`, `G7`, `Dm`,
  `F`, `Am7`).
- `T1-CHORD-02`: Half-diminished and diminished mappings (`Bm7b5`, `F#m7b5`, `D#dim7`, `Gdim`).
- `T1-CHORD-03`: Slash chord parsing with counter-bass and fundamental bass preservation (`C/G`,
  `Am7/E`, `G7/B`).
- `T1-CHORD-04`: Extended jazz qualities (`Ebmaj7`, `Bbsus4`, `Gaug`, `C9`, `D11`, `E13`).
- `T1-CHORD-05`: Every parsed chord resolves to playable Stradella button pairings.
- `T1-CHORD-06`: Score fusion chord agreement upgrades confidence to 0.95.

#### Feature 4: Meter (`tests/e2e/score_reader.test.ts`)

- `T1-METER-01`: Standard simple meters (4/4, 3/4, 2/4) parsing via deterministic tokens.
- `T1-METER-02`: Compound 6/8 meter recognition with rational beat conversion
  (`beats: 6, beatType: 8`).
- `T1-METER-03`: Common time ("C", 4/4) and cut time ("C|", 2/2) translation.
- `T1-METER-04`: Humdrum kern meter parsing (`*M4/4`, `*M3/4`, `*M6/8`).
- `T1-METER-05`: `fuseScoreDocument` deterministically supplements 6/8 meter over default 4/4.
- `T1-METER-06`: Multi-line stacked digit meter notation parsing ("6\n8", "3 4", "9/8").

#### Feature 5: Key Signatures (`tests/e2e/score_reader.test.ts`)

- `T1-KEY-01`: Key signatures with 1 to 6 sharps (`*k[f#]` to `*k[f#c#g#d#a#e#]`).
- `T1-KEY-02`: Key signatures with 1 to 6 flats (`*k[b-]` to `*k[b-e-a-d-g-c-]`).
- `T1-KEY-03`: Natural key verification (`*k[]`, C Major / A Minor, 0 fifths).
- `T1-KEY-04`: Text key declaration parsing ("Key: G", "Bb Major", "F# Minor", "D Major").
- `T1-KEY-05`: `fuseScoreDocument` supplements non-zero key signature across all measures.
- `T1-KEY-06`: Minor key signatures properly offset relative major fifths (-3 fifths).

#### Feature 6: Mobile Touch Targets (`tests/ux/score_reader_ux.test.tsx`)

- `T1-TOUCH-01`: `ScoreReviewQueue` "Review Issues" trigger button maintains
  $\ge 44 \times 44\text{px}$ touch target.
- `T1-TOUCH-02`: `ScoreReviewQueue` primary interactive controls enforce `min-h-[44px]`.
- `T1-TOUCH-03`: Multi-issue review queue container enforces `min-h-[44px]` accessibility classes.
- `T1-TOUCH-04`: `ImportModal` action buttons ("Cancel", "Save to Songbook", "Fetch", Close)
  maintain $\ge 44\text{px}$.
- `T1-TOUCH-05`: `ImportModal` 5-tab switcher buttons provide dedicated accessible touch targets.
- `T1-TOUCH-06`: `GuidedPhotoPreview` `<details><summary>` and boundary adjustment controls meet
  accessibility standard.
- `T1-TOUCH-07`: `LeadSheetReader` score reader controls enforce `min-h-[44px]` (Previous, Next,
  Loop, Count-in).

#### Feature 7: Drawer Screen Occlusion (`tests/ux/score_reader_ux.test.tsx`)

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

---

### Tier 2: Boundary & Corner Cases

- `T2-EDGE-01`: Degenerate sub-32x32 images return safe fallback layout without throwing uncaught
  exceptions.
- `T2-EDGE-02`: All-white and all-black frames return graceful fallback layout
  (`usedFallback: true`).
- `T2-EDGE-03`: `estimateSkewAngle` estimates rotation within $\pm 15^\circ$ search window.
- `T2-EDGE-04`: Dense chord progressions (4 chords in 1 measure) preserve distinct beat offsets.
- `T2-EDGE-05`: Multi-system score (4 systems, 16 measures) preserves measure order and indexing.
- `T2-EDGE-06`: Altered jazz voicings and polychords (`C7(#9)`, `Ab13`, `Eb/Bb`) preserve harmony
  integrity.
- `T2-UX-EDGE-01`: 360px mobile viewport renders `ImportModal` tab switcher without container
  blowout.
- `T2-UX-EDGE-02`: 390px mobile viewport renders `LeadSheetReader` with segmented measure guidance.
- `T2-UX-EDGE-03`: 430px mobile viewport renders review queue with readable typography and compact
  styling.
- `T2-UX-EDGE-04`: High issue count (8+ issues) displays correct total count in queue header.
- `T2-UX-EDGE-05`: Non-actionable informational issues are filtered out from the actionable review
  queue.

---

### Tier 3: Cross-Feature Interactions

- `T3-XFEAT-01`: Score fusion synchronizes melody notes and chord harmonies by beat offset.
- `T3-XFEAT-02`: 6/8 compound meter with stepwise chromatic bass slash chords (`C`, `C/B`
  $\rightarrow$ `B_`, `Am`, `Am/G`, `F`, `G7/B`).
- `T3-XFEAT-03`: Camera photo layout measures are correlated with `ScoreDocument` measures
  (`sourceBox` linkage).
- `T3-XFEAT-04`: Low-confidence melody notes (< 0.35) are isolated as `low_melody_confidence`
  without affecting chords.
- `T3-XFEAT-05`: Score correction session updates persist through undo/redo stack.
- `T3-UX-XFEAT-01`: `ScoreReviewQueue` quick chord update synchronizes with session document.
- `T3-UX-XFEAT-02`: `GuidedPhotoPreview` with detected layout displays measure count and dimensions.
- `T3-UX-XFEAT-03`: Playback controls remain active and interactive in `LeadSheetReader` during
  score review.
- `T3-UX-XFEAT-04`: Non-blocking workflow allows immediate transition from review queue to playback.

---

### Tier 4: Real-World Scenarios

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

## 4. Quality Gate Execution Guide

To verify the test suite locally per `AGENTS.md`:

```bash
# 1. Format verification (Zero formatting discrepancies)
deno fmt --check

# 2. Static analysis & linter (Zero errors or warnings)
deno lint

# 3. Hermetic unit, component, UX & E2E test suite (100% passing tests)
deno task test

# 4. Target-specific verification commands
deno test --allow-read --allow-env=NODE_ENV tests/e2e/score_reader.test.ts
deno test --allow-read --allow-env=NODE_ENV tests/ux/score_reader_ux.test.tsx
```
