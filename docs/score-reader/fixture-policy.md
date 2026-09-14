# Score reader fixture and evaluation-data policy

This policy applies to committed score-reader fixtures, local benchmark material, generated model
outputs, screenshots, and browser-audit artifacts.

## Committed fixtures

Only authored synthetic scores or material with documented permission/public-domain status may be
committed. Every fixture must have a row in `tests/fixtures/score/fixture-manifest.json` containing:

- stable fixture ID and SHA-256 checksum;
- creator/source and the underlying musical work;
- public-domain/copyright status of the work;
- engraving/image license and allowed uses;
- creation method, software, fonts, and model versions;
- whether the fixture is synthetic, transformed, or human-authored;
- reviewer and review date.

Fixtures must be minimal, reproducible, and free of personal information. Do not add a teacher's
class sheet, a student's handwriting, or any private/copyrighted photograph without explicit written
permission and a recorded provenance review.

## Private evaluation data

Private scans and camera photographs stay outside Git, CI, logs, screenshots, agent worktrees, and
third-party services unless the owner explicitly authorizes that destination. Local evaluation
commands must accept paths supplied by the user and must not copy inputs into the repository.
Results may be summarized numerically only when the summary cannot reconstruct the source or its
notation.

## Generated artifacts

Model weights, tokenizers, ONNX files, decoded score output, and screenshots are never committed by
default. The decision log provides standing user authorization to publish only the exact reviewed,
checksummed release artifacts to the selected project-owned GitHub Releases location after the
frozen gates and final review pass; no new approval is required then. Any different artifact,
destination, or timing requires an updated decision record. Browser caches are runtime data, not
fixtures.

## Review rule

When provenance is uncertain, treat the material as private and do not commit it. A fixture that
cannot satisfy the manifest fields is not eligible for the frozen benchmark corpus.
