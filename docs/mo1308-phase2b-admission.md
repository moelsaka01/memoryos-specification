# MO-1308 Phase 2B admission

Status: **DEVELOPMENT COMPLETE IN THE CLOUD, AMENDED BY A4.1 AND A4.5 — NOT BOUND**.

This record describes Stream 2B of [MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md)
(section 18.1, with Amendments A1–A3) on branch `mo1308/phase2b-ingest`, created from
`1003289f` (the Phase 1 head). It is development evidence from the cloud container
(Linux, Node v22.22.0), not certification. The stream is bound later on the reference
Windows host under the pinned Node v24.21.0. It is independent of Stream 2A: it imports
nothing from `memoryos-history-ledger.js`.

## 1. Deliverable

`repositories/cca-studio/web/js/memoryos-history-admission.js` — the only production file
of this stream (Freeze §5.1, §18.1: "Seven admission methods"). It exports one function,
`admitHistoryRecord({recordKind, members, ledger})`, and returns the closed `record`
object of a RECORD entry (`recordKind`, `recordDigest`, `admission`, `members`,
`workspaceAssociation`, `subjects`), deeply frozen. It builds no entry and no chain:
that is Stream 2A's `appendHistoryEntry`.

Direct imports: `mip-canonical.js`, `memory-investigation-package.js` (MIP-001),
`investigation-policy-engine.js` and `policy-canonical.js` (Policy),
`regression-policy-fact-source.js` (Regression) and `memoryos-history-contract.js`. It
imports no SDK, Investigation Core, filesystem, network, process, clock or predecessor
package (R28, R29, R35, R37), and never calls `verifyReadiness` or `windows-inspect.ps1`
(R08). The Policy and Regression modules themselves import the Core, so it is loaded
transitively; no history code reaches it directly.

| Kind | `admission` | What is checked (Freeze §7.3) |
|---|---|---|
| `MIP_PACKAGE` | `MIP_001_VERIFIED` | `verifyMemoryInvestigationPackage` accepts `package.mip`; package Workspace equals the ledger Workspace (`WORKSPACE_MISMATCH`) |
| `INVESTIGATION_CHECKPOINT` | `CORE_LOG_VERIFIED_STATE_ISSUED` | Exactly the Standard's nine-member projection as JCS; every transition identity, the published prefix-digest chain, log digest and count; the checkpoint identifier; transition 0 `CREATED` (`sourceKind` `mip`, the ledger Workspace); transition 1 `PACKAGE_IMPORTED` whose package passes the MIP-001 verifier. `stateDigest` is retained as issued, not re-derived. A native checkpoint is rejected |
| `POLICY_EVALUATION` | `SDK_POLICY_ARTIFACTS_VERIFIED` | Exact canonical bytes; `validateEvaluationIdentity`; `validatePolicyEvaluationOutcome` with the supplied identity as `expectedIdentity`; the outcome's `evaluationIdentityDigest` equals the identity digest |
| `REGRESSION_REPORT` | `SDK_REGRESSION_REPORT_INSPECTED` | `parseDetachedCognitiveRegressionReport` (the module behind `inspectRegressionReport`: closed shape and identifier recomputation); both Workspaces equal the ledger Workspace. Regression is never recomputed |
| `CICD_RUN` | `MO1306_BUNDLE_INTEGRITY_VERIFIED` | MO-1306 §9 rules that need no installation: exact cardinality (6 or 4) and basenames; canonical `J`; the four closed MO-1306 shapes; artifact-manifest sizes, digests and basename order; marker manifest digest; `runId` consistency; result/projection/exit agreement and the error catalog (§8); result–evidence cross-hashes; input-role order; and, when present, the two normative artifacts through the Policy checks with the result's `semantic` digests, `artifactKind`, `semanticDigest` and `decision` |
| `READINESS_RESULT` | `MO1307_SELF_DIGESTS_RECOMPUTED` | Canonical `J` with MO-1307's limits; top-level members, `kind`, `version`; recomputation of `readinessDigest` and `proofBindingDigest` per MO-1307 §14 |
| `HUMAN_DECISION_CLAIM` | `MO1307_DECISION_CLAIM_BOUND` | Canonical `J`; the exact MO-1307 §13 shape and value rules; `authenticity` `NOT_VERIFIED_BY_MEMORYOS`; binding (H16) to a retained `READINESS_RESULT` entry with equal `candidateDigest`, `readinessDigest` and `proofBindingDigest`. **Amendment A4.1:** the referenced result's retained bytes are checked against the entry, re-verified with the readiness self-digest rules, and `decisionConsistency` is computed from the claim and the result (section 3a) |

The returned record carries `decisionConsistency` (A4.1): `null` for every kind except
`HUMAN_DECISION_CLAIM`.

Every kind also enforces its exact member name set (`RECORD_INVALID`), the per-kind
member and total byte limits (`RESOURCE_LIMIT`), duplicates (`RECORD_DUPLICATE`) and
purged re-supply (`RECORD_PURGED`, H23). Subjects are copied from the owner's verified
values, sorted strictly ascending by `(type, value)` (Amendment A2).

## 2. Requirements touched

R01 (closed record), R02 (`recordDigest`), R03 (`J` equivalence, differential against
both predecessors' parsers), R07 (per-kind matrix), R08, R09 (pure: a rejected
admission changes nothing), R10, R11, R12 (admission side), R13 (binding; consistency
is never stored), R20, R24, R26 (per-kind limits), R28, R29, R35, R37. R14, R15–R19,
R21–R23, R25–R27 belong to other streams.

## 3a. Amendment A4.1: `decisionConsistency` at admission

[Amendment A4.1](mo1308-contract-freeze-1.md) moves the derivation of `decisionConsistency` to
admission. For a `HUMAN_DECISION_CLAIM`, admission finds the retained `READINESS_RESULT`
entry whose three digests equal the claim's, reads its retained bytes, requires them to equal
the entry's recorded member length and digest, re-verifies them (canonical `J`, both
self-digests, closed `readiness` set, the claim's three digests), and computes:
`APPROVE` with `NOT_READY` or `COULD_NOT_EVALUATE` is `CONTRARY_TO_READINESS`; every other
pair is `CONSISTENT`. Absent or purged result or unavailable bytes: `DECISION_UNBOUND`;
recorded bytes that differ: `RECORD_BYTES_MISMATCH`; a result that does not verify or does
not carry the claim's digests: `RECORD_INVALID`. Nothing is stored for a rejected claim.
Interpretation **J2 is superseded**: a purged readiness result no longer binds a new claim.

The ledger view gains the optional member `members`, a `Map` from record digest to the
retained `[{name, bytes}]` of `READINESS_RESULT` records; Stream 2A's `historyLedgerView`
supplies it. Without it no claim can be admitted. The contract module's closed `record`
shape gains `decisionConsistency` in a commit identical to the one in Streams 2A and 2C.

## 3b. Amendment A4.5: linear checkpoint admission

The Standard's prefix digest `D(LOG, id, "[" + t0 + "," + … + ti + "]")` was re-hashed from the
start for every transition. SHA-256 is a streaming hash, so the module now keeps one
running state per log (`"MIP-1" NUL domain NUL id NUL "["` and the transitions so far) and
finishes a copy with `"]"` for each prefix: each transition is absorbed once. The module
carries its own incremental SHA-256 (the canonical module's hash cannot be resumed). All
digests, errors and subjects are unchanged.

Proof of identical results: B28 pins the incremental hash to the standard one for every
length 0–300, random splits, clones and the NIST vectors; B29 runs 29 corpus and tampered
variants through the new code and through a **verbatim copy of the previous algorithm**
(`tests/support/mo1308-legacy-checkpoint-oracle.mjs`) and compares accept/reject, error
code and stage, and subjects; B30 does so for generated checkpoints of 2, 5, 64, 500, 2,500
and 10,000 transitions (the oracle uses native hashing so 10,000 finishes; the 10,000 case
alone takes about two minutes) and checks that a forged prefix digest at the deepest
transition is rejected identically and that 10,001 transitions are refused.

## 3. Interface for Stream 2D

Admission is independent of Stream 2A, so `ledger` is plain data, not a 2A object:
`{ workspaceIdentifier, entries, members }` with the parsed, frozen `MemoryOSHistoryEntry`
values and the retained readiness bytes (the facade builds it from 2A's verified ledger with
`historyLedgerView(ledger)`). The facade applies the SDK `admission` brand
(the Phase 1 guard already keeps the `historyAdmissions` set) and hands the record to
2A's `appendHistoryEntry`. Admission validates the view with the contract's
`validateEntry` and fails `USAGE` on a malformed view or call.

## 4. Interpretations inside the Freeze text (confirm or amend)

| # | Point | Reading implemented |
|---|---|---|
| J1 | Ledger input | Plain `{workspaceIdentifier, entries}` view (section 3), a private detail needed to keep 2A and 2B independent |
| J2 | Claim bound to a purged readiness result (§7.4) | **Superseded by A4.1**: a purged result has no retained bytes to verify, so it does not bind (`DECISION_UNBOUND`) |
| J3 | Order of checks | Call shape, kind, member names and limits, then duplicate/purged (cheap, bytes are digest-identical), then the owner's verification |
| J4 | Error for each failure class | Malformed call or view `USAGE`; unknown kind (SDK guard precedent), wrong member set, any owner failure `RECORD_INVALID`; byte limits `RESOURCE_LIMIT`; Workspace `WORKSPACE_MISMATCH`; claim `DECISION_UNBOUND` |
| J5 | `POLICY_EVALUATION` and the SDK | The history authority may not import the SDK or the Core, and the SDK's detached verifiers sit behind a Core-owned integration object. Admission composes the same Policy-module functions those verifiers call. Equivalence with the SDK verifiers is proved differentially (B07), not assumed |
| J6 | Checkpoint private limits | Parse depth 256 and 4,194,304 values; at most 10,000 transitions (the Core's published count policy). The Freeze fixes only the 32 MiB byte limit |
| J7 | MO-1306 tables | The four closed shapes, the error catalog, the projection table and the semantic-code allowlist are embedded as data copies of the MO-1306 contracts (a predecessor import is forbidden). Drift is guarded by B24 (result rules agree with MO-1306 `checkResult` over the whole catalog space) and B25 (allowlist equals the owner list) |
| J8 | Installation-bound CI digests | `distributionSha256`, `runtimeClosureSha256`, `semanticContractSha256` and the installed adapter digest are retained as recorded, not re-verified, as §7.3 states; the bundle directory name cannot be compared with `runId` because admission receives members, not a path |
| J9 | Readiness result shape | Only the top-level closed members, `kind`, `version`, `assessment.candidateDigest` shape and the two recomputed digests are checked (§7.3 lists no more); the assessment, audit, gates and graph are not re-derived |
| J10 | `MIP_PACKAGE` extensions | The frozen call has no extension option, so a package that requires an unsupported extension is rejected (`RECORD_INVALID`) |
| J11 | `POLICY_EVALUATION` subjects | `EVALUATION_IDENTITY_DIGEST` is the outcome's `evaluationIdentityDigest`; `OUTCOME_DIGEST` is the domain-separated digest of the outcome bytes (the SDK verifier's `outcomeDigest`) |

## 5. Disclosed limits (recorded, not hidden)

- **`POLICY_EVALUATION` is inspection, not re-evaluation.** The SDK's own detached
  verifiers report `authority: "inspectionOnly"`. A digest-valued data field inside the
  outcome result can be changed and the artifact still verifies, in the SDK and here
  (B07 pins the identical behavior). Admission proves a well-formed pair that is bound to
  its identity, not that the outcome is the genuine evaluation outcome.
- **`READINESS_RESULT` is not a MO-1307 verification.** A result re-sealed over a changed
  assessment is integrity-consistent and is admitted (B13 pins this), as the Freeze row
  states.
- **Identity is integrity, not origin** (H07): a self-consistent forged Regression report
  or checkpoint is admitted.
- **Checkpoint cost.** Resolved by A4.5; see sections 3b and 7.
- **Accepted limits (A4.4).** The first two bullets above are recorded by Amendment A4.4 as known limits, not defects.

## 6. Tests

`repositories/cca-conformance/tests/mo1308_phase2b_admission_test.mjs` (30 tests, B01–B30).
Positive corpus: the repository's reference MIP, a Core checkpoint, every released
Policy and Policy Set artifact pair, a Core regression report, all 217 real MO-1306
bundles under `evidence/mo1306` (completed and operational-failure), all 16 released
MO-1307 results and all 12 released decision fixtures. Negative corpus: single-byte
flips, self-consistent re-sealed forgeries (checkpoint chain, bundle hashes, readiness
digests), shape and limit boundaries, and differential tests against the owners
(SDK verifiers, `inspectRegressionReport`, MO-1306 `parseJSON` and `checkResult`,
MO-1307 `parseCanonical`). The module's key conditions were mutation-checked during
development (each removed condition fails a test); that is not a committed test. In the
cloud container (Linux, Node v22.22.0): 30/30.

| Suite | Result |
|---|---|
| `cca-conformance` `tests/mo1308_*_test.mjs` | 49/49 (19 Phase 1 + 30 here), with tag `memoryos-1.3-mo1302` fetched locally (without it WC07 fails as an environment defect, not a product defect) |
| `cca-studio` `npm test` | 358/358 (unchanged) |
| `memoryos-cli` `npm test` | 45/45 (unchanged) |
| `tools/verify_workspace.py` | Only the pre-existing Linux `MO-1304 … INSTALL_TOOLCHAIN` error |

The studio test list is not edited by this stream (the tests live in `cca-conformance`,
run by the `mo1308_*_test.mjs` glob) so 2A, 2B and 2C stay disjoint. The tests read the
repository's released evidence read-only; nothing is written.

Needs the Windows host: nothing in 2B is platform-specific; the stream is re-run there
under Node v24.21.0 with the 122 native MO-1307 tests, the pinned Node check and
`verify_workspace.py` without the MO-1304 error.

## 7. Characterization (Freeze §14.2, Amendment A2 item 4)

`repositories/cca-conformance/tools/mo1308-phase2b/characterize.mjs` measures admission
of the reference MIP, checkpoints of 2, 100, 1,000 and 3,000 transitions and readiness
results of increasing size. Values are recorded, not pass/fail. Cloud values (Linux,
Node v22.22.0, one run):

| Admission | Input | Before A4.5 | After A4.5 | Heap delta (after) |
|---|---:|---:|---:|---:|
| `MIP_PACKAGE` (reference) | 19,519 B | 72 ms | 57 ms | 3.8 MiB |
| `INVESTIGATION_CHECKPOINT`, 2 transitions | 20,853 B | 30 ms | 41 ms | 3.5 MiB |
| `INVESTIGATION_CHECKPOINT`, 100 transitions | 49 KB | 169 ms | 53 ms | 2.0 MiB |
| `INVESTIGATION_CHECKPOINT`, 1,000 transitions | 313 KB | 5,643 ms | 140 ms | 4.7 MiB |
| `INVESTIGATION_CHECKPOINT`, 3,000 transitions | 900 KB | 49,019 ms | **294 ms** | 12.5 MiB |
| `INVESTIGATION_CHECKPOINT`, 10,000 transitions | 2.95 MB | (extrapolated: minutes) | **937 ms** | 33.9 MiB |
| `READINESS_RESULT` | 64,098 B | 20 ms | 15 ms | 4.6 MiB |
| `READINESS_RESULT` | 2,109,499 B | 207 ms | 213 ms | 19.9 MiB |
| `READINESS_RESULT` | 4,158,999 B (near the 4 MiB limit) | 372 ms | 404 ms | 16.6 MiB |

The checkpoint finding is **closed by Amendment A4.5**: admission is now linear (3,000
transitions: 49 s to 0.3 s; the Core's 10,000-transition policy: under a second), with no
limit change. (The transition shape of the checkpoints measured after A4.5 differs
slightly from those measured before, which does not affect the trend.) Not measured here: a 16 MiB MIP (no valid package of that size
exists to hash) and a 32 MiB checkpoint.

## 8. Local binding plan (one run, reference Windows host)

Follows the MO-1307 and Phase 1 precedent. Worktree detached at the 2B head `$B`; Node
v24.21.0 (SHA-256 `ba4e6d11…6c32`); one validation generation, no silent retry, logs
kept and classified if any expected result is not met.

| # | Item | Expected |
|---|---|---|
| 1 | `tests/mo1308_phase2b_admission_test.mjs` | 30/30 (B30 alone runs about two minutes) |
| 2 | `tests/mo1308_*_test.mjs` | 49/49 |
| 3 | `cca-studio` `npm test` | 358/358 |
| 4 | `memoryos-cli` `npm test` | 45/45 |
| 5 | `tests/mo1307_*_test.mjs` | 639/639 |
| 6 | `python tools\verify_workspace.py --root .` | exit 0, pass line only |
| 7 | CTest | `DEFERRED_TOOLCHAIN_ABSENT` (Amendment A3; mandatory before Phase 3) |
| 8 | Characterization | recorded |
| 9 | Clean tree | empty |

Evidence commit (single-parent child of `$B`, adding only
`repositories/cca-conformance/evidence/mo1308/phase2b/`, raw logs under the
`evidence/mo1308/**` `-text` rule) and a binding-only commit, as Phase 1. The receipt must
disclose the section 5 limits. No `main` update, no tag.
