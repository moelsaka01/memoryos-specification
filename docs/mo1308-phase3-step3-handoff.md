# MO-1308 Phase 3 step 3: handoff (updated at the end of every task)

## Current state (2026-10-08): TASK 1 DONE; NEXT = TASK 2 (harness expectation changes)
Task 1 (move to candidate f4211c8c, bookkeeping only) is complete: phase3-corrections (A10, section 37) and phase3-precondition (A3.2 generation 4) are merged into `mo1308/phase3-shared`; A8.9 is appended to the Freeze; the candidate identity, inventory and protocol are regenerated; the shared merge is in all four stream branches.

* **Candidate:** `f4211c8c502f771bc78c2d2ab509c20d2b715676` (binding B of `mo1308/phase3-corrections`, evidence `d1836294`, `main` at the same commit). `productionTreeDigest` = `sha256:144171044dad6b83050cf0933ce68f243416d66ca3f39f458b15a0b8216200d3` (candidate-identity.json SHA-256 `13565f19bd393c411e7bb133a889a34eb9429185b3b8eeb8686a1ed7713e042f`). Against b0bf2d56 only `memoryos-cli/bin/memoryos.js` and `memoryos-cli/src/history-store.js` changed; `memoryos-history-admission.js` and `mip-canonical.js` are byte-identical (D9 holds).
* **A3 gate input** (3A-A4, 3D-D5): `evidence/mo1308/phase3-precondition-g4/receipt.json` (top-level `verdict` = PASS; branch head `ce0d15ce`, evidence `ce3876f4`).
* **Bound hashes (A8.9):** protocol `1c3622ba59e97e517213c1a8e805e025e79b6fa8f3aae8f4749864514e6aa2a0`, inventory `884638ed9a8b4c707f26566a064fd37c171f8347353486e1dd57038141e66c06`, identity `13565f19bd393c411e7bb133a889a34eb9429185b3b8eeb8686a1ed7713e042f`, corpus (unchanged) `b055805d2db43f414261921ded61eb69d856ad5c821139254e9ba1b7ce386c9f`.
* **Heads after Task 1:** shared `8ac7930b`; 3A, 3B, 3C, 3D heads are the merge commits of `origin/mo1308/phase3-shared` (3A also carries this file's commit; see `git log`). Old heads: 3A `b3224446`, 3B `5ef538ba`, 3C `c1ef03eb`, 3D `c56a707f`.
* **Open for Task 2:** fill the placeholder subsection "A8.9 harness expectation changes" at the end of `docs/mo1308-contract-freeze-1.md`; then the work listed under "Open issues" below. The shared test A02 fails on the 3A branch only because 3A carries its own rehearsal evidence (`evidence/mo1308/phase3a-rehearsal-r2`); it is not a regression.
* Allowed path set: `memoryos-cli/bin/memoryos.js` joined CLI_HISTORY_NAMESPACE (299 changed paths since BF, all classified).

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
