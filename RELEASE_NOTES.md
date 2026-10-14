# MemoryOS v1.3.1 Release Notes

## Release status

**Released as v1.3.1** (a Studio-only addition to MemoryOS 1.3; the v1.3.0 notes follow unchanged).

| Identity | Value |
|---|---|
| Semantic version | 1.3.1 |
| Release tag | v1.3.1, annotated, peels to BF `2781d93ff79f60a9f10614fcb793d3ea45c464fa` |
| Baseline | v1.3.0 (`889f99e72a5d41c242572cc052ab97b07cc10a24`) |
| Product commit | `c0c06c1b08bd68dd120d20210ba744ba3e83bb5a`; candidate `275f84f5`; I3 `267edcf1` |
| Certification host | Windows 11 x64, Node v24.21.0, Edge 155.0.4283.45 |

## What is new

Studio's **History** screen opens a history export folder chosen by the user (`showDirectoryPicker` in read mode, or the directory input),
reads each file once, verifies the export with the released MO-1308 verifier and shows the MO-1309 dashboard inside Studio. It is read-only and
stores nothing. "No network" means no endpoint, no upload and no request that carries export data; Studio loads its own static files.

## Certification record

- Campaign SH `gen-1`: 17 of 17 cases pass (`SH ACCEPTED`).
- Retained regression, each suite once: studio 358/358 plus 22/22 and 9/9 for History, cli 91/91, MO-1309 suites all passing, MO-1307 strict 639/639.
- Differential gate against v1.3.0 (Node subset; C++ CTest skipped on the SH-C1 proof that no C, C++, CMake or vcpkg path changed): 0 regressions, 0 new failures.
- Validator: `CERTIFIED_READY_TO_TAG`. Disclosures: [mo1310-release-disclosures.md](docs/mo1310-release-disclosures.md).

Qualifications and known baseline failures are in [KNOWN_ISSUES.md](KNOWN_ISSUES.md). No MO-1308 production byte, C or C++ file, dependency or lockfile changed; the standalone MO-1309 generator's output is byte-identical to v1.3.0.

---

# MemoryOS v1.3.0 Release Notes

## Release status

**Released as v1.3.0**

| Identity | Value |
|---|---|
| Product release | MemoryOS 1.3 |
| Semantic version | 1.3.0 |
| Release tag | v1.3.0 |
| Milestones | MO-1301 to MO-1309, each at its own annotated tag |
| Standard | CCA-MEMORYOS-1.0 remains the published Standard ([README](README.md), [CHANGELOG](CHANGELOG.md) MO-1301) |

Every statement below cites the recorded document it comes from. Limits and
qualifications are listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md); read it before
relying on a milestone's certification. This release is documentation only on
top of the recorded milestone and maintenance commits: the release commit adds
no code, test or evidence.

## Milestone tags

Each tag is an annotated tag object that peels to the commit shown, and each
commit is an ancestor of the v1.3.0 release commit.

| Milestone | Tag | Tag object | Peels to |
|---|---|---|---|
| MO-1301 Investigation Policies | `memoryos-1.3-mo1301` | `2cda15d8ab056ac8f2971c5cd9a22cb89fc4821e` | `af6a405b3cd9097ce469b16a854a0568b8acee1f` |
| MO-1302 GitHub Actions and Deterministic CI Policy Gates | `memoryos-1.3-mo1302` | `773dd03829dd6b3632bf43a45578925b1498515d` | `7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d` |
| MO-1303 VS Code Extension | `memoryos-1.3-mo1303` | `f3891cbac8a6ab804887a3d95a595c7bd1523af9` | `49aa80fa76bffc03e36335be8ab805bb5dc38f9c` |
| MO-1304 MCP Server and Agent Integration | `memoryos-1.3-mo1304` | `6d877151f0857006fcf12958f8b4c5bc662f43d6` | `ce7b001d911239fa50d904f5f336bb1bd7858ba3` |
| MO-1305 REST Gateway | `memoryos-1.3-mo1305` | `741e596454cfbcc908b8bd576b4fa97311139083` | `5955af062152a84c10de17860ba0bcabe8b3555f` |
| MO-1306 Provider-Neutral CI/CD Integration | `memoryos-1.3-mo1306` | `9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8` | `332ab0d2c35643ea8d155bcbea9c5019b304bbe3` |
| MO-1307 Release Governance and Readiness | `memoryos-1.3-mo1307` | `a3042f3bded41ec71deff8dac71691e9a595460b` | `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` |
| MO-1308 Investigation History | `memoryos-1.3-mo1308` | `3ddb8243dcb9dcf023aa7df45552f71b86ccca20` | `bf2fdc87e9b2bfc25588ef61deacac6c04684376` |
| MO-1309 Cloud Dashboard | `memoryos-1.3-mo1309` | `3cf8a61f1a3ee1e6c23291c356a9316195f2de20` | `97d84a1e84d8896d7d883810287c0fb063d6c376` |

Sources for the tag objects and commits: the tag objects verified in the
repository for this release, and the commits recorded in
[CHANGELOG.md](CHANGELOG.md) (MO-1302 to MO-1308),
[ROADMAP.md](ROADMAP.md), the tag tables in
[MO-1304](docs/mo1304-mcp-server-agent-integration.md) and
[MO-1305](docs/mo1305-rest-gateway.md), and the
[MO-1309 handoff](docs/mo1309-phase4-handoff.md).

## What each milestone delivered

### MO-1301 — Investigation Policies

Deterministic engineering-policy subsystem over the corrected v1.2.1
baseline: closed Policy and Policy Set artifacts, atomic Core-owned
PolicyFactContext capture, trusted Cognitive Regression provenance, six
registered rules, exact evidence, deterministic PASS/FAIL/COULD_NOT_EVALUATE
aggregation, a measured 31-limit Resource Profile, Evaluation Identity,
canonical outcomes, exact-byte caching, SDK/CLI 1.1 integration and an
additive MemoryOS 1.3 conformance inventory. Source: [CHANGELOG](CHANGELOG.md)
MO-1301; specification: [Investigation Policies](docs/investigation-policies.md).

### MO-1302 — GitHub Actions and Deterministic CI Policy Gates

GitHub-specific CI integration over the MO-1301 Policy authority. Source:
[CHANGELOG](CHANGELOG.md) MO-1302; contract:
[GitHub Policy Gate](repositories/cca-conformance/docs/mo1302-github-policy-gate.md).

### MO-1303 — VS Code Extension

Released under an explicit external-infrastructure exception: Ubuntu and
Windows hosted certification PASS; macOS hosted certification and
three-platform parity NOT EXECUTED because of an external GitHub
runner-allocation and billing restriction. Source: [CHANGELOG](CHANGELOG.md)
MO-1303.

### MO-1304 — MCP Server and Agent Integration

Certified for Windows 11 x64 and Ubuntu 24.04 LTS x64 with two-platform
parity PASS; macOS remains unsupported for MO-1304. Source:
[CHANGELOG](CHANGELOG.md) MO-1304;
[Windows certification and parity record](repositories/cca-conformance/docs/mo1304-phase3-windows-certification.md).

### MO-1305 — REST Gateway

A bounded HTTP/API surface with six SDK-backed semantic operations and three
operational endpoints under `/v1`, native TLS over HTTP/1.1, bearer
authentication, explicit remote mode, bounded execution and a
dependency-free Node adapter. Installed-package certification ran on the
existing physical Windows 11 x64 host only. Source: [CHANGELOG](CHANGELOG.md)
MO-1305; [Phase 3D release record](docs/mo1305-phase3d-release.md).

### MO-1306 — Provider-Neutral CI/CD Integration

One SDK-backed provider-neutral core with a native Windows generic runner and
deterministic GitLab, Jenkins, Azure and GitHub provider files. The generic
runner is REAL_EXECUTION_CERTIFIED; the GitHub integration is IMPLEMENTED,
OFFLINE_VALIDATED and NOT_CERTIFIED hosted. Released with qualified
certification. Source: [CHANGELOG](CHANGELOG.md) MO-1306;
[hosted scope correction](docs/mo1306-hosted-certification-scope-correction.md);
[qualified release record](docs/mo1306-phase3d-qualified-release.md).

### MO-1307 — Release Governance and Readiness

Deterministic, evidence-backed readiness assessment of an exact candidate;
final release authorization remains human. The read-only validator reported
`CERTIFIED_READY_TO_TAG`; 632 of 639 conformance tests passed and 7 were
disclosed stale-baseline tests, and the test-only V2 correction is bound
afterwards (639/639 on the reference Windows host under Node v24.21.0).
Source: [CHANGELOG](CHANGELOG.md) MO-1307;
[Phase 3D certification](docs/mo1307-phase3d-certification.md);
[V2 correction](docs/mo1307-v2-stale-test-correction.md).

### MO-1308 — Investigation History

A local, file-based, append-only, hash-chained ledger of records that
existing authorities produce, with deterministic query and the
`MemoryOSHistoryExport` bundle, through the JavaScript SDK and the
`memoryos history` CLI namespace. Contract Freeze 1 closed all 55 decisions;
certifying generations `phase3a` 108/108, `phase3b` 26/26, `phase3c` 67/67,
and `phase3d` accepted by the read-only validator at BF. The claim is local
single-user v1 on native Windows 11 x64. Source: [CHANGELOG](CHANGELOG.md)
MO-1308; [Contract Freeze 1](docs/mo1308-contract-freeze-1.md);
[release disclosures](docs/mo1308-release-disclosures.md).

### MO-1309 — Cloud Dashboard

A static, offline, cloud-ready, strictly read-only dashboard over a verified
MO-1308 history export, generated as one self-contained HTML file. "Cloud"
means an operator can host the generated output anywhere; MemoryOS ships no
hosting, server, accounts, tenancy, billing or network access. The final
record (I3 `85f72601`) and binding-only BF `97d84a1e` were validated
`CERTIFIED_READY_TO_TAG` (tag message of `memoryos-1.3-mo1309`) with
campaigns 4A, 4B and 4C accepted. The certified scale is 10,000 entries.
Source: [authority](docs/mo1309-cloud-dashboard.md);
[Contract Freeze 1](docs/mo1309-contract-freeze-1.md);
[Phase 4 handoff](docs/mo1309-phase4-handoff.md);
[release disclosures](docs/mo1309-release-disclosures.md).

## Compatibility

- **SDK and CLI 1.2.0.** MO-1308 moves the JavaScript SDK and the CLI from
  1.1.0 to 1.2.0, additively and outside the CCA-MEMORYOS-1.0 baseline
  claim, as MO-1301 did for 1.1.0; the live version pins are 1.2.0
  ([Contract Freeze 1](docs/mo1308-contract-freeze-1.md) requirement R34 and
  §13.1). `repositories/memoryos-cli/package.json` declares 1.2.0.
- **Released bundles are unchanged.** Requirement R32 of MO-1308 states that
  released packages, vendored closures and tags are byte-identical.
  Amendment A1 pins the vendored MO-1302 Action files to their bytes at tag
  `memoryos-1.3-mo1302` rather than to moving source, and amendment A9.1
  extends A1 to every released bundle: vendored copies inside a released
  package stay byte-identical to their released bytes and are not refreshed
  ([Contract Freeze 1](docs/mo1308-contract-freeze-1.md) §24 and A9.1; the
  vendored MCP and VS Code runtimes are pinned to `memoryos-1.3-mo1304` and
  `memoryos-1.3-mo1303`).
- **Standard.** CCA-MEMORYOS-1.0 remains the published Standard. MO-1309
  creates no Standard requirement and needs no CCA-MEMORYOS-1.1
  ([MO-1309 authority](docs/mo1309-cloud-dashboard.md) §1.1, decision M11).
- **Baseline.** MemoryOS 1.3 is additive over the corrected v1.2.1 baseline
  ([CHANGELOG](CHANGELOG.md) MO-1301).

## Pre-release maintenance (PR #4, `maint/pre-1.3-release`)

Merged into `main` as `dd058bfc` (PR #4, head `6f07d40a`). All items are from
[docs/maint-pre-1.3-release.md](docs/maint-pre-1.3-release.md).

### Owner-approved product fix: `core_process.cpp` fd inheritance

`repositories/cca-sdk/src/core_process.cpp`, POSIX path only: the Core
transport pipes are now created close-on-exec (`pipe2(..., O_CLOEXEC)` on
Linux; `pipe()` then `fcntl(F_SETFD, FD_CLOEXEC)` immediately after creation
elsewhere). Before the fix, a process forked by another thread between pipe
creation and the host's exec inherited the parent's pipe ends, so the Core
host never saw end-of-file on stdin and `~CoreProcess` blocked
(`MemoryOsSdk.KeepsConcurrentInstancesDeterministicAndIsolated` and
`memoryos.standard.sdk.cpp.reference` timed out on Linux and macOS). The
Windows path is untouched. A regression test,
`MemoryOsSdkTransport.DoesNotLeakPipeEndsIntoLaterSpawnedProcesses`
(POSIX), failed after 20.0 s before the fix and passed in 6 ms after it
(standalone measurement). Accepted limit: on macOS there remains a
microsecond window between `pipe()` and `fcntl()`; see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### Test and CI fixes (no product semantics changed)

Per the maintenance record, cca-core and cca-sdk object code was
byte-identical for the initial items, the MCP shipped surface was untouched,
and the later changes are test, tooling or CI changes:

- MCP suite: no tracked measurement rewrite; the closure is assembled by
  `scripts/run-isolated-tests.mjs` and `scripts/prepare-tests.mjs`.
- 1.2.1 manifest pins authenticated against release commit `2c3a5491`
  (`v1.2.1`); MO-1304 tag asserted present; MO-1305 workspace gate derived
  from `git rev-parse --show-toplevel`.
- MSVC fixes (C4100, C2607 with a configure-time compile-fail check, C4996 in
  `cca-sdk/src/memoryos.cpp` scoped to MSVC), Windows long paths, MSVC
  selected in CI, Windows RelWithDebInfo for the allocation-failure suites,
  canonical temp directories, `npm.cmd` preference.
- clang-format 18 applied (object code of the 59 standalone production TUs
  byte-identical); the 12 `*_allocation_failure_test.cpp` harness files gained
  the nothrow `operator new/delete` forms (test-harness defect, not a product
  bug).
- A Node test comparing multi-MB buffers used `assert.deepEqual` and could
  allocate >13 GB in its failure diff; it now uses `Buffer.equals`.
- CI: pinned Node 24.21.0, `npm ci --ignore-scripts`, sibling `cca-specifications`
  clone, job timeouts and `ctest --timeout 600`.
- Coverage tooling: the report step uses `--cobertura-pretty --cobertura <file>`
  with gcovr 8.3, and passes `--gcov-ignore-parse-errors negative_hits.warn_once_per_file`
  for GCC bug 68080. The `--fail-under-line 90` gate is unchanged. **Coverage
  meets the 90 % line gate**: the Coverage job passed on head `dfbaf864`
  (run 38282490143) with no file excluded.
- Reference-host-only suites are excluded by exact name on hosted runners and
  `cca.workspace.verify` reports a `NOT_RUN_ON_HOSTED_RUNNER` sub-check; see
  [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### Windows access violation

`MemoryProviderAllocationFailureTest.DescriptorWorkspaceFailureConstructionPreservesCompleteState`
dies with `0xC0000005` on windows-2022. It is not fixed and not excluded and is
**deferred to post-1.3.0** by owner decision; see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Documentation

- [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
- [CHANGELOG.md](CHANGELOG.md)
- [ROADMAP.md](ROADMAP.md)
- [MemoryOS Standard repository](https://github.com/moelsaka01/memoryos-specification)
- Previous release notes: the v1.2.1 notes are preserved at the `v1.2.1` tag.
