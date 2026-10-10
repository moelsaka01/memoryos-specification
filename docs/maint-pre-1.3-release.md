# Pre-1.3 release maintenance (test/CI only)

Branch `maint/pre-1.3-release`, based on `origin/main` d7a4919e. No product semantics changed (cca-core and
cca-sdk object code byte-identical; MCP shipped surface untouched). No tag, evidence or MO-1308/MO-1309 file
was edited. Not merged to main.

## Done

| # | Item | Commit(s) | Verified in the cloud |
|---|------|-----------|-----------------------|
| 1 | MCP suite: no tracked measurement rewrite, closure assembled, `.tgz` built by `scripts/prepare-tests.mjs` | 6220f44a | `npm test` 136/136 on Node 24.21.0 (env `NODE_OPTIONS`/`NODE_PATH` unset), tracked files unchanged |
| 2 | 1.2.1 manifest pins authenticated against release commit 2c3a5491 (`v1.2.1`) | 3a10b0a2, e9df7652 | `specification` and `coverage-gap` pass |
| 3 | MO-1304 tag asserted present (object 6d877151 -> ce7b001d); frozen-surface checks bounded to the tag | 42ee3899, platform-support commit | `mo1304-phase1/-phase3-ubuntu/-platform-support` pass |
| 4 | MO-1305 phase 3D workspace gate derived from `git rev-parse --show-toplevel` | 58ab0566 | `tests/test_mo1305_workspace_root.py` |
| 5 | MSVC C4100 (`[[maybe_unused]]`), C2607 static_assert (SFINAE detector + positive control), Windows long paths, full-history checkout, minimal-preset yaml-cpp message | 0832c958, 01f5e682, db3148cb | GCC 13/Clang 18 compile, 376 cca_core tests, mutation check |

ctest `memoryos.standard.*`: baseline main 11 failing, this branch 7, no new failures.

## In progress

Nothing. All work is committed and pushed.

## Needs a GitHub Actions run (not triggered; pushes to this branch do not run CI)

- Windows job: confirm the `core.longpaths` fix (cause of the checkout failure is likely, not confirmed),
  the C4100 fix and the static_assert rewrite on MSVC 19.44. A second C4100 elsewhere is possible.
- macOS job hung for hours in the last two runs on main (cancelled); cause not investigated.

## Still failing (outside the five items)

- `mo1304-phase3-windows`: hash-pinned Python validator uses POSIX path rules on Windows-recorded paths.
- `mo1303-phase3`: `yauzl` not installed for the VSIX check.
- `mo1304-phase2`: fails identically at baseline.
- `independent`, `runtime.reference`, `sdk.cpp.reference`: not investigated.
- `mo1305-phase3`: validator preconditions (HEAD is BF commit, branch main, tag absent, Codex-machine source
  commits) cannot hold in cloud/CI.
- clang-format job: `repositories/cca-studio/tests/memory_studio_test.cpp` on main.

## Exact next step

Open a pull request from `maint/pre-1.3-release` only when a CI run is approved (it will consume Actions
minutes), then read the Windows job log. If it still fails at checkout, fetch the log lines before
"Updating files" to find the unwritable path. Environment needed to reproduce locally: Node 24.21.0, unset
`NODE_OPTIONS`/`NODE_PATH`, full git history with tags, sibling `cca-specifications` checkout at
`../cca-specifications`.
