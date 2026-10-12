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


### Windows access violation: status after round 9 (head 023eae65) - UNRESOLVED, no workaround in the tree
The `/Od` mitigations (a test-side pragma, then `/Od` on the test source via CMake, confirmed applied by the compiler's
D9025 notices) did **not** stop `MemoryProviderAllocationFailureTest.DescriptorWorkspaceFailureConstructionPreservesCompleteState`
from dying with `0xC0000005` in the real `ci` build, even though the same switch passed in the standalone bisect build
(default flags, `/WX` off, no preset). So the bisect results (all-`/Od`, product-file-`/Od`, test-file-`/Od` pass; MSVC ASan
clean) are not a reliable guide: the behaviour moves with unrelated build differences, which is typical of a latent
uninitialized/dangling access, not of a switch-controlled optimizer defect. Both mitigation commits were reverted (they
did not work) and the bisect diagnostic step was removed. Windows is therefore 690/692 + this test; it needs a debugger
session on a Windows machine (RelWithDebInfo, `cca_memory_provider_allocation_tests.exe`, WinDbg/VS "break on access violation").
The surrounding evidence does not point at product code, but it has not been ruled out either.


## Round 10 - owner decisions applied (head after 552bf2e9)

### 1. OWNER-APPROVED PRODUCT FIX (scope extension of this item) - for the v1.3.0 release notes
`repositories/cca-sdk/src/core_process.cpp`, POSIX path only: the Core transport pipes are now created close-on-exec
(`pipe2(..., O_CLOEXEC)` on Linux; `pipe` then `fcntl(F_SETFD, FD_CLOEXEC)` immediately after creation elsewhere). Nothing
else changed; the Windows path is untouched and the host's stdio still arrives through `dup2`, which clears the flag on the
duplicates.
- **Symptom:** a process forked by another thread between pipe creation and the host's exec inherited the parent's pipe ends,
  so the Core host never saw end-of-file on stdin and `~CoreProcess` blocked (`MemoryOsSdk.KeepsConcurrentInstancesDeterministicAndIsolated`,
  `memoryos.standard.sdk.cpp.reference` timed out on Linux/macOS).
- **Authority check (condition a):** `core_process.cpp` is in neither the MO-1308 candidate identity
  (`mo1308-phase3-candidate-identity.json`: 45 JS production paths under `cca-studio` and `memoryos-cli`, none under `cca-sdk/src`),
  nor the MO-1308 final/phase-3 inventories (no `cca-sdk` reference), nor any MO-1309 document. It is listed (by path, no hash)
  in the older MO-1301/MO-1302 inventories and `verify_workspace.py` `REQUIRED_PATHS`; the one content check on it
  (`mo1302_cross_platform_closure_conformance_test.mjs`, the `#include <Windows.h>` block) is unaffected.
- **Regression test:** `MemoryOsSdkTransport.DoesNotLeakPipeEndsIntoLaterSpawnedProcesses` (POSIX). It starts a transport,
  forks a bystander `sleep 20`, then destroys the transport. Before the fix: FAILED after 20.0 s (waited for the bystander).
  After: PASSED in 6 ms. (Measured standalone against the original and the fixed `core_process.cpp`.)
- **Known limit:** on non-Linux POSIX (macOS) there remains a microsecond window between `pipe()` and `fcntl()`; closing it
  needs a process-wide spawn lock, which was not part of the approved change.

### 2. Reference-host-only suites (hosted CI excludes them BY EXACT NAME)
| Test | Why it cannot pass on a hosted runner | Hosted CI |
|---|---|---|
| `memoryos.standard.mo1304-phase2` | pins bytes/history of the reference host's frozen setup (`verify_workspace.py` and memoryos-mcp bytes at the binding revision, tooling) | excluded on Linux, macOS, Windows, ASan, Coverage |
| `memoryos.standard.mo1304-phase3-windows` | Windows-toolchain parity evidence; fails off the reference host on POSIX | excluded on Linux, macOS, ASan, Coverage; **still runs (and passes) on the Windows runner** |

Both carry the CTest label `reference-host-only` (added in `repositories/cca-conformance/CMakeLists.txt`; no test body, input
or pin changed) and run unchanged on the reference host. The exclusion is the anchored regex in `CCA_CTEST_EXCLUDE`
(`^memoryos\.standard\.mo1304-phase2$`, or the two-name alternation on POSIX), passed with `ctest -E` / `scripts/coverage.sh -E`.
Not excluded and still red on Windows: `memoryos.standard.mo1305-phase3` (frozen evidence, Windows-only registration); it
was not on the owner's list and is reported rather than excluded.

### 3. `cca.workspace.verify` is NOT excluded - one sub-check is reported as not run on hosted POSIX runners
Before (hosted POSIX / this sandbox), the only failure printed by `verify_workspace.py` was
`error: MO-1304 independent platform/parity validation failed` (the verifier collects all errors; this was the sole one). Cause:
`validate_parity.py validate` re-runs the independent validation of the Windows-11 receipt
(`INDEPENDENT_VALIDATION_FAILED:windows-11`), which needs the reference host.
After, with `CCA_VERIFY_WORKSPACE_NOT_RUN=MO1304_WINDOWS_TOOLCHAIN_PARITY` (set by the CTest property when
`CCA_WORKSPACE_VERIFY_NOT_RUN_MO1304_PARITY` is ON / the env var is `1`, which CI sets on Linux, macOS, ASan and Coverage only):
```
NOT_RUN_ON_HOSTED_RUNNER: MO-1304 independent platform/parity validation (Windows-toolchain parity; enforced on the reference host)
CCA workspace verification passed: <root>
```
Only that subprocess is skipped. The three receipt identity checks (path, byte length, sha256) in the same block, and every
other check, still run: a one-byte change to `mo1304-phase3-parity.json` still fails with `MO-1304 evidence identity mismatch`
with the flag set. Any other flag value, and the default, run the sub-check as before. The change is inside
`validate_mo1304_registration` (no argparse/`main` change), so the byte-comparison in the phase-2 suite
(everything outside that function and `validate_conformance_artifacts` unchanged) still holds. The windows runner does not set
the flag and enforces the sub-check.

### 4. Windows access violation: deferred (owner decision)
Open. `MemoryProviderAllocationFailureTest.DescriptorWorkspaceFailureConstructionPreservesCompleteState`,
`0xC0000005` in the `ci` RelWithDebInfo build on windows-2022; no crash location available from the hosted log (no
debugger/dump). Passes under MSVC ASan and in a standalone `/Od` bisect build. To be debugged on the reference host after
MO-1309 is tagged. Everything else on the Windows job passes except `mo1304-phase2` (now excluded) and `mo1305-phase3`.

### Round 10 addenda (owner decisions, second message)
- **`memoryos.standard.mo1305-phase3` is now also reference-host-only** (label `reference-host-only`; excluded by anchored exact name
  on every hosted runner where it is registered, which is Windows only: CMake skips it on POSIX). It fails on hosted Windows
  because it pins the reference host's frozen evidence/setup. Test body, inputs and pins are unchanged and it runs unchanged on
  the reference host. Hosted exclusions are now: Linux/macOS/ASan/Coverage = `mo1304-phase2`, `mo1304-phase3-windows`;
  Windows = `mo1304-phase2`, `mo1305-phase3` (`mo1304-phase3-windows` still runs and passes there).
- **FOR THE v1.3.0 RELEASE NOTES - accepted disclosure:** on non-Linux POSIX (macOS) the Core transport pipes are made
  close-on-exec with `pipe()` followed immediately by `fcntl(FD_CLOEXEC)`. A microsecond window between the two calls remains
  in which a process forked by another thread could still inherit a pipe end. Owner decision: accepted, no process-wide spawn
  lock. Linux uses `pipe2(O_CLOEXEC)` and has no window.
- **Superseded notes:** every earlier "unresolved", "STOP: real product bug", "Known remaining", "Still failing" and
  "evidence-bound failures" statement above this line (rounds 1-9) is superseded by round 10: the fd-inheritance bug is fixed
  (owner-approved), the frozen-evidence suites are reference-host-only/not-run as listed, and the only open item is the deferred
  Windows access violation. Those sections are kept unedited as history.
- **Coverage report step (round 10):** with the tests now passing, `cca_coverage` failed in gcovr 8.3 with
  `Unknown directory '.../coverage.xml'`: `--xml-pretty` is a flag and took the path as a search directory. The target now uses
  `--cobertura-pretty --cobertura <file>` (`cmake/CCACoverage.cmake`; tooling only, parsing checked with gcovr 8.3 locally).
  The `--fail-under-line 90` gate is unchanged.
- **Coverage, gcov negative hits:** the next failure was gcovr aborting on `branch 2 taken -1` (GCC bug 68080, multithreaded
  counters). `cmake/CCACoverage.cmake` now passes gcovr's documented `--gcov-ignore-parse-errors negative_hits.warn_once_per_file`
  (warns once per file; affects branch counters only). The `--fail-under-line 90` line gate is unchanged.
- **Windows regression introduced and reverted in round 10 (head 7a9f70f2):** running `ctest` under `shell: bash` on Windows
  (added for the `-E` exclusion) made `memoryos.cli.unit`, `memoryos.standard.coverage-gap` and `memoryos.standard.specification`
  fail there (they pass on Linux locally and passed on Windows before). Working theory: Git Bash puts MSYS tools ahead of the
  native `git`/`tar` on `PATH` and these tests shell out to git. Windows now uses pwsh (`-E $env:CCA_CTEST_EXCLUDE`) as before;
  the theory is confirmed only if those three pass in the next Windows run.
