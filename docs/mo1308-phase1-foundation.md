# MO-1308 Phase 1 foundation

Status: **DEVELOPMENT COMPLETE IN THE CLOUD — PENDING B1 ON THE REFERENCE WINDOWS HOST**.

This record describes the Phase 1 deliverables of
[MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md) (section 18.1, with
Amendment A1) on branch `mo1308/phase1`. It is development evidence from the
cloud container (Linux, Node v22.22.0), not certification. B1 binds it later on
the reference Windows host under the pinned Node v24.21.0.

## 1. Commits

| Commit | Purpose |
|---|---|
| `ad200d67` | Docs: V2 correction recorded as bound; ROADMAP |
| `64e5d520` | Entry-obligation proofs and record |
| `98701b4a` | **WORKSPACE_CHECK_CORRECTION** (own commit): MO-1302 vendored runtime pinned to its release; Freeze Amendment A1 ([record](mo1302-vendored-runtime-check-correction.md)) |
| `119a48cb` | Harness fix to the correction probe (seed from released bytes) |
| `6fc08a75` | Contract module, shape fixtures and generator, contract tests |
| `c6a57193` | Guarded SDK history entry points; conformance prototype list |
| `9c2757e7` | Guarded CLI grammar; conformance CLI command list |
| the commit adding this record | ARCHITECTURE and ambiguity text; characterization tool; this record |

## 2. Deliverables mapped to the Freeze

| Freeze item | Phase 1 content |
|---|---|
| §5.1 contract module | `repositories/cca-studio/web/js/memoryos-history-contract.js`: shape kinds, D domains, record kinds, admission and Workspace association per kind, member rules and per-kind limits, subject types and the §8.2 subject-source binding, tombstone reasons, retention and consistency enums, layout names, §14.1 error catalog (`MemoryOSHistoryError`), §14.2 limits, strict JCS byte decoder, shape validators |
| §8.2 subject-source binding | `SUBJECT_SOURCES`: each kind's subject types bound to the owner's published field (MIP `manifest`/`integrity`, Core checkpoint fields, Policy outcome `evaluationIdentityDigest` and the owner verifier's `outcomeDigest`, Regression `identifier`, MO-1306 `runId`/`semantic.*`, MO-1307 readiness and decision digests) |
| §13.2 guarded SDK signatures | `memoryos-sdk.js` exports the eight functions and `MemoryOSHistoryError`, plus `MemoryOS#createHistoryCheckpointRecord`. Each checks its frozen argument shape, then fails closed with `MO1308_INTERNAL` (MO-1307 Phase 1 guard precedent). No file I/O (H06). SDK version stays 1.1.0 until 2D |
| §13.3 guarded CLI grammar | `memoryos-cli/src/history-arguments.js` validates the seven subcommands; `commands.js` fails every valid command closed with `MO1308_INTERNAL` (exit 5); usage errors are `MO1308_USAGE` (exit 1). JSON errors add `error.historyCode`; messages are the catalog's fixed text |
| Fixtures | `cca-studio/tests/fixtures/memoryos-history/1.0.0/shape-cases.json` (41 cases: 9 valid, 32 invalid; synthetic digests, not identity vectors) and its generator `cca-studio/scripts/generate-memoryos-history-fixtures.mjs` |
| §5.4 ARCHITECTURE and ambiguity text | Applied verbatim to ARCHITECTURE §5 (`cca-studio`, `memoryos-cli`) and §13, and to CCA-A016 |
| R03 equivalence vectors | EO1 in `cca-conformance/tests/mo1308_phase1_entry_obligations_test.mjs` |
| Regression inspection confirmation | EO2 in the same test |
| §14.2 characterization | `cca-conformance/tools/mo1308-phase1/characterize.mjs` measures the Phase 1 operations (decoder and validators) at the frozen limits |
| §18.2 obligations | 1–3 proven or satisfied; 4 satisfied under the corrected check for what the cloud can check; Windows part at B1 |

Ownership kept disjoint for Phase 2: 2A and 2B add `memoryos-history-ledger.js`
and `memoryos-history-admission.js`; 2C adds further `memoryos-cli/src/history-*.js`
files against the frozen grammar; 2D replaces the SDK guards and sets 1.2.0.

## 3. Requirements touched in Phase 1

| Requirement | Phase 1 evidence |
|---|---|
| R01 closed, versioned shapes | Validators and 41 fixture cases |
| R03 J equivalence | EO1 |
| R24 data classes | Validators reject extra members (for example time fields); full audit in 3C |
| R25 errors and exits | Catalog pinned by tests; CLI exits 1 and 5 exercised |
| R26 limits | Limits pinned; validators enforce indices, sizes, page bounds |
| R28 authority imports | Contract imports only `mip-canonical.js` |
| R29 SDK no I/O | SDK guard test |
| R30 `session` unchanged | No session change; existing CLI tests pass |
| R32 released closures unchanged | WC09; EO3 (released SDK copies equal release bytes) |
| R33 no new dependency | No package-lock or dependency change |
| R35 no timestamp | Contract and grammar audits; fixture rejects time members |
| R36 one Workspace per ledger | Descriptor requires exactly one non-empty `workspaceIdentifier` |
| R37 no helper process | Contract, SDK and grammar audits |

## 4. Tests in the cloud container

| Suite | Result |
|---|---|
| `cca-conformance` `tests/mo1308_*_test.mjs` | 19/19 |
| `cca-studio` `npm test` | 358/358 (baseline 346) |
| `memoryos-cli` `npm test` | 45/45 (baseline 38) |
| `cca-conformance` normative vectors, compatibility, MO-1301 integration, reference implementation, MO-1302 Action foundation, component evidence, boundary contract | All pass (two pinned lists updated, below) |
| `tools/verify_workspace.py` | Only the pre-existing Linux `MO-1304 … INSTALL_TOOLCHAIN` error; no MO-1302 error |

Pinned-list updates, both as MO-1301 did for its additions: the
CCA-MEMORYOS-1.0 conformance test's exact `MemoryOS.prototype` list gains
`createHistoryCheckpointRecord` (JavaScript-only, outside the CCA-MOS-SDK-004
common operations; the C++/Python parity list is unchanged), and its exact CLI
command list gains `history` (outside the CCA-MOS-CLI-001 baseline CLI 1.0.0).

Needs the Windows host: the 122 native MO-1307 tests that cannot run on
Linux; the pinned Node binary check; `verify_workspace.py` without the MO-1304
toolchain error; the CTest run; and the reference-host characterization.

## 5. Open points for the owner

1. **CLI query defaults (before Phase 2C).** §13.3 makes `--retention`,
   `--from` and `--limit` optional, but `MemoryOSHistoryQuery` requires
   `retention`, `fromIndex` and `limit`, and the Freeze names no defaults. The
   Phase 1 grammar validates the flags without choosing defaults. Phase 2C
   cannot build a query without a decision.
2. **Argument shapes fixed by Phase 1** (§13.2 delegates this): `ledger` and
   `admission` are branded, immutable values issued only by the history
   authority (public fields are the frozen shape; verified state is private, as
   for the SDK `Checkpoint`); `members` is a `Map` from record digest to
   `[{name, bytes}]`; export files are `[{path, bytes}]`.
3. **Literal readings, recorded.** `subjects` must be non-decreasing by
   `(type, value)` (the Freeze says "sorts" and does not require uniqueness);
   `query.recordKinds` may contain duplicates (the Freeze sets no rule); lists
   that are sets by construction (member names, indices, digests, export paths,
   result indices) are strictly ascending.
4. **Characterization scope.** Phase 1 can only characterize the decoder and
   validators. In the cloud, generate-plus-decode-plus-validate of 100,000
   maximal (16,383-byte) entries took about 69 s (about 0.7 ms per entry,
   generation included); a 1,000-entry query page is 423,335 bytes, within the
   4 MiB CLI limit. Ledger, admission, query and export characterization falls
   to the phases that implement them.

## 6. B1 local binding plan (one run binds the correction and Phase 1)

Reference Windows 11 x64 host; `node.exe` v24.21.0 with SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`. One
validation generation: if any expected result is not met, keep the logs,
classify, and stop; no silent retry.

```powershell
Set-Location C:\Users\melsa\Documents\Codex\cca-workspace
git fetch origin mo1308/phase1
$P = git rev-parse origin/mo1308/phase1        # record: the Phase 1 head
if (Test-Path ..\cca-mo1308-b1) { throw 'worktree path exists' }
git worktree add --detach ..\cca-mo1308-b1 $P
Set-Location ..\cca-mo1308-b1
if (git status --porcelain) { throw 'not clean' }
$node = (Get-Command node.exe).Source
& $node --version                                           # v24.21.0
(Get-FileHash -Algorithm SHA256 $node).Hash.ToLower()       # ba4e6d11...6c32
git rev-parse 'memoryos-1.3-mo1302^{commit}'                # 7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d
$logs = "C:\Users\melsa\Documents\Codex\mo1308-b1"; if (Test-Path $logs) { throw 'log dir exists' }
New-Item -ItemType Directory $logs | Out-Null
```

| # | Item | Command (from the worktree root) | Expected |
|---|---|---|---|
| 1 | **Workspace-check correction** (named receipt item) | `cmd /d /c "cd repositories\cca-conformance && `"$node`" --test --test-concurrency=1 tests/mo1308_phase1_workspace_check_correction_test.mjs > $logs\wscheck.log 2>&1"` | 11/11 (WC01–WC11) |
| 2 | Entry obligations | same pattern, `tests/mo1308_phase1_entry_obligations_test.mjs` → `entry.log` | 8/8 |
| 3 | All MO-1308 suites | `tests/mo1308_*_test.mjs` → `mo1308.log` | 19/19 |
| 4 | MO-1307 regression | `tests/mo1307_*_test.mjs` → `mo1307.log` | 639/639, 25 files |
| 5 | cca-studio | `cmd /d /c "cd repositories\cca-studio && `"$node`" --test <the package.json test list> > $logs\studio.log 2>&1"` (or `npm test`) | 358/358 |
| 6 | memoryos-cli | `cmd /d /c "cd repositories\memoryos-cli && `"$node`" --test --test-concurrency=1 tests/*.test.mjs > $logs\cli.log 2>&1"` | 45/45 |
| 7 | Released-copy check (Freeze §18.2 item 4) | included in items 1–2 (EO3, WC08, WC09); also `git diff --quiet 7e07bd0d HEAD -- .github/actions/memoryos-policy-gate` | exit 0 |
| 8 | Workspace verifier | `python tools\verify_workspace.py --root . > $logs\verify.log 2>&1` | exit 0, no output; **no MO-1302 and no MO-1304 error** |
| 9 | CTest | `cmake --preset default`, `cmake --build --preset default`, `ctest --preset default --output-on-failure > $logs\ctest.log 2>&1` (at minimum `ctest --preset default -R cca.workspace.verify`) | all pass, including `cca.workspace.verify` |
| 10 | Characterization (§14.2) | `& $node --expose-gc repositories\cca-conformance\tools\mo1308-phase1\characterize.mjs > $logs\characterization.json` | completes; values recorded, not pass/fail |
| 11 | Clean tree afterwards | `git status --porcelain` | empty |

Binding, following the MO-1307 V2 and Phase 3D precedent:

1. **Evidence commit E**, single-parent child of `$P` on `mo1308/phase1`,
   adding only `repositories/cca-conformance/evidence/mo1308/phase1/`: each
   log's exact bytes, `characterization.json`, and `receipt.json` with
   `kind: "MO1308Phase1Receipt"`, the Phase 1 head `$P`, the runtime
   (version, platform, arch, node SHA-256), and one item per row above with
   its command, counts and log `{path, byteLength, sha256}`. Item 1 is named
   `WORKSPACE_CHECK_CORRECTION` and cites commit `98701b4a`. `result` is
   `PASS` only if every expected value holds, otherwise `FAILED_PRESERVED`.
2. **Binding commit B1**, single-parent child of E, adding only
   `repositories/cca-conformance/evidence/mo1308/phase1/binding.json` with
   E's commit and tree, the path, byte length and SHA-256 of the receipt, every
   log, this record and the correction record. B1 embeds no hash of itself.
3. Push `mo1308/phase1`. No `main` update, no tag.
