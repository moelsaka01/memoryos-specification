# MO-1309 Phase 4 — plan for the Windows host

Status: **prepared in the cloud (Phase 3), not run.** Nothing here is a certifying result. The campaign scripts have been rehearsed in the cloud
as non-certifying (receipts under `repositories/cca-conformance/evidence/mo1309/phase3-rehearsal/`), and a certifying run is refused anywhere but
the Windows host (`tools/mo1309/campaigns.mjs` checks the platform, architecture, Node version, a clean tree, a new output directory under
`evidence/mo1309/` and one-shot creation). Freeze references: sections 15, 17 and 14 ([Freeze](mo1309-contract-freeze-1.md)).

## 0. Preconditions (stop if any is false)

1. Windows 11 x64, the host on which MO-1308 was certified. Node.js **v24.21.0** exactly (`node --version`). A Chromium-family browser; set
   `MO1309_BROWSER` unless it is Chrome or Edge in the default install path; note its version in the campaign log.
2. A fresh clone with full history, checked out at **main = binding B2** (the Phase 3 binding; `git rev-parse HEAD` is recorded in each receipt).
   `git status --porcelain` is empty. 8 GB free disk (the 100,000-entry corpus is 436 MB of files in 280,003 files; leave room for logs).
3. Record, in the campaign log and nowhere in a product file: real-time antivirus on the corpus directory, power plan, file system.
4. `git tag --list "memoryos-1.3-*"` shows the released tags; **no tag is created by anything below.**

## 1. Order of work (each numbered step is made once; failures are preserved, never rewritten)

| Step | Branch | Command (from the repository root) | Output (new, committed as evidence) |
|---|---|---|---|
| W1 Windows performance run (docs/mo1309-phase2d-windows-run.md) | `mo1309/phase4a-e2e` | from `repositories/cca-studio`: `node scripts/memoryos-dashboard-perf.mjs run --sizes 1000,10000 --runs 5 --corpus <new dir> --out <report-1k-10k.json>`, then `... check <report-1k-10k.json> ../../docs/mo1309-phase2d-budgets.json`, then `... run --sizes 100000 --runs 1 --corpus <same dir> --out <report-100k.json>` | `evidence/mo1309/phase2d-windows/` (two reports, their SHA-256, console output) |
| W2 4A end to end | `mo1309/phase4a-e2e` | `node repositories/cca-conformance/tools/mo1309/campaigns.mjs 4a --certifying --full --out repositories/cca-conformance/evidence/mo1309/4a/gen-1` | `4a-receipt.json` |
| W3 4B closure and supply | `mo1309/phase4b-closure` | `... campaigns.mjs 4b --certifying --out ...evidence/mo1309/4b/gen-1` | `4b-receipt.json` |
| W4 4C security and trust wording | `mo1309/phase4c-trust` | `... campaigns.mjs 4c --certifying --out ...evidence/mo1309/4c/gen-1` | `4c-receipt.json` |
| W5 Retained regression | `mo1309/phase4d` | `node repositories/cca-conformance/tools/mo1309/run-tests.mjs --out repositories/cca-conformance/evidence/mo1309/regression --run-label windows` (every suite once; a rerun is `--suite <id>` again and becomes its own row with its own log) | `rows.json`, `logs/` |
| W6 Differential gate | `mo1309/phase4d` | `node repositories/cca-conformance/tools/mo1309/differential-gate.mjs --out repositories/cca-conformance/evidence/mo1309/differential-node` and the A3.2 CTest differential on Windows: CTest, preset `default`, `-E "^cca_core_tests_NOT_BUILT$"`, at BF `bf2fdc87e9b2bfc25588ef61deacac6c04684376` and at the candidate, identical toolchain | `receipt.json` (Node units) and the CTest record |
| W7 4D final | `mo1309/phase4d` | author `docs/mo1309-release-disclosures.md` (every recorded outcome and qualification), then `node .../assemble-final.mjs --candidate <B2 or later production commit> --evidence repositories/cca-conformance/evidence/mo1309 --disclosures docs/mo1309-release-disclosures.md [--qualification <id>]...`, commit it as **I3**, run `node .../validate.mjs` (expect `I3_VALID_PENDING_BF`), then commit the **binding-only BF** (`mo1309-final-binding.json` = `{"i3":"<I3 hash>"}`, nothing else) and run `validate.mjs` again | `CERTIFIED_READY_TO_TAG` or a preserved generation |

The streams own disjoint evidence paths and may run in any order; W5 to W7 follow W2 to W4. After the streams, `main` is advanced only by
fast-forward after an ancestry check, never forced, and no tag is created (Freeze section 14, rule 3).

## 2. Failure handling

Failures are classified as in MO-1308 Phase 3 protocol section 6. A `HARNESS_DEFECT`, `ENVIRONMENT_BLOCKER` or `INTERRUPTION` gets a new generation
(`gen-2`, at most two extra per stream) with a disposition file (`disposition.md`) bound in the final record; the failed generation is preserved and
never promoted. A `CONTRACT_DEFECT`, a `PRODUCT_DEFECT` requiring a public-behaviour change, a new dependency, a limit or scope change, or any
change to MO-1308 production bytes is a **STOP** (owner). A budget exceedance on Windows is a finding for 4A (a slower host is not by itself a
product defect); raising a budget or the certified scale returns to owner review.

## 3. Every Windows-only part

The cloud established everything below that is not listed as Windows-only; the cloud rehearsal receipts record each case with the same list.

| Item | Why it cannot be certified in the cloud |
|---|---|
| Certifying status of any 4A, 4B or 4C case (DB29) | the Freeze requires Windows 11 x64, Node 24.21.0 and a Chromium-family browser; the cloud is Linux, Node 22.22.0, Playwright Chromium 1194 |
| 4A-E1, E2, E3 export from the MO-1308 CLI | NTFS and the Windows CLI store; the cloud rehearsal used the same released CLI on Linux |
| 4A-E4 certified-scale (10,000) generation, load and budget check | budgets are for the reference host; the cloud measured 10,000 in `docs/mo1309-phase3-cloud-report.json` |
| 4A-E5 byte comparison, E9 exclusive output and failure paths | hard-link publication, sharing violations and antivirus behaviour on NTFS |
| 4A-E6 `file://` versus static HTTP, E7 keyboard, 200% zoom, 320/768/1280 | in the Windows browser and with Windows display scaling |
| 4A-E8 100,000-entry characterization (`--full`) | the reference host; recorded with no pass, fail or support claim |
| 4B-C1 to C4 | rerun on the Windows checkout (line endings, closure reproducibility from a fresh checkout) |
| 4C-S1 to S6 | the injection, CSP, tamper, forbidden-affordance, swap-after-read and data-class cases rendered and run on Windows, including a real directory swap during the read (NTFS) |
| A3.2 CTest differential (default preset, MSVC, vcpkg, GoogleTest) | `cca_core_tests`, the 112 `*AllocationFailureTest` cases, `memoryos.sdk.*`, `memoryos.standard.runtime.reference` and the Windows-only store tests need the Windows toolchain; the cloud ran only the Node-driven units |
| 4D validator run on the final record, I3 and the binding-only BF | the record needs the accepted certifying Windows receipts; the cloud validator is exercised with synthetic repositories and negative controls |
| The human tag review for `memoryos-1.3-mo1309` | human decision, after `CERTIFIED_READY_TO_TAG` |

Everything else (MO-1309 unit, browser and integration tests, the differential tests of the view-model builder, the closure audit, the inventory, the
manifest runner, the validator rules) is established in the cloud and re-run on Windows only as part of W5.
