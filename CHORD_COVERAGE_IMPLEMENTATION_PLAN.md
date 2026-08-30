# Mainstream Chord Coverage Implementation Plan

## Purpose

This plan expands the deterministic chord engine so the LH Stradella and RH CBA views can safely
handle the common-but-currently-missing chord symbols we expect to encounter in mainstream
piano/vocal books, guitar lead sheets, and the planned score-photo lookup feature.

This is an implementation plan, not an instruction to redesign the application. Keep the existing
architecture, UI conventions, note-spelling behavior, and Stradella/CBA interaction model unless a
change is explicitly required below. Read `AGENTS.md` and `SPEC.md` before editing code.

The score-scan feature in `SCORE_SCAN_IMPLEMENTATION_PLAN.md` should be considered **blocked for
final acceptance until this chord-coverage milestone is complete**. It may be developed
independently, but its final tests must not be weakened merely because a score-style chord such as
`Em(maj7)/D#` is not yet supported.

## Current-state constraints

The current code already has the right pipeline:

```text
raw chord text
  -> parseChord()
  -> ParsedChord / ChordQuality
  -> enrichChord()
     -> solveStradellaChord()
     -> generateCbaGrip()
  -> existing badge / mini-card / drawer UI
```

Relevant files:

- `src/types/index.ts` — `ChordQuality`, `ParsedChord`, `StradellaVoicing`, `CbaGrip`.
- `src/lib/capo/transposition.ts` — chord grammar, classification, parsing, formatting.
- `src/lib/parser/twoline.ts` — `isChordToken()` grammar used during ingestion.
- `src/lib/cba/grips.ts` — practical RH pitch sets and CBA grip generation.
- `src/lib/stradella/solver.ts` — main LH solver.
- `src/lib/stradella/compound.ts` — practical compound Stradella recipes.
- `src/lib/stradella/slash.ts` — slash-bass solver and quality-to-row mapping.
- `src/lib/stradella/grooves.ts` — accompaniment ribbon derived from the chosen LH voicing.
- `src/components/ChordBadge.tsx`, `StradellaMiniCard.tsx`, `StradellaGrid.tsx`,
  `MiniGripDrawer.tsx` — consumers that must remain truthful when a voicing has no chord button.
- `src/lib/capo/capo.test.ts`, `src/lib/cba/cba.test.ts`, `tests/unit/stress_m2_theory.test.ts`, and
  parser tests — existing test style and regression coverage.

A critical rule for this work: **never accept a distinct chord spelling and then silently render the
wrong chord tones.** A practical omission is acceptable and must be documented (for example,
omitting the fifth from an extended RH voicing); introducing a non-chord tone as though it were
exact is not.

### Locked Stradella hardware model

The existing application models a standard six-row Stradella system. For this milestone, continue
using the standard dominant-seventh button voicing in which the fifth is omitted: `1, 3, b7`. This
is why a root dominant-7 button is a safe exact subset for `7#9` and `7#5`/augmented-7 chords. Do
not add a French/root-omitted seventh-layout preference in this milestone.

Reference for the standard system: `https://www.accordions.com/index/art/stradella.shtml`.

## Locked target vocabulary

Implement exactly these semantic additions/fixes for this milestone. Do not broaden the task into a
complete jazz-chord dictionary.

| Family                      | Required spellings / aliases                                | New `ChordQuality` | Practical RH pitch-class intervals from root                                                | LH strategy                                                                                                                              |
| --------------------------- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Power chord                 | `C5`                                                        | `power5`           | `1, 5` = `[0, 7]`                                                                           | Fundamental bass only; RH supplies fifth. No major/minor chord button because that would introduce a third.                              |
| Minor-major 7               | `Cm(maj7)`, `CmMaj7`, `Cmin(maj7)`, `CmM7`                  | `minorMajor7`      | `1, b3, 5, 7` = `[0, 3, 7, 11]`                                                             | Root bass + root minor chord; RH supplies major 7.                                                                                       |
| Dominant 7 sus4             | `C7sus4`, `C7sus`                                           | `dominant7Sus4`    | `1, 4, 5, b7` = `[0, 5, 7, 10]`                                                             | Fundamental bass only; RH supplies the suspended dominant. Do not use a `C7` button because its major 3rd conflicts with the suspension. |
| Dominant 11                 | `C11`                                                       | `dominant11`       | Practical four-note RH voicing `1, b7, 9, 11` = `[0, 10, 2, 5]`; deliberately omit 3 and 5  | Root bass + minor chord on 5th, e.g. `C + Gm`; RH supplies 11. This is an exact subset of the extended harmony.                          |
| Minor 11                    | `Cm11`, `Cmin11`                                            | `minor11`          | Practical four-note RH voicing `1, b3, b7, 11` = `[0, 3, 10, 5]`; deliberately omit 5 and 9 | Root bass + major chord on b3, e.g. `C + Eb`; RH supplies 11/optional 9.                                                                 |
| Dominant 7 #9               | `C7#9`, `C7(#9)`, Unicode-sharp equivalents                 | `sevenSharpNine`   | `1, 3, b7, #9` = `[0, 4, 10, 3]`; deliberately omit 5                                       | Root bass + root dominant-7 button; RH supplies #9.                                                                                      |
| Dominant 7 #5 / augmented 7 | `C7#5`, `C7(#5)`, `Caug7`, `C+7`, Unicode-sharp equivalents | `sevenSharpFive`   | `1, 3, #5, b7` = `[0, 4, 8, 10]`                                                            | Root bass + root dominant-7 button; on standard Stradella its `1,3,b7` tones are an exact subset and RH supplies #5.                     |
| Add 4 / add 11              | `Cadd4`, `Cadd11`                                           | `add4`             | `1, 3, 4, 5` = `[0, 4, 5, 7]`                                                               | Root bass + root major chord; RH supplies 4/11. `add11` is an alias of the same practical quality for this app.                          |

### Explicit non-goals

Do **not** add the following in this milestone unless an existing regression requires a tiny
compatibility fix: `maj11`, `maj13`, `m13`, `maj7#11`, `maj7#5`, `m7#5`, `9sus4`, `9sus2`, arbitrary
multi-alteration parsing, polychords, chord-scale analysis, French/root-omitted Stradella seventh
layouts, or new jazz voicing modes.

Do not change the existing meanings of working chord families merely to make a new test pass.

## Required parser behavior

### 1. Extend `ChordQuality`

Add these values in `src/types/index.ts`:

```ts
"power5";
"minorMajor7";
"dominant7Sus4";
"dominant11";
"minor11";
"sevenSharpNine";
"sevenSharpFive";
"add4";
```

Use these exact names so downstream switches remain readable and consistent with existing names such
as `sevenFlatNine` and `sevenSharpEleven`.

### 2. Fix classification order, not just regex acceptance

`src/lib/capo/transposition.ts` currently recognizes several strings syntactically but collapses
them into another quality. The implementation must classify the locked vocabulary semantically.

Important precedence rules:

- Detect `minorMajor7` before generic `major7` and before generic `minor`.
- Detect **exactly** `7sus` / `7sus4` as `dominant7Sus4` before plain `sus4` and before plain
  `dominant7`. Do not accidentally map `7sus2` to this quality.
- Detect `sevenSharpNine` before generic `altered`.
- Detect `sevenSharpFive` before generic `augmented` and generic `altered`.
- Detect `dominant11` before any broad fallback that would treat `11` as `unknown` or another
  extension.
- Detect `minor11` before generic `minor`.
- Detect `add4` / `add11` before the current generic `add9` bucket.
- Detect `power5` rather than treating the `5` suffix as a major triad.

Preserve Unicode accidental normalization (`♯` -> `#`, `♭` -> `b`).

Regression boundary: plain `Caug` / `C+` must remain the existing `augmented` triad quality; only
the seventh-bearing aliases `Caug7` / `C+7` join `sevenSharpFive`.

### 3. Keep tokenizer validation in sync

`src/lib/parser/twoline.ts::isChordToken()` has a separate chord-token grammar. Extend it to accept
all required aliases above, including `m(maj7)` forms and parenthesized `7(#5)` / `7(#9)` forms.

Do not solve this by accepting every token starting with A-G. Invalid text must not begin producing
chord badges.

Add regression tests asserting that every locked spelling is accepted by `isChordToken()` and
classified to the expected `ChordQuality` by `parseChord()`.

### 4. Preserve slash-bass semantics

Every new family must still allow the existing `/Bass` suffix where syntactically meaningful, for
example:

- `Em(maj7)/D#`
- `Cm11/Bb`
- `C7#9/E`
- `Cadd4/G`

The slash note remains the bass instruction; it does not change the chord quality.

The specific photographed-score-style case `Em(maj7)/D#` must be a named regression test. It must
parse as root `E`, quality `minorMajor7`, bass `D#` and must not become an E-major/major-7 chord
internally.

## RH CBA implementation

### 1. Extend practical pitch sets in `src/lib/cba/grips.ts`

Add switch branches matching the exact interval table above.

The engine already uses practical four-note voicings for some large extensions, so `dominant11` and
`minor11` must remain at four RH buttons. Do not try to place five or six simultaneous notes on the
CBA grid.

### 2. Fix alteration-aware automatic spelling

In `getChordNotes()` when `noteSpelling === "auto"`:

- `sevenSharpNine` must spell the altered tone as a sharp relative to the root. Example: `C7#9`
  shows `D#`, not `Eb`.
- `sevenSharpFive` must spell the altered fifth as a sharp relative to the root. Example: `C7#5`
  shows `G#`, not `Ab`.

Explicit user overrides (`flats` / `sharps`) may continue to override automatic spelling as they do
today. Do not expand this milestone into a fully diatonic spelling engine for theoretical names such
as E# or double accidentals; preserve the repository's existing note-spelling policy outside the two
locked alterations above.

### 3. Two-note power-chord grip

`generateCbaGrip()` currently assumes triads/four-note chords when choosing the display fingering
string. For a two-note `power5` grip:

- return exactly two button coordinates;
- use the two-note fingering pattern already naturally produced by the coordinate assignment (`1-2`)
  unless a mathematical/ergonomic review demonstrates a better stable rule across all 12 roots;
- ensure the displayed `fingeringPattern` matches the actual button `finger` values rather than
  incorrectly showing `1-2-4`.

Do not invent a third note solely to reuse triad UI.

## LH Stradella implementation

### 1. Add an explicit bass-only strategy

Two new qualities cannot be represented safely by a single standard Stradella chord button without
adding a conflicting tone:

```text
power5
dominant7Sus4
```

Add a small shared predicate/constant under `src/lib/stradella/` (name at implementer discretion,
e.g. `BASS_ONLY_QUALITIES`) so both normal and slash solvers can recognize these qualities.

For a non-slash bass-only quality, `solveStradellaChord()` must return:

- a correct fundamental `rootButton`;
- `chordButton: undefined`;
- `primaryBass` and `columnOffset` as usual;
- a single-bass fingering such as `"4"`;
- a clear explanation, for example `Fundamental bass C only; RH supplies 5` or
  `Fundamental bass C only; RH supplies 7sus4`;
- correct range metadata.

Do **not** fake a major chord button.

### 2. Add exact-subset compound recipes

Add the following rules to `COMPOUND_RULES` where appropriate:

- `minorMajor7`: root bass + root minor chord (`offset 0`, minor row); explanation says RH adds
  major 7.
- `dominant11`: root bass + minor chord on 5th (`+7 semitones`, Circle-of-Fifths `+1`); explanation
  says RH adds 11.
- `minor11`: root bass + major chord on b3 (`+3 semitones`, existing b3 column delta); explanation
  says RH adds 11/9.
- `sevenSharpNine`: root bass + root seventh chord (`offset 0`, seventh row); explanation says RH
  adds #9.
- `sevenSharpFive`: root bass + root seventh chord (`offset 0`, seventh row); explanation says RH
  adds #5.
- `add4`: root bass + root major chord (`offset 0`, major row); explanation says RH adds 4/11.

These recipes must use only chord tones or deliberate omissions. Do not add a non-chord tone merely
to create a visually busier LH diagram.

### 3. Make slash solver aware of the new families

`src/lib/stradella/slash.ts` currently maps quality to a chord row independently of the main solver.
Update it so:

- `power5` and `dominant7Sus4` remain bass-only even with a slash bass; the selected slash bass may
  be fundamental or counter-bass according to the existing minimum-distance algorithm, but
  `chordButton` stays absent.
- `minorMajor7` and `minor11` use the minor row when a simplified root chord button is appropriate.
- `dominant11`, `sevenSharpNine`, and `sevenSharpFive` use the seventh row for slash-chord
  simplification; on the locked standard Stradella model those row tones are a subset of the
  theoretical chord.
- `add4` uses the major row.

Keep the current minimum-distance slash-bass algorithm unchanged.

### 4. Prevent groove fallback from lying

`src/lib/stradella/grooves.ts` currently invents a root-major chord name when `voicing.chordButton`
is missing. That is unsafe once bass-only qualities are deliberate.

Change groove solving so a voicing with no `chordButton` does **not** produce fake chord/chop steps.
For this milestone the simplest correct behavior is:

```text
if voicing has no chordButton -> no groove ribbon for that chord
```

Returning `null` is acceptable. Do not add a new rhythmic bass-only groove system in this milestone.

### 5. Verify existing UI consumers

`StradellaGrid`, `StradellaMiniCard`, `ChordBadge`, and `MiniGripDrawer` already use optional
`chordButton` in many places. Confirm with tests/visual audit that bass-only voicings:

- show the selected bass button and no phantom chord button;
- show a useful explanation / recipe label;
- do not display an empty `+` recipe;
- do not show a fake major groove ribbon;
- remain tappable and open the existing drawer normally.

Make only the minimum UI guard changes needed to satisfy those conditions.

## Required test matrix

Tests must prove semantics, not merely prove that parsing does not throw.

### Parser/classifier tests

For each family, test at least the canonical C-root spelling plus aliases. Include Unicode `♯` where
relevant. Assert `quality`, normalized root, extension, slash bass, and formatted raw chord where
appropriate.

Mandatory named regressions:

```text
C5
Cm(maj7)
CmMaj7
Em(maj7)/D#
C7sus4
C7sus
C11
Cm11
C7#9
C7(#9)
C7#5
C7(#5)
Caug7
C+7
Cadd4
Cadd11
```

Also add guard regressions proving plain `Caug` / `C+` remain `augmented`, and that `C7sus2` is not
accidentally classified as `dominant7Sus4` by the new precedence rule.

### RH interval tests

For every new quality, assert exact pitch classes for root C. Then run a 12-root loop checking
interval transposition modulo 12.

Also assert:

- `C7#9` auto-spells the #9 as `D#`.
- `C7#5` auto-spells the #5 as `G#`.
- `C5` produces exactly 2 coordinates and a matching two-finger display pattern.
- `C11` and `Cm11` produce no more than 4 simultaneous RH buttons.

### LH recipe tests

Assert exact recipes for root C and at least one flat/sharp root. Add 12-root loop coverage for
column/range invariants where practical.

Mandatory expectations:

```text
Cm(maj7) -> C bass + Cm button
C11      -> C bass + Gm button
Cm11     -> C bass + Eb major button
C7#9     -> C bass + C7 button
C7#5     -> C bass + C7 button
Cadd4    -> C bass + C major button
C5       -> C bass only, no chordButton
C7sus4   -> C bass only, no chordButton
```

For bass-only qualities (`power5`, `dominant7Sus4`), assert `solveStradellaGroove(...) === null` for
an enabled groove.

For `Em(maj7)/D#`, assert the slash-bass choice and ensure the chord row is minor rather than major.

### Regression tests

Run the existing parser, capo/enharmonic, Stradella, CBA, rendering and stress tests. Existing
supported qualities must not change their pitch sets or LH recipe unexpectedly.

## Documentation updates during implementation

After code/tests pass:

- Update `SPEC.md` with the new `ChordQuality` semantics, the standard Stradella seventh-button
  assumption, and test matrix IDs.
- Update README chord-coverage wording only if it currently makes a statement that becomes stale.
- Do not add a giant chord dictionary to README.

## Recommended execution order

1. Types + parser/classifier + tokenizer acceptance tests.
2. RH pitch sets + spelling + power-chord two-note grip tests.
3. LH compound/bass-only/slash behavior + groove safety tests.
4. Minimal UI guards for bass-only voicings.
5. Full regression and mobile UI audit.
6. Documentation update.
7. Independent reviewer gate and remediation.

## Completion checklist

- [ ] Read `AGENTS.md`, `SPEC.md`, this plan, and the existing parser/CBA/Stradella tests before
      editing.
- [ ] Add the eight exact `ChordQuality` values listed in this plan; do not add unrelated chord
      families.
- [ ] Update `parseChord()` / classification precedence and `isChordToken()` so every locked alias
      maps to the correct semantic quality without changing `Caug`/`C+` or accidentally absorbing
      `7sus2`.
- [ ] Add parser regressions including `Em(maj7)/D#` and ensure unsupported text is not accidentally
      accepted as a chord.
- [ ] Implement the exact RH practical interval sets, alteration-aware auto-spelling, and truthful
      two-note `power5` fingering display.
- [ ] Implement the LH exact-subset compound recipes and two-quality bass-only strategy exactly as
      specified, including `sevenSharpFive -> root 7th button` on the standard Stradella model.
- [ ] Update slash-chord behavior for the new qualities without changing the existing
      minimum-distance bass algorithm.
- [ ] Prevent `solveStradellaGroove()` from inventing a major chord when `chordButton` is absent.
- [ ] Add/extend unit and stress tests across all 12 roots where specified; keep default tests
      hermetic and offline.
- [ ] Run the repository quality gate from `AGENTS.md`: `deno fmt --check`, `deno lint`,
      `deno task test`, `deno task build`; because theory/UI output changes, also run the
      appropriate `deno task audit:ui` / targeted mobile visual audit required by `AGENTS.md`.
- [ ] Update `SPEC.md` and any narrowly affected README wording, then confirm `git diff --check` and
      that no unrelated files/assets were added.
- [ ] **Final review gate:** invoke a fresh, read-only reviewer subagent before declaring the work
      complete. Model this after the independent review-gate pattern in
      `arthow4n/did-it-become-what-you-like` (`AGENTS.md` and
      `.agents/skills/implementation-planning/SKILL.md`): give the reviewer this plan, `AGENTS.md`,
      the final diff, and test evidence; ask it to audit music-theory correctness across all 12
      roots, parser precedence, the standard Stradella seventh-button assumption, LH/RH
      truthfulness, regressions, and test adequacy without editing code. The primary coding agent
      must fix all material findings, rerun affected checks, and only then commit/push the completed
      implementation.

## Ready-to-use delegation prompt

```text
Implement CHORD_COVERAGE_IMPLEMENTATION_PLAN.md as the single primary coding agent.
Read AGENTS.md and SPEC.md first. Follow the plan literally unless repository reality makes a step
unsafe; if so, record the mismatch and choose the smallest compatible correction. Keep the work
limited to the eight locked chord families. Add tests before considering each semantic change done.
Do not weaken existing tests or change the slash-distance algorithm. Run the mandated quality gates.
Before completion, invoke a fresh read-only reviewer subagent exactly as required by the last checklist
item, remediate its material findings, rerun affected validation, then commit and push.
```
