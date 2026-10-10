# MO-1309 Phase 2D — prepared Windows characterization run

Status: **prepared, not run.** This run has not been run. No Windows result exists, and none is claimed anywhere in
MO-1309. The run belongs to the Windows campaign (Freeze section 15, phase 4A, case 4A-E4 and 4A-E8; requirement
DB22 and DB29). It is a one-shot campaign step, so the commands below are fixed here and nothing in them is chosen
at run time.

## Preconditions

1. Reference host: Windows 11 x64, the host on which MO-1308 was certified.
2. Node.js 24.21.0 (`node --version` must print `v24.21.0`; stop otherwise).
3. A Chromium-family browser. Set `MO1309_BROWSER` to its executable when it is not Chrome or Edge in the default
   install path. Record `Browser.getVersion` (the runner records the host, not the browser build; note the browser
   version in the campaign log).
4. A clean checkout of the integrated Phase 3 commit (the commit the campaign binds), with no uncommitted change.
5. At least 8 GB free disk for the 100,000-entry corpus (1.5 GB, about 280,000 files on this corpus) and the
   same free memory the cloud run used (the generator peaks well under 2 GB at 100,000 entries on Linux; record the
   Windows figure, do not assume it).
6. Record, in the campaign log and not in any product file: whether real-time antivirus scanning is active on the
   corpus directory, the power plan, and the corpus directory's file system. These change file-read cost and are part of
   the characterization.

## Commands (run from `repositories/cca-studio`)

```text
node scripts/memoryos-dashboard-perf.mjs run --sizes 1000,10000 --runs 5 --corpus <empty-or-new-directory> --out <report-1k-10k.json>
node scripts/memoryos-dashboard-perf.mjs check <report-1k-10k.json> ../../docs/mo1309-phase2d-budgets.json
node scripts/memoryos-dashboard-perf.mjs run --sizes 100000 --runs 1 --corpus <the-same-directory> --out <report-100k.json>
```

The first command builds the 1,000 and 10,000-entry synthetic corpora (about a minute on the cloud host) and measures five
runs of each. The second command compares the worst run at the certified scale with the recorded budgets and exits non-zero
if any budget is exceeded. The third command is the 100,000-entry characterization: it has no budget, no pass and no
fail, and its numbers are recorded as a known performance characteristic only. If it does not complete (memory,
time), record that outcome as it is.

## What to retain

The two report files; the SHA-256 of each; the campaign log lines for the preconditions above; the exact commit; and the
console output of the three commands. A Windows report is a new file. The cloud report
(`docs/mo1309-phase2d-cloud-report.json`) is never edited.

## Reading the result

- A budget violation at the certified scale is a finding for the 4A campaign, classified under MO-1308 Phase 3 protocol
  section 6 (a slower host is not by itself a product defect). Raising a budget or the certified scale after the
  Phase 2D binding returns to owner review.
- The corpus is synthetic (see [the performance record](mo1309-phase2d-performance.md)); case 4A-E1 and 4A-E2 cover real
  CLI-produced exports.

## Phase 3 note

The linear view-model build (Phase 3) and the tightened budgets (view-model build 30 s, generation wall 60 s, generator memory 1,100 MB) apply to this run; the
commands are unchanged. The cloud reference for the same commands is `docs/mo1309-phase3-cloud-report.json`. The run is still **prepared, not run**. It is executed
inside campaign 4A (cases 4A-E4 and 4A-E8) by `tools/mo1309/campaigns.mjs 4a --certifying [--full]`, which wraps these commands.
