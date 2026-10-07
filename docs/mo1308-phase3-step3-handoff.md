# MO-1308 Phase 3 step 3: handoff (updated at the end of every correction step)

## Branch heads (as of this file's first commit)
* `mo1308/phase3a-native` d58a1ba8 + this file; worktree `C:\w3a`.
* `mo1308/phase3c-security` c1ef03eb; worktree `C:\w3c`.
* Candidate under test: b0bf2d56, productionTreeDigest sha256:aa9816c3...a798. Correction branch (to create): `mo1308/phase3-corrections` from b0bf2d56.

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

## Findings (candidate b0bf2d56)
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
