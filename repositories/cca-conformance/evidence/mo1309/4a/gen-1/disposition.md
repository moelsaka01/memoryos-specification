# 4A generation 1 — disposition

Result: `FAILED_PRESERVED`. Preserved unchanged and never promoted. Receipt: `4a-receipt.json` (commit `5730b659`, Windows 11 x64, Node v24.21.0, Edge 155.0.4283.45).

Cases 4A-E1 to E6 PASS, 4A-E8 RECORDED (100,000-entry characterization, no claim). Cases 4A-E7 and 4A-E9 are FAIL with `exitCode: 0`, `tests/pass/fail: null` (NaN).

Classification: **HARNESS_DEFECT** (Freeze section 14.2). `campaigns.mjs` `nodeTest` read the `node --test` summary only as TAP (`# tests N`). Node 24 prints the spec-reporter summary
(`ℹ tests N`) when stdout is a pipe, so the counts were never read, and the case rule (`pass > 0`) failed although the child exited 0. Reproduced by running the E9 command
directly: 6 tests, 6 pass, 0 fail, exit 0. The cloud rehearsal ran under Node 22, whose default off a terminal is TAP. No product byte and no test assertion about product behaviour is involved.

Fix (tooling only, Freeze section 14.1): `tools/mo1309/run-tests.mjs` `tapCounts` accepts both summary forms; `campaigns.mjs` uses it. The same parser is used by the retained-regression runner (it would have recorded NaN counts in W5).
Negative control (`tests/mo1309_manifest_test.mjs`): a spec-format summary with `fail 1` is read as a failure, a garbled summary and a summary with no marker are NaN (never a pass); a missing summary stays NaN.
Related fixes in the same commit: the DB29 unit test asserted a Linux-only refusal text and now also accepts the "output is not under evidence/mo1309" refusal (the second assertion in that test is unchanged and still requires a refusal); the committed inventory
was rebuilt (`inventory.mjs build`) because it lists DB-tagged test titles and the new control carries one.
Environment note: campaigns are run from PowerShell with the Windows `tar.exe` (`C:\WINDOWS\system32\tar.exe`) first on PATH; Git-for-Windows' GNU tar fails 4B-C4 (`tar: Cannot connect to C:`), and a PATH containing it would be an ENVIRONMENT_BLOCKER, not a product finding.

Next: generation 2 (`gen-2`) is the first of at most two extra generations for stream 4A.
