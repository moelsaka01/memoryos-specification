# MO-1309 Phase 2D — performance characterization

Stream `mo1309/phase2d-perf`, created from the bound Phase 1 commit `2da41aca`. It adds the corpus builder, the measuring
runner and the budget evaluator (`scripts/memoryos-dashboard-perf*.mjs`), the recorded cloud report
([report](mo1309-phase2d-cloud-report.json)), the budgets ([budgets](mo1309-phase2d-budgets.json)) and the prepared
[Windows run](mo1309-phase2d-windows-run.md). It changes no product file. **No Windows result exists and none is claimed.**

## 1. What was measured and on what

| Item | Value |
|---|---|
| Host | cloud container, Linux 6.18, x64, 4 vCPU Intel Xeon 2.8 GHz, 16 GB, Node.js v22.22.0 (the Windows run uses Node 24.21.0) |
| Tree | throwaway, unpushed merge of the 2D tip `7d6ae4b6`, Phase 2A `6956c650` and Phase 2B `2d0b66fe`: the generator and page as they will be integrated |
| Browser | the cloud image's preinstalled Chromium (Playwright build 1194), driven by the 2A DevTools harness, `file://` |
| Corpus | synthetic exports of 1,000, 10,000 and 100,000 entries built by `memoryos-dashboard-perf-corpus.mjs` with the MO-1308 identity primitives and `buildHistoryExport`, and accepted by `verifyHistoryExport` before being written. `POLICY_EVALUATION` records of the CLI-export size (two members of 1,062 and 1,963 bytes, two subjects), one tombstone and purge in every twenty entries. 1,000 entries are 2,803 files and 4.4 MB; 10,000 are 28,003 files and 44 MB; 100,000 are 280,003 files and 436 MB |
| Why synthetic | the released exporter needs about 16 minutes for 100,000 entries (MO-1308 Q11) and 100,000 CLI appends are slower still. The corpus is therefore not an export produced by the released CLI; real CLI exports are covered by cases 4A-E1 and 4A-E2. It is deterministic: the same N gives the same bytes |
| Runs | five runs at 1,000 and 10,000 entries; one run at 100,000 (it takes 49 minutes) |
| Generation | the real generator functions in a fresh child process per run: read, `verifyHistoryExport` alone, view-model build (which verifies again), assembly, exclusive publication; wall time is the whole child, `maxRSS` is the child's peak |
| Page | one fresh browser per run loads the snapshot; load and interaction times are read inside the page |

## 2. Results (medians of the recorded runs; the report holds every run)

| Metric | 1,000 | 10,000 | 100,000 (characterized, one run) |
|---|---:|---:|---:|
| Read the export (files into memory) | 0.09 s | 0.74 s | 8.3 s |
| `verifyHistoryExport` alone | 0.59 s | 5.4 s | 57.8 s |
| View-model build (includes verification) | 0.84 s | 29.5 s | 2,861 s (47.7 min) |
| Assemble the snapshot | 0.10 s | 0.86 s | 15.3 s |
| Publish (exclusive staging, link) | 3 ms | 62 ms | 0.70 s |
| **Generation, whole process** | **1.7 s** | **36.8 s** | **2,944 s (49.1 min)** |
| Generator peak memory | 117 MB | 391 MB | 2,604 MB |
| **Snapshot size** | **0.92 MB** | **8.90 MB** | **88.8 MB** |
| **Page load event** | **0.09 s** | **0.29 s** | **4.35 s** |
| Page script heap after load | 2.7 MB | 14.1 MB | 111 MB |
| Filter / sort / next page (in page) | 7 / 5 / 18 ms | 10 / 6 / 18 ms | 29 / 23 / 42 ms |

The page renders 100 rows (1,108 DOM nodes) at every scale, so interaction cost is dominated by filtering the in-memory
entries, which grows linearly.

## 3. Findings

1. **View-model build is quadratic in the number of entries.** `buildDashboardViewModel` reads entry meaning through the
   MO-1308 `queryHistoryLedger`, whose page limit is 1,000, and every query call verifies the whole chain again. The build
   therefore costs about `entries / 1000` chain verifications: 29.5 s at 10,000 entries (5.4 s of which is the first
   verification) and 2,861 s at 100,000. Everything else in generation is linear (read, verify, assemble, publish, page load).
2. The page itself scales acceptably to 100,000 entries on this host: 4.35 s load, 111 MB heap, interactions under 50 ms.
3. The generator's memory at 100,000 entries is 2.6 GB, because the whole export (436 MB) and its parsed form are held
   (Freeze section 9.4 requires the single in-memory read).
4. **Not a STOP.** Fixing finding 1 needs no public-behaviour change, no new limit and no change to MO-1308 bytes; it is a
   private change to the Phase 1 view-model unit (for example one chain verification and one pass over the verified
   entries, with a differential test against `queryHistoryLedger`). It is not done here: Phase 2D characterizes, and the
   Freeze fixes the certified scale at 1,000 or 10,000 precisely because larger scales are not claimed (section 12). It is
   recorded for Phase 3 and for the owner as an optional improvement; the 100,000-entry outcome would change, but no
   claim depends on it.

## 4. Certified scale and budgets (Freeze section 12)

**Certified scale: 10,000 entries.** The Freeze rule is the largest of 1,000 and 10,000 at which generation and load
complete: both completed in all five runs at 10,000 (36.5 s to 37.8 s generation, 0.28 s to 0.32 s load).

**100,000 entries is characterized only.** The numbers in section 2 are recorded with no pass, fail or support claim and
are disclosed as a known performance characteristic: generation takes about 49 minutes and 2.6 GB on this host.

Budgets ([budgets](mo1309-phase2d-budgets.json)) bound the **worst run at 10,000 entries** and are fixed by this binding:

| Rule | Metrics | Bound |
|---|---|---|
| About 5 times the worst cloud run, rounded up | view-model build 150 s, generation wall 200 s, assembly 5 s, `verifyHistoryExport` alone 30 s, load event and DOM-content-loaded 1.6 s | the Windows reference host is expected to be slower in file-system-bound work, not CPU work |
| File-system-bound work, wider | read 30 s, publish 5 s | NTFS and real-time scanning cost is not measured here |
| 3 times | generator peak memory 1,200 MB | |
| 1.24 times | snapshot size 11,000,000 bytes | the size is deterministic; the margin allows page edits made in Phase 3 |
| Usability ceilings | filter, sort and next page 200 ms each; page heap 100 MB; DOM nodes 3,000 | |

Raising a budget or the certified scale after this binding returns to owner review. A Windows exceedance is a finding
for campaign 4A, not an automatic budget change.

## 5. Reproduce

`node scripts/memoryos-dashboard-perf.mjs run --sizes 1000,10000 --runs 5 --corpus <dir> --out <report.json>` then
`node scripts/memoryos-dashboard-perf.mjs check <report.json> ../../docs/mo1309-phase2d-budgets.json`, from
`repositories/cca-studio` on the integrated tree. The runner needs the Phase 2A page and harness and the Phase 2B generator, so
it runs on the integrated Phase 3 tree, not on this branch alone; the pure parts (corpus, report validation, budget
evaluation, the recorded binding) are tested here by `tests/memoryos_dashboard_perf_test.mjs`.

## 6. Requirement coverage

DB22: the certified scale is measured and fixed (10,000), and 100,000 is characterized with no claim. DB32 is respected:
no export-performance work was done and no MO-1308 byte changed. The Windows half of DB22 (case 4A-E4 and 4A-E8) is
prepared, not run.
