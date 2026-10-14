# MemoryOS v1.3.1 Known Issues

Items added for 1.3.1 (source: [mo1310-release-disclosures.md](docs/mo1310-release-disclosures.md)); the v1.3.0 list follows unchanged.

- **Q-SAB-STANDIN.** The released MO-1308 modules reference `SharedArrayBuffer` without a `typeof` guard, so the verifier throws in a page that is not cross-origin isolated. Studio supplies a scoped stand-in for the one synchronous verification call. Maintenance follow-up: guard the MO-1308 modules (MO-1308 SharedArrayBuffer guard), with a byte-identical-behaviour proof.
- **Q-STATIC-FILES.** "No network" is defined as no endpoint, no upload and no request carrying export data; Studio loads its own static files from its origin.
- **Q-FOLDER-ACCESS.** Directory-handle access exists only in Chromium-family browsers in a secure context; elsewhere use the directory input. The browser mediates the dialog and permission.
- **Q-NATIVE-PICKER.** The native folder dialog is not automated; one operator observation in Edge on the reference host reported it worked as expected (no prompt wording was recorded).
- **Q-MO1308-TREE-AUDITS (owner decision OD-1).** Seven mo1308 tests (A01, A02, B01, B02, N07, S03, D03) audit the whole tree against the MO-1308 binding and fail by design on any commit after `memoryos-1.3-mo1308`, including v1.3.0; they are pinned by exact name, with the same seven failing at v1.3.0 on the reference host.
- **Q-MO1309-BASELINE-BOUND.** Two MO-1309 tooling tests fail identically at v1.3.0; their counts are pinned.
- **Q-GATE-NODE.** The differential verdict name `PASS_QUALIFIED_CLOUD_SUBSET` is fixed by the tool; the C++ CTest run was skipped on the SH-C1 proof; 14 pre-existing unit failures are identical at v1.3.0.
- **Q-TOOLING.** The certification tooling and manifest changed after the campaign and regression runs (owner decision OD-1); the product bytes are those of `c0c06c1b`.

---

# MemoryOS v1.3.0 Known Issues

This file lists the limits, qualifications and open items recorded for
MemoryOS 1.3.0. Every item cites the document it comes from. Nothing here is a
new finding; items are carried from the recorded disclosures. Release context:
[RELEASE_NOTES.md](RELEASE_NOTES.md).

## Scope of the MO-1308 claim (H40, A6)

**Local single-user v1 only.** The MO-1308 history ledger is claimed for a
local single-user v1 on native Windows 11 x64 with the pinned Node. It is
integrity-checked, not authenticated, not encrypted and not signed. It is not
claimed for multi-user, shared-storage or cloud use; those require a
re-review before any such claim (MO-1309 inherits this, see below).

- **H40.** The store is Node-only; a directory swap is detected after the
  fact, never prevented. Residual swap windows between a check and the
  filesystem call are the accepted H40 class.
  Source: [MO-1308 disclosures](docs/mo1308-release-disclosures.md) (Q01 and
  "Other recorded limits"); [CHANGELOG](CHANGELOG.md) MO-1308.
- **A6 (rollback anchor).** Truncating the tail, or restoring an older valid
  prefix, produces a ledger that still verifies; only an externally recorded
  `headDigest` exposes it. Operators should record the `headDigest` of every
  export outside the ledger and verify it externally (case 3C-A6: CONFIRMED).
  Source: [MO-1308 disclosures](docs/mo1308-release-disclosures.md).

## MO-1308 qualification outcomes (Q01 to Q15)

Source for all rows: [MO-1308 release disclosures](docs/mo1308-release-disclosures.md).
Outcomes are those recorded in the accepted generations `phase3a` (108/108),
`phase3b` (26/26) and `phase3c` (67/67).

| ID | Recorded outcome |
|---|---|
| Q01 | DISCLOSED: Node-only store; directory swap detected after the fact, never prevented (H40). Local single-user v1 only; re-review before any multi-user, shared-storage or cloud use. |
| Q02 | A failed exclusive create of a staging file is a typed IO failure and is never retried; the transient-lock and delete-pending hypotheses are not both resolved. Case 3A-E6 CONFIRMED (EPERM-versus-EEXIST behaviour); case 3A-F7 NOT_CONFIRMED (no staging EPERM in more than 1 of 10 runs with A10 staging names). |
| Q03 | Tail truncation and rollback to an older valid prefix cannot be detected without an external head anchor (3C-A6). |
| Q04 | 3C-E6 CONFIRMED: a staging remnant left by an interrupted append can survive a purge. |
| Q05 | 3C-E7 CONFIRMED: after a purge the entry keeps its recordDigest, member names, lengths, digests and subjects. |
| Q06 | 3C-E9 CONFIRMED: the tombstone authority reference is operator-chosen free text and is permanent. |
| Q07 | 3C-E8 CONFIRMED: an export taken before a tombstone keeps the bytes; there is no import and no recall. |
| Q08 | 3C-B5 CONFIRMED: an entry whose admission fields are forged, or whose bytes would fail admission, still verifies when the chain and member digests are consistent. |
| Q09 | DISCLOSED: the incremental SHA-256 and the canonical module copy are first-party code, verified by FIPS 180-4 example messages, the CAVP Monte Carlo procedure computed against `node:crypto`, differential tests and a recorded independent review; official CAVP response files were not used. |
| Q10 | Host latency under antivirus and indexers is heavy-tailed; an environment qualification, not a bound. |
| Q11 | 3A-JC6 CONFIRMED: exporting 100,000 entries completes with the marker written last and takes on the order of 16 minutes on the reference host; a performance follow-up, not a defect. |
| Q12 | 3C-C10 CONFIRMED: policy-evaluation admission is inspection-only and readiness-result admission is not a MO-1307 verification. |
| Q13 | 3C-B3 CONFIRMED: a fully self-consistent forged chain verifies; integrity only, access control is the operator's filesystem responsibility (H07, H08). |
| Q14 | DISCLOSED: the certification claims native Windows 11 x64 only (H45). |
| Q15 | DISCLOSED: UNC, network, OneDrive and cloud-placeholder locations are observed, not claimed. |

Also recorded in the same document: harness reviews have no open blocking
finding; accepted non-blocking items include that 3A-G6 races only the first
part of its swap schedule and that the 3B transitive-import check records but
does not assert that the history authority reaches the Core through
`investigation-policy-engine.js`. Rehearsals (3A r2-r11, 3B r1-r2, 3C r1-r5,
3D r1-r2) are preserved and never accepted inputs.

## Sha256Stream input validation (MO-1308)

`Sha256Stream.update` does not validate its argument. This is a non-blocking,
latent item from the independent SHA-256 review, recorded
`ACCEPTED_WITH_DISCLOSURE` with no production change.
Source: [MO-1308 Phase 3C security record](docs/mo1308-phase3c-security.md)
(case 3C-D9).

## MO-1309 disclosures

Source for this section: [MO-1309 release disclosures](docs/mo1309-release-disclosures.md),
candidate `74be815b`. MO-1309 is a read-only static presentation of one verified
MO-1308 export; it is an integrity view as of generation, not evidence of
authenticity, completeness, currency or approval.

- **Q-STORE-INTEGRITY.** Verification is integrity only: a forged
  self-consistent chain verifies; truncation and rollback are detectable only
  through an externally recorded `headDigest`. The history is not encrypted, so
  a hosted snapshot discloses entry metadata (identifiers, subjects, digests,
  tombstone reasons, authority references) to anyone who can read it; access
  control is the operator's. The MO-1308 claim (local single-user v1, native
  Windows 11 x64, H40 re-review) is unchanged.
- **Q-SCALE.** The certified scale is **10,000 entries**. Worst of five runs
  on the reference host (budget in brackets): read 7.3 s (30 s), verify-only
  7.8 s (30 s), view-model build 8.5 s (30 s), generation wall 25.9 s (60 s),
  generator RSS 467 MB (1,100 MB), snapshot 8.9 MB (11 MB).
- **Q-PERF-100K.** **100,000 entries are characterized only**, with no pass,
  fail or support claim. One run: generation wall 363 s (about 6 minutes),
  generator RSS 2,127 MB, snapshot 88.8 MB, page heap 98.9 MB.
- **Q-HOST.** Performance numbers come from a non-idle laptop (CPU about
  20–57 % before runs; Defender real-time monitoring on); the budgets were
  derived from a cloud host. The browser was Edge 155.0.4283.45, not Chrome.
- **Q-TOOLING.** Certifying campaigns 4A, 4B and 4C ran with tooling of
  commits `68eed767` and `f8bcf30f`; later test/tooling fixes touch no product
  byte; `mo1309-tools` was rerun at the candidate (32/32).
- **Q-GATE-NODE.** The Node differential gate is `PASS_QUALIFIED_CLOUD_SUBSET`:
  `tools/verify_workspace.py` exits 2 on both BF and the candidate when run
  directly in a fresh worktree, so that rule is established by the CTest test
  `cca.workspace.verify`, which passes on both. 0 regressions, 0 new failures,
  15 shared failures identical at BF
  ([classification](docs/mo1309-differential-classification.md)).
- **Q-GATE-LONG-UNITS.** `mo1308_phase3b_test.mjs` and `mo1308_phase3d_test.mjs`
  exceeded the gate's 900 s per-unit limit on BF and the candidate. Without
  the limit, `mo1308_phase3b` is identical on both sides (17 of 21 pass; the
  same four tests fail: A01, B02, N07, S03). `mo1308_phase3d_test` **hangs on
  a clean BF checkout** (no output for 30 minutes, idle child `git.exe`) and
  was stopped by hand and not run on the candidate. The owner accepted both as
  unchanged; they were not retried.
- **Q-CTEST.** The CTest differential is `PASS`: 317 registered, 2 excluded
  (`cca_core_tests_NOT_BUILT`, the A3.1 MSVC C2607 waiver, and
  `memoryos.sdk.cpp.regression.example`, blocked by Smart App Control, A3.3),
  315 executed per side: 192 passed on both, 123 failed on both identically.
  `cca_core_tests` does not compile with this MSVC and was not run. Native C++
  verification belongs on a host without Smart App Control.
- **Q-SHARED-FAILURES.** The 123 shared failures are the same set as in the
  MO-1308 A3.2 record: 112 `*AllocationFailureTest` aborts, MCP integrity and
  artifact failures, a hard-coded workspace path, the stale 1.2.1 pin, the
  missing Standard publication, and `memoryos.standard.runtime.reference`
  Not Run because of the waiver.
- **Open follow-ups recorded by MO-1309:** `tools/verify_workspace.py` exiting 2
  in a fresh worktree on BF and candidate; the shared failures; Windows CI
  green with native C++ tests on a host without Smart App Control.

## MemoryOS 1.3.1 (Studio History screen; pending certification)

Not part of v1.3.0. Source: [MemoryOS 1.3.1 Freeze](docs/mo1310-studio-history-1.3.1.md) and
[Windows plan](docs/release-1.3.1-windows-plan.md). These items are recorded at build time and will be restated in the 1.3.1 disclosures.

- **MO-1308 verifier and browsers (Q-SAB-STANDIN).** The released MO-1308 modules reference `SharedArrayBuffer` without a `typeof` guard, so
  the verifier throws in a page that is not cross-origin isolated. Studio compensates with a scoped stand-in during the single verification
  call; no MO-1308 byte changes. A guard in the MO-1308 modules is a candidate for a later maintenance item.
- **Folder access.** The File System Access directory handle exists in Chromium-family browsers only; other browsers use the read-only directory
  input. The browser mediates permission; Studio cannot read a folder the user did not choose and keeps no handle.
- **Static files.** "No network" for the History screen means no endpoint, no upload and no request carrying export data; Studio loads its own
  static files, and the optional snapshot download fetches three of them on click.
- **MO-1309 tooling tests tied to the MO-1308 BF.** Two tests audit the whole tree against `bf2fdc87` and fail identically at v1.3.0; the 1.3.1
  regression pins their counts.

## Export performance on the reference host

Exporting 100,000 entries with the MO-1308 CLI takes about 16 minutes
(MO-1308 Q11, case 3A-JC6) and remains a separate maintenance item (DB32).
Sources: [MO-1308 disclosures](docs/mo1308-release-disclosures.md);
[MO-1309 disclosures](docs/mo1309-release-disclosures.md) (Q-PERF-100K).

## Smart App Control on the reference host

Smart App Control is enforcing on the Windows 11 reference host and was left
untouched. It blocks a build-dependent set of freshly built unsigned
executables (amendment A3.3), which is why
`memoryos.sdk.cpp.regression.example` is excluded from the MO-1309 CTest
differential and why native C++ verification belongs on a host without Smart
App Control. Sources: [MO-1308 Contract Freeze 1](docs/mo1308-contract-freeze-1.md)
§33 (A3.3); [MO-1309 disclosures](docs/mo1309-release-disclosures.md) (Q-CTEST);
[MO-1309 Phase 4 handoff](docs/mo1309-phase4-handoff.md).

## Pre-release maintenance disclosures

Source for this section: [docs/maint-pre-1.3-release.md](docs/maint-pre-1.3-release.md).

### macOS pipe()/fcntl() window

The `core_process.cpp` fd-inheritance fix makes the Core transport pipes
close-on-exec. Linux uses `pipe2(O_CLOEXEC)` and has no window. On non-Linux
POSIX (macOS) the pipes are created with `pipe()` and made close-on-exec by
`fcntl(FD_CLOEXEC)` immediately afterwards; a microsecond window between the
two calls remains in which a process forked by another thread could still
inherit a pipe end. Owner decision: accepted, no process-wide spawn lock.

### Reference-host-only suites and the NOT_RUN_ON_HOSTED_RUNNER sub-check

Hosted CI excludes the following suites by exact name; they carry the CTest
label `reference-host-only`, their bodies, inputs and pins are unchanged, and
they run unchanged on the reference host:

| Test | Excluded on hosted |
|---|---|
| `memoryos.standard.mo1304-phase2` | Linux, macOS, Windows, ASan, Coverage |
| `memoryos.standard.mo1304-phase3-windows` | Linux, macOS, ASan, Coverage (still runs and passes on the Windows runner) |
| `memoryos.standard.mo1305-phase3` | every hosted runner where it is registered (Windows only) |

`cca.workspace.verify` is **not** excluded. On hosted POSIX runners (Linux,
macOS, ASan, Coverage) one sub-check, the independent MO-1304
platform/parity validation of the Windows-11 receipt, is skipped and reported
as `NOT_RUN_ON_HOSTED_RUNNER`; it is enforced on the reference host and on the
Windows runner. The three receipt identity checks and every other check
still run.

### Windows access violation (open, deferred to post-1.3.0)

`MemoryProviderAllocationFailureTest.DescriptorWorkspaceFailureConstructionPreservesCompleteState`
dies with `0xC0000005` on windows-2022 (`ci` preset, RelWithDebInfo, MSVC
14.44); it was the only failing test (689/690) at head `58a7a807`.
Deterministic; passes under MSVC AddressSanitizer and in a standalone `/Od`
bisect build; no crash location is available from the hosted log. It is likely
latent undefined behaviour in the test or the code it exercises
(`memory_provider`); a product defect is **not ruled out**. Status: not fixed,
not excluded; to be debugged with a Windows debugger after 1.3.0 (owner
decision). Hosted Windows CI therefore shows this test failing.

## Platform and certification qualifications of earlier milestones

- **MO-1303:** released under an external-infrastructure exception: macOS
  hosted certification and three-platform parity NOT EXECUTED. Source:
  [CHANGELOG](CHANGELOG.md).
- **MO-1304:** macOS remains unsupported. Source: [CHANGELOG](CHANGELOG.md).
- **MO-1305:** installed-package certification ran on the existing physical
  Windows 11 x64 host only. Source: [CHANGELOG](CHANGELOG.md).
- **MO-1306:** the GitHub integration is IMPLEMENTED and OFFLINE_VALIDATED but
  NOT_CERTIFIED hosted. Source: [CHANGELOG](CHANGELOG.md),
  [hosted scope correction](docs/mo1306-hosted-certification-scope-correction.md).

## Carried forward from v1.2.1

These two items are carried unchanged from the v1.2.1 known-issues list; this
release records no change to them.

- **Observe → Trace discoverability.** Open, low impact, first-time usability
  only. Trace begins after the engineer selects a valid Reflection while in
  Observe. Workaround: select a Reflection node or its unambiguous owning
  Reflection aggregate or session. Runtime, determinism and public APIs are not
  affected.
- **Source license.** Pending an authorized owner decision. The repository
  grants no software license; [LICENSE](LICENSE) is a notice, not a grant. The
  separately published MemoryOS Standard is an open technical standard and its
  publication does not license the Reference Implementation source.

## Resolved since tag

- **MO-1307 stale-baseline tests.** Seven of 639 conformance tests were
  disclosed stale-baseline tests at the `memoryos-1.3-mo1307` tag. They were
  fixed by the test-only MO-1307 V2 stale-test correction (evidence `32255d7a`,
  binding `1c3a4269`, 639/639 on the reference host under Node v24.21.0). No
  open item remains. Source:
  [V2 correction](docs/mo1307-v2-stale-test-correction.md);
  [CHANGELOG](CHANGELOG.md) MO-1307.
