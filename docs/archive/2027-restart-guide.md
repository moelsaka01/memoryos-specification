# MemoryOS 2027 restart guide

Written 2026-10-15 at the end-of-2026 archive. Goal: resume MemoryOS work in 2027 from a **fresh clone** of GitHub, with nothing needed from the 2026 PC. The companion [2026 local inventory](2026-local-inventory.md) lists everything that existed on that PC and where each item went.

## 1. Where everything is

| What | Where |
|---|---|
| Implementation and the MemoryOS Standard | <https://github.com/moelsaka01/memoryos-specification> (branch `main`) |
| Specifications repository (CCA specifications, `release/memoryos-v1.2.1-publications` content equals `main` `bdf8fd4`) | <https://github.com/moelsaka01/cca-specifications> (branch `main`, tags `ar001-constitution`, `proc-1.0`, `sp001-foundation`, `sp004-persistence`) |
| Published releases | `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.2.1`, `v1.3.0`, `v1.3.1` (Latest) at <https://github.com/moelsaka01/memoryos-specification/releases> |
| Milestone tags | `cp001-memory-foundation` .. `cp011-memory-studio`, `im001-foundation` .. `im006-persistence`, `memoryos-1.1-*`, `memoryos-1.2-mo1201..mo1208`, `memoryos-1.3-mo1301..mo1309`, `archive/mo1308/*` |
| 2026 archive tags | `archive/2026/*` (see section 2) |
| Private media and logs | **draft** release `archive-2026-media` (never published; visible only to the repository owner) |
| Media production scripts | `tools/media/1.3.0/` and `tools/media/1.3.1/` on `main`, each with `MEDIA-NOTES.md` and `SOCIAL-POSTS.md` |

GitHub holds only `main` and tags; every other branch was deleted after being tagged.

Fresh start:

```bash
git clone https://github.com/moelsaka01/memoryos-specification.git
cd memoryos-specification
git fetch --tags
git checkout v1.3.1          # released state; `main` is v1.3.1 plus archive documents and tools/media
```

On Windows enable long paths **before** cloning (the repository contains deep evidence trees; a clone without it fails to check out many files and shows them as deleted - never commit from such a clone):

```bash
git clone -c core.longpaths=true https://github.com/moelsaka01/memoryos-specification.git
```

Download the private archive (needs `gh auth login` as the owner):

```bash
gh release download archive-2026-media --repo moelsaka01/memoryos-specification --dir archive-2026-media
```

## 2. Archive tags (`archive/2026/*`)

All annotated, never to be moved or deleted.

| Pattern | Meaning |
|---|---|
| `archive/2026/cca-workspace/codex/mo1307-*` | local-only MO-1307 branch tips of the 2026 workspace (13 tips: phase2a/2b/2c-resumed, phase3a-c3rb-*, phase3b-*, phase3c-*) |
| `archive/2026/cca-workspace/main-local-unpushed` | the 3 unpushed local `main` commits (MO-1307 helper deadline characterization and correction design) |
| `archive/2026/cca-workspace/detached-p4r`, `detached-r3d` | two detached worktree heads |
| `archive/2026/<folder>-wip` | snapshot commit of the **uncommitted** work in a worktree (parent = that worktree's HEAD). Examples: `cca-workspace-wip` (MO-1307 Phase 3A R2 diagnostic, serialization correction, C3S F22 disposition, `.gitattributes`, readiness manifest/helper edits), `m7t-wip`/`m7u-wip` (replacement helper-bound characterization), `r3a-wip`, `cca-mo1307-3a-wip`, `cca-mo1307-2c-wip`, `w3t-wip` (**Studio history-store / CLI history changes**), `n7c-wip` (`mo1309/x` evidence), `g7b-wip`/`g7c-wip`, `2026-07-25-outputs-cca-workspace-wip`, `2026-09-11-*-wip` |
| `archive/2026/tt-3d-1` .. `tt-3d-8` | heads of the Phase 3D rehearsal clones (`p3d-test` commits) |
| `archive/2026/2026-09-11-mo1302-phase3-reproduction` | MO-1302 Phase 3 reproduction head |
| `archive/2026/branches/<branch>` | tip of a remote branch that was not merged into `main` when branches were cleaned up: `claude/peaceful-gauss-62v6vi`, `codex/mo1307-phase3br2-c3tb`, `codex/mo1307-phase3cr2-c3tb`, three `dependabot/github_actions/actions/*` bumps (their three pull requests closed when the branches were deleted) |

Recover a snapshot: `git switch -c wip-r3a archive/2026/r3a-wip` (use `git tag -l 'archive/2026/*'` to list). To unpack uncommitted work onto its base: `git diff <tag>^ <tag>`.

Draft release `archive-2026-media` contents (see `ARCHIVE-ZIP-MANIFEST.txt` inside it): final 1.3.0 and 1.3.1 media (`1.3.0-out__*`, `1.3.1-out__*`, `1.3.1-ads-v2__*`, `1.3.1-ads-v2-social__*`), 1.1/1.2 demo clips (`release-media__*`), `memoryos-0.1.0.vsix`, and zipped text logs/scratch (`logs-*`, `scratch-*`, `dated-*`, `claude-scratchpad-*`).

## 3. Exact toolchain (reference host: Windows 11 10.0.26200 x64)

| Tool | Pinned version | Notes |
|---|---|---|
| Node.js | **v24.21.0** (npm 11.19.0) | `node.exe` SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` |
| Python | 3.14.4 | `C:\Python314` |
| Visual Studio 2022 Build Tools | 17.14 (17.14.37710.0), MSVC 14.44.35207 (`cl` 19.44) | C++ build tools only (no IDE) |
| CMake | 3.31.6 | |
| Ninja | 1.13.2 | |
| vcpkg | release 2026.06.24, commit `cd61e1e26a038e82d6550a3ebbe0fbbfe7da78e3` | also `builtin-baseline` in `vcpkg.json`; triplet `x64-windows`; deps `gtest`, `yaml-cpp` |
| FFmpeg | 9.0.2 (gyan.dev full build, `winget install Gyan.FFmpeg`) | media only |
| GitHub CLI | 2.102.0 | `gh auth login` as `moelsaka01` |
| Microsoft Edge | 155.0.4283.45 | Studio browser tests and the native-folder-picker observation |

Re-download and verify Node (do not trust a copy without checking the hash):

```powershell
$v = 'v24.21.0'
Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-win-x64.zip" -OutFile node.zip
Invoke-WebRequest "https://nodejs.org/dist/$v/SHASUMS256.txt" -OutFile SHASUMS256.txt
(Get-FileHash node.zip -Algorithm SHA256).Hash.ToLower()    # expect 158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541
Select-String 'win-x64.zip' SHASUMS256.txt                  # same hash as the line printed
Expand-Archive node.zip .; (Get-FileHash node-$v-win-x64\node.exe -Algorithm SHA256).Hash.ToLower()
# expect ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32
```

The repository also keeps the signed checksum evidence: `repositories/cca-conformance/evidence/mo1305-phase1-aux/toolchain/` (`SHASUMS256.txt`, `.asc`, keyring, verification output; signing fingerprint `5BE8A3F6C8A5C01D106C0AD820B1A390B168D356`). Verify `SHASUMS256.txt.asc` with GPG against the Node.js release keys for full provenance.

vcpkg: `git clone https://github.com/microsoft/vcpkg && git -C vcpkg checkout cd61e1e26a038e82d6550a3ebbe0fbbfe7da78e3 && vcpkg\bootstrap-vcpkg.bat`.

Other host settings:

- **Developer Mode: ON** (`AllowDevelopmentWithoutDevLicense = 1`) on the reference host (recorded as the state of the reference host; keep it as is).
- **Smart App Control: enforcing** (`VerifiedAndReputablePolicyState = 0x1`) on the reference host, left untouched. It blocks freshly built unsigned executables. Precedent in MO-1308 Contract Freeze 1 ([docs/mo1308-contract-freeze-1.md](../mo1308-contract-freeze-1.md)): **A3.1** waives the `cca_core_tests` target (MSVC C2607 does not compile with this toolchain); **A3.2** defines the differential no-regression gate (base vs candidate, same host); **A3.3** excludes the executables Smart App Control blocks (`memoryos.sdk.cpp.regression.example`) from the A3.2 CTest runs; **A3.4** fixes the A3.2 generation 3 receipt as the gate input. Native C++ verification belongs on a host **without** Smart App Control (the Smart App Control switch cannot be turned back on once off - do not change it on the reference host). Behaviour to expect: some freshly built `.exe` files are refused at launch; record it, do not work around it.
- Node-only history store: Windows 11 x64 claim only; run tests with the pinned Node on `PATH` first.

## 4. Open follow-ups

From [KNOWN_ISSUES.md](../../KNOWN_ISSUES.md) (v1.3.1 and carried items):

1. **Q-SAB-STANDIN / MO-1308 `SharedArrayBuffer` guard.** The released MO-1308 modules use `SharedArrayBuffer` without a `typeof` guard, so the verifier throws in a page that is not cross-origin isolated; Studio uses a scoped stand-in. Maintenance item: guard the MO-1308 modules with a byte-identical-behaviour proof.
2. **Q-MO1308-TREE-AUDITS (OD-1).** Seven tests (A01, A02, B01, B02, N07, S03, D03) fail by design on any commit after `memoryos-1.3-mo1308`; pinned by exact name.
3. **Q-MO1309-BASELINE-BOUND** (two tooling tests pinned), **Q-GATE-NODE**, **Q-GATE-LONG-UNITS** (`mo1308_phase3d_test` hangs on a clean base checkout), **Q-CTEST**, **Q-SHARED-FAILURES** (123 shared CTest failures, 112 `*AllocationFailureTest` aborts), `tools/verify_workspace.py` exiting 2 in a fresh worktree.
4. **Windows access violation (open, deferred).** `MemoryProviderAllocationFailureTest.DescriptorWorkspaceFailureConstructionPreservesCompleteState` dies with `0xC0000005` on windows-2022 (`ci` preset, RelWithDebInfo, MSVC 14.44), deterministic, passes under ASan and a standalone `/Od` build; likely UB in the test or `memory_provider`, a product defect not ruled out. Debug with a Windows debugger; hosted Windows CI shows it failing until fixed.
5. **Windows CI green with native C++ tests** on a host without Smart App Control.
6. Q-STORE-INTEGRITY / A6 rollback anchor (record `headDigest` externally), Q-SCALE / Q-PERF-100K (100k export about 16 min, 100k snapshot characterized only), macOS `pipe()`/`fcntl()` window, `Sha256Stream.update` input validation, Observe -> Trace discoverability, **source license decision** (no software license granted; `LICENSE` is a notice).
7. **Studio History screen clipping/scroll issue** (owner-reported; the details are not recorded in the repository): the Studio History screen has a clipping / scroll problem. Freeze check SH18 only asserts "no horizontal page scroll at 320, 768 and 1280 px", so vertical clipping and inner scrolling are not covered by any test. Reproduce in Edge at those widths, then fix with a regression test in the `studio-history-browser` suite.
8. **Studio UI integration of history writes** (owner follow-up): as of v1.3.1 the Studio History screen presents and verifies an exported MO-1308 history; history writes are not integrated into the Studio UI (they go through the MO-1308 CLI/store). Possibly related uncommitted work: `archive/2026/w3t-wip` (`repositories/memoryos-cli/bin/memoryos.js`, `src/history-store.js`). See the Freeze `docs/mo1310-studio-history-1.3.1.md`. Any new write path must respect the MO-1308 claim (local single-user v1, Windows 11 x64) and needs a new Freeze.
9. In-flight MO-1307 work captured as `-wip` tags: Phase 3A R2 diagnostic, serialization correction and C3S F22 disposition (`archive/2026/cca-workspace-wip`), replacement helper-bound characterization (`m7t-wip`, `m7u-wip`), Phase 3A refresh (`r3a-wip`). The MO-1307 helper-deadline line (`6d444e32`, `1e78a9a9`, `4a1de6f0`; tag `archive/2026/cca-workspace/main-local-unpushed`) was local-only (never pushed); `origin/main` already has the final MO-1307 result (639/639 on Windows under Node v24.21.0).

## 5. How the handoff / Freeze / pre-authorization workflow ran

The method is document-driven; resume it as-is.

1. **Contract Freeze.** Each milestone (`mo13xx`) begins with an append-only Freeze document (`docs/mo13xx-contract-freeze-1.md`: claims, limits, cases, phases). Once marked FROZEN it is changed only by numbered **amendments** (A1..A10, A3.1..A3.4), each owner-authorized and dated. Examples: MO-1308 Freeze 1, MO-1309 Freeze 1, 1.3.1 Freeze `docs/mo1310-studio-history-1.3.1.md`.
2. **Handoff file.** One committed file per run (`docs/mo1309-handoff.md`, `docs/release-1.3.1-handoff.md`, per-phase `docs/mo1309-phaseN-handoff.md`) with a fixed template: *State, Last bound commit, Next action, Decisions needed*, then a dated, append-only **run log**. The four fields are replaced at each update; the log is never rewritten. A new session resumes with a sentence such as: "Read docs/release-1.3.1-handoff.md and continue the 1.3.1 run to completion".
3. **Phases, generations and binding.** Work is split into phases on branches (`mo1309/phase1` ..). Certifying runs are numbered *generations*; failed ones are preserved (never deleted) as `FAILED_PRESERVED`/`ESCALATED_PRESERVED`. A phase ends with a **binding** commit; the final record is **I3** and a binding-only **BF** commit; a validator reports `CERTIFIED_READY_TO_TAG`.
4. **Standing pre-authorization (OWNER M9, section 14 of the MO-1309 Freeze).** Allowed without asking: harness/environment fixes that touch only test/harness/fixture/tooling files (each with a negative control, logged afterwards in the run log); a new generation after a non-product failure (`HARNESS_DEFECT`, `ENVIRONMENT_BLOCKER`, `INTERRUPTION`), capped at two extra generations per stream; **fast-forward only** of `main` at named boundaries (Freeze approval, phase binding, I3/BF, evidence commits) after an ancestry check; documentation-only corrections to ROADMAP, CHANGELOG and handoffs. **Not pre-authorized:** tags and tag pushes (tags stay human), limit or scope changes, new dependencies, anything weakening a product guarantee. A `CONTRACT_DEFECT`, a `PRODUCT_DEFECT` changing public behaviour, or an escalated generation needs the owner. The run **STOPs** and records the question under *Decisions needed* (example: SH-D4 in 1.3.1, resolved as owner decision OD-1).
5. **Release.** After `CERTIFIED_READY_TO_TAG` a human reviews and pushes the annotated tag (`v1.3.1`, tag object `82aed773` peeling to `2781d93f`); the GitHub release is first created as a **draft** and published by the owner.
6. **Archive hygiene (this session).** Never force-push, never move or delete a tag, never rewrite history; unmerged branch tips are tagged before deletion; uncommitted work is snapshotted with a temporary index and `git commit-tree` (no checkout, no change to the worktree).

Rules of thumb for 2027: start from `v1.3.1`, read `KNOWN_ISSUES.md`, `docs/release-1.3.1-handoff.md` and the newest Freeze, write a new Freeze and handoff before touching product bytes, and keep every run log append-only.
