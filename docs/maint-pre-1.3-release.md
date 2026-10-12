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


## CI round 1 on PR #4 (run 73, head a4928a48) and the fixes pushed in response

| Job | Result | Cause | Action |
|-----|--------|-------|--------|
| Windows (windows-2022) | Build failed at ~5 min | The runner PATH carries MinGW; Ninja picked GCC 14.2 and linked vcpkg's MSVC-ABI gtest (`undefined reference to testing::Test::~Test()`). The C4100/C2607 fixes were therefore not yet exercised. | `ci.yml` imports the VS developer environment and sets `CC=cl CXX=cl` (53e38461) |
| clang-format | failed | 97 files had drifted from the repo style (not only `memory_studio_test.cpp`) | clang-format 18 applied (3ad441b0 + the harness commit); object code of all 59 standalone production TUs byte-identical; `client.cpp` differs only by include emission order (proved) |
| ASan/UBSan | 17 allocation-failure tests: `alloc-dealloc-mismatch (operator new vs free)` | Test-harness defect: the 12 `*_allocation_failure_test.cpp` files replace `operator new/delete` with `malloc/free` but not the nothrow forms that `std::stable_sort` (inside GoogleTest) uses. Not a product bug. | Nothrow overloads added, no failure injection (ffd1eb8c); all 12 binaries clean under ASan+UBSan locally |
| Ubuntu | 14 failing | `ERR_MODULE_NOT_FOUND` (no `npm ci` for memoryos-mcp / memoryos-vscode); missing sibling `cca-specifications`; runner Node is 22.23.3 while the suites pin 24.21.0 | Node 24.21.0 via the pinned setup-node, `npm ci --ignore-scripts`, sibling clone at bdf8fd46 (53e38461) |
| macOS | Test step ran 6 h until cancelled | A hung test whose orphaned Node child keeps ctest's pipes open (see product bug below) | `timeout-minutes` on all long jobs, `ctest --timeout 600` (53e38461) |
| Coverage | failed after 56 min | not yet read (same missing Node/deps/spec checkout and the same SDK hang are the expected causes) | covered by the same CI changes; re-check next round |

### STOP: real product bug found (not changed, per the rules)

`repositories/cca-sdk/src/core_process.cpp` (POSIX branch, ~lines 232-262) creates its stdin/stdout pipes with
plain `pipe()` (no `O_CLOEXEC`) and then `fork()` + `execl()`. When two `MemoryOS` instances start their Core
host on two threads (as `MemoryOsSdk.KeepsConcurrentInstancesDeterministicAndIsolated` does), each child
inherits the other instance's pipe ends. The Node host never sees EOF on stdin, the destructor's `waitpid`
blocks forever, and the test times out (1500 s on CI; ctest cannot reap it, which is what held macOS for 6 h).

Evidence: it reproduces locally with the CI toolchain's gtest: that test alone hangs in **19 of 40** runs
(20 s timeout), **12 of 40** when pinned to 2 CPUs; the other 20 SDK tests pass. It hangs in the Ubuntu job
(shows as `memoryos.standard.sdk.cpp.reference` timing out), in the sanitizer job
(`MemoryOsSdk.KeepsConcurrentInstances...` timeout) and on macOS.

The minimal production fix (not applied): create the pipes with `pipe2(..., O_CLOEXEC)` (Linux) / set
`FD_CLOEXEC` under a process-wide spawn mutex (macOS has no `pipe2`), keeping `dup2` for the child's
stdin/stdout (dup2 clears CLOEXEC on the targets). This needs your decision because it changes product code.
Until then Linux and macOS Build-and-test, the sanitizer job and Coverage cannot be green.

### Known remaining after round 1 (outside test/CI scope or pinned by frozen evidence)

- `memoryos.standard.mo1304-phase3-windows` and `cca.workspace.verify` ("MO-1304 independent platform/parity
  validation failed"): `tools/mo1304-windows/validate_windows.py` compares Windows-recorded paths with
  `pathlib.Path` (POSIX semantics on Linux/macOS). The file is hash-pinned by frozen evidence
  (mo1305-phase2d, mo1307) and its own harness manifest, so it is not edited. It should pass on the Windows job.
- `memoryos.standard.mo1305-phase3`: generation-time preconditions of the validator (HEAD is the BF commit,
  branch main, tag absent, Codex-machine source commits) cannot hold in CI.

### Next step

Read the CI run for the head after 53e38461 (Windows build/test result first; then any further C4100 under
`/WX`), fix what is test/CI-only, and wait for the owner's decision on the `core_process.cpp` fix.


## CI rounds 2-3 on PR #4 (runs 75-78) - findings and fixes

State at head 98f907a3 (previous heads: ab281cf2, 1f647734, 9bbfcbf6, 98926a61).

| Area | Finding | Action |
|------|---------|--------|
| Windows build | MSVC now selected; cca-core, cca-sdk, tests compile under `/W4 /WX`. Two further errors found and fixed: C4996 `getenv` in `cca-sdk/src/memoryos.cpp` (scoped `_CRT_SECURE_NO_WARNINGS` on `memoryos_sdk`, MSVC only) and C2607 on `increment_metric` (MSVC mis-evaluates access for a default-argument call in a dependent context; detector now passes all arguments, and a configure-time `try_compile` compile-fail check proves the one-argument call is rejected, with a positive control) | `98f907a3`.. see git log |
| Windows/macOS `memoryos.cli.unit`, MCP installed-tree | `MO1308_FILESYSTEM_BOUNDARY` / `MO1304_RUNTIME_INTEGRITY`: `os.tmpdir()` is not canonical on the runners (Windows 8.3 `RUNNER~1`, macOS `/var` -> `/private/var`) | `TEMP`/`TMP`/`TMPDIR` set to `RUNNER_TEMP` in CI |
| Windows vscode package validation | `Process not started`: `find_program(npm npm.cmd)` picked the extensionless shim | prefer `npm.cmd` |
| Ubuntu + ASan job killed ("runner received a shutdown signal") at `memoryos.standard.independent` | Not infrastructure: `canonicalArtifactBytes` used `assert.deepEqual` on two multi-MB Buffers; the suite mismatches them on purpose and Node's failure-message diff grew to >13 GB (pre-existing on main, masked until the sibling Standard checkout existed) | `Buffer.equals` + bounded message (`9bbfcbf6`); test 2.6 s / 207 MB |
| `cca.memory_reflection.architecture` | my clang-format reflow removed whitespace that the API-012-HPP text check matches | three declarations kept inside `clang-format off/on` (`1f647734`) |
| `mo1304-phase2` "bind their actual code" | REGRESSION I introduced in `6220f44a`: that evidence pins the bytes of every existing `memoryos-mcp/tests` and `scripts` file and the exact list of `*.test.mjs` | all pinned files restored (empty diff vs `84128231`); isolation moved into the new `scripts/run-isolated-tests.mjs` wrapper (copy -> assemble -> build .tgz -> run -> verify tracked measurements unchanged), used by `memoryos.mcp.foundation` (`98926a61`) |
| Windows allocation-failure tests (~100) | die silently right after `[ RUN ]` under MSVC (non-zero exit, no message). Hypotheses: `std::terminate` from the MSVC debug-iterator proxy allocation in a noexcept path, or a CRT heap mismatch with the replaced `operator new/delete` | CI now runs one directly on failure and prints the exit code; fix pending that result |

macOS completes without a hang now (no SDK failure there); its failures were the temp-directory class above plus the frozen-evidence tests.

### Still open

1. `core_process.cpp` pipe inheritance bug (Linux SDK hang) - needs the owner's decision; no production file has been changed.
2. Windows allocation-failure tests - waiting for the diagnostic.
3. Evidence-bound suites that cannot pass off the author's machine: `mo1304-phase2` (archive gzip bytes), `mo1304-phase3-windows` and `cca.workspace.verify` (validator uses POSIX path semantics; hash-pinned), `mo1305-phase3` (generation-time preconditions).


## CI rounds 4-5 on PR #4 (heads 795db6f0 .. ded237b8)

| Job | State | Notes |
|-----|-------|-------|
| clang-format | green | |
| AddressSanitizer + UBSan | 688/691, **0 sanitizer reports** | only the 3 evidence-bound suites fail; the SDK hang did not recur in this job |
| Ubuntu, macOS | 688/691 | evidence-bound suites + the SDK concurrent-instance hang (`MemoryOsSdk.KeepsConcurrentInstancesDeterministicAndIsolated` and `memoryos.standard.sdk.cpp.reference` time out): same POSIX `core_process.cpp` bug, **needs the owner's decision** |
| Windows | 689/692, deterministic | Debug -> RelWithDebInfo (MSVC checked iterators made every allocation-failure sweep `std::terminate`) fixed 111 of 112; `cli.unit`, MCP installed-tree, vscode package validation, `mo1304-phase3-windows` and `workspace.verify` pass after the canonical-temp and `npm.cmd` fixes |
| clang-tidy | transient | one run died on `curl 504` downloading vcpkg-glibc during bootstrap (comment posted on PR #4); passed on earlier heads |

### The one remaining Windows C++ failure
`MemoryProviderAllocationFailureTest.DescriptorWorkspaceFailureConstructionPreservesCompleteState`: SEH `0xC0000005`
in the test body on windows-2022 RelWithDebInfo (deterministic). Findings: it **passes under MSVC AddressSanitizer** with
no report (so no heap overflow/UAF), the product path (`registerProvider`, workspace-mismatch branch) is plain, the
sibling failure-construction tests pass. That is consistent with undefined behaviour that instrumentation masks or an
optimizer-dependent miscompile; the CI step on failure now builds the target with `/Od` to check optimizer dependence.
It has not been attributed to product code or to the harness; it needs a debugger session on Windows.

### Evidence-bound failures (cannot be fixed without editing frozen evidence or hash-pinned harness files)
- `mo1304-phase2`: compares the built `.tgz` identity with the recorded one (gzip bytes are not reproducible across zlib builds).
- `mo1305-phase3`: generation-time preconditions (HEAD is the BF commit, branch main, tag absent, Codex-machine source commits).
- `mo1304-phase3-windows`, `cca.workspace.verify`: POSIX-only failures; the validator uses POSIX `pathlib` semantics on Windows-recorded paths and verifies its own hash against the frozen harness manifest, so it cannot be patched. They pass on Windows.

### Exact next steps
1. Owner decision on `repositories/cca-sdk/src/core_process.cpp` (pipes created without `O_CLOEXEC`; fix: `pipe2(..., O_CLOEXEC)` on Linux, `FD_CLOEXEC` under a spawn mutex elsewhere). Until then Linux/macOS Build-and-test, Coverage cannot be green.
2. Read the `/Od` experiment on the next Windows run; if the crash disappears, it is optimizer-dependent: investigate that test body (and the harness) with a Windows debugger.
3. Re-run clang-tidy once if it fails on the vcpkg download again.


### CI infrastructure blips (not caused by this PR)
- clang-tidy, run 38246010004: `curl: (22) ... 504` downloading `vcpkg-glibc` in `Bootstrap dependencies` (comment posted on PR #4).
- Windows, run 38250034240: `Downloading vcpkg.exe ... Download failed, server returned an error` from GitHub releases in `Bootstrap dependencies (Windows)`, before any build, so the `/Od` optimizer experiment did not run. The run was superseded by the next push (a re-run is refused while any job of the run is still in progress).


### Windows access violation: not fixed by a test-side pragma (round 7)
Head 1a359541: with everything `/Od` the test passes (exit 0); under MSVC AddressSanitizer it passes with no report; at
default `/O2` it dies with `0xC0000005`. A `#pragma optimize("", off)` in the *test* translation unit (7d69f37e) did **not**
change the result, so it was reverted: the product library `cca_memory.lib` stays `/O2` in that experiment, which means the
optimizer-sensitive code may be **product code** (latent UB or an MSVC defect in `memory_provider.cpp` or what it inlines).
This is a possible product finding and is not being papered over. The CI diagnostic now keeps `/O2` and forces `/Od` on one
translation unit at a time (product file, then test file) to say which side owns it.
