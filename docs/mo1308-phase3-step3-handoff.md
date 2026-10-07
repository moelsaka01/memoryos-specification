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
