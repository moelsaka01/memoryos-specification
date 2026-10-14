# MO-1308 3D-D4: retained-regression deviation (disposition)

Status: **ACCEPTED_WITH_DISCLOSURE** by the owner. No re-certification. Written after the tag `memoryos-1.3-mo1308` (annotated tag object `3ddb8243dcb9dcf023aa7df45552f71b86ccca20`, peeling to the binding-only BF `bf2fdc87e9b2bfc25588ef61deacac6c04684376`). Docs-only; nothing certified is changed.

## What deviated

Case 3D-D4 (retained full regression) is backed by `repositories/cca-conformance/evidence/mo1308/phase3d-regression/regression.json` and its raw logs.

1. **The first run of the mo1308 suite failed 18 of 220 tests for non-product causes.** It ran on `9b79e120`. The causes, all diagnosed before anything was re-run:
   - Python 3 was not on the PATH of the regression shell (WC01-WC06, WC11: "Python 3 is required").
   - An operator-made octopus merge of the three stream branches into the 3D branch, which the lineage rule rejects (A01, S03).
   - 3D test fixtures that fabricate generations named `phase3a/b/c` collided with the real accepted evidence that had meanwhile landed (D02-D12).

   The causes were fixed (Python on PATH; sequential two-parent merges on a new branch; test clones start from a clean evidence slate), and the **whole** mo1308 suite was run again on `0ba274e0`: 220/220. That second run is the `mo1308` row of `regression.json`.
2. **The first run is preserved in committed evidence, but only as a log and a sentence.** The log is `repositories/cca-conformance/evidence/mo1308/phase3d-regression/logs/mo1308-first-run-9b79e120.log`, SHA-256 `4d564414556e21431ba28634bfd15dc9ca3a28c081b837e61a7587c98f9249dd` (`tests 220, pass 202, fail 18`). It was committed in `e1e7bc8b`, an ancestor of BF `bf2fdc87`. It is disclosed only in the `notes` member of `regression.json`; it is **not a suite row**, and the validator does not read or check it (the validator checks the `suites[]` rows only).
3. **The MO-1307 suite ran exactly once**: 639/639, `retries: 0`, one `mo1307` row (run on `9b79e120`, log `logs/mo1307.log`, SHA-256 `1e4bce5a85db9be0c0f1bab14a4ee1bd3136e5d837fe0aed732388586809e7e3`), fresh worktree, `.cache/mo1307` ABSENT before the run, CPU load 8.5%, F22 2032.4 ms. It was not re-run. The cli (91), studio (358) and examples (22) suites also ran once.
4. **The regression run script was not committed at the time.** It still exists and is committed now, unchanged byte for byte, as `repositories/cca-conformance/tools/mo1308-phase3d/regress-as-run.mjs` (SHA-256 `d9cb8a8385d3391b4ea1af84401ebbca2b5d717accf7c37571774468e337c1c0`). **This is the as-run script, not certified tooling**: it was not part of any sealed tool list or reviewed, and it is not bound to any generation. Caveats about what "as run" means:
   - The file is the version used for the second (clean) mo1308 run. The first invocation (mo1307, cli, studio, examples and the first mo1308 run) used the same script with an earlier count-parsing expression that returned null counts; the counts in `regression.json` were then recomputed from the committed raw logs by an inline assembly step that was not saved, and each log digest was re-checked against the file.
   - The log digests in `regression.json` are the digests of the committed logs.

## Disposition

**ACCEPTED_WITH_DISCLOSURE** by the owner. The release stands as certified at `bf2fdc87`; no generation, record or tag is changed or re-run.

## Follow-up for future MOs

Any rerun inside a retained regression must be recorded as a **separate suite row with its own log binding** (and the validator should recompute log digests against the committed logs and check each row's commit), never as a replacement of the failed row with the failure left in prose.
