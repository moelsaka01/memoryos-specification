# MO-1308 Phase 2D integration

Status: **DEVELOPMENT COMPLETE IN THE CLOUD — NOT BOUND**.

This record describes Stream 2D of [MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md) (section 18.1, with
Amendments A1–A6) on branch `mo1308/phase2d`. It is development evidence from the cloud container (Linux, Node
v22.22.0), not certification. Binding B2 is made later on the reference Windows host under the pinned Node v24.21.0.

## 1. Integration

`mo1308/phase2d` was created from the 2A head `d33f4acf` (binding B of generation 2). Merged with normal merge
commits, no rebase, squash or force-push, no conflict:

| Merge | Parent added | Result |
|---|---|---|
| `dab4dbb` | 2B head `1f91a378` (binding B) | clean (`ort`) |
| `832e68d` | 2C head `7609576` (Amendment A6 docs-only commit on top of binding B `fb3bd12d`, an ancestor, verified) | clean (`ort`) |

The streams carry identical cherry-picked contract commits, so nothing conflicted. Amendments A1–A6 are intact and in
order in the Freeze. No evidence directory was touched.

## 2. What 2D implements

| Freeze item | Implementation |
|---|---|
| §13.2 SDK facade | `memoryos-sdk.js`: the eight functions forward to `memoryos-history-ledger.js` and `memoryos-history-admission.js`. The Phase 1 argument-shape checks stay in front. |
| A2 item 2 brands | `verifyHistoryLedger` brands the verified-ledger value and `admitHistoryRecord` brands the admission record in the SDK; only values the facade issued are accepted (`USAGE` otherwise). |
| A4.1 glue | `admitHistoryRecord` builds admission input with 2A's `historyLedgerView(ledger)`, which carries the retained `READINESS_RESULT` bytes. |
| §7.2 `createHistoryCheckpointRecord` | Returns the JCS bytes of the nine-member Core checkpoint projection. A native investigation is rejected by running the real `INVESTIGATION_CHECKPOINT` admission against an empty ledger view of the checkpoint's Workspace (`RECORD_INVALID`). It never restores. |
| §13.1 versions | SDK `1.2.0`; CLI `1.2.0` (`version.js`, `package.json`, CMake project). Vendored released copies (Action, MCP, CI, REST) are unchanged (A1). C++ and Python SDKs stay `1.1.0`. |
| §13.3, H06 option B | `commands.js` dispatches `history` to 2C's `executeHistoryCommand` with the eight SDK functions as `engine`. The SDK does no file I/O; the CLI owns the store. `help.js` and the CMake `--check` list are updated. |
| Query and export | Real SDK `queryHistoryLedger`, `buildHistoryExport`, `verifyHistoryExport` through the CLI (`query`, `export`, `verify-export`). |
| Tests | See section 4. |

## 3. Decisions inside the Freeze text (confirm or amend)

| # | Point | Reading implemented |
|---|---|---|
| L1 | JSON and human success envelope `command` | `history <subcommand>`, like the error envelope (errors already used it). The Phase 2C wiring returned plain `history` for success. Freeze fixes only `result` (A4.2). |
| L2 | Human output of arrays of objects | `history query` entries print as canonical JSON per element; previously `[object Object]`. Arrays of scalars print exactly as before. |
| L3 | Checkpoint native rejection | Done by running the admission method, not by a second reading of the shape, so the SDK cannot produce bytes the ledger would refuse. |
| L4 | `verify-export` on a missing directory | Reports `LEDGER_NOT_FOUND` (2C behaviour, exit 4). Left unchanged; the Freeze has no separate "export not found" code. |
| L5 | Tombstone rows in a query | A tombstone entry is a result row (§11.2 `entryType`) and matches its target's kind and subjects; two 2C assertions that encoded the stand-in's filter-only behaviour were corrected (section 4). |

## 4. Tests (cloud, Linux, Node v22.22.0)

| Suite | Result |
|---|---|
| `cca-conformance` `tests/mo1308_*_test.mjs` | 92/92 (19 Phase 1 + 25 2A + 30 2B + 18 new 2D) |
| `memoryos-cli` `npm test` | 69 pass, 12 skipped (the 12 native-Windows W-tests), 0 fail; 81 total |
| `cca-studio` `npm test` | 358/358 |
| `cca-conformance` `tests/mo1307_*_test.mjs` | 517 pass, 122 fail: the 122 native-Windows/PowerShell tests (host-only, as in the 2A and 2B records), identical on the pre-2D merge head |
| Full `cca-conformance` `tests/*_test.mjs` | 775/920 on both the merge head `832e68d` and this branch; the same 145 tests fail in both (the 122 above plus release-tag and Windows items). No regression |
| `tools/verify_workspace.py` | only the pre-existing Linux `MO-1304 … validation failed` error, identical to the merge head |
| `memoryos-cli` `examples/run-cli-examples.mjs` | all pass |

2D tests, `tests/mo1308_phase2d_integration_test.mjs` (D01–D18): versions and released copies; every kind through the SDK;
brands; the A4.1 glue (unbound, wrong, purged, consistent, contrary); the checkpoint record (oracle bytes, determinism,
native rejection, not restorable); the CLI end to end through real processes for every kind; tombstone, purge, export
and verify-export; SDK/CLI byte parity (R27) and an independent twin (R04); every CLI failure class with exact code, exit,
no disclosure and no change (R09, R25); single-byte tamper corpus over the descriptor, every entry byte and a stride of
every member, in the SDK and the CLI (R21); export tamper corpus (R23); damaged ledger behaviour of query, append, export
and tombstone; architecture and static audits (R12, R14, R28–R30, R35, R37); no test-only export.

**2C stand-in replaced.** The 2C store, Windows and worker tests now run on the real SDK
(`tests/support/history-engine.mjs`) with real records of the repository (`tests/support/history-corpus.mjs`): distinct
real checkpoint records, the released Policy pairs, MO-1306 bundles, MO-1307 results and decisions, a real regression
report. Every 2C test passes (24/24 store tests in the cloud). Two assertions encoded the stand-in, not the product, and
were corrected (test defects, not product defects): T09's "foreign member name" now uses a name that is foreign to the
record (the stand-in record happened to own the old name), and T20's query count includes the tombstone row (L5).
The stand-in file stays only for the 2C characterization tool, which writes synthetic entries (its header says so).

**Grammar test.** The Phase 1 test "every valid history command fails closed" is replaced by one asserting that every
valid command is accepted by the grammar and answered by the store with its frozen code and exit, creating nothing;
the human-error test follows. Version pins of the live SDK and CLI moved to 1.2.0 in nine assertions (SDK guard, MO-1204
SDK, Policy SDK, CLI contract, human output, MO-1301 integration, compatibility); released-evidence inventories
that record 1.1.0 historically are unchanged.

**`__sha256ForTests` removed.** The production export is gone. B28 reaches the same code by evaluating the module's own
self-contained hash section from its source text (constants, compression function and `Sha256Stream`), with every
assertion unchanged; D15 asserts that production exports no test-only seam.

**Windows-only, not run here.** `history-store-windows.test.mjs` (12 tests W01–W08c) is skipped on Linux. It was edited
only to use the real engine, the real corpus and the real checkpoint member name (`checkpoint.json`); the syntax is
checked, the behaviour is not. The same applies to `support/history-windows-worker.mjs`. Also host-only: pinned Node
v24.21.0, the 122 native MO-1307 tests, `verify_workspace.py` without the Linux error, and CTest (deferred, A3).

## 5. Characterization (Freeze §14.2, Amendment A2 item 4)

`repositories/cca-conformance/tools/mo1308-phase2d/characterize.mjs` runs the REAL SDK through the CLI command layer at the
100,000-entry ceiling. Cloud values (one run) are in section 5a.

## 6. Local binding plan B2 (one run, reference Windows host)

Worktree detached at the 2D head `$D`; Node v24.21.0 (SHA-256 `ba4e6d11…6c32`); one validation generation, no silent
retry, logs kept and classified if any expected result is not met; raw logs under the `evidence/mo1308/**` `-text` rule.

| # | Item | Expected |
|---|---|---|
| 1 | `cca-conformance` `tests/mo1308_*_test.mjs` | 92/92 (B30 about two minutes; the 2D corpus a few minutes) |
| 2 | `memoryos-cli` `tests/history-store.test.mjs` | 24/24, 0 skipped |
| 3 | `memoryos-cli` `tests/history-store-windows.test.mjs` | 12/12, 0 skipped (W01b needs an app-execution alias; a skip is NOT_RUN and the receipt cannot be PASS) |
| 4 | `memoryos-cli` `npm test` | 81/81 |
| 5 | `cca-studio` `npm test` | 358/358 |
| 6 | `cca-conformance` `tests/mo1307_*_test.mjs` | 639/639 (including the 122 native tests) |
| 7 | studio and CLI examples | pass |
| 8 | `python tools\verify_workspace.py --root .` | exit 0, pass line only |
| 9 | CTest | `DEFERRED_TOOLCHAIN_ABSENT` (Amendment A3; mandatory before Phase 3) |
| 10 | Characterization 2A, 2B, 2C, 2D | each exits 0 with a recorded value for every operation (the 2C tool uses its stand-in by design) |
| 11 | Clean tree | empty |

Evidence commit (single-parent child of `$D`, adding only `repositories/cca-conformance/evidence/mo1308/phase2d/`) and a
binding-only commit, as the earlier streams. The receipt must disclose A6 and the H40 qualification, the section 3
decisions, and every Windows test run versus NOT_RUN. No `main` update, no tag.
