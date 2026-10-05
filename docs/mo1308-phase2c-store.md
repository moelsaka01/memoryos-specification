# MO-1308 Phase 2C persistence and publication

Status: **DEVELOPMENT COMPLETE IN THE CLOUD — NOT BOUND; WINDOWS-HOST TESTS PENDING**.

This record describes Stream 2C of [MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md)
(section 18.1, with Amendments A1–A3) on branch `mo1308/phase2c-store`, created from
`1003289f` (the Phase 1 head). It is development evidence from the cloud container
(Linux, Node v22.22.0), not certification. The stream is bound later on the reference
Windows host under the pinned Node v24.21.0. It is independent of Streams 2A and 2B and
imports nothing from `memoryos-history-ledger.js` or `memoryos-history-admission.js`.

## 1. Deliverable

| File | Content |
|---|---|
| `repositories/memoryos-cli/src/history-store.js` | The Node-only file store: layout (§9.1), append protocol (§9.2), optimistic concurrency (§9.3), path and link mechanism (§9.4), tombstone purge (§10.2), export and verify-export reading and writing (§12) |
| `repositories/memoryos-cli/src/history-commands.js` | `executeHistoryCommand(parsed, {engine})`: the seven `memoryos history` subcommands (§13.3) turned into store operations, with the exit mapping of §14.1 |
| `repositories/memoryos-cli/tests/history-store.test.mjs` | 21 tests (T01–T19, T12b, T13b) |
| `repositories/memoryos-cli/tests/support/` | A conforming stand-in for the SDK history functions and a concurrent-appender worker, test-only |

The store is built against the frozen SDK signatures only (§13.2): `createHistoryLedger`,
`verifyHistoryLedger`, `admitHistoryRecord`, `appendHistoryEntry`,
`tombstoneHistoryEntry`, `queryHistoryLedger`, `buildHistoryExport`,
`verifyHistoryExport` and `MemoryOSHistoryError`, supplied as an `engine` argument. The
store reads bytes, hands them to the engine and writes the bytes the engine returns; it
defines no identity, shape or verification (AR-006, SP-004 §8). It is **not wired into
`commands.js`**: that is Stream 2D (wiring). The Phase 1 guard, `commands.js`, `main.js`,
`help.js`, the SDK facade and every Phase 1 test are unchanged.

Stream 2C **could be built from the frozen interface alone**; no Stream 2A or 2B
implementation was needed. Where a test needs working SDK functions, a stand-in
implements the frozen byte formats just far enough to drive the store (its admission trusts
member names, and it is not the 2B admission). It is disclosed as such in the stand-in's
header. Verification against the real functions is Stream 2D's integrated suite.

## 2. Freeze requirements implemented

| Freeze | Implementation |
|---|---|
| §9.1 layout | `memoryos-history-ledger.json`, `entries/<20-digit>.json`, `records/<64-hex>/<MemberName>`, `.pending/`; no head file, segment or seal; no file is ever modified (R06) |
| §9.2 append | 1 read and verify the whole chain through the engine; 2 admit and build entry `n`; 3 for each member: exclusive-create a staging file, write, flush, handle-vs-path identity check, re-read and compare, hard-link into `records/<digest>/<name>` (an existing identical member is accepted after a byte comparison), remove the staging name; 4 the commit point: the same for `entries/<n>.json`, `LEDGER_CONFLICT` if the name exists, nothing published; 5 remove the staging name |
| §9.3 concurrency | Lock-free: exclusive creation of `entries/<n>.json` is the only serialization point (R15) |
| §9.4 mechanism (H40) | `lstat` of every path component (no symlink or junction), `realpath` equality with the canonical root, `wx` for every new name, hard-link publication that never replaces a name, handle `fstat` versus path `lstat` identity after writing, fail closed (`FILESYSTEM_BOUNDARY`). No PowerShell helper and no new compiled helper; the store starts no process (R37) |
| §9.5 | No timer, deadline, clock or randomness; staging names are `role.counter` |
| §10.2 purge | The tombstone entry is committed first, then every member of the target record is deleted; an interrupted purge is `purgePending` and re-running the same command finishes it without a new entry |
| §11.1 anomalies | `verify` discloses staging files (`pendingArtifacts`) and unreferenced records, never deletes them; any extra, missing or foreign file fails closed |
| §12 export | A new directory; every file written exclusively; the completion marker is created last (the commit point); `verify-export` reads every file and checks it through the engine |
| §13.3 CLI | `init`, `append` (`--record`, `--identity`/`--outcome`, `--run`), `tombstone`, `verify`, `query` (kinds ordered strictly ascending, Amendment A2), `export`, `verify-export`; `verify`, `query` and `verify-export` never write |
| §14.1 errors | Every failure is a `MemoryOSHistoryError` with its frozen code, stage and fixed message; the CLI error carries `historyCode` and the category exit (2 admission, 3 integrity, 4 filesystem, 5 internal); no path, record content, exception message or stack |
| §14.2 limits | Entries 100,000, entry file 16,384, descriptor 1,024, per-kind member limits, CLI JSON stdout 4,194,304 (T01 pins every duplicated constant to the contract module) |

Requirements touched: R06, R09, R15, R16, R17 (Linux half), R18, R19, R20 (store side),
R21 (store layout side), R22, R23, R25 (code and exit mapping), R37.

## 3. Interface for Stream 2D

`commands.js` keeps the single SDK import (an existing architecture test requires it) and
replaces the Phase 1 guard with `executeHistoryCommand(parsed, { engine })`, where `engine`
is the eight SDK functions plus `MemoryOSHistoryError`. The Phase 1 grammar test that
asserts "every valid command fails closed with `MO1308_INTERNAL`" then changes with the
wiring. Without an engine the command layer still fails closed with `MO1308_INTERNAL`
(T16). CMake's `--check` list and `help.js` are 2D's. The CLI keeps its own copies of the
frozen constants rather than importing the contract (ARCHITECTURE §5); T01 pins them.

## 4. Interpretations inside the Freeze text (confirm or amend)

| # | Point | Reading implemented |
|---|---|---|
| K1 | CLI success results (§13.3 fixes no result shape for four commands) | `init` → `{ledgerIdentifier}`; `append` and `tombstone` → `{index, entryDigest}`; `export` → `{ledgerIdentifier, entryCount, headDigest}`; `verify` and `verify-export` → the Verification; `query` → the QueryResult. Minimal projections of the SDK return values; data classes stay within §15.3 |
| K2 | Locations | `init` and `export` need an existing real parent (a missing parent is `FILESYSTEM_BOUNDARY`); an existing target is `LEDGER_EXISTS`; a missing ledger is `LEDGER_NOT_FOUND` |
| K3 | Staging names | `<role>.<n>` with the first free counter, so a leftover from a crashed writer never blocks a retry; no randomness or time |
| K4 | Cleanup after the commit | Removing staging names and the emptied record directory is best effort; a failure leaves a disclosed anomaly (`pendingArtifacts`) or an empty directory, never a false error after a successful commit |
| K5 | Resuming a purge | Re-running the command finishes the purge only when the target is `purgePending` and the reason and authority reference equal the committed tombstone's; any other command on a tombstoned target is `TOMBSTONE_INVALID` |
| K6 | Append reads every retained member | `verifyHistoryLedger` (§11.1) takes all retained members, so an append reads all of them (memory is bounded by the retained bytes). Same finding as Stream 2A (I8) |
| K7 | A pre-existing member name | Identical bytes are accepted; different bytes are `RECORD_BYTES_MISMATCH` |
| K8 | Detecting a directory swap | After every write and link the receiving directory's `realpath` must still equal its own path. A swap is detected after the fact, as the H40 acceptance states; nothing is prevented |
| K9 | Strict ancestors | A symlink in any ancestor of a ledger, export or input path is refused, so a host whose temp or home path is itself a link needs the real path |
| K10 | `pendingArtifacts` | The store counts `.pending` and overlays the engine's `0` (the pure verifier cannot see staging files) |
| K11 | Other reparse points | Node's `lstat` reports symlinks and junctions; it cannot identify other reparse-point kinds. The Freeze lists "other reparse point" in §9.4, and H40 records that Node alone cannot go further. To be exercised on Windows in 3A |

## 5. Tests

`repositories/memoryos-cli/tests/history-store.test.mjs`, 21 tests. In the cloud container
(Linux, Node v22.22.0): 21/21. They cover: constant pinning; layout; append, member and
commit ordering with a byte-for-byte immutability snapshot; rejected appends changing
nothing; the commit race (in-process hook and six real concurrent processes); fault
injection at **every** mutating step of an append and of a tombstone purge (nothing
before the commit point, a complete entry after it) and at an export's marker write; `verify` layout defects and
single-byte tampering; symlinks on the root, every ancestor, every directory and file;
handle/path identity mismatch; a directory swapped for a link mid-append; export
determinism, marker-last and tamper detection; the command layer, exits and secrecy of
errors; a static audit (no helper process, no timer or clock, no replacement call, only the
allowed deletions). The store's key conditions were mutation-checked during development
(each removed condition fails a test, apart from defenses that are deliberately duplicated:
a symlink on an ancestor is caught both by the component check and by the realpath
comparison); that is not a committed test.

| Suite | Result |
|---|---|
| `memoryos-cli` `npm test` | 66/66 (45 existing + 21 new) |
| `cca-conformance` `tests/mo1308_*_test.mjs` | 19/19 (Phase 1; the 2A and 2B suites live on their own branches), with tag `memoryos-1.3-mo1302` fetched locally |
| `cca-studio` `npm test` | unchanged (no studio file is touched) |
| `tools/verify_workspace.py` | Only the pre-existing Linux `MO-1304 … INSTALL_TOOLCHAIN` error |

**Tests that need the Windows host and are not claimed here:**

1. Directory junctions and other reparse points as ledger root, ancestor, `entries`, `records`, `.pending` and members (T11 exercises symlinks only; on Windows, symlink creation needs a privilege and the test skips without it).
2. Hard-link publication, `fsync` and exclusive-create semantics on NTFS, including a link-count and file-index (`ino`) comparison that is only meaningful there.
3. The case-insensitive `realpath` comparison (`win32` branch, untested on Linux) and drive-letter, UNC and long-path forms.
4. `O_NOFOLLOW` does not exist on Windows; there the component and identity checks are the only guard.
5. The concurrent-appender and directory-swap races on NTFS, antivirus or indexer interference, and sharing violations (3A one-shot campaign).
6. The whole suite under the pinned Node v24.21.0.

## 6. Characterization (Freeze §14.2, Amendment A2 item 4)

`repositories/cca-conformance/tools/mo1308-phase2c/characterize.mjs` measures the store at
the frozen 100,000-entry ceiling with the stand-in engine, so the values bound the
store's I/O plus a native-crypto verifier, not the real engine. Cloud values are in the
report; the reference-host values are recorded at binding.

## 7. Local binding plan (one run, reference Windows host)

Follows the MO-1307 and Phase 1 precedent. Worktree detached at the 2C head `$C`; Node
v24.21.0 (SHA-256 `ba4e6d11…6c32`); one validation generation, no silent retry, logs
kept and classified if any expected result is not met.

| # | Item | Expected |
|---|---|---|
| 1 | `memoryos-cli` `tests/history-store.test.mjs` | 21/21, with any symlink-privilege skip recorded as such |
| 2 | `memoryos-cli` `npm test` | 66/66 |
| 3 | `cca-conformance` `tests/mo1308_*_test.mjs` | 19/19 |
| 4 | `cca-studio` `npm test` | 358/358 |
| 5 | `tests/mo1307_*_test.mjs` | 639/639 |
| 6 | `python tools\verify_workspace.py --root .` | exit 0, pass line only |
| 7 | CTest | `DEFERRED_TOOLCHAIN_ABSENT` (Amendment A3; mandatory before Phase 3) |
| 8 | Characterization | recorded |
| 9 | Clean tree | empty |

Evidence commit (single-parent child of `$C`, adding only
`repositories/cca-conformance/evidence/mo1308/phase2c/`, raw logs under the
`evidence/mo1308/**` `-text` rule) and a binding-only commit, as Phase 1. The receipt must
disclose the H40 qualification and the section 5 list of host-only tests. No `main`
update, no tag.
