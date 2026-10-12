# MO-1309 handoff — phase 4 (Windows certification)

Fixed template: this file opens with State, Last bound commit, Next action and
Decisions needed, and ends with the dated run log. One committed file per phase
(see [the Freeze](mo1309-contract-freeze-1.md) section 15). The run log is
appended to, never rewritten; the four fields above are replaced at each update.
Resume with: "Read docs/mo1309-phase4-handoff.md and continue the Phase 4 run to completion".

## State

Phase 4 started on the Windows host from B2 `9991a105`. Step W1 (2D Windows performance run) COMPLETE and committed (budget check passed). Next: W2 (4A). No certifying campaign result yet.

## Last bound commit

B2 `9991a105ab6670baac0bcfe489aca433157382be` (`main` on origin). Phase 4 work: worktree `C:/p4a` on `mo1309/phase4a-e2e`.

## Next action

W2 (4A certifying, `campaigns.mjs 4a --certifying --full`), then W3 (4B), W4 (4C), W5 (regression), W6 (differential gate), W7 (4D).

## Decisions needed

None.

## Run log

- 2026-10-12 — Fetched origin; `origin/main` = B2 `9991a105` (local `main` in the primary checkout is at `4a1de6f0`, an older ancestor, with unrelated uncommitted work; not touched). Worktree `C:/p4a` created at B2 on `mo1309/phase4a-e2e`, clean.
  Environment: pinned Node v24.21.0 (SHA-256 `ba4e6d11…6c32` verified), Python 3.14 first on PATH, Edge 155.0.4283.45 at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (`MO1309_BROWSER`). Host: Dell i7-1165G7, 15.7 GB RAM, NTFS, power scheme "Dell",
  Defender real-time monitoring enabled (DisableRealtimeMonitoring=false; exclusions not visible without admin), Smart App Control enforcing (untouched). Host is not idle (user's browser and chat apps; CPU 32–57 % samples); load is sampled and recorded per run. Disk free 38 GB at start. Existing tags `memoryos-1.3-mo1301`…`mo1308`; none created here.
- 2026-10-12 — W1, the 2D Windows performance run (docs/mo1309-phase2d-windows-run.md, three commands unchanged, corpus `C:/p4corpus` NTFS, Edge 155.0.4283.45). Load samples before the run: 32–57 % total CPU (host shared with the user's browser and chat apps; not idle). Evidence `repositories/cca-conformance/evidence/mo1309/phase2d-windows/`: `report-1k-10k.json` (hash below), `report-100k.json`, `console.log`.
  `check` against the budgets: `{"ok":true,"reason":"within budget"}`, exit 0. Worst of five runs at the certified scale 10,000 vs budget: read 7.3 s (30 s), verify-only 7.8 s (30 s), view-model build 8.5 s (30 s), assemble 1.2 s (5 s), publish 0.2 s (5 s), generation wall 25.9 s (60 s), generator RSS 467 MB (1,100 MB), snapshot 8.90 MB (11 MB), load event 440 ms (1,600 ms), filter/sort/next-page 17/10/29 ms (200 ms), page heap 14.3 MB (100 MB), DOM nodes 1,108 (3,000).
  100,000 entries (characterization only, no budget, no claim; one run): completed. read 227 s, verify-only 53 s, view-model build 67.5 s, assemble 11.2 s, publish 1.2 s, generation wall 363 s, generator RSS 2,127 MB, snapshot 88.8 MB, load event 2.34 s, filter/sort/next-page 52/69/69 ms, page heap 98.9 MB.
  Full SHA-256: report-1k-10k `e2b59aef4f010eca8b0c6d07354f13eaf5e62373553ed15d8d0a7214abfcf6b0`; report-100k `2e164c4a608b5c62b694ec196a097bc00db9922810d9e2762a77294cf3731f1e`.
