# MO-1308 Phase 3 step 3: handoff (updated at the end of every task)

## Current state (2026-10-08): TASKS 1 AND 2 DONE; NEXT = TASKS 3-4
Task 1 (move to candidate f4211c8c, A8.9) and Task 2 (harness updates for A10 and harness assumption fixes) are complete and pushed. Nothing certifying or rehearsal-grade has been produced: the changed cases were verified one by one in development worktrees (`dev-run.mjs`), and every branch's own test file and the shared tests pass on this host (about 40 existing worktrees).

* **Candidate:** `f4211c8c502f771bc78c2d2ab509c20d2b715676`, productionTreeDigest `sha256:144171044dad6b83050cf0933ce68f243416d66ca3f39f458b15a0b8216200d3`. A3 gate input (3A-A4, 3D-D5): `evidence/mo1308/phase3-precondition-g4/receipt.json`, top-level `verdict` PASS. Bound hashes are those of A8.9 (protocol, inventory and identity text did not change in Task 2).
* **Where Task 2 is recorded:** the subsection "A8.9 harness expectation changes" at the end of `docs/mo1308-contract-freeze-1.md` (on `phase3-shared`, merged into every stream branch).
* **3A harness (now A10-exact):** E1/E5/E6/H1/H3 and the D4 staging scenario stop the real append at the first look at a staging name (preload point `POINT.firstStaging`, `cases-ntfs.mjs`), read the process id from the reached file and plant/hold/expect `<role>.<pid>.<n>` (helpers `appendWithStagingNames`, `memberStage`, `entryStage`). D4 staging: exit 4 FILESYSTEM_BOUNDARY, nothing at any link target, ledger unchanged, for file symlink, junction and directory symlink. G3: two stops (before the purge, between two members), exit 4, outside sentinels byte-identical. L3: strict (query and append exit 0, nothing on stderr, failure keeps exit 2 with both streams closed). `--tolerate` and `concludeKnown` removed. Old-product check: on a scratch worktree with the two b0bf2d56 production files, 3A-D4, 3A-G3, 3A-L3 and 3A-H1 FAIL (D4: 12 problems, the append succeeds through the dangling staging link; G3: outside decoys deleted; L3: EPIPE stack, exit 1; H1: old `.0` name), and all PASS on f4211c8c.
* **Shared:** A02 allows only `phase3-precondition(-gN)` and `phase3[abcd]-rehearsal-rN` evidence (A03 pins it; certifying generation directories stay rejected on the shared step); new `tools/mo1308-phase3/short-temp.mjs` (`C:\tt\<stream>-<n>`, `MO1308_P3_TEMP_ROOT`, at most 24 characters) used by 3B, 3C, 3D and the shared tests.
* **3B:** test E01 no longer asserts a single worktree (compares before/after); the 3B-E2 assembler no longer runs `git worktree prune`, removes only its own worktree and fails if it stays registered.
* **Heads after Task 2:** see the report of this task / `git log` of each branch (3A carries this file's commit).
* **F22 (MO-1307 timing assertion, host data):** 6 full-suite runs `node --test --test-concurrency=1 tests/mo1307_*_test.mjs`: 639/639 each, F22 2024-2040 ms (2000 ms allowance + settle). 20 solo runs: 2046-2083 ms. Margin probe on a copy of the test (original untouched; copy deleted): 125 quiet runs, `performance.now() - dispositionDeadline` min 1.10 ms, p5 2.71, p50 8.72, p95 16.06, max 18.78, 0 negative; 55 runs with 8 CPU-burn processes: min 8.01, p50 22.47, max 75.37, 0 negative. Separately, F22 failed in its setup (`staged()`, MO1307_OUTPUT after ~16 ms, not the timing assertion) in 13/80 + 5/30 runs on a worktree with about 200 stale `.cache/mo1307/phase2c-finalization-correction/focused-<pid>` directories left by earlier runs, and 0/30 (and 0/6 in the full suite) after removing them: a stale-directory effect of the test's own cache, not timing. The original C3S failure (line 206, whole test 2029.5 ms) was not reproduced in 180 probe runs. Proposal for 3D-D4 (owner decides): see the Task 2 report.
* **Next (Tasks 3-4):** not started. Remaining from earlier lists: harness reviews on final harness bytes, rehearsals of 3A G-M and the ceiling, binding, the certifying runs.


## Branch heads (as of the first commit of this file, before Task 1)
* `mo1308/phase3a-native` d58a1ba8 + this file; worktree `C:\w3a`.
* `mo1308/phase3c-security` c1ef03eb; worktree `C:\w3c`.
* Old candidate b0bf2d56, productionTreeDigest sha256:aa9816c3...a798. Correction branch `mo1308/phase3-corrections` from b0bf2d56 (now merged, head f4211c8c).
## Harness status
| Stream / segment | State |
|---|---|
| 3C main | rehearsed: r1 (step C over guard, kept), r2 67/67 PASS inside guards (evidence/mo1308/phase3c-rehearsal-r1,-r2) |
| 3A main1 (A-E) | rehearsed: r2 PASS within guards (evidence/mo1308/phase3a-rehearsal-r2) |
| 3A main2 F | rehearsed: r2 F1-F6 PASS; F7 ESCALATE (2 of 10 runs staging EPERM, runs 7 and 10), generation stopped (D6) |
| 3A main2 G-M | development-only (each case passed individually); L step trimmed to ~230 s, K4/M1 bulk verify: untested in a rehearsal |
| 3A ceiling JC | development-only at small size; 100,000-entry run never executed |
| Independent harness reviews (3A, 3C) | not done (brief drafted in C:\scratch3a\review-brief-3a.md); must run on final harness bytes |

## Scratch locations (outside every sealed directory)
`C:\scratch3a` (probes, patch scripts, steps.py, run3a.sh, aborted-r1-observation-float), `C:\scratch3c`. Work roots: `C:\w3a\.p3a-work`, `C:\w3c\.p3c-work` (git-excluded).
Run a 3A rehearsal: `bash /c/scratch3a/run3a.sh N` (uses `--tolerate 3A-L3`, rehearsal only). Pinned Node: `C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64\node.exe`.

## Findings (old candidate b0bf2d56; corrected by A10 in f4211c8c)
1. **3A-L3** closed stdout pipe: `memoryos-cli/src/main.js:21` `process.stdout.write` emits an unhandled EPIPE; Node prints a stack with source paths, exit 1, even after a committed init/append. Repro: spawn the CLI with stdout piped and destroy the read end at once (`C:\scratch3a\epipe.mjs`). Harness: cases-transport.mjs `3A-L3`.
2. **3A-D4** planted dangling link at a staging name: `history-store.js` `writeFileExclusive` (`openSync` O_EXCL) follows a dangling symlink/junction on Windows and creates the target; after-the-fact lstat then fails typed. Harness: cases-paths.mjs `3A-D4` (staging sub-scenario, currently records `createdThroughDanglingStagingLink`).
3. **3A-G3** purge through a swapped record directory: `purgeMembers` lstat/unlinks by path with no chain re-check, deleting same-named files outside the ledger. Harness: cases-swap.mjs `3A-G3` (records `decoysDeletedThroughTheSwappedJunction`).
4. **3A-F7** staging EPERM in 2 of 10 runs: staging names `<role>.<n>` (first free counter) are contended by concurrent writers (A6 delete-pending hypothesis; Q02 CONFIRMED by 3A-E6). Harness: cases-conc.mjs `3A-F7`.

## Accepted (to be written into Amendment A10)
G1/G2/G4/G6 stray creation during swap races (H40); D8 name forms (ADS input, trailing dot/space, reserved names, no aliasing); L4 uses TZ values plus a shifted Date (system clock untouched); JC6/Q11 threshold 8 minutes.

## Open issues / remaining work
Rehearse 3A G-M and ceiling on the new candidate; harness reviews; tighten harness assertions for D4/G3/L3 (strict) once fixed; binding, A3.2 differential and candidate move are separate steps.

## Correction round progress
(none yet)
* Step 1 (3A-L3) DONE on `mo1308/phase3-corrections` (worktree `C:\w3k`): `bin/memoryos.js` swallows stream errors on stdout/stderr; exit code stays the command's own. Test: `memoryos-cli/tests/closed-output.test.mjs` (3 tests, fail on b0bf2d56). Rule to propose in A10: unwritable output never changes the exit of an operation already carried out and prints nothing.
* Step 2 (3A-D4) DONE: `history-store.js` `writeFileExclusive` lstat-checks the name first and refuses a link with FILESYSTEM_BOUNDARY before any create. Test W09 (3 link kinds x member/entry staging names; fails on b0bf2d56). Residual: a swap between the lstat and the create (H40, to disclose in A10).
* Step 3 (3A-G3) DONE: `history-store.js` captures record-directory identities at read (`recordDirs`) and `assertPurgeBoundary` runs before every deletion and the final rmdir (no links in the chain, canonical paths, dev/ino equal). Test W10 (fails on b0bf2d56). Residual window: a swap between the check and the unlink (H40; disclose in A10). Full memoryos-cli suite run started in the background (task output in the Claude tasks dir); result to be recorded here.
* Step 4 (3A-F7) DONE: staging names `<role>.<pid>.<n>` (history-store.js). Test W11; W09 and the W08 pattern follow the new form. Full memoryos-cli suite 89/89 PASS on the corrections branch. F7 workload x20 on the corrected product (scratch worktree `C:\w3t` = phase3a-native + the two corrected product files, uncommitted): staging EPERM 0 of 20 (batches 0 and 0). Old candidate: 2 of 10.
* Step 5 DONE: Amendment A10 (Freeze section 37) as `docs/mo1308-amendment-a10.md` on `mo1308/phase3-corrections` (to be merged after section 36).
* Correction branch `mo1308/phase3-corrections` (worktree `C:\w3k`) head: see `git log` (last product commit 7cb06b09, A10 after it). Production paths changed: `repositories/memoryos-cli/bin/memoryos.js`, `repositories/memoryos-cli/src/history-store.js`.
* NEXT (separate steps, not started): binding, A3.2 differential gate, Phase 3 candidate move (new identity/protocol hashes), then re-tighten harness D4/G3/L3 assertions (remove `--tolerate`), update W-pattern expectations (staging names now `.pid.n`: 3A harness cases E1/E5/E6/D4/F7/H1/H3 plant names `.0`/`.1` and must plant `.${pid}` forms of the product's names, which the harness cannot know in advance: use a name-capturing preload event instead), rehearse G-M and the ceiling, harness reviews. `C:\w3t` can be removed after use.
