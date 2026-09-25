# Phase 3C-R audit tooling

Use the recorded Python 3.12 executable with `-B -X utf8`, from the dedicated
`cca-mo1305-3c-refresh` worktree on `mo1305/phase3c-refresh`.

1. `python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3c-refresh/cheap.py`
2. `python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3c-refresh/audit.py create`
3. `python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3c-refresh/audit.py validate`
4. `python -B -X utf8 tools/verify_workspace.py --root .`
5. `python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3c-refresh/validate.py`
6. `git diff --check`

Individual `audit`, `matrix`, `receipt` and `negatives` subcommands are read-only.
`create` writes canonical audit artifacts, after cheap gates pass; `validate`
recomputes current source/evidence references and rejects missing, forged or
prematurely promoted external requirements. Phase 3D binds the eventual audit
commit externally; the receipt never includes its own future Git identity.

The existing pinned correction cache inputs must be available at the paths in
its accepted receipt. Only copied historical bytes were observed for this audit;
no rebuild or install is claimed. Schema validation verifies the full pinned
engineering runtime inventory. No package or runtime dependencies are added.

`context.py` is a static audit-context adaptation of immutable correction
`check.py`: original substantive validate() checks are preserved, the real
workspace/branch is checked explicitly, the graph is anchored to C3B, and sibling
worktree inspection is prohibited. The original eight correction tests are
replayed by `correction.test.mjs` with only import/root/context-entrypoint changes.
Do not run the historical main-only gate here or change branch to satisfy it.

No new gateway runtime witness is needed: corrected metadata is freshly checked,
C3 archive smoke is already bound, and runtime/semantic bytes remain unchanged.
The matrix explicitly keeps Windows and artifact recertification pending.
