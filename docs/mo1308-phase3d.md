# MO-1308 Phase 3D final integration: read-only validator and I3 inventory builder

Status: **AUTHORED AND REHEARSED IN THE CLOUD — NOT RUN FOR REAL**. Stream 3D of the [Phase 3 protocol](mo1308-phase3-protocol.md)
(Freeze Amendment A8, section 34), on branch `mo1308/phase3d`. It reads only; it creates no tag, no push and no approval, and
nothing here is evidence.

## 1. Tools (`repositories/cca-conformance/tools/mo1308-phase3d/`)

| File | Role |
|---|---|
| `validate.mjs` | the checks, one per 3D case; `evaluate()` returns the report and the gathered context |
| `validate-final.mjs` | the read-only command line. Exit 0 for `CERTIFIED_READY_TO_TAG` or `I3_VALID_PENDING_BF`, 1 for `NOT_READY`, 2 for an input error. Writes nothing and executes no product or test |
| `i3-inventory.mjs` | builds the I3 inventory from a state the validator calls ready (it refuses `NOT_READY`); read-only unless `--write` (created exclusively, only at `repositories/cca-conformance/mo1308-final-release-inventory.json`) |
| `cases.mjs`, `campaign.mjs` | the ten cases wired to the shared runner (`rehearse`, and `seal`/`run`/`close` for the validator run after BF) |

Result tokens: `NOT_READY`; `I3_VALID_PENDING_BF` (every case READY except D7, which waits for the binding-only child; HEAD is I3);
`CERTIFIED_READY_TO_TAG` (every case READY and HEAD is the binding-only BF child of a valid I3). Per case: `READY`, `NOT_READY`
with reasons, and for D7 `PENDING_BF`.

## 2. What each case checks

| Case | Recomputed from immutable inputs |
|---|---|
| D1 | HEAD descends from B2; the candidate identity re-verifies against HEAD; no commit after B2 touches a production path (each commit against each parent) |
| D2 | every generation directory under `evidence/mo1308/` verifies (`verifyEvidence`); per stream exactly one accepted certifying generation, the latest; every earlier one is `FAILED_PRESERVED` or `ESCALATED_PRESERVED`, superseded by the next with the prior evidence-seal hash and a valid disposition (shape, generation, seal, `NEW_GENERATION`, ordinal, owner approval reference); rehearsals are listed but never accepted and must be non-certifying and non-promotable; the accepted 3A generation binds the A3.2 receipt that D5 reads |
| D3 | R01–R37 are exactly the inventory list and each has a PASS case in an accepted generation (a requirement whose cases are all 3D cases is proven by D4/D5 of the same run) |
| D4 | a retained regression record (below) for this production tree, naming a commit that is HEAD or its ancestor, with suites `mo1308`, `cli`, `studio`, `mo1307` (639 tests) and `examples`, each a clean pass with a raw-log digest |
| D5 | the A3.2 receipt exists and its `verdict` is `PASS` |
| D6 | Q01–Q15 are in the register and `docs/mo1308-release-disclosures.md` states the recorded outcome of every qualification case and DISCLOSED for each structural one (the shared disclosure check) |
| D7 | `mo1308-final-release-inventory.json` is in HEAD (I3); if `mo1308-final-binding.json` is also in HEAD, HEAD is a single-parent child of I3 that adds exactly that one file and edits nothing, the binding names the inventory by hash and I3 by commit, and does not contain its own hash; a `memoryos-1.3-mo1308` tag, if it exists, targets exactly that BF (none is created) |

### Step E (moved from 3C by the owner, A8.7)

| Case | Recomputed |
|---|---|
| E1 (was 3C-K1) | README, ROADMAP, RELEASE_NOTES, KNOWN_ISSUES, ARCHITECTURE and the CLI documents contain no unnegated claim beyond the Freeze (tamper-proof, encrypted, signed, authenticated, multi-user, shared storage, cloud, conformance claims on a MO-1308 line); every Q01–Q15 is in the disclosures |
| E2 (was 3C-K2) | a document gives the headDigest anchoring guidance and states the recorded outcome of 3C-A6 from the accepted 3C generation |
| E3 (was 3C-K3) | the disclosures state the recorded outcome of every qualification case and DISCLOSED for each structural one (shared disclosure check) |

## 3. Rehearsal against the current state

`validate-final.mjs` on the real repository: `NOT_READY`; D1 READY (the candidate and every commit since leave the 45 production paths
byte-identical); D2–D7 and E1–E3 NOT_READY (no certifying evidence, no regression record, no disclosures, no I3). D5 reads the real A3.2 receipt now merged from the precondition branch: its `verdict` is `FAILED_PRESERVED` (A3.2 rule 2: `memoryos.vscode.runtime` passes on BF and fails on B2), so D5 is NOT_READY for that reason. This confirms that the verdict member is `verdict`.
`campaign.mjs rehearse` ends `REHEARSAL_FAILED` at D2 (the first mandatory failure stops the generation, as designed). The test
`mo1308_phase3d_test.mjs` also fabricates a complete local clone (three accepted generations, receipts, disclosures, regression
record) and walks it through `NOT_READY` → I3 → `I3_VALID_PENDING_BF` → `CERTIFIED_READY_TO_TAG`, plus tamper and rehearsal negatives.

## 4. Inputs the protocol does not fix (assumptions to confirm)

1. **A3.2 receipt member.** Confirmed from the real receipt: `receipt.json` → `verdict`; the validator requires `"PASS"`.
2. **Regression record.** D4 needs the retained full regression as a bound input; no format exists. The validator expects `evidence/mo1308/phase3d/regression.json` of kind `MO1308Phase3RegressionRecord` (`commit`, `candidate.productionTreeDigest`, `suites[] {name, passed, failed, skipped, total, exitCode, logSha256}`).
3. **Dispositions.** The protocol defines the record but not its location. The validator finds `MO1308Phase3Disposition` files anywhere under `evidence/mo1308/` whose path contains "disposition", by hash, through the successor generation's `supersedes.dispositionSha256`.
4. **File names.** `docs/mo1308-release-disclosures.md`, `mo1308-final-release-inventory.json` (I3) and `mo1308-final-binding.json` (BF) follow MO-1307's pattern and are not yet fixed by the protocol.
