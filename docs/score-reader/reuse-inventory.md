# Existing implementation inventory

This inventory is the Milestone 0 map for reuse. It is descriptive; it does not authorize changing
the existing behavior without the plan's tests and review gates.

| Area                                   | Existing path                                                                                                                                  | Reuse expectation                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Capo/transposition/spelling            | `src/lib/capo/`                                                                                                                                | Use the existing enharmonic and transposition rules for derived score harmony; keep guitar capo semantics separate. |
| Stradella layout/solver/voicings       | `src/lib/stradella/`                                                                                                                           | Adapt timed harmony events into the existing solver, transitions, grooves, and accordion-size clamping.             |
| CBA chord geometry/grips/voice leading | `src/lib/cba/`                                                                                                                                 | Preserve chord-grip behavior and semantic colors; add a separately anchored absolute-pitch layout for melody.       |
| Reader shell and segmented lines       | `src/components/LeadSheetReader.tsx`, `src/components/LineRenderer.tsx`                                                                        | Extend the current shell and atomic inline-flex rendering; do not create a second app shell.                        |
| Interactive guidance                   | `src/components/ChordBadge.tsx`, `src/components/MiniGripDrawer.tsx`, `src/components/CbaMiniCard.tsx`, `src/components/StradellaMiniCard.tsx` | Reuse components, touch targets, stop-propagation behavior, and MiniCard/Drawer noise rules.                        |
| Navigation/lifecycle                   | `src/hooks/useAutoScroll.ts`, `src/hooks/usePedalNavigation.ts`, `src/hooks/useWakeLock.ts`                                                    | Add score-aware clock/pedal routing while retaining classic lead-sheet behavior and wake-lock re-acquisition.       |
| Persistence/preferences                | `src/lib/storage/songbook.ts`, `src/lib/storage/urlState.ts`                                                                                   | Add versioned score/source migrations and matching preference events without breaking returning users.              |
| Cloud chord lookup                     | `api/scan-chords.ts`, `src/types/scan.ts`                                                                                                      | Treat as explicit user-invoked chord lookup; do not infer timed measure harmony from its unique chord list.         |

The plan's later ownership map may add score-specific modules, workers, and tests under these
boundaries.
