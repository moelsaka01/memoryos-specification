# MO-1308 Phase 2A ledger core

Status: **DEVELOPMENT COMPLETE IN THE CLOUD — BLOCKER-1 RESOLVED BY AMENDMENT A4.1 — NOT BOUND**.

This record describes Stream 2A of [MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md)
(section 18.1, with Amendments A1–A3) on branch `mo1308/phase2a-ledger`, created from
`1003289f` (the Phase 1 head). It is development evidence from the cloud container
(Linux, Node v22.22.0), not certification. The stream is bound later on the reference
Windows host under the pinned Node v24.21.0.

## 1. Deliverable

`repositories/cca-studio/web/js/memoryos-history-ledger.js` — the only production file
of this stream (Freeze §5.1, §18.1: "Identities, chain, verify, query, export model").
It imports only `memoryos-history-contract.js` and `mip-canonical.js` (R28), performs no
I/O, clock, randomness or process access (R29, R35, R37), and owns no state between
calls (AR-004). The SDK facade (`memoryos-sdk.js`) is **not** changed: the Phase 1
guards remain until Stream 2D.

| Freeze item | Content |
|---|---|
| §8.2 identities | `ledgerIdentifierOf`, `genesisDigestOf`, `entryDigestOf`, `recordDigestOf` with the `MEMORYOS-HISTORY-*` domains through the Standard's `D` and `JCS` (R02) |
| §13.2 `createHistoryLedger` | Descriptor bytes (exact JCS, no trailing LF) and `ledgerIdentifier` |
| §13.2 `verifyHistoryLedger` | §11.1 verification of descriptor, every entry and every retained member. Returns the frozen `MemoryOSHistoryVerification`, which is also the branded verified-ledger value (Amendment A2 item 2); the private state is held in a `WeakMap` |
| §13.2 `appendHistoryEntry` | Builds entry `n`; re-validates the closed `record` shape, member rules, `recordDigest`, Workspace subject, duplicate and purged rules |
| §13.2 `tombstoneHistoryEntry` | §10.1 rules: RECORD target, one tombstone per target, never a tombstone, closed reason, authority reference |
| §13.2 `queryHistoryLedger` | §11.2: chain verified first (not member bytes), index-ascending, kind/subject/retention filters, tombstones match on their target; the stored `decisionConsistency` (A4.1) |
| §13.2 `buildHistoryExport`, `verifyHistoryExport` | §12 export model: byte-identical for equal ledgers, retained members only, manifest and completion marker |
| Helpers for 2B and 2D | `isVerifiedHistoryLedger`, `historyLedgerEntries` (the parsed, frozen entries, a public Freeze shape), `historyLedgerView` (A4.1) |

## 2. Requirements touched

R02, R04, R05, R06 (module never modifies a file; it has no file access), R09 (rejected
appends change nothing), R10, R11 (Workspace subject), R18–R23, R24, R26 (entries, entry
size, descriptor size, subjects), R28, R29, R35, R36, R37. R13 (stored consistency, A4.1), R12, R14, R17, R25–R27, R30–R34
belong to other streams.

## 3. BLOCKER-1 resolved: Amendment A4.1 (stored `decisionConsistency`)

The Phase 2A report found that `decisionConsistency` cannot be derived by a query that
receives no member bytes. The owner resolved it in
[Amendment A4.1](mo1308-contract-freeze-1.md): the value is computed once, at admission of a
`HUMAN_DECISION_CLAIM`, from the verified bytes of the claim and of the readiness result it
references, and **stored in the claim's entry**; `query` returns the stored value and never
recomputes it. This stream implements it:

- **Shape (contract module, an identical commit in every Phase 2 stream).** The entry
  `record` gains the required member `decisionConsistency`: `null` for every kind except
  `HUMAN_DECISION_CLAIM`, where it is `"CONSISTENT"` or `"CONTRARY_TO_READINESS"`. The
  entry digest covers it. The validators, the 54-case shape fixtures and the Phase 1
  characterization tool follow. This changes the Phase 1 contract module and fixtures,
  which A4.1 authorizes; no identity vector existed.
- **Append.** `appendHistoryEntry` stores a claim only against a retained
  `READINESS_RESULT` entry carrying its three digests, else `DECISION_UNBOUND`. It stores
  the value admission computed and never guesses one. A claim record with no value, an
  unknown value, or a value on another kind is `RECORD_INVALID`.
- **Query.** Returns the stored value for a claim record entry and `null` for every other
  entry and every tombstone. It needs no member bytes, and the value survives a purge of
  the claim or of the readiness result.
- **Interface for admission (2B).** `historyLedgerView(ledger)` returns `{workspaceIdentifier,
  entries, members}`, where `members` is a snapshot copy of the retained bytes of
  `READINESS_RESULT` records only, so admission can re-verify the referenced result.

Tests L14, L14b and L14c replace the former fail-closed pin: stored value returned by
query without members, covered by the entry identity (a flipped value breaks the chain),
surviving purges; and a claim whose readiness result is absent, in another ledger,
partially matching or purged is rejected and nothing is stored.

## 4. Interpretations made inside the Freeze text (confirm or amend)

Each is the literal reading of the Freeze text or the narrowest one; each lives in one
place and is isolated by a test, so an amendment is a small change.

| # | Point | Reading implemented |
|---|---|---|
| I1 | `purgePending: [Index]` (§10.2, §11.1) | The **target** entry index of each tombstoned record that still has member bytes (the index the operator re-runs `--target` with) |
| I2 | `pendingArtifacts` (§11.1) | Staging files are a filesystem fact; the pure verifier returns `0` and the file store (2C) overlays the true count |
| I3 | Tombstone entry in a query result (§11.2) | `recordKind`, `recordDigest`, `admission`, `workspaceAssociation`, `retention`, `tombstoneIndex`, `decisionConsistency` are `null` and `subjects` is `[]`; matching uses the target's kind, subjects and PURGED retention |
| I4 | `nextIndex` (§11.2) | The index of the next *matching* entry after the page, else `null` |
| I5 | Verified-ledger value (§13.2) | The verification object itself is the branded ledger value; `appendHistoryEntry` accepts the `record` object as `admission`. The `admission` brand and the `ledger` hand-off to 2B are 2D facade concerns (the Phase 1 SDK already holds `historyAdmissions`) |
| I6 | Export file order (§12) | `files` is path-ordered; the store must write the completion marker last |
| I7 | `verify-export` codes (§14.1) | Manifest, marker, file-set and file-digest failures are `EXPORT_CORRUPT`; ledger-content failures keep their §11.1 code (`LEDGER_CORRUPT`, `RECORD_BYTES_MISMATCH`) |
| I8 | Append needs members | `appendHistoryEntry` needs the verified ledger, and `verifyHistoryLedger` verifies every retained member (§11.1, §9.2 step 1), so a store passes all retained members on append. Memory is then bounded by the retained bytes, not by entry count |
| I9 | Truncation | Removing the last entries leaves a valid shorter ledger: the head is the highest contiguous index and there is no head file (§9.1). Not detectable by design |

## 5. Tests

`repositories/cca-conformance/tests/mo1308_phase2a_ledger_test.mjs` (25 tests: L01–L23, L14b, L14c),
checked against an independent oracle (`node:crypto` and a local canonical serializer),
with a single-byte tamper corpus over the descriptor, every entry and every export file,
and re-sealed forgeries. The verifier's key conditions were mutation-checked during development (each removed condition fails a test); that is not a committed test. In the
cloud container (Linux, Node v22.22.0): 25/25.

| Suite | Result |
|---|---|
| `cca-conformance` `tests/mo1308_*_test.mjs` | 44/44 (19 Phase 1 + 25 here), with tag `memoryos-1.3-mo1302` fetched locally (without it WC07 fails as an environment defect, not a product defect) |
| `cca-studio` `npm test` | 358/358 (the contract and fixture tests now declare the 54-case A4.1 fixtures) |
| `memoryos-cli` `npm test` | 45/45 (unchanged) |
| `tools/verify_workspace.py` | Only the pre-existing Linux `MO-1304 … INSTALL_TOOLCHAIN` error |

The studio test list is not edited by this stream (the new tests live in
`cca-conformance`, run by the `mo1308_*_test.mjs` glob) so 2A, 2B and 2C stay disjoint.

Needs the Windows host: nothing in 2A is platform-specific; the whole stream is
re-run there under Node v24.21.0 (B-run below) and the 122 native MO-1307 tests,
the pinned Node check and `verify_workspace.py` without the MO-1304 error remain
host-only.

## 6. Characterization (Freeze §14.2, Amendment A2 item 4)

`repositories/cca-conformance/tools/mo1308-phase2a/characterize.mjs` measures generate,
query, verify, export and verify-export at the frozen limit (100,000 entries). Values are
recorded, not pass/fail. Cloud values (Linux, Node v22.22.0, one run, 100,000 entries
of 3 subjects each, one retained member each):

| Operation | Time | Heap delta |
|---|---:|---:|
| Generate 100,000 entries (identities included) | 14.1 s | 61.7 MiB |
| Query page of 1,000 (chain verify + filter) | 18.9 s | 183.5 MiB |
| Query with a subject filter over the full ledger | 18.1 s | 180.4 MiB |
| Verify (chain and members) | 21.2 s | 230.6 MiB |
| Build export (verify + manifest) | 32.7 s | 279.6 MiB |
| Verify export | 33.5 s | 469.3 MiB |

Every operation is linear in the entry count (about 0.2 ms per entry for a chain
verify). A query or an append must verify the whole chain first (§11.2, §9.2), so each
takes about 19–21 s at the 100,000-entry ceiling; a Freeze consequence, not a defect.
The reference-host numbers are recorded at binding.

## 7. Local binding plan (one run, reference Windows host)

Follows the MO-1307 and Phase 1 precedent. Worktree detached at the 2A head `$A`; Node
v24.21.0 (SHA-256 `ba4e6d11…6c32`); one validation generation, no silent retry, logs
kept and classified if any expected result is not met.

| # | Item | Expected |
|---|---|---|
| 1 | `tests/mo1308_phase2a_ledger_test.mjs` | 25/25 |
| 2 | `tests/mo1308_*_test.mjs` | 44/44 |
| 3 | `cca-studio` `npm test` | 358/358 |
| 4 | `memoryos-cli` `npm test` | 45/45 |
| 5 | `tests/mo1307_*_test.mjs` | 639/639 |
| 6 | `python tools\verify_workspace.py --root .` | exit 0, pass line only |
| 7 | CTest | `DEFERRED_TOOLCHAIN_ABSENT` (Amendment A3; mandatory before Phase 3) |
| 8 | Characterization | completes with exit 0 and a recorded value for every measured operation (a failed operation records no value and makes the tool exit non-zero) |
| 9 | Clean tree | empty |

**Generation history.** Generation 1 (evidence commit `d9249b83`, `FAILED_PRESERVED`) passed items 1 to 6 and failed
item 8: `characterize.mjs` predated Amendment A4.1 and built entries without `decisionConsistency`, so the contract
rejected the ledger at the first query (a test-tooling fault, not a product or environment fault). Generation 1 stays
exactly as committed. The tool now generates A4.1 entries (`decisionConsistency` is `null` for every record it builds,
because it builds only `MIP_PACKAGE` records) and exits non-zero if any measured operation returns an error. Tooling
only: no production file and no test assertion changed. Generation 2 is a new run, one run, recorded under
`repositories/cca-conformance/evidence/mo1308/phase2a-g2/`; generation 1's directory is never overwritten.

Evidence commit (single-parent child of `$A`, adding only
`repositories/cca-conformance/evidence/mo1308/phase2a/` (generation 2: `phase2a-g2/`), raw logs under the
`evidence/mo1308/**` `-text` rule) and a binding-only commit, as Phase 1. The receipt
records that this stream changes the Phase 1 contract module and fixtures under
Amendment A4.1 (item 3 re-runs them). No `main` update, no tag.
