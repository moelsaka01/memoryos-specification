# MO-1308 Freeze Amendment A10 (Freeze section 37): Phase 3A findings, corrections and accepted items

Status: **owner-authorized 2026-10-07 (append-only, dated)**. It is the text of section 37 of
[MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md), to be merged after section 36. It changes no frozen shape, layout, limit, identity or error
code. It corrects four defects found by the Phase 3A Windows rehearsals on candidate `b0bf2d56` and records the items the owner accepted. The
candidate changes: a new candidate, binding and A3.2 differential follow as separate steps. The Phase 3A generation-2 F7 escalation on the old candidate
needs no rerun.

## 37.1 Corrections (branch `mo1308/phase3-corrections`, product paths `memoryos-cli/bin/memoryos.js` and `memoryos-cli/src/history-store.js`)

| # | Case | Before (b0bf2d56) | After | Regression test |
|---|---|---|---|---|
| 1 | 3A-L3 | a closed stdout pipe raised an unhandled EPIPE: stack trace with source paths on stderr, exit 1, even after a committed `init` or `append` | stream errors on stdout and stderr are swallowed in the entry file; nothing is printed; the exit code is the command's own | `tests/closed-output.test.mjs` L3a-L3c |
| 2 | 3A-D4 | an exclusive create at a staging name that held a planted dangling link or junction followed it on Windows and created the target | `writeFileExclusive` lstat-checks the name first and refuses a link with `MO1308_FILESYSTEM_BOUNDARY` before any create | `history-store-windows` W09 |
| 3 | 3A-G3 | a purge deleted same-named files outside the ledger when the record directory was swapped for a junction after the tombstone commit | the record-directory identity (dev/ino) is captured when the ledger is read; before every deletion and the final rmdir the ledger root, `records/` and the record directory are proven not to be links, canonical, and identical to the captured identity; any mismatch is `MO1308_FILESYSTEM_BOUNDARY` and deletes nothing | W10 |
| 4 | 3A-F7 | staging names `<role>.<n>` were contended by concurrent writers; a name still delete-pending gave EPERM (typed IO) in 2 of 10 runs | staging names are `<role>.<pid>.<n>` (the first free counter per process); the §9.1 layout says only "`.pending/` staging only", so no frozen text changes; EPERM is not retried | W11 |

New or refined behaviour: **output rule (new)**. An operation that was carried out is never reported as failed because its output could not be
written, and a failure whose error output cannot be written keeps its exit category; neither prints anything about the write failure. The Freeze did not
define this case. Staging names (K3) are refined to carry the writer's process id; the process id is neither a clock nor randomness (R35) and no
history byte depends on it.

## 37.2 Disclosed residual races (H40, Q01)

* **D4:** a link planted after the lstat of a staging name and before its create is not prevented; the post-write identity checks still detect it after the fact.
* **G3:** a swap of the record directory between the pre-deletion check and the unlink of one member is not prevented; at most that one member name is
  followed. A swap before the check is refused with nothing deleted.
* A swap during an operation is detected after the fact, never prevented (Q01 unchanged).

## 37.3 Accepted items

1. **G1, G2, G4, G6:** during a swap race a member, an entry or an export file may be created outside the ledger before the typed failure (H40).
2. **D8 name forms:** an alternate data stream is accepted as an input file (the bytes of the named stream); ledger or export names with a trailing dot or
   space, or a reserved device name, are created and addressed as exactly those literal names (Node uses the extended-length form); there is no
   aliasing to the stripped name. Disclosed with the Q01 and Q15 text.
3. **L4:** the host's system clock and time zone are system settings the harness does not change; 3A-L4 runs the product with other `TZ` values and a shifted
   `Date` (`clock-shift.mjs`) and compares every byte. Protocol note to 9.1 step L.
4. **JC6 / Q11:** the pre-registered threshold is 8 minutes: CONFIRMED when the 100,000-entry export takes at least 8 minutes, otherwise NOT_CONFIRMED.

## 37.4 Evidence of the staging-name fix (3A-F7 concurrency workload on the corrected product)

The 3A-F7 workload (10 appender processes of 3 records each started together by a barrier, 2 readers, the observation preload in errors-only mode) was run 20 times on the corrected product (worktree with the corrected `history-store.js` and entry file): **staging EPERM in 0 of 20 runs** (two batches of 10: 0 and 0; owner decision D6 escalates at 2 of 10). On b0bf2d56 the same workload gave 2 of 10 (runs 7 and 10, one typed IO each). Every run kept the contract: every success present once, every absent record a typed failure, chain valid, readers never saw an integrity or boundary code.

This amendment is append-only; the frozen text and Amendments A1 to A9 and A3.1 to A3.4 are unchanged.
