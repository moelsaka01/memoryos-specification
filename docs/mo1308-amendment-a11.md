## 38. Amendment A11 — the entry-count limit is tested first (2026-10-08, owner-authorized)

Status: **owner-authorized 2026-10-08 (append-only, dated)**. It is also the file `docs/mo1308-amendment-a11.md` of branch `mo1308/phase3-corrections-2`, to be merged after section 37. It changes no frozen shape, layout, limit, identity or error code: it makes the product do what section 14.2 and the error table already say. The owner decided to correct the product, not to amend the Freeze or the Phase 3 protocol.

### 38.1 The defect (found by the non-certifying Phase 3A rehearsal r6, case 3A-JC9, candidate `f4211c8c`)

With a ledger holding exactly 100,000 entries, a further valid `append` was refused with exit 2 `MO1308_RECORD_INVALID` (stage `ADMISSION`) instead of `MO1308_RESOURCE_LIMIT`. Cause: `appendHistoryEntry` (`repositories/cca-studio/web/js/memoryos-history-ledger.js`) built the would-be entry with `index = 100000` and ran the entry shape check on it before the limit test in `sealEntry`; the shape check allows indexes up to 99,999 only (`maximumIndex`), so the shape check failed first and masked the limit. The refusal was clean (nothing written), only the code was wrong. The code was the same in `b0bf2d56` and the Phase 2 code; Amendment A10 did not touch it.

### 38.2 The correction (one production path)

`appendHistoryEntry` tests `state.entries.length >= entriesPerLedger` right after the ledger handle is resolved and before any shape check, and fails with `RESOURCE_LIMIT`, stage `PUBLICATION` (the code and stage the limit test in `sealEntry` already used), exit category 2, nothing written. Changed production path: `repositories/cca-studio/web/js/memoryos-history-ledger.js` (in the candidate's import closure through `memoryos-sdk.js`). `memoryos-history-admission.js` and `mip-canonical.js` are NOT changed, so the SHA-256 review of 3C-D9 stays valid.

### 38.3 Other limits checked for the same ordering problem

Every Freeze section 14.2 limit on the append, admission, tombstone and read paths was traced to the check that enforces it and to the checks before it:
* **Entries per ledger, append:** the defect above (fixed). **Tombstone** on a full ledger: no shape check on the would-be entry, the limit test in `sealEntry` is reached after the target checks (`TOMBSTONE_INVALID` for an invalid target first, as for any invalid request), so a valid tombstone of a full ledger gives `RESOURCE_LIMIT`; unchanged.
* **Entries per ledger, read:** `verifyChain` tests `entryBytesList.length` before any entry is decoded; the store tests the entry-file count before the name and size checks. Unchanged.
* **Entry bytes (16,384):** tested on the encoded entry in `sealEntry` after construction, and by `decodeHistoryBytes` before parsing on read. Not masked.
* **Descriptor bytes (1,024):** tested before parsing. **Member bytes and total member bytes** (admission): tested after the member-set name check and before the owner's verifiers; an oversized member under an invalid member set is `RECORD_INVALID` (the stronger fault), an oversized member of a valid set is `RESOURCE_LIMIT`. Unchanged.
* **Subjects per entry (16):** a record whose admission would produce more than 16 subjects would fail the entry shape check (`RECORD_INVALID`) and not `RESOURCE_LIMIT`. No record kind produces more than four subjects (the subject sets are fixed by construction in the admission methods), so this is not reachable and nothing was changed.
* **Query limit, authority reference and ledger name maxima, reported anomalies, CLI JSON stdout (4,194,304):** input-shape rules (`USAGE`) or truncation rules, not resource refusals that a shape check can mask. Unchanged.
No other masked limit was found.

### 38.4 Regression tests (fail on `f4211c8c`, pass after)

`repositories/memoryos-cli/tests/history-limit-order.test.mjs` (L01, L02): the real SDK is loaded from a copy of `cca-studio/web` whose two ledger limits are made tiny (`entriesPerLedger` 3, `maximumIndex` 2; the replacement is asserted), so the unmodified ordering logic is exercised through the real file store without a 100,000-entry ledger: after three appends the fourth gives `MO1308_RESOURCE_LIMIT` at stage `PUBLICATION` and the ledger directory is byte-identical (nothing written, staged or removed); a ledger at a limit of four accepts four appends and refuses the fifth. On `f4211c8c` L01 and L02 fail with `RECORD_INVALID` / `ADMISSION`. The Phase 3A case 3A-JC9 (the real 100,001st append) is the end-to-end check at the next rehearsal.

### 38.5 What follows

Not part of this amendment, and not done: the binding of the correction branch, the A3.2 differential and the candidate move (new identity, protocol and inventory hashes, a note in the style of A8.8 and A8.9), then the rehearsals and the harness reviews on the new candidate. The candidate `f4211c8c` stays the candidate until that step.

This amendment is append-only; the frozen text and Amendments A1 to A10 are unchanged.
