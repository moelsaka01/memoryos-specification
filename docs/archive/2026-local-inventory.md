# MemoryOS 2026 local inventory (archive snapshot)

Snapshot taken 2026-10-15 on the Windows reference PC (`DESKTOP-5IVGB5K`) as part of the end-of-2026 archive. It records every MemoryOS-related git repository, worktree and folder found, whether its commits are on GitHub, what uncommitted work existed, and where it was archived. Nothing was deleted from the PC. See [the 2027 restart guide](2027-restart-guide.md) for how to resume.

GitHub repositories: [memoryos-specification](https://github.com/moelsaka01/memoryos-specification) (the implementation and the MemoryOS Standard; 49 of the local worktrees are linked to `C:\Users\melsa\Documents\Codex\cca-workspace\.git`) and [cca-specifications](https://github.com/moelsaka01/cca-specifications) (`cca-specifications` plus its `-v1.2.1-restoration` worktree).

## Method and conventions

- A HEAD is **on GitHub** when it is contained in a remote branch or any tag of the matching GitHub repository (checked after `git fetch origin --tags`).
- Uncommitted work (modified and untracked, honouring `.gitignore`) was snapshotted without touching the worktree: a temporary index, `git commit-tree`, then pushed as branch and annotated tag `archive/2026/<name>-wip`. Excluded: `node_modules`, `.cache`, `out/`, `build/`, `vcpkg`, `dist`, `.venv`, `*.tgz *.zip *.exe *.dll *.mp4 *.pem *.key`, files larger than 50 MB. A handful of files with paths longer than the Windows limit (the regenerated 1.2.1 manifests in the `r9eb` and `v121-generation*` reproduction folders) could not be read and are regenerable.
- Ignored files (build trees, `node_modules`, vcpkg) are never archived; they are regenerable from the toolchain in the restart guide.
- Local branches were never deleted. Those whose commits were not reachable from GitHub were tagged `archive/2026/cca-workspace/<branch>`.

## 1. Shared object store: `cca-workspace` local refs

Local `main` was 3 commits ahead of and 411 behind `origin/main` after `git fetch` (diverged; 391 behind before the fetch). Its 3 unpushed commits (`6d444e32`, `1e78a9a9`, `4a1de6f0`) are preserved by tags `archive/2026/cca-workspace/main-local-unpushed` and, with its 13 uncommitted files, by `archive/2026/cca-workspace-wip`. No stashes. 43 local branches existed; 32 were not on `origin` by name:

| Local branch | Tip | Status on GitHub | Archive ref |
|---|---|---|---|
| `codex/mo1307-console-ownership` | `cd8926e1` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-final-headless` | `b73f4bd6` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-headless-cleanup` | `c285fd8e` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-helper-bound-characterization` | `79ef47e6` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-missing-leaf-lifecycle` | `b82ecc77` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-n15-correction` | `56a3d93a` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-n17-fixture` | `f1a78f64` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-phase2a-readiness-core` | `b628349b` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase2a-readiness-core` |
| `codex/mo1307-phase2b-evidence-graph` | `b2877ab3` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase2b-evidence-graph` |
| `codex/mo1307-phase2c-acquisition-publication` | `3883ca88` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-phase2c-resumed` | `24a9ed13` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase2c-resumed` |
| `codex/mo1307-phase3a-c3rb-cert` | `7c288248` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3a-c3rb-cert` |
| `codex/mo1307-phase3a-c3rb-restart` | `bf715553` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3a-c3rb-restart` |
| `codex/mo1307-phase3a-refresh` | `defe9398` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-phase3a-runtime` | `976d4a04` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-phase3ar2-c3tb` | `9f45656c` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-phase3ar2-c3ub` | `0d254bba` | same-name remote branch | - |
| `codex/mo1307-phase3b-c3rb-cert` | `702c1b63` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3b-c3rb-cert` |
| `codex/mo1307-phase3b-package` | `85dea823` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3b-package` |
| `codex/mo1307-phase3b-refresh` | `5cb213ee` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3b-refresh` |
| `codex/mo1307-phase3br2-c3tb` | `4d92f0f2` | same-name remote branch | - |
| `codex/mo1307-phase3c-c3rb-cert` | `2fe26d37` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3c-c3rb-cert` |
| `codex/mo1307-phase3c-c3rb-cert2` | `f35dfcbf` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3c-c3rb-cert2` |
| `codex/mo1307-phase3c-c3rb-cert3` | `b02fc022` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3c-c3rb-cert3` |
| `codex/mo1307-phase3c-refresh` | `f4ed5873` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3c-refresh` |
| `codex/mo1307-phase3c-security` | `191f3474` | NOT on GitHub before archive | `archive/2026/cca-workspace/codex/mo1307-phase3c-security` |
| `codex/mo1307-phase3cr2-c3tb` | `7d2006c6` | same-name remote branch | - |
| `codex/mo1307-phase3d-certification` | `1dd1e8c8` | same-name remote branch | - |
| `codex/mo1307-prospective-helper-bound-candidate` | `119e68bd` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-slot5-deadline` | `0599476f` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-startup-exit22` | `02d96d07` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-startup-resolution` | `cb1e1428` | reachable from a GitHub branch or tag | - |
| `codex/mo1307-wire-repair` | `93e515d8` | reachable from a GitHub branch or tag | - |
| `im003-runtime-foundation` | `3827a696` | same-name remote branch | - |
| `main` | `4a1de6f0` | diverged (3 ahead / 411 behind) | `archive/2026/cca-workspace/main-local-unpushed`, `archive/2026/cca-workspace-wip` |
| `media/v1.3.0` | `889f99e7` | reachable from a GitHub branch or tag | - |
| `media/v1.3.1` | `2781d93f` | reachable from a GitHub branch or tag | - |
| `mo1309/phase4a-e2e` | `f8bcf30f` | same-name remote branch | - |
| `mo1309/phase4b-closure` | `4c8ca152` | same-name remote branch | - |
| `mo1309/phase4c-trust` | `b8f618e4` | same-name remote branch | - |
| `mo1309/phase4d` | `97d84a1e` | same-name remote branch | - |
| `release-1.3.1/windows` | `2ca7e8d6` | same-name remote branch | - |
| `release/v1.2.1-restoration` | `2c3a5491` | reachable from a GitHub branch or tag | - |

Two detached worktree heads were also unreachable and are tagged: `archive/2026/cca-workspace/detached-p4r` (`C:\p4r`, `9369292b`) and `archive/2026/cca-workspace/detached-r3d` (`C:\r3d`, `9b79e120`).

## 2. Git repositories and worktrees

| Path | HEAD | Branch | HEAD on GitHub | Uncommitted | Archive | Size (MB, no caches) | Disposition |
|---|---|---|---|---|---|---|---|
| `C:\c3a` | `7f95d951` | (detached) | yes | none | - | 430 | SAFE_TO_DELETE |
| `C:\c3b` | `e9749e1a` | (detached) | yes | none | - | 427 | SAFE_TO_DELETE |
| `C:\c3c` | `e8101d92` | (detached) | yes | none | - | 427 | SAFE_TO_DELETE |
| `C:\c3d` | `7e2d5919` | (detached) | yes | none | - | 431 | SAFE_TO_DELETE |
| `C:\g7b` | `bf2fdc87` | (detached) | yes | 1 path(s) | `archive/2026/g7b-wip` | 1334 | SAFE_TO_DELETE |
| `C:\g7c` | `74be815b` | (detached) | yes | 1 path(s) | `archive/2026/g7c-wip` | 1338 | SAFE_TO_DELETE |
| `C:\m7a` | `7c288248` | `codex/mo1307-phase3a-c3rb-cert` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3a-c3rb-cert` | 323 | SAFE_TO_DELETE |
| `C:\m7a2` | `bf715553` | `codex/mo1307-phase3a-c3rb-restart` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3a-c3rb-restart` | 321 | SAFE_TO_DELETE |
| `C:\m7b` | `702c1b63` | `codex/mo1307-phase3b-c3rb-cert` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3b-c3rb-cert` | 315 | SAFE_TO_DELETE |
| `C:\m7c` | `2fe26d37` | `codex/mo1307-phase3c-c3rb-cert` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3c-c3rb-cert` | 318 | SAFE_TO_DELETE |
| `C:\m7c2` | `f35dfcbf` | `codex/mo1307-phase3c-c3rb-cert2` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3c-c3rb-cert2` | 319 | SAFE_TO_DELETE |
| `C:\m7c3` | `b02fc022` | `codex/mo1307-phase3c-c3rb-cert3` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3c-c3rb-cert3` | 341 | SAFE_TO_DELETE |
| `C:\m7t` | `b82ecc77` | (detached) | yes | 2 path(s) | `archive/2026/m7t-wip` | 323 | SAFE_TO_DELETE |
| `C:\m7u` | `b82ecc77` | (detached) | yes | 3 path(s) | `archive/2026/m7u-wip` | 330 | SAFE_TO_DELETE |
| `C:\mos-media\repo` | `889f99e7` | `media/v1.3.0` | yes | 1 path(s) | tools/media committed to main (tools/media/1.3.0) | 441 | SAFE_TO_DELETE |
| `C:\mos-media\repo131` | `2781d93f` | `media/v1.3.1` | yes | 1 path(s) | tools/media committed to main (tools/media/1.3.1) | 447 | SAFE_TO_DELETE |
| `C:\n7b` | `bf2fdc87` | (detached) | yes | none | - | 431 | SAFE_TO_DELETE |
| `C:\n7c` | `1026dce7` | (detached) | yes | 1 path(s) | `archive/2026/n7c-wip` | 435 | SAFE_TO_DELETE |
| `C:\n8b` | `bf2fdc87` | (detached) | yes | none | - | 431 | SAFE_TO_DELETE |
| `C:\n8c` | `74be815b` | (detached) | yes | none | - | 435 | SAFE_TO_DELETE |
| `C:\p4a` | `f8bcf30f` | `mo1309/phase4a-e2e` | yes | none | - | 435 | SAFE_TO_DELETE |
| `C:\p4b` | `4c8ca152` | `mo1309/phase4b-closure` | yes | none | - | 435 | SAFE_TO_DELETE |
| `C:\p4c` | `b8f618e4` | `mo1309/phase4c-trust` | yes | none | - | 435 | SAFE_TO_DELETE |
| `C:\p4d` | `97d84a1e` | `mo1309/phase4d` | yes | none | - | 441 | SAFE_TO_DELETE |
| `C:\p4r` | `9369292b` | (detached) | yes | none | `archive/2026/cca-workspace/detached-p4r` | 435 | SAFE_TO_DELETE |
| `C:\r131` | `2ca7e8d6` | `release-1.3.1/windows` | yes | none | - | 447 | SAFE_TO_DELETE |
| `C:\r3` | `f5481d56` | (detached) | yes | none | - | 416 | SAFE_TO_DELETE |
| `C:\r3d` | `9b79e120` | (detached) | yes | none | `archive/2026/cca-workspace/detached-r3d` | 431 | SAFE_TO_DELETE |
| `C:\r3e` | `0ba274e0` | (detached) | yes | none | - | 431 | SAFE_TO_DELETE |
| `C:\t131b` | `889f99e7` | (detached) | yes | none | - | 441 | SAFE_TO_DELETE |
| `C:\t131c` | `bbee6e5a` | (detached) | yes | none | - | 445 | SAFE_TO_DELETE |
| `C:\tt\3d-1\clone` | `3e2a0b81` | (detached) | yes | none | `archive/2026/tt-3d-1` | 430 | SAFE_TO_DELETE |
| `C:\tt\3d-2\clone` | `eb2513c4` | (detached) | yes | none | `archive/2026/tt-3d-2` | 430 | SAFE_TO_DELETE |
| `C:\tt\3d-3\clone` | `0071022c` | (detached) | yes | 1 path(s) | `archive/2026/tt-3d-3` | 434 | SAFE_TO_DELETE |
| `C:\tt\3d-4\clone` | `ce7ecf31` | (detached) | yes | 1 path(s) | `archive/2026/tt-3d-4` | 430 | SAFE_TO_DELETE |
| `C:\tt\3d-5\clone` | `42291189` | (detached) | yes | 1 path(s) | `archive/2026/tt-3d-5` | 434 | SAFE_TO_DELETE |
| `C:\tt\3d-6\clone` | `b0ce98dc` | (detached) | yes | 1 path(s) | `archive/2026/tt-3d-6` | 430 | SAFE_TO_DELETE |
| `C:\tt\3d-7\clone` | `f69dce44` | (detached) | yes | none | `archive/2026/tt-3d-7` | 440 | SAFE_TO_DELETE |
| `C:\tt\3d-8\clone` | `fca418c2` | (detached) | yes | none | `archive/2026/tt-3d-8` | 444 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-2a` | `b628349b` | `codex/mo1307-phase2a-readiness-core` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase2a-readiness-core` | 226 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-2b` | `b2877ab3` | `codex/mo1307-phase2b-evidence-graph` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase2b-evidence-graph` | 226 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-2c` | `3883ca88` | `codex/mo1307-phase2c-acquisition-publication` | yes | 3 path(s) | `archive/2026/cca-mo1307-2c-wip` | 226 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-2c-resumed` | `24a9ed13` | `codex/mo1307-phase2c-resumed` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase2c-resumed` | 258 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-3a` | `976d4a04` | `codex/mo1307-phase3a-runtime` | yes | 7 path(s) | `archive/2026/cca-mo1307-3a-wip` | 280 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-3b` | `85dea823` | `codex/mo1307-phase3b-package` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3b-package` | 272 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-3c` | `191f3474` | `codex/mo1307-phase3c-security` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3c-security` | 279 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-mo1307-3d` | `1dd1e8c8` | `codex/mo1307-phase3d-certification` | yes | none | - | 414 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-specifications` | `bdf8fd4` | `main` | yes | none | - | 1 | SAFE_TO_DELETE (last: owns the shared .git of the restoration worktree) |
| `C:\Users\melsa\Documents\Codex\cca-specifications-v1.2.1-restoration` | `bdf8fd4` | `release/memoryos-v1.2.1-publications` | yes | none | - | 1 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\cca-workspace` | `4a1de6f0` | `main` | yes | 13 path(s) | `archive/2026/cca-workspace-wip` | 671 | SAFE_TO_DELETE (last: owns the shared .git of all workspace worktrees) |
| `C:\Users\melsa\Documents\Codex\r3a` | `defe9398` | `codex/mo1307-phase3a-refresh` | yes | 10 path(s) | `archive/2026/r3a-wip` | 325 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\r3b` | `5cb213ee` | `codex/mo1307-phase3b-refresh` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3b-refresh` | 318 | SAFE_TO_DELETE |
| `C:\Users\melsa\Documents\Codex\r3c` | `f4ed5873` | `codex/mo1307-phase3c-refresh` | yes | none | `archive/2026/cca-workspace/codex/mo1307-phase3c-refresh` | 334 | SAFE_TO_DELETE |
| `C:\v6a` | `a07f19d2` | (detached) | yes | none | - | 722 | SAFE_TO_DELETE |
| `C:\w2` | `749d2113` | (detached) | yes | none | - | 423 | SAFE_TO_DELETE |
| `C:\w3t` | `e61e6135` | (detached) | yes | 2 path(s) | `archive/2026/w3t-wip` | 419 | SAFE_TO_DELETE |
| `C:\x3c` | `fafb410a` | (detached) | yes | none | - | 422 | SAFE_TO_DELETE |
| `C:\y1` | `88a3fba6` | (detached) | yes | none | - | 421 | SAFE_TO_DELETE |
| `C:\z3c` | `f119728c` | (detached) | yes | none | - | 422 | SAFE_TO_DELETE |

### Notes on worktree dispositions

- Worktrees of `cca-workspace` are removed with `git worktree remove --force <path>` (or deleted, then `git worktree prune`); the 32 local branches stay in the shared `.git` until it is deleted. Everything they hold is on GitHub as shown above.
- `C:\mos-media\repo` and `repo131` carry the 1.3.0/1.3.1 media scripts as untracked `tools/media`; those are committed on `main` under `tools/media/1.3.0/` and `tools/media/1.3.1/` together with each output folder
- `C:\tt\3d-1` to `3d-8` are throw-away rehearsal clones (clean-evidence-slate test clones of the Phase 3D campaign); each has two local commits by `p3d-test`, preserved as `archive/2026/tt-3d-N`.

## 3. Nested clones inside the dated Codex folders

All are standalone clones or worktrees created by earlier Codex sessions. Every HEAD is on GitHub (matching repository) except those tagged below; counts of uncommitted paths in parentheses.

| Folder | Clones / worktrees | State | Archive | Disposition |
|---|---|---|---|---|
| `2026-07-25\files-mentioned-by-the-user-you` (~12.7 GB, mostly ignored build output in `outputs\cca-workspace`) | 5 repos: `outputs\cca-workspace` (im003 clone, 139 modified), three unborn `cca-specifications` drafts (8 untracked entries each), `work\memoryos-v1.2-release` | HEAD `92c944c` is on GitHub; the drafts have no commits | `archive/2026/2026-07-25-outputs-cca-workspace-wip`; drafts zipped as `dated-2026-07-25-spec-draft-*.zip` in the draft release; `products`, `AR-001`, `.capture`, `outputs\IS-002-HANDOFF.md`, `reference-artifacts.zip` uploaded; `release-media` 1.1/1.2 demo GIF/MP4 uploaded; the 343 MB `outputs\cca-workspace.zip` is a 1.2-era snapshot regenerable from tags | SAFE_TO_DELETE |
| `2026-09-11\memoryos-1-3-we-are-starting` (~4.4 GB) | 40 repos under `work\` (v1.2.1 reproduction, `r770a`, `r841a`, `r9eb`, `v121-generation`..`5`, `final-repro`, `wheel`), `out\` (mo1301 reproduction clones), `mo1302-phase3-*` | All reproduction clones; HEADs on GitHub except `mo1302-phase3-*` (`19910133`) and the `v121-generation*` heads | `archive/2026/2026-09-11-mo1302-phase3-reproduction`; `archive/2026/2026-09-11-v121-generation*-wip` and `2026-09-11-r9eb-w-wip` (regenerated manifests); `handoff-patches`, `tools`, `outputs` zipped. The 589-path `out\mo1301-*\implementation` clones show only deleted tracked files (reproduction scaffolding) and `final-repro` shows 4 deleted manifests: nothing to archive. `wheel` holds only `build/` and `egg-info` (regenerable) | SAFE_TO_DELETE |
| `2026-06-21\files-mentioned-by-the-user-you` (118 MB) | empty `.git` directory; contents are **Quantum Race** (race-engineering demo: backend, frontend, Docker) | not MemoryOS | none | KEEP (not MemoryOS) |
| `2026-09-19\open-c-users-melsa-documents-codex` (~990 MB) | no git; `work\` holds embedded Python 3.12.10, nuget cache, `vscode-test`, `npm-cache`, `vsix-check`, `vsix-final` | regenerable tool downloads | `memoryos-0.1.0.vsix` and its identity JSON uploaded | SAFE_TO_DELETE |
| `2026-08-18`, `2026-09-02`, `2026-09-06`, `2026-09-17`, `2026-09-18`, `2026-09-21`, `3ar2`, `3cr2`, `cca-mo1306-2c`, `cca-mo1306-3a` | empty chat-session folders (0 files) | nothing to archive | none | SAFE_TO_DELETE |

## 4. Folders that are not git repositories

| Path | Size (MB) | What it is | Archived as | Disposition |
|---|---|---|---|---|
| `C:\g4-logs` | 2 | Phase 3 precondition logs (g4) | `logs-C-g4-logs.zip` (text); committed evidence also in repo | SAFE_TO_DELETE |
| `C:\g5-logs` | 2 | Phase 3 precondition logs (g5) | `logs-C-g5-logs.zip` | SAFE_TO_DELETE |
| `C:\g6-logs` | 2 | Phase 3 precondition logs (g6) | `logs-C-g6-logs.zip` | SAFE_TO_DELETE |
| `C:\g7-logs` | 3 | Phase 3 precondition logs (g7) | `logs-C-g7-logs.zip` | SAFE_TO_DELETE |
| `C:\w6logs` | 0 | npm-ci logs for n7b/n7c/n8b/n8c | `logs-C-w6logs.zip` | SAFE_TO_DELETE |
| `C:\r3out` | 0 | MO-1307 characterization outputs | `scratch-C-r3out.zip` | SAFE_TO_DELETE |
| `C:\r131-obs` | 1 | 1.3.1 Windows run observations | `scratch-C-r131-obs.zip` | SAFE_TO_DELETE |
| `C:\scratch3a` | 0 | scratch | `scratch-C-scratch3a.zip` | SAFE_TO_DELETE |
| `C:\scratch3c` | 0 | scratch | `scratch-C-scratch3c.zip` | SAFE_TO_DELETE |
| `C:\scratch3d` | 0 | scratch | `scratch-C-scratch3d.zip` | SAFE_TO_DELETE |
| `C:\scr` | 2 | dev-logs, dev-setup, rec-logs, g3/g4 temp | `scratch-C-scr.zip` | SAFE_TO_DELETE |
| `C:\m1306` | 17 | MO-1306 historical worktree evidence (3a, 3ar, 3br, 3c) | `scratch-C-m1306.zip` (near-identical to Codex\mo1306-historical-worktree-evidence) | SAFE_TO_DELETE |
| `C:\mos-demo` | 1 | demo export, ledger, policy, records | `scratch-C-mos-demo.zip`; regenerable by the demo scripts | SAFE_TO_DELETE |
| `C:\p4corpus` | 461 | generated 1k/10k/100k history corpora (310,809 files) | regenerable by `tools/mo1309` generators | SAFE_TO_DELETE |
| `C:\mos-node` | 90 | pinned Node v24.21.0 (node.exe SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`) | re-download and verify per the restart guide | SAFE_TO_DELETE |
| `C:\51b47c9bd6e56c6720f9` | 196 | Visual Studio Build Tools installer cache (.msi/.msu/.dll) | regenerable (Microsoft installer) | SAFE_TO_DELETE |
| `C:\v8a` | 498 | extracted rehearsal-r8 source tree (not git) | regenerable from tag; `.p3a-work` has no text files | SAFE_TO_DELETE |
| `C:\v9a` | 455 | extracted rehearsal-r9 source tree (not git) | regenerable from tag | SAFE_TO_DELETE |
| `C:\mos-media\out` | 52 | 1.3.0 media outputs (ads, GIF, MP4, thumbnails) | all files in draft release `archive-2026-media` prefixed `1.3.0-out__` | SAFE_TO_DELETE |
| `C:\mos-media\out-1.3.1` | 354 | 1.3.1 media outputs incl. `ads-v2`, `ads-v2\social` | prefixes `1.3.1-out__`, `1.3.1-ads-v2__`, `1.3.1-ads-v2-social__` | SAFE_TO_DELETE |
| `C:\mos-media\work, work131` | - | render work trees (frames, audio, intermediates; ~2.6 GB) | regenerable with `tools/media/*` | SAFE_TO_DELETE |
| `C:\mos-media\scratch, live, precedent` | - | diagnostic scripts, live captures, precedent clips | `scratch-mos-media-*.zip` (text only) | SAFE_TO_DELETE |
| `C:\mos-media (whole)` | - | media workspace; 2 git worktrees inside (see section 2) | see above | SAFE_TO_DELETE (after removing its two worktrees) |
| `C:\Dev, C:\backup, C:\content, C:\m7fix, C:\m7h, C:\t131s` | - | empty folders | nothing | SAFE_TO_DELETE (empty) |
| `C:\fold` | 0 | one file `Sheet.xlsx`, not MemoryOS-related | - | KEEP (not MemoryOS) |
| `C:\Mohamed` | 14 | "3d frog frenzy" assets, not MemoryOS | - | KEEP (not MemoryOS) |
| `Codex\.pnpm-store` | 81 | pnpm package store (81 MB) | regenerable | SAFE_TO_DELETE |
| `Codex\npm-cache-mo1308` | 0 | npm cache (`_cacache`) | regenerable | SAFE_TO_DELETE |
| `Codex\mo1308-b1, scratch-mo1308` | - | MO-1308 B1 characterization logs; dev-out and run.ps1 | `logs-CX-mo1308-b1.zip`, `logs-CX-scratch-mo1308.zip` | SAFE_TO_DELETE |
| `Codex\*-logs (b2d, b2g2, cd1, d2d-devlogs, d8-2a, d8-2c, d9-logs-a/b, g2-2a, g2-2c, g3-2c, g3-logs, m8-2a/2b/2c, p1d, p1r, p2r, q3b)` | - | campaign logs of MO-1307/1308 phases | `logs-CX-<name>.zip` each | SAFE_TO_DELETE |
| `Codex\3ar2-h2-resume-capture-20261004T094932Z` | 1 | MO-1307 Phase 3A r2 resume capture (48 files) | `logs-CX-3ar2-h2-resume-capture-20261004T094932Z.zip` | SAFE_TO_DELETE |
| `Codex\mo1305-phase3c-historical-blocker` | 0 | MO-1305 historical blocker docs | `logs-CX-mo1305-phase3c-historical-blocker.zip` | SAFE_TO_DELETE |
| `Codex\mo1306-historical-worktree-evidence` | 17 | MO-1306 historical worktree evidence (1,321 files, 17 MB) | `logs-CX-mo1306-historical-worktree-evidence.zip` | SAFE_TO_DELETE |
| `AppData\Local\Temp\claude\C--Users-melsa-Documents-Codex-cca-workspace\<session>\scratchpad (9 sessions)` | - | Claude Code session scratchpads (one is a 311 MB MemoryOS release workspace) | `claude-scratchpad-<id>.zip` (text only, files < 5 MB); the rest is regenerable | SAFE_TO_DELETE (not this session's until it ends) |

## 5. WSL

`wsl -l -v` lists one distribution: **docker-desktop** (WSL 2, stopped). It is Docker Desktop's internal utility distribution, not user work. It was not started and not modified (starting it would only be needed to list files; it holds no user-created MemoryOS content). Verdict: **KEEP** - it is not a MemoryOS-only distribution, so it is not SAFE_TO_UNREGISTER; Docker Desktop manages it.

## 6. What is on GitHub after the archive

- Branch `main` only (all other branches deleted after tagging; see the restart guide for the tag list).
- Release/milestone tags (`v1.0.0`..`v1.3.1`, `memoryos-1.x-*`, `cp*`, `im*`, `archive/mo1308/*`) unchanged.
- Annotated archive tags `archive/2026/*`: workspace local-only branches, `*-wip` snapshots of uncommitted work, `tt-3d-N` clones, `branches/<name>` for every unmerged remote branch.
- Private **draft** release `archive-2026-media` (never published): final media (1.3.0, 1.3.1, `ads-v2`, `ads-v2/social`, thumbnails, GIF, MP4; 1.1/1.2 demo clips) and zipped scratch/logs (`ARCHIVE-ZIP-MANIFEST.txt` lists every zip with source path and counts).
- `tools/media/1.3.0/` and `tools/media/1.3.1/` on `main`.

