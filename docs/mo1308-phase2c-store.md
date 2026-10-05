# MO-1308 Phase 2C persistence and publication

Status: **DEVELOPMENT COMPLETE (CLOUD, THEN THE WINDOWS HOST), ADOPTED BY AMENDMENT A4.2 — NOT BOUND**. Generation 1 of the local run
(`2c5cf474`) is `FAILED_PRESERVED` (section 7). The Windows-host tests were written on the Windows host and found a product race,
fixed in section 5a; a Freeze amendment for the new error mapping is proposed there.

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
| `repositories/memoryos-cli/tests/history-store.test.mjs` | 24 tests (T01–T22, T12b, T13b; T20–T22 are the snapshot regression tests of section 5a) |
| `repositories/memoryos-cli/tests/history-store-windows.test.mjs` | 12 native-Windows (NTFS) tests W01–W08c (section 5b); skipped, never passed, on other platforms |
| `repositories/memoryos-cli/tests/support/` | A conforming stand-in for the SDK history functions, a concurrent-appender worker and a Windows concurrency worker, test-only |

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
| §10.2 purge | The tombstone entry is committed first, then every member of the target record is deleted; an interrupted purge is `purgePending` and re-running the same command finishes it without a new entry. Every read takes a consistent snapshot (section 5a) so that a purge racing a read is never reported as corruption |
| §11.1 anomalies | `verify` discloses staging files (`pendingArtifacts`) and unreferenced records, never deletes them; any extra, missing or foreign file fails closed |
| §12 export | A new directory; every file written exclusively; the completion marker is created last (the commit point); `verify-export` reads every file and checks it through the engine |
| §13.3 CLI | `init`, `append` (`--record`, `--identity`/`--outcome`, `--run`), `tombstone`, `verify`, `query` (kinds ordered strictly ascending, Amendment A2), `export`, `verify-export`; `verify`, `query` and `verify-export` never write |
| §14.1 errors | Every failure is a `MemoryOSHistoryError` with its frozen code, stage and fixed message; the CLI error carries `historyCode` and the category exit (2 admission, 3 integrity, 4 filesystem, 5 internal); no path, record content, exception message or stack |
| §14.2 limits | Entries 100,000, entry file 16,384, descriptor 1,024, per-kind member limits, CLI JSON stdout 4,194,304 (T01 pins every duplicated constant to the contract module) |

Requirements touched: R06, R09, R15, R16, R17 (Linux half), R18, R19, R20 (store side),
R21 (store layout side), R22, R23, R25 (code and exit mapping), R37.

## 2a. Amendment A4

- **A4.2 (K1 adopted).** [Amendment A4.2](mo1308-contract-freeze-1.md) freezes the success
  results exactly as K1 chose them: `init` `{ledgerIdentifier}`, `append` and `tombstone`
  `{index, entryDigest}`, `export` `{ledgerIdentifier, entryCount, headDigest}`, `verify` and
  `verify-export` the Verification, `query` the QueryResult. **No shape needed any
  adjustment.** T16 now pins the exact key set of each.
- **A4.1 (entry shape).** The `record` shape gains `decisionConsistency`. The store is
  indifferent (it writes the bytes the engine returns), but the stand-in engine and the
  contract module in this branch follow it: the same contract commit as in Streams 2A and
  2B, and the stand-in's admission carries a trusted `decisionConsistency` (the real
  admission computes it, Stream 2B). No store code changed.
- **A4.3.** K1–K11 are accepted as written.

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

`repositories/memoryos-cli/tests/history-store.test.mjs`, 24 tests (T01–T19 with T12b and T13b were 21/21 in the cloud
container, Linux, Node v22.22.0; T20–T22 were added with the snapshot fix, section 5a). They cover: constant pinning; layout; append, member and
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
| `memoryos-cli` `npm test` | 81/81 on Windows (45 existing + 24 store + 12 Windows); the cloud figure was 66/66 before sections 5a and 5b (45 + 21) |
| `cca-conformance` `tests/mo1308_*_test.mjs` | 19/19 (Phase 1; the 2A and 2B suites live on their own branches), with tag `memoryos-1.3-mo1302` fetched locally |
| `cca-studio` `npm test` | 358/358 (the contract and fixture tests declare the 54-case A4.1 fixtures) |
| `tools/verify_workspace.py` | Only the pre-existing Linux `MO-1304 … INSTALL_TOOLCHAIN` error |

## 5a. Product race found on the Windows host: a purge racing a read (classified: product, found by W08b)

**Finding.** `readLedger` listed the entries, then later listed the members. A tombstone commits its entry first and deletes
the target's members afterwards (section 10.2). A read whose entry listing preceded the tombstone and whose member
listing followed the deletions saw a retained record with no member, and the engine reported `RECORD_BYTES_MISMATCH`
(exit 3, integrity class) on a valid ledger. Re-running succeeded. It affected `verify`, `append`, `export` and
`tombstone` (all read members). It is platform independent (it reproduces deterministically on any platform with an
injected purge), was never fatal (fail closed, nothing written) and was found on Windows by W08b (three tombstone
processes and three appenders). Classification: **product defect (non-atomic read), not a test or environment fault.**

**Fix (development decision of the owner: Option A).** `readLedger` now takes a consistent snapshot: it reads the entry
listing, the descriptor, the entries and the members, then lists the entries again. Entries are only ever added, so an
unchanged listing means no entry was committed during the read, and a purge (which follows its tombstone entry) cannot
have completed unseen. A pass whose listing changed, including one that failed part-way (an error observed on a
changing ledger is not trusted), is discarded and repeated from the start.

- **Retry bound: `STORE_SNAPSHOT_ATTEMPTS = 8` passes.** A pass is overtaken only by another writer's entry commit. One
  purge is one tombstone entry, so a purge plus a short burst of appends is absorbed with headroom; sustained writing is
  cut off after at most eight scans (each a full read of the ledger) instead of looping without bound. A quiescent
  ledger is always read in exactly one pass (T22 counts the listings). The loop is bounded and deterministic for a
  quiescent ledger; it uses no clock, timer, sleep, helper or process (R35–R37).
- **Error mapping.** When all eight passes are overtaken the read fails with the existing `LEDGER_CONFLICT` (stage
  `ACQUISITION`, exit category 4, a concurrency code, which callers already retry), never with `RECORD_BYTES_MISMATCH`
  or any integrity code. Nothing is published by a failed append, tombstone or export.
- **Stable snapshots are unchanged.** Anything observed with the entry listing unchanged is reported exactly as before
  (T22: member bytes changed, member missing from a retained record, a damaged entry; each is found in a single pass).
- **A vanishing member.** A member listed in a record directory but gone by the time it is read (a purge unlinking it) is
  treated as absent, exactly as if it had been listed a moment later; the engine then decides. On a stable snapshot a
  retained record's missing member is still `RECORD_BYTES_MISMATCH`; a purged or purge-pending record is fine. Previously
  this window produced `IO`.

**Contract-visible changes (propose as a Freeze amendment, A4.4 or later).** (1) `LEDGER_CONFLICT`, defined for an append
that lost the entry commit race (§9.3, §14.1), is now also the result of any store read (`verify`, `query`, `export`,
`tombstone`, `append`) that could not obtain a consistent snapshot in eight passes, with stage `ACQUISITION`; the
message text is unchanged and fixed. (2) The `IO` result for a member that vanished between listing and read no longer
occurs; it is absent-member handling as described. No other code, shape, layout or limit changes. The engine, the
format and the commit protocol are untouched.

**Tests.** T20 injects a purge between the entry listing and the member listing (no production seam: the store takes
`fs` by design, so the test supplies a listing-aware `fs` and a second store as the concurrent writer) and shows that
`verify`, `append`, `export`, `tombstone` and `query` return correct results after exactly one discarded pass. T21
overtakes every pass and shows `LEDGER_CONFLICT`, stage `ACQUISITION`, exit 4, exactly eight passes, nothing published.
T22 shows real corruption of a quiescent ledger is still the integrity error, found in one pass. Run against the
pre-fix store, T20, T21 and T22 fail. W08b passes without tolerating `RECORD_BYTES_MISMATCH` (section 5b).

## 5b. Windows-host tests (`history-store-windows.test.mjs`, 12 tests)

Written on the reference Windows host and run with the pinned Node v24.21.0; on any other platform they are skipped
(never passed). They replace the former "host-only, not claimed" list. Each asserts the frozen H40 behaviour: a link is
refused, a swap is detected after the fact, no existing content is overwritten or replaced, every later read fails
closed.

| Test | What it proves |
|---|---|
| W01 | Junctions and directory symlinks as ledger root, ancestor, `entries`, `records`, `.pending` or a record directory, a dangling junction, and init at or under one: `FILESYSTEM_BOUNDARY` on every operation; no ledger or outside file changed |
| W01b | An app-execution alias (`IO_REPARSE_TAG_APPEXECLINK`, neither junction nor symlink) is refused as an input file; skipped, and reported as NOT_RUN, on a host without one |
| W02 | A junction swapped in for a record directory during an append: detected, the decoy survives, no entry committed, reads fail closed |
| W03 | The `entries` directory swapped for a junction at the commit point: detected after the fact, the real entries unchanged, reads fail closed, the ledger verifies once restored |
| W04 | NTFS hard links: one link and a distinct file index for every published file; a hard link never replaces an existing name (also differing in case); a rival writer's entry survives; an unremoved staging link is only an anomaly |
| W05 | Exclusive create: an existing name in any case is refused; staging names held open by another process are skipped, never opened or replaced |
| W05b | A sharing violation (another process holds a ledger file with no sharing) is a typed `IO` failure that changes nothing; releasing restores service |
| W06 | Any casing of the real path is accepted (the `win32` case-insensitive realpath branch); case-only renames inside a ledger are corruption; an 8.3 short alias is refused and creates nothing |
| W07 | Drive-letter, `/`, `..`, UNC (`\\localhost\C$\…`) and long (over 300 characters, no prefix) forms work end to end; the `\\?\` and `\\.\` forms are refused with `FILESYSTEM_BOUNDARY` and create nothing |
| W08 | Ten real appender processes and two readers: one entry per index, a verifying chain, readers never see an integrity or boundary failure |
| W08b | Three tombstone processes and three appenders: one tombstone per target, every purge finished, a verifying chain; the only tolerated failure is the retried `LEDGER_CONFLICT` |
| W08c | A junction swapper racing three appender processes: the race is exercised, the outside sentinel is untouched, the ledger only verifies or fails closed with a typed error (`LEDGER_CORRUPT` and `RECORD_BYTES_MISMATCH` are allowed here and only here, because the swap itself puts a foreign name in the ledger root and hides the members) |

The mutation checks run during development (each removed condition fails a test): the component link check (W01–W03), the
post-write canonical check (W03), the case-insensitive comparison (W06), exclusive create (W05, W08) and IO handling
(W05, W08).

**Known limitations (accepted, recorded).** (1) The `\\?\` and `\\.\` prefixed forms are refused with
`FILESYSTEM_BOUNDARY`: `realpath` strips the prefix, so the canonical form never equals the given one. It fails closed and
creates nothing; W07 pins it. (2) Only symlinks, directory junctions and app-execution aliases can be created or found
unprivileged on a host; other reparse-point kinds (WIM, cloud-files placeholders, deduplication) cannot be planted, so they
remain covered only by the rule that Node's `lstat` is the sole detector (K11, H40). (3) `O_NOFOLLOW` does not exist on
Windows; the component and identity checks are the only guard (H40), exactly as accepted.

## 6. Characterization (Freeze §14.2, Amendment A2 item 4)

`repositories/cca-conformance/tools/mo1308-phase2c/characterize.mjs` measures the store at
the frozen 100,000-entry ceiling with the stand-in engine, so the values bound the
store's I/O plus a native-crypto verifier, not the real engine. Cloud values (Linux,
Node v22.22.0, one run, 99,999 existing entries, one member each, then the 100,000th):

| Operation | Time | Heap delta |
|---|---:|---:|
| Generate 99,999 entries and members on disk | 34.4 s | 7.3 MiB |
| `query` page of 1,000 (reads every entry, no members) | 14.2 s | 175.9 MiB |
| `verify` (reads every entry and member) | 16.4 s | 229.0 MiB |
| `append` of the last allowed entry (verify, then publish) | 16.1 s | 223.6 MiB |
| `export` (200,000 files written, each flushed and re-read) | 459.8 s | 381.0 MiB |
| `verify-export` | 7.5 s | 332.3 MiB |

Reads and appends are linear and dominated by reading the files. Export is the slow path
because every file is written exclusively, flushed and re-read for the identity check
(about 2.3 ms per file). Reference-host values (NTFS, where file creation is slower) are
recorded at binding.

## 7. Local binding plan (one run, reference Windows host)

Follows the MO-1307 and Phase 1 precedent. Worktree detached at the 2C head `$C`; Node
v24.21.0 (SHA-256 `ba4e6d11…6c32`); one validation generation, no silent retry, logs
kept and classified if any expected result is not met.

| # | Item | Expected |
|---|---|---|
| 1 | `memoryos-cli` `tests/history-store.test.mjs` | 24/24, 0 skipped (a symlink-privilege skip would be recorded as NOT_RUN and the receipt could not be PASS) |
| 2 | `memoryos-cli` `tests/history-store-windows.test.mjs` | 12/12, 0 skipped (W01b needs an app-execution alias; a skip is NOT_RUN and the receipt cannot be PASS) |
| 3 | `memoryos-cli` `npm test` | 81/81 |
| 4 | `cca-conformance` `tests/mo1308_*_test.mjs` | 19/19 |
| 5 | `cca-studio` `npm test` | 358/358 |
| 6 | `tests/mo1307_*_test.mjs` | 639/639 |
| 7 | `python tools\verify_workspace.py --root .` | exit 0, pass line only |
| 8 | CTest | `DEFERRED_TOOLCHAIN_ABSENT` (Amendment A3; mandatory before Phase 3) |
| 9 | Characterization | completes with exit 0 and a recorded value for every measured operation (a failed operation records no value and makes the tool exit non-zero) |
| 10 | Clean tree | empty |

**Generation history.** Generation 1 (evidence commit `2c5cf474`, `FAILED_PRESERVED`) passed its items but failed the
characterization: `characterize.mjs` predated Amendment A4.1 (entries without `decisionConsistency`), so every measured
operation returned an error while the tool exited 0 (a test-tooling fault). Generation 1 stays exactly as committed, with
no binding commit. The tool now follows A4.1 and exits non-zero on any failed operation; the Windows tests of section 5b
and the snapshot fix of section 5a are new. Generation 2 is a new run, one run, recorded under
`repositories/cca-conformance/evidence/mo1308/phase2c-g2/`; generation 1's directory is never overwritten.

Evidence commit (single-parent child of `$C`, adding only
`repositories/cca-conformance/evidence/mo1308/phase2c-g2/`, raw logs under the
`evidence/mo1308/**` `-text` rule) and a binding-only commit, as Phase 1. The receipt must
disclose the H40 qualification, the known limitations of section 5b, the snapshot fix of section 5a (contract-visible
`LEDGER_CONFLICT` mapping) and every Windows test run versus NOT_RUN. No `main` update, no tag.
