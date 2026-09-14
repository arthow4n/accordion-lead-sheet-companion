# CBA melody-path specification (v1)

This is the physical-layout contract for the future melody fingering solver. It is intentionally
separate from the existing chord-grip lattice: chord grips use pitch classes and a convenient
12-column teaching view, while melody guidance must distinguish octaves and the finite edges of a
real instrument.

## Authority and scope

The supported profile is `roland-fr-1xb-c-griff-europe-v1`. The existing app CBA grid remains the
coordinate authority for row numbering, row staggering, and pitch-class assignment. The FR-1XB
manual is used only for the physical profile and absolute anchor:

- Roland documents 62 velocity-sensitive right-hand buttons and C-Griff Europe as a treble mode in
  the [FR-1XB specifications](https://www.roland.com/global/products/fr-1xb/support/).
- The [FR-1x owner manual treble diagram](https://cdn.roland.com/assets/media/pdf/FR-1x_e02_W.pdf)
  labels the C-Griff Europe buttons with their octaves and MIDI note numbers (manual pp. 49–50).
- The proven
  [accordion-fingering-practice-midi project](https://github.com/arthow4n/accordion-fingering-practice-midi)
  uses the FR-1XB treble MIDI channel and a conservative G3–G6 practice range. That range is a
  useful default exercise window, not a claim that the physical keyboard ends at G3 or G6.

“Orientation” here means only how coordinates are read by the app: row 1 is the outer/fingertip
side, row 5 is the innermost auxiliary side, and increasing columns move toward the high register.
It does not ask the player to hold the phone in a particular direction. “Hand” means the right hand
treble manual, distinguishing it from the left-hand Stradella manual.

## Absolute coordinate model

The current app grid defines row offsets (in semitones) as:

```text
o(1)=0, o(2)=1, o(3)=2, o(4)=0, o(5)=1
```

The approved FR-1XB anchor is row 1, column 5 = C4 = MIDI 60. Therefore:

```text
midi(row, column) = 60 + 3 * (column - 5) + o(row)
```

The physical row bounds are:

```text
row 1: columns 4..15 (12 buttons)
row 2: columns 3..15 (13 buttons)
row 3: columns 3..14 (12 buttons)
row 4: columns 3..15 (13 buttons; duplicate of row 1)
row 5: columns 3..14 (12 buttons; duplicate of row 2)
```

That is 62 buttons. The resulting range is F#3 (MIDI 54) through G6 (MIDI 91). Rows 4 and 5 are
physical auxiliary rows, not octave transpositions; they duplicate rows 1 and 2 in pitch assignment.
`SpelledPitch` is retained for display, while MIDI pitch class plus octave selects physical
candidates. A score’s 16-foot/register label is metadata for the selected instrument sound; it must
not silently alter the source notation’s octave. An explicit user transposition may add an integer
semitone offset before candidate lookup.

## Candidate enumeration

For a written pitch `p` and optional explicit transposition `t`:

```text
q = midi(p) + t
Candidates(q) = {
  (r,c) | rowBounds(r).min <= c <= rowBounds(r).max and midi(r,c) = q
}
```

Candidates are returned in deterministic row/column order. Enharmonic spellings (for example `G#4`
and `Ab4`) share candidates but the original spelling remains available to the renderer. An empty
set is an out-of-range diagnostic, never an invented octave or nearest-note substitute.

## Melody-path state and cost (solver milestone)

The eventual dynamic-programming state is `(button, finger, handPosition, previousTransition)`.
`button` is a physical row/column candidate; `finger` is 1–5; `handPosition` is a bounded centroid
estimate; and `previousTransition` records direction and whether the preceding event was a rest,
tie, or phrase boundary. A state is invalid when it violates a user lock or an instrument bound.

For adjacent events, the initial versioned cost terms are:

```text
4.0 * |Δcolumn|                         column travel
1.5 * |Δrow|                            row travel
2.0 * repeated-button indicator        repeated-note stability
3.0 * same-finger/different-button     awkward re-articulation
6.0 * finger-crossing indicator        crossing penalty
3.0 * max(0, stretch-2)^2              excessive span
1.0 * thumb-use indicator               thumb is allowed but discouraged
```

After a rest or explicit phrase boundary, the hand-position term resets and the first move pays a
bounded reposition cost rather than inheriting the previous centroid. Ties keep the same physical
button when possible. Look-ahead is represented by adding the next transition cost before choosing
the current state; it must not make the result nondeterministic.

Tie-breaking order is: lower total cost, lower column travel, lower row travel, lower finger, lower
row, then lower column. User-locked coordinates/fingers are hard constraints and are applied before
optimization. No LLM is involved in candidate lookup or path optimization.

## Required fixture coverage

Before the solver is enabled, tests must cover every physical coordinate and every playable MIDI
note, all twelve pitch classes, ascending and descending scales, repeated notes, chromatic runs,
large leaps, rests, ties, phrase resets, transposition, out-of-range notes, three-row projection,
and five-row auxiliary duplicates. Existing chord-grid tests must continue to prove the `1-2-4` and
`2-3-5` grip invariants independently of this melody profile.
