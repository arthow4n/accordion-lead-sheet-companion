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
`button` is a physical row/column candidate; `finger` is 1–5; `handPosition` is a bounded
`{row, column}` coordinate; and `previousTransition` records direction plus whether the preceding
event was a rest, tie, or phrase boundary. For a single-note melody, the hand position is updated to
the selected button after each note and is clamped to the finite layout. (A future chord-aware mode
may use a weighted centroid.) A state is invalid when it violates a user lock or an instrument
bound.

For adjacent sounding events, v1 uses this exact edge cost. `dc` and `dr` are the column and row
deltas, `stretch = |dc| + |dr|`, and “different button” means different physical coordinates:

```text
columnTravel = |dc|
rowTravel = |dr|
sameMidiDifferentButton = prev.midi == next.midi && button differs ? 1 : 0
sameFingerDifferentButton = prev.finger == next.finger && button differs ? 1 : 0
physicalDelta = 3 * dc + (next.row - prev.row)  // signed C-system travel in semitones
fingerCrossing = (physicalDelta > 0 && next.finger < prev.finger) ||
                 (physicalDelta < 0 && next.finger > prev.finger) ? 1 : 0

edgeCost = 4.0 * columnTravel
         + 1.5 * rowTravel
         + 2.0 * sameMidiDifferentButton  // re-articulation penalty; same button is preferred
         + 3.0 * sameFingerDifferentButton
         + 6.0 * fingerCrossing
         + 3.0 * max(0, stretch - 2)^2
         + 1.0 * (next.finger == 1 ? 1 : 0) // thumb is allowed but discouraged
```

For the first note in a phrase, `previousTransition` is null and the hand-position anchor is the
profile reference coordinate. The initial reposition cost is
`4*|candidate.column-reference.column| + 1.5*|candidate.row-reference.row| + thumbCost`. After a
rest or explicit phrase boundary, the previous state is cleared, the hand position resets to that
same reference coordinate, and the next note pays the initial reposition cost. A tie continuation is
a hard transition rule: the next event must use the previous button and finger; if that physical
button/finger is not among the candidates, the event is diagnosed as `invalid_tie` and no guidance
is emitted. Thus the thumb penalty and tie-breaking order can never replace a tied finger. V1 has
`lookAheadWeight = 0`: no hidden second transition is added, so there is no double-counting. A
non-zero look-ahead requires a second-order DP and a schema/version change.

User locks are hard constraints filtered before optimization. A lock that names a missing
coordinate, an out-of-range note, or conflicting coordinate/finger choices returns an `invalid_lock`
diagnostic and no melody guidance; the solver never falls back to a nearest button. An out-of-range
pitch returns `out_of_range` and no guidance.

Tie-breaking is complete and deterministic: lower total cost; lower final column travel; lower final
row travel; lower final finger; lower final row; lower final column; then lexicographically earlier
event-index/candidate order. The path result stores the solver schema version. No LLM is involved in
candidate lookup or path optimization.

## Required fixture coverage

Before the solver is enabled, tests must cover every physical coordinate and every playable MIDI
note, all twelve pitch classes, ascending and descending scales, repeated notes, chromatic runs,
large leaps, rests, ties, phrase resets, transposition, out-of-range notes, three-row projection,
and five-row auxiliary duplicates. Existing chord-grid tests must continue to prove the established
canonical/inversion fingering invariants independently of this melody profile, including the
isomorphic `1-2-4` and optional `2-3-5` triad patterns. The existing canonical grip API keeps
`1-2-4` as its backwards-compatible default; callers must opt into `2-3-5`, and the alternate
pattern reuses the same pitch-valid coordinates. The melody profile must not change chord-grip
behavior.
