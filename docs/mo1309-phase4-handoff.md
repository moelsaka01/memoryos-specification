# MO-1309 handoff — phase 4 (Windows certification)

Fixed template: this file opens with State, Last bound commit, Next action and
Decisions needed, and ends with the dated run log. One committed file per phase
(see [the Freeze](mo1309-contract-freeze-1.md) section 15). The run log is
appended to, never rewritten; the four fields above are replaced at each update.
Resume with: "Read docs/mo1309-phase4-handoff.md and continue the Phase 4 run to completion".

## State

Phase 4 on the Windows host from B2 `9991a105`. W1 COMPLETE (within budget). W2 4A: generation 1 `FAILED_PRESERVED` (HARNESS_DEFECT), generation 2 ACCEPTED (certifying, all cases PASS, E8 RECORDED). Next: W3 (4B). Extra generations used: 4A 1 of 2.

## Last bound commit

B2 `9991a105ab6670baac0bcfe489aca433157382be` (`main` on origin). Phase 4 work: worktree `C:/p4a` on `mo1309/phase4a-e2e`.

## Next action

W3 4B certifying (`campaigns.mjs 4b --certifying`, PowerShell, branch `mo1309/phase4b-closure` from the 4A evidence commit), then W4 (4C), W5, W6, W7.

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
- 2026-10-12 — W2 4A generation 1 (`mo1309/phase4a-e2e` at `5730b659`, run from Git Bash, load samples 27–40 % CPU, disk 37 GB free): `FAILED_PRESERVED`. (A first launch stopped at once with ENOENT because the one-shot output's parent `evidence/mo1309/4a/` did not exist; no case ran, no output was created, so that is not a generation; the empty parent was created and the run repeated.)
  E1–E6 PASS, E8 RECORDED, E7 and E9 FAIL with exit code 0 and no counts. Classification HARNESS_DEFECT: Node 24's `node --test` prints `ℹ tests N` (spec) off a terminal and the campaign and regression runners parsed only TAP `# tests N`. Disposition in `evidence/mo1309/4a/gen-1/disposition.md`.
  Fix (tooling only, section 14.1; logged): `tapCounts` accepts both forms and `campaigns.mjs` uses it; negative-control test added; the DB29 unit test no longer assumes a Linux refusal text; the inventory was rebuilt for the new DB30-tagged test title (only that title was added). Also: Git Bash's GNU tar breaks 4B-C4, so all campaigns run from PowerShell (Windows tar first). Tool tests (manifest, campaigns, inventory) 13/13 on Windows.
- 2026-10-12 — W2 4A generation 2 (`gen-2`, run from PowerShell at `68eed767`, clean tree, 35.9 GB free, load samples 21–31 % CPU): **ACCEPTED** certifying. E1–E7 and E9 PASS, E8 RECORDED (100,000 entries, no claim). Receipt `evidence/mo1309/4a/gen-2/4a-receipt.json`, console in `console.log`.
  Streams 4B and 4C branch from the 4A evidence commit (not literally B2) because the generation 1 fix to the shared summary parser is needed there too; B2 plus tooling-only commits, no production byte differs.
