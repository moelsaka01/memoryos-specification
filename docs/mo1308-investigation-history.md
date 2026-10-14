# MemoryOS 1.3 MO-1308 — Investigation History

## 1. Authority, status and verified baseline

Status: **AUTHORIZED / CONTRACT FREEZE 1 NEXT**.

This owner-authorized roadmap authority establishes MO-1308's purpose, scope,
boundaries, the owner decisions taken at authorization, and the Contract
Freeze 1 agenda. It is documentation and analysis only. Implementation has not
started. No exact schema, filename convention, API, enumeration value, error
code, resource value, store mechanism or package boundary is frozen by a
recommendation in this document. Recommendations are proposals for Freeze,
not decisions.

### 1.1 Repository baseline

The baseline is `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c`, subject
`conformance(memoryos-1.3): bind MO-1307 Phase 3D final certification (BF)`,
sole parent I3 `ee18fc6114610569682cc04e5e8e025408a38594`. On 2026-10-04 the
following were verified from a fresh clone of
`https://github.com/moelsaka01/memoryos-specification`:

| Check | Result |
|---|---|
| `origin/main` and remote `refs/heads/main` | `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` |
| Working tree before this change | Clean |
| Remote `codex/mo1307-phase3d-certification` | `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` |
| Remote `codex/mo1307-phase3ar2-c3ub` (accepted 3AR2 evidence commit) | `0d254bba008616b36709fb4b742496a4a15c9e36` |
| Remote `codex/mo1307-phase3br2-c3tb` (accepted 3BR2) | `4d92f0f21c9c3aad8202f4558d61b9229c7214fc` |
| Remote `codex/mo1307-phase3cr2-c3tb` (accepted 3CR2) | `7d2006c6e19bb50bffb6c710672be996e3c3590b` |
| Remote tag `memoryos-1.3-mo1307` | ABSENT |
| Latest remote MemoryOS 1.3 tag | `memoryos-1.3-mo1306`, object `9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8`, peeling to `332ab0d2c35643ea8d155bcbea9c5019b304bbe3` |

This authority was prepared in a cloud clone of the GitHub repository, not in
the local Windows workspace `C:\Users\melsa\Documents\Codex\cca-workspace`.
Local worktrees were not inspected and were not changed.

### 1.2 Owner-supplied MO-1307 post-BF validator result

The owner ran the read-only MO-1307 Phase 3D validator
(`repositories/cca-conformance/tools/mo1307-phase3d/validate-final.mjs`) on the
reference Windows host under Node v24.21.0, from worktree `cca-mo1307-3d`. The
owner-supplied output, recorded verbatim, is:

```json
{"result":"CERTIFIED_READY_TO_TAG","head":"1dd1e8c82fe0ed5a32a894744392f2c279f89d4c","i3":"ee18fc6114610569682cc04e5e8e025408a38594","bf":"1dd1e8c82fe0ed5a32a894744392f2c279f89d4c","candidate":"17fa84efe46d30e6f4be85fd2427485677a222a3","production":{"commit":"98b766f9218b209f52251147213839b9775f6da3","tree":"b9dabf54572e06c96bb5e48c4e20671f2cc24053"},"streams":{"3A":"PHASE3AR2_ACCEPTED_FINAL_CANDIDATE","3B":"PHASE3BR2_ACCEPTED","3C":"PASS_ACCEPTANCE_READY"},"attempts":16,"conformanceTests":{"total":639,"pass":632,"fail":7},"packageReproducible":true,"releaseTag":"ABSENT","humanTagReviewRequired":true,"binding":{"path":"repositories/cca-conformance/mo1307-final-binding.json","byteLength":5559,"sha256":"sha256:316638525f3ef382782db1cf86cb2e3b2b6dbaa4ff36104b98af465a60445376"}}
```

Before this record was relied on, its repository-checkable fields were
compared with the baseline. Every compared field matched:

| Field | Repository check at `1dd1e8c` | Result |
|---|---|---|
| `binding.path` | File exists at that path | MATCH |
| `binding.byteLength` | `git cat-file -s 1dd1e8c:<path>` = 5559 | MATCH |
| `binding.sha256` | SHA-256 of the blob = `316638525f3ef382782db1cf86cb2e3b2b6dbaa4ff36104b98af465a60445376` | MATCH |
| `head`, `bf` | Baseline commit | MATCH |
| `i3` | Sole parent of BF; `binding.i3.commit` | MATCH |
| `candidate` | `binding.candidate.binding` | MATCH |
| `production.commit`, `production.tree` | `binding.candidate.production`, `binding.candidate.productionTree` | MATCH |
| `attempts` | 16 rows in the final inventory's `claims.attempts` | MATCH |
| `releaseTag`, `humanTagReviewRequired` | `binding.tagPolicy`; remote tag absent | MATCH |
| `conformanceTests` | [Phase 3D record](mo1307-phase3d-certification.md): 639 tests, 632 pass, 7 disclosed failures | MATCH |

The validator itself was not re-executed in the cloud clone. Its pinned Node
v24.21.0 requirement refused the available Node v22.22.0, which is the
validator's intended fail-closed behavior. The record above is therefore
**owner-supplied evidence**, cross-checked against repository bytes, not a
witness produced by this task.

### 1.3 Scope of this task

This task changes only this authority and ROADMAP.md. It authorizes exactly one
documentation commit on branch `mo1308/authority` with parent
`1dd1e8c82fe0ed5a32a894744392f2c279f89d4c`, and a push of that branch. It
creates no production code, schema, package, fixture, evidence, certification
result, tag, pull request or `main` update. ARCHITECTURE.md and the ambiguity
register are not edited here; section 4 records the approved architecture
exception, and Freeze settles their exact text.

## 2. Purpose and human authority

MO-1308 will provide durable, verifiable history of MemoryOS investigation and
evaluation records. It keeps the bounded records that earlier milestones
already produce and verify, binds them into an append-only, integrity-chained
ledger, and offers deterministic query, review and export over that ledger.

MO-1308 is a **record-keeping** authority, not a semantic one. It does not
re-derive or reinterpret what any record means. Investigation semantics remain
owned by the Investigation Core; package semantics by MIP-001; Policy outcomes
by the Policy Engine; Regression by the Regression engine; CI/CD operational
results by MO-1306; and readiness by MO-1307.

**History records what happened. It does not authorize anything.** A stored
READY readiness result is not release approval. A stored human-decision claim
is a claim whose authenticity remains `NOT_VERIFIED_BY_MEMORYOS`. History must
never become a tag, push, publish, deploy, merge or release authorization, and
must never feed back into MO-1307 readiness gates as a grant.

Five dimensions must remain distinguishable:

| Dimension | Owner / meaning |
|---|---|
| Record semantics | The producing authority (Core, MIP-001, Policy, Regression, MO-1306, MO-1307) |
| Admission | Whether MO-1308 verified a record through its owner's rules before recording it |
| Ledger integrity | Whether the stored chain, entries and retained bytes verify |
| Retention state | Whether a record's original bytes are retained or were purged by a governed tombstone |
| Human authority | Separate organizational decisions, never inferred from history |

## 3. Sources and predecessor boundaries

The identifiers below are evidence references for the decision register.
Released contracts apply within their original scope.

| Ref | Read authority | Boundary retained |
|---|---|---|
| B1 | [Architecture](../ARCHITECTURE.md) §5, §11, §13, §14; [ambiguity register](ambiguity-register.md) CCA-A016 | One semantic authority per capability; fixed dependency direction Runtime → Investigation Core → SDK → CLI/Studio; databases, networking and plugins excluded unless separately approved; transactional output unresolved; a security, privacy and threat model is required before database work. |
| B2 | [Investigation Core](../repositories/cca-studio/docs/investigation-core.md) and `repositories/cca-studio/web/js/investigation-core.js` | The transition log is the canonical source of investigation truth: contiguous never-rewritten indices; every transition binds `previousLogDigest`; transition identifiers hash content, index, kind, investigation identifier and preceding digest; 15 closed transition kinds. Checkpoints (`MemoryOSInvestigationCheckpoint`, domain `INVESTIGATION-CORE-CHECKPOINT-1.0`) bind investigation, Workspace, log, log digest, transition count and state digest. Logs live in an in-memory map per Core instance; there is no cross-process persistence today. |
| B3 | CCA-MEMORYOS-1.0 requirements CCA-MOS-LIFE-003, -009, -011, pinned in [the requirements manifest](../repositories/cca-conformance/requirements-manifest.json) | LIFE-003: Core-generated history uses the exact closed transition and log shapes, append-only contiguous indices, prefix-digest chain, domain-separated identities and final log digest. LIFE-009: Archived is terminal for mutation but loadable and checkpointable. LIFE-011: a checkpoint binds Investigation, Workspace, log, log digest, transition count and state digest; invalid or conflicting restoration fails atomically. |
| B4 | [Memory Investigation Packages](../repositories/cca-studio/docs/memory-investigation-packages.md) (MIP-001) | RFC 8785 canonical JSON and SHA-256; integrity, not producer authenticity; unknown non-critical extensions preserved, unknown critical extensions rejected. Native Studio investigations cannot be exported as MIP because no Studio-to-MIP mapping exists. |
| B5 | [SDK API reference](../repositories/cca-sdk/docs/api-reference.md), [CLI command reference](../repositories/memoryos-cli/docs/command-reference.md) | A Checkpoint is an opaque restoration handle valid only in the issuing SDK instance; "serialized checkpoint metadata is not a restoration credential." The CLI session never serializes checkpoints and cannot restore across processes. |
| B6 | [Investigation Policies](investigation-policies.md) | `MemoryOSPolicyEvaluationIdentity`, `evaluationIdentityDigest`, canonical outcome bytes and their verifiers. |
| B7 | [Cognitive Regression](../repositories/cca-studio/docs/cognitive-regression.md) | Read-only immutable report; never recomputed by consumers. |
| B8 | [MO-1305 REST authority](mo1305-rest-gateway.md) §6 | MO-1308 owns evaluation-history databases, history query engines, historical evidence persistence and long-term audit-store architecture. Transient gateway logs are operational records, not Investigation History. |
| B9 | [MO-1306 authority](mo1306-provider-neutral-cicd.md) §5 and [Freeze](mo1306-contract-freeze-1.md) §7–§9 | A per-run bundle under `.memoryos-ci/out/<RunId>/`; the completion marker is the only publication commit point; missing marker means incomplete attempt. Metadata classes: OPERATIONAL, DIAGNOSTIC, FORBIDDEN. Timestamps are diagnostic and excluded from identities. MO-1306 is not a durable history store. |
| B10 | [MO-1307 authority](mo1307-release-governance-readiness.md) §13 and D46/D47; [Freeze](mo1307-contract-freeze-1.md) §8, §12, §13 | MO-1307 is not durable storage. `memoryos-readiness-result.json` carries `readinessDigest` and `proofBindingDigest`. Historical raw sources cannot directly satisfy current certification slots. The optional human-decision record keeps `authenticity:"NOT_VERIFIED_BY_MEMORYOS"`. |
| B11 | [MO-1307 Phase 3D record](mo1307-phase3d-certification.md), [final binding](../repositories/cca-conformance/mo1307-final-binding.json), [final inventory](../repositories/cca-conformance/mo1307-final-release-inventory.json) | Final candidate C3VB, audit `PASS_WITH_DISCLOSED_STALE_TEST_BASELINE` (632/639), helper latency as a retained environment qualification, tag absent pending human review. |
| B12 | Owner's 2026-10-04 MO-1308 authority task, decisions V1–V9, recorded in section 15 | Documentation-only authorization, owner decisions, and the explicit instruction to leave every other gap OPEN. |
| B13 | [Current roadmap](../ROADMAP.md) | MO-1308 scope: durable investigation/evaluation history, traceability, historical evidence, query/review surfaces; existing Investigation Core history semantics retain their authority. |

Nothing here reopens MO-1301–MO-1307 or changes CCA-MEMORYOS-1.0, MIP-001 or
any released contract.

### 3.1 Existing history mechanisms and their relationship to MO-1308

| Mechanism | Durable across processes today? | MO-1308 relationship |
|---|---|---|
| Core TransitionLog and Checkpoint (B2, B3) | No | Unchanged authority. MO-1308 stores and re-verifies; it does not rewrite, extend or replace a TransitionLog. |
| Trace, Replay, Evolution, Comparative Reconstruction | Only inside MIP-backed packages | Unchanged authority. MO-1308 does not replay cognition. |
| Cognitive Regression and Explorer | No (reports are transported) | Reports may be stored as records; never recomputed. |
| cca-core forgotten-identity history; Runtime lifecycle history | No | Not applicable; different concepts. |
| MO-1307 `History` / `HISTORICAL_DISPOSITION` | Supplied input only | Owned by MO-1307. MO-1308 may store readiness results that contain it, without redefining dispositions. |
| MO-1306 CI bundle | Caller-retained files | Admissible record (CICD_RUN). |
| Conformance generations and inventories | Retained in Git | Engineering certification history, not product history; not an MO-1308 record kind. |
| REST, MCP and gateway logs | No | Not Investigation History (B8). |

### 3.2 Evidence limitation

The CCA-MEMORYOS-1.0 Standard source documents referenced by the requirements
manifest (for example `investigation-lifecycle.md`) are not present in this
repository, including at tag `v1.2.1`. The manifest pins only the requirement
statements. The lifecycle contract above was read from those statements, the
Core documentation and the Core implementation, not from the Standard's own
text. This is decision H31.

## 4. Architecture change under ARCHITECTURE §13

ARCHITECTURE §13 excludes databases, networking and related capabilities and
states that crossing those boundaries requires a separately approved
architecture. ARCHITECTURE §14 leaves transactional output unresolved.

**Owner decision V4 approves, as that separately approved architecture, a
file-based, append-only ledger for MO-1308.** In v1 there is no database
engine, no network service and no cloud store. The approval is limited to:

- local files written by the MO-1308 component under an explicitly supplied
  ledger location;
- append-only entries bound into an integrity chain;
- the publication, retention and export behavior that Freeze defines.

The approval does not authorize a database engine, an embedded SQL or key-value
library, a server process, a network listener, remote or cloud storage,
multi-tenant hosting, or any general persistence for other components.

Freeze must settle the exact amendment text for ARCHITECTURE.md (§5 repository
boundary and dependency direction, §13 exclusion wording, §14 transactional
output) and the ambiguity-register entries CCA-A016 and CCA-A018 (H04). Until
Freeze, implementation may not rely on an unwritten architecture change.

## 5. Record scope

### 5.1 v1 record kinds (owner decision V5)

| Record kind | Source authority | Admission principle |
|---|---|---|
| `INVESTIGATION_CHECKPOINT` | Investigation Core (B2, B3) | MIP-backed investigations only. Admitted only after the chain, digests and Workspace binding re-verify under Core rules. Not a restoration credential (B5). |
| `MIP_PACKAGE` | MIP-001 (B4) | Admitted only after the MIP-001 verifier passes. |
| `POLICY_EVALUATION` | Policy Engine (B6) | Admitted only after the Policy identity and outcome verifiers pass. |
| `REGRESSION_REPORT` | Cognitive Regression (B7) | Admitted only after the report validates; never recomputed. |
| `CICD_RUN` | MO-1306 (B9) | Complete bundles only (completion marker present and verified). |
| `READINESS_RESULT` | MO-1307 (B10) | Admitted without calling `verifyReadiness` and without `windows-inspect.ps1` (V3). The admission verification level is H12. |
| `HUMAN_DECISION_CLAIM` | MO-1307 human-decision record (B10) | Stored as a claim; authenticity remains `NOT_VERIFIED_BY_MEMORYOS`. |

### 5.2 Excluded from v1 (owner decision V5)

- `INGESTION_REJECTED`: rejected admissions are not recorded as entries.
- Native (non-MIP) Studio investigations and their checkpoints.
- Conformance generations, certification receipts and engineering inventories.
- REST, MCP, gateway and runner logs.

Excluded kinds cannot be added by implementation; adding one requires a later
authority.

### 5.3 What is immutable and what is derived

- **Immutable:** every appended entry, including its record digest; the order
  of entries; retained original record bytes until a governed tombstone purges
  them (section 8).
- **Derived:** every query result, projection, export manifest and summary.
  Derived output is recomputed from the verified ledger and is never
  authoritative. No cache is authoritative.

## 6. Threat and privacy model (CCA-A016 for MO-1308)

This section is the MO-1308 instance of the deferred CCA-A016 model. It fixes
the assets, boundaries and required properties; the exact mechanisms are Freeze
decisions listed in section 15.

### 6.1 Assets

1. Ledger integrity: the order and content of entries and the chain binding them.
2. Retained original record bytes, which may contain investigation content,
   observations, Policy inputs or provider metadata.
3. Record and subject identities (Workspace, investigation, candidate, run).
4. Tombstone governance records.
5. Export bundles once they leave the ledger location.

### 6.2 Actors and trust boundaries

| Boundary | Trust |
|---|---|
| Records supplied by a caller | Untrusted until the owning authority's verification passes. |
| The ledger location when read back | Untrusted. Every read verifies the chain and every entry it relies on. |
| Export bundles | Integrity only. Hashes establish integrity, not origin (B4, B9). |
| Human-decision claims | Claims only. MemoryOS never authenticates an actor. |
| Operator who invokes MO-1308 | Trusted to choose locations and authorize tombstones as Freeze defines; never trusted to rewrite history. |
| Other processes on the host | Untrusted; may race, replace or link files. |

### 6.3 Threats and required properties

| Threat | Required property |
|---|---|
| Forged or substituted record | Admission only through the owner's verifier; record digest bound in the entry. |
| Silent edit, deletion, reordering, truncation or rollback of entries | Chain verification fails closed; no partial result is returned. |
| Entry from another ledger or Workspace spliced in | Ledger and Workspace identity bound into every entry. |
| Partial or interrupted write presented as history | A single publication commit point; unmarked or partial data is never history. |
| Path traversal, link or reparse-point redirection, TOCTOU replacement | Canonical location validation and exclusive creation, at least as strict as MO-1306/MO-1307; mechanism is H40. |
| Concurrent writers corrupting order | Fail closed; mechanism is H41. |
| History used as approval or as a readiness grant | Prohibited (section 2, H48). |
| Tombstone used to hide history | A tombstone is itself an appended, governed entry; the original entry and record digest remain and the chain still verifies (section 8). |
| Leakage of sensitive data through stored or exported bytes | Only admitted record bytes and their identities are stored; MO-1306 FORBIDDEN fields (workspace paths, provider URLs) and DIAGNOSTIC fields (actor, runner identity, timestamps) never enter MO-1308-authored structures. The full data-class list is H09. |
| Resource exhaustion | Closed, bounded limits (H44). |

### 6.4 Privacy

Retained record bytes can carry personal or confidential data supplied by the
records' producers. MO-1308 does not inspect record content for personal data.
The v1 privacy control is the governed tombstone (V6): original bytes may be
purged while the entry and record digest remain. Whether the remaining digest
and subject identities are themselves acceptable after purge, encryption at
rest, and any access control on the ledger location are OPEN (H08, H20–H23).

## 7. Identity, ordering and determinism

Principles retained from predecessors:

- No wall clock, random value, locale, host identity or network input enters
  semantics or identities (B1 §11, B9, B10 §8). Wall-clock time is **not**
  authoritative for ordering (H38).
- MO-1308 mints no substitute for an identity another authority already
  defines. Subject identities are reused exactly: investigation identifier,
  TransitionLog digest, checkpoint identifier, MIP package digest,
  `evaluationIdentityDigest`, MO-1306 `RunId`, MO-1307 `candidateDigest`,
  `readinessDigest` and `proofBindingDigest`.
- Equivalent histories, appended in the same order from the same records, must
  produce byte-identical ledgers and query results.

OPEN for Freeze: the exact entry and ledger identity definitions and domain
strings (H36); the canonicalization and hash primitive and whether it is
shared or a bound copy (H37); ordering and batch semantics (H39); whether an
observed time may be kept as non-semantic metadata (H54); and how concurrent
investigations or writers map onto one ledger (H26, H41).

## 8. Retention, tombstones and redaction (owner decision V6)

History is append-only. Entries are never edited, reordered or removed.

A **governed tombstone** is a new appended entry that references an earlier
entry and records that the earlier entry's original record bytes were purged.
After a purge:

- the earlier entry and its record digest remain in the chain, so the chain
  still verifies;
- the original record bytes are no longer retained;
- verification of the purged record's content is no longer possible and must be
  reported as such, never as a pass;
- queries and exports show the entry as tombstoned, not as absent.

OPEN for Freeze: who may authorize a tombstone and what it must record (H20);
whether any retention period or expiry exists (H21); exact verification and
export behavior for purged entries (H22); whether purged bytes may ever be
re-supplied (H23).

## 9. Persistence and publication

Approved principle (V4): a local, file-based, append-only ledger.

Required properties, derived from predecessors:

- one publication commit point; anything before it is an incomplete attempt and
  never history (B9);
- no replacement of an existing published file;
- every read re-verifies;
- failures leave previously published history unchanged.

**Store mechanism (V3):** MO-1308 ingestion must not use `windows-inspect.ps1`
or `verifyReadiness`. The store mechanism is a Contract Freeze decision, with
a non-PowerShell mechanism preferred (H40). The MO-1307 helper-latency
qualification (B11: one helper at 8912 ms of 9000 ms, dominated by Windows
PowerShell startup) is the reason for that preference.

OPEN for Freeze: segmenting, sealing and head representation (H42);
concurrency (H41); platform target (H45).

## 10. Interfaces

Owner decision V7: **v1 surfaces are the JavaScript SDK and the CLI only.**
Python, C++, REST and MCP surfaces are deferred. No VS Code, GitHub Action or
CI/CD adapter surface is added.

Owner decision V8: **portability is the `MemoryOSHistoryExport` bundle only.**
A MIP extension is deferred.

Architecture constraint: the CLI consumes only the public JavaScript SDK
facade, and the SDK owns no investigation or package behavior (B1 §5). How the
SDK exposes history without breaking that direction, or without becoming a
second authority, is OPEN (H06). Candidate operation names from the
initialization report (`appendHistory`, `verifyHistory`, `queryHistory`,
`exportHistory`, and a `memoryos history` CLI namespace) are proposals only.

OPEN for Freeze: query model and result schema (H27, H28); CLI grammar and exit
codes that do not collide with CLI 0/6/7 or MO-1306 10–17 (H30); export bundle
format and import behavior (H25); error set (H43).

## 11. MO-1307 and MO-1309 boundaries

### 11.1 MO-1307

- MO-1308 consumes readiness results and human-decision records as immutable
  records. It never calls `verifyReadiness` or `windows-inspect.ps1` (V3).
- Stored history never satisfies a current MO-1307 certification slot and is
  never fed back into readiness as a grant (B10 §8; H48).
- MO-1307 is not reopened. Two MO-1307 follow-ups are recorded:
  1. **Tag deferral (V1).** `memoryos-1.3-mo1307` is not tagged now. Tagging
     follows completion of the stale-test correction below and a passing
     validator re-run. The exact tag target after that correction is OPEN
     (H34): the validator requires `HEAD` to be BF and BF to add only the
     binding file, so a correction committed after BF is not part of a tag on
     BF.
  2. **Stale-test correction (V2) — dependency.** The 7 disclosed failing
     tests (`C2C01`, `C2C17`, `C2C18`, `R07`, `R08`, `R09`, `NRT01`) receive a
     separate, test-only, bound MO-1307 correction. `NRT01` becomes a
     preserved-evidence check, not a re-execution. **This correction must be
     complete before the MO-1308 Phase 1 binding.** It is not performed here.

### 11.2 MO-1309

MO-1309 Cloud Dashboard remains PLANNED / AUTHORITY PENDING. MO-1308 adds no
dashboard, cloud, tenant, account, user, billing or URL concepts and no push or
network mechanism (H49). The intended forward interface is the read-only
`MemoryOSHistoryExport` bundle plus the SDK query result, whose exact shapes
are OPEN (H25, H27). MO-1308 must be useful on its own as offline local
history.

## 12. Errors and resource limits

Freeze must define a closed error set with stable codes (H43) and closed,
bounded limits for record sizes, entry counts, ledger sizes, query results and
export sizes (H44). Corruption of any kind fails closed with a stable error and
no partial result.

## 13. Exclusions

- No database engine, network service, cloud store, server process or remote
  synchronization (V4).
- No native non-MIP investigation history and no rejected-admission entries in
  v1 (V5).
- No Python, C++, REST, MCP, VS Code, GitHub Action or CI adapter surfaces in v1
  (V7).
- No MIP extension in v1 (V8).
- No re-derivation of any producer's semantics; no replay, regression or
  readiness engine inside MO-1308.
- No restoration of a stored checkpoint into a Core (B5).
- No dashboard or MO-1309 concern.
- No human-approval, tag, push, publish, deploy or merge authority.

## 14. Testing, certification and candidate workstreams

This is a plan for Freeze. No test, evidence or branch is created by this
authority.

### 14.1 Test areas Freeze must cover

| Area | Coverage |
|---|---|
| Schema and closed shapes | Unknown fields, versions and kinds rejected. |
| Determinism | Equivalent histories give identical bytes; volatile metadata varied independently; exact bytes compared. |
| Append-only and chain integrity | Gaps, duplicates, reordering, truncation, rollback, foreign-ledger splice, seal mismatch. |
| Corruption and tamper | Single-byte flips in each stored structure; substituted records with valid self-hashes rejected. |
| Admission delegation | Each v1 kind admitted only through its owner's verification; forged, stale, wrong-Workspace and incomplete inputs rejected; incomplete CI bundles rejected; native checkpoints rejected. |
| Human-authority separation | READY results and APPROVE claims never become approval or readiness grants. |
| Tombstones | Chain verifies after purge; purged content never reported as verified; tombstone governance enforced. |
| Persistence | Interruption at each stage, leftover staging, replacement and link attacks, location canonicalization. |
| Concurrency | Concurrent writers fail closed. |
| SDK/CLI parity | Byte-identical query and export results. |
| Export | Exact bundle cardinality, commit marker, integrity, round trip. |
| Migration and versions | Unknown major versions rejected. |
| Resources | Limits enforced; separate characterization. |
| Privacy | FORBIDDEN and DIAGNOSTIC data never appear in MO-1308-authored bytes. |
| Predecessor regression | Existing suites unchanged; MO-1307 stale tests resolved by V2 before Phase 1 binding. |

### 14.2 Candidate phase structure

Subject to Freeze. Branch names follow V9 (`mo1308/…`); worktrees follow the
existing `cca-mo13xx-…` convention.

| Phase | Objective | One-shot | Branch / worktree |
|---|---|---|---|
| 0A Authority | This document and ROADMAP reconciliation | No | `mo1308/authority` / `cca-mo1308-authority` |
| 0B Contract Freeze 1 | Close every OPEN decision; exact shapes, errors, limits, requirement inventory, stream ownership; ARCHITECTURE and ambiguity-register text | No | `mo1308/freeze` / `cca-mo1308-freeze` |
| 1 Foundation | Private package, contracts, schemas, identities, structural validation, fixtures; binding B1. **Requires the V2 MO-1307 correction first.** | No | `mo1308/phase1` / `cca-mo1308-1` |
| 2A Ledger core | Append, chain, verify, ordering, sealing, corruption detection | No | `mo1308/phase2a-ledger` / `cca-mo1308-2a` |
| 2B Admission | Per-kind admission delegating to owner verification | No | `mo1308/phase2b-ingest` / `cca-mo1308-2b` |
| 2C Persistence | File ledger store, publication commit point, read-back, location safety | No | `mo1308/phase2c-store` / `cca-mo1308-2c` |
| 2D Integration | Combine 2A–2C; query, export, SDK and CLI surfaces; binding B2 | No | `mo1308/phase2d` / `cca-mo1308-2d` |
| 3A Native runtime | Installed-package execution, if Freeze selects a production runtime | Yes | `mo1308/phase3a-runtime` / `cca-mo1308-3a` |
| 3B Package and supply | Independent assemblies, SBOM, provenance | Yes | `mo1308/phase3b-package` / `cca-mo1308-3b` |
| 3C Security and integrity | Tamper/forgery corpus, data boundaries, authority separation | Yes | `mo1308/phase3c-security` / `cca-mo1308-3c` |
| 3D Final integration | I3 and binding-only BF; human tag review | Validator run | `mo1308/phase3d` / `cca-mo1308-3d` |

### 14.3 Parallelization

```text
0A → 0B → [V2 MO-1307 correction] → 1 ─┬─ 2A ─┐
                                        ├─ 2B ─┼─ 2D ─┬─ 3A ─┐
                                        └─ 2C ─┘      ├─ 3B ─┼─ 3D → human tag review
                                                      └─ 3C ─┘
```

2A and 2B depend only on Phase 1's frozen entry and record contracts and are
genuinely independent. 2C is independent only if Phase 1 freezes the stored
byte format and the verification interface so the store handles verified
opaque data; otherwise 2C runs after 2A. That choice is H02. Accepted streams
are preserved; a failed stream restarts alone. Certification generations are
append-only; failed generations are preserved and never promoted.

### 14.4 Publication

Development branches may be pushed regularly once checkpoints are committed.
One-shot generations are not pushed while sealed and running; they are pushed
after sealing, PASS or FAIL. `main` advances only at accepted integration
boundaries. Tags follow human review only.

## 15. Contract Freeze 1 decision register

The register contains **55 entries: 34 OPEN, 14 RESOLVED_BY_OWNER,
6 RESOLVED_BY_PREDECESSOR and 1 RESOLVED_BY_CONSTRAINT**. Entries are grouped
by the gaps G1–G13 identified in the MO-1308 initialization report, followed by
the remaining Freeze-level agenda. RESOLVED_BY_OWNER entries apply owner
decisions V1–V9 from the 2026-10-04 authorization (B12). OPEN entries list
options and constraints only; they are not decided. Freeze must record the
selected option and evidence for every OPEN entry, or explicitly exclude the
feature from v1. New questions found at Freeze must be added explicitly before
closure; there is no silent unregistered design authority.

### G1 — MO-1308 authority and Freeze

**H01 — Does MO-1308 have an authority?**
- Evidence: B12, B13.
- Decision: this document; Contract Freeze 1 next.
- Status: RESOLVED_BY_OWNER.

**H02 — Exact phase structure and stream ownership.**
- Evidence: section 14; MO-1305–MO-1307 precedent.
- Options: section 14.2 structure with parallel 2A/2B/2C; 2C serial after 2A; fully serial Phase 2.
- Constraints: no manufactured parallelism; the V2 MO-1307 correction precedes the Phase 1 binding.
- Status: OPEN.

### G2 — Architecture §13

**H03 — Persistence architecture.**
- Evidence: B1 §13; V4.
- Decision: file-based append-only ledger; no database engine, network service or cloud store in v1.
- Status: RESOLVED_BY_OWNER (V4).

**H04 — Exact ARCHITECTURE.md and ambiguity-register amendments.**
- Evidence: B1 §5, §13, §14; CCA-A016, CCA-A018.
- Options: amend at Freeze; amend at Phase 1 with Freeze-approved text.
- Constraints: no implementation relies on unwritten architecture.
- Status: OPEN.

**H05 — Package placement and owner.**
- Evidence: MO-1307 private-package precedent; reserved `repositories/memoryos` boundary.
- Options: a new private package; placement inside an existing repository; the reserved `memoryos` boundary.
- Status: OPEN.

**H06 — Dependency direction for SDK and CLI exposure.**
- Evidence: B1 §5 (the CLI consumes only the SDK; the SDK owns no behavior); V7.
- Options: SDK facade delegating to the history component; a separate history facade the CLI may consume (requires an architecture change); other.
- Constraints: no second semantic authority; no reverse dependency into the Core.
- Status: OPEN.

### G3 — Threat, security and privacy model

**H07 — Ledger and export authenticity (signatures, attestations).**
- Evidence: B4, B9 (integrity, not origin).
- Options: integrity only in v1; an optional opaque attestation digest; signatures (would need key-management authority).
- Status: OPEN.

**H08 — Confidentiality at rest and access control on the ledger location.**
- Evidence: section 6.4.
- Options: none in v1, with disclosure; operator-managed filesystem controls; encryption (would need key authority).
- Status: OPEN.

**H09 — Closed data-class list for MO-1308-authored structures.**
- Evidence: B9 metadata classes.
- Constraints: FORBIDDEN and DIAGNOSTIC classes never enter MO-1308-authored bytes.
- Status: OPEN.

### G4 — Record scope

**H10 — v1 record kinds.**
- Decision: `INVESTIGATION_CHECKPOINT` and `MIP_PACKAGE` (MIP-backed only), `POLICY_EVALUATION`, `REGRESSION_REPORT`, `CICD_RUN`, `READINESS_RESULT`, `HUMAN_DECISION_CLAIM`.
- Status: RESOLVED_BY_OWNER (V5).

**H11 — Excluded kinds.**
- Decision: `INGESTION_REJECTED` is excluded; rejected admissions are not recorded as entries.
- Status: RESOLVED_BY_OWNER (V5).

**H12 — Admission verification per record kind.**
- Evidence: B2–B10. Fixed constraint (V3): ingestion uses neither `verifyReadiness` nor `windows-inspect.ps1`.
- Options: structural and self-digest verification only; additional verification through other owner verifiers; a recorded verification-level field.
- Status: OPEN.

**H13 — Serialized form of an `INVESTIGATION_CHECKPOINT` record.**
- Evidence: B2 (the TransitionLog accepts serialized transitions; the Checkpoint has no public serialized form); B5.
- Options: a Core-defined canonical checkpoint serialization; the MIP package plus log digests; other.
- Constraints: no new Core semantics outside the Core authority.
- Status: OPEN.

**H14 — Can a stored checkpoint be restored into a Core?**
- Evidence: B5 ("serialized checkpoint metadata is not a restoration credential").
- Decision: no; any change needs a separate SDK/Core authority.
- Status: RESOLVED_BY_PREDECESSOR.

**H15 — Human-decision claim authenticity.**
- Evidence: B10 §13.
- Decision: authenticity remains `NOT_VERIFIED_BY_MEMORYOS`.
- Status: RESOLVED_BY_PREDECESSOR.

**H16 — Must a `HUMAN_DECISION_CLAIM` reference an already-recorded `READINESS_RESULT`?**
- Options: required; optional; not checked.
- Status: OPEN.

**H17 — Exact retained bytes for Policy and Regression records.**
- Options: exact SDK artifact bytes only; artifacts plus identity records; digests only.
- Status: OPEN.

### G5 — Native investigations

**H18 — Native non-MIP investigation history.**
- Evidence: B4 (no Studio-to-MIP mapping); V5.
- Decision: excluded from v1. A future mapping needs separate authority.
- Status: RESOLVED_BY_OWNER (V5).

### G6 — Retention and redaction

**H19 — Retention model.**
- Decision: append-only with governed tombstone entries; original record bytes may be purged while the entry and record digest remain, so the chain still verifies (section 8).
- Status: RESOLVED_BY_OWNER (V6).

**H20 — Tombstone governance: who authorizes a tombstone and what it records.**
- Options: operator-supplied reason code and authority reference; a closed reason enumeration; an external decision-record digest.
- Status: OPEN.

**H21 — Retention period or expiry.**
- Constraints: age alone must not change a verification outcome; no wall clock in identities.
- Options: none in v1; operator-invoked policy; a fixed period.
- Status: OPEN.

**H22 — Verification and export behavior for purged entries.**
- Constraints: purged content is never reported as verified.
- Status: OPEN.

**H23 — Can purged bytes be re-supplied later?**
- Options: never; re-supply with an exact digest match as a new entry; other.
- Status: OPEN.

### G7 — MIP representation

**H24 — History inside MIP.**
- Decision: MIP extension deferred; `MemoryOSHistoryExport` bundle only in v1.
- Status: RESOLVED_BY_OWNER (V8).

### G8 — Portability and ledger scope

**H25 — `MemoryOSHistoryExport` format, commit marker and import behavior.**
- Evidence: B9 bundle and marker pattern.
- Options: export only; export plus verify-only reading; export plus import into a new ledger; merge.
- Status: OPEN.

**H26 — Ledger scope.**
- Options: one ledger per Workspace; one ledger per location covering several Workspaces; other.
- Status: OPEN.

### G9 — Query

**H27 — Query model, filters, result schema and pagination.**
- Constraints: deterministic; recomputed from the verified ledger; bounded.
- Status: OPEN.

**H28 — Cross-ledger queries.**
- Options: excluded in v1; over verified exports only.
- Status: OPEN.

### G10 — Surfaces

**H29 — v1 surfaces.**
- Decision: JavaScript SDK and CLI only; Python, C++, REST and MCP deferred.
- Status: RESOLVED_BY_OWNER (V7).

**H30 — CLI grammar and exit codes.**
- Constraints: no collision with CLI exits 0/6/7 or MO-1306 exits 10–17; released CLI commands unchanged.
- Status: OPEN.

### G11 — Standard source

**H31 — Governing text for Core-history verification at admission.**
- Evidence: section 3.2.
- Options: requirement statements plus the Core implementation; obtain and pin the Standard source documents.
- Status: OPEN.

### G12 — MO-1307 release state

**H32 — MO-1307 tag timing.**
- Decision: no tag now; tag only after the V2 correction is complete and the validator passes again.
- Status: RESOLVED_BY_OWNER (V1).

**H33 — ROADMAP MO-1307 status.**
- Decision: corrected in this commit from verified Phase 3D facts, without rewriting historical records.
- Status: RESOLVED_BY_OWNER (V1).

**H34 — MO-1307 tag target after the V2 correction.**
- Evidence: `validate-final.mjs` requires `HEAD` to be BF and BF to add only the binding file.
- Options: tag BF (the correction stays outside the tagged commit); a new bound validator and binding for a later commit; other.
- Constraints: owner decision; outside MO-1308 implementation.
- Status: OPEN.

### G13 — MO-1307 stale tests

**H35 — Disposition of the 7 stale MO-1307 tests.**
- Decision: a separate, test-only, bound MO-1307 correction before the MO-1308 Phase 1 binding; `NRT01` becomes a preserved-evidence check, not a re-execution. Recorded as a dependency; not performed here.
- Status: RESOLVED_BY_OWNER (V2).

### Remaining Freeze agenda

**H36 — Entry and ledger identity definitions and domain strings.**
- Status: OPEN.

**H37 — Canonicalization and hash primitive: shared module or bound copy.**
- Evidence: B4 and B10 both use canonical JSON and SHA-256.
- Constraints: no third independent canonicalization without justification; supply-chain binding.
- Status: OPEN.

**H38 — Wall-clock time is not authoritative for ordering or identity.**
- Evidence: B1 §11, B9, B10 §8.
- Status: RESOLVED_BY_PREDECESSOR.

**H39 — Ordering and batch semantics.**
- Options: append index only; batches with a deterministic tie-break.
- Status: OPEN.

**H40 — Store mechanism on Windows.**
- Evidence: V3; B11 helper latency.
- Constraints: no `windows-inspect.ps1` in ingestion; a non-PowerShell mechanism preferred; location safety at least as strict as MO-1306/MO-1307.
- Status: OPEN.

**H41 — Concurrency and writer exclusivity.**
- Status: OPEN.

**H42 — Segmenting, sealing and head representation.**
- Status: OPEN.

**H43 — Closed error set and codes.**
- Status: OPEN.

**H44 — Resource limits.**
- Status: OPEN.

**H45 — Platform target.**
- Evidence: MO-1306 and MO-1307 native Windows 11 x64 precedent, with no Linux or VM gate.
- Status: OPEN.

**H46 — Distribution and supply chain.**
- Options: a private offline package with zero external production dependencies (MO-1307 precedent); other.
- Status: OPEN.

**H47 — Certification applicability (3A, 3B, 3C).**
- Status: OPEN.

**H48 — History never grants approval or readiness.**
- Evidence: B10 §8, §13; section 2.
- Status: RESOLVED_BY_PREDECESSOR.

**H49 — No MO-1309 coupling.**
- Evidence: B13; ROADMAP MO-1309 scope.
- Status: RESOLVED_BY_CONSTRAINT.

**H50 — Conformance generations are not product history.**
- Evidence: the closed V5 record-kind list.
- Status: RESOLVED_BY_OWNER (V5).

**H51 — Gateway, REST and MCP logs are not Investigation History.**
- Evidence: B8.
- Status: RESOLVED_BY_PREDECESSOR.

**H52 — History references and never rewrites the Core TransitionLog.**
- Evidence: B2, B3, B13.
- Status: RESOLVED_BY_PREDECESSOR.

**H53 — Branch naming.**
- Decision: `mo1308/…`.
- Status: RESOLVED_BY_OWNER (V9).

**H54 — Optional observed time as non-semantic metadata.**
- Options: none; a diagnostic field excluded from identities.
- Status: OPEN.

**H55 — MO-1308 run-time dependency on the MO-1307 readiness runtime.**
- Evidence: V3; section 11.1.
- Decision: MO-1308 consumes readiness results as records and never invokes `verifyReadiness` or `windows-inspect.ps1`.
- Status: RESOLVED_BY_OWNER (V3).

### 15.1 Register count

| Status | Entries | Count |
|---|---|---:|
| OPEN | H02, H04–H09, H12, H13, H16, H17, H20–H23, H25–H28, H30, H31, H34, H36, H37, H39–H47, H54 | 34 |
| RESOLVED_BY_OWNER | H01, H03, H10, H11, H18, H19, H24, H29, H32, H33, H35, H50, H53, H55 | 14 |
| RESOLVED_BY_PREDECESSOR | H14, H15, H38, H48, H51, H52 | 6 |
| RESOLVED_BY_CONSTRAINT | H49 | 1 |
| Total | | 55 |

## 16. Contradiction audit

The audit searched ROADMAP.md, ARCHITECTURE.md, the ambiguity register, the
MO-1305–MO-1307 authorities, freezes and phase records, the Core, MIP, SDK and
CLI documentation, and the MO-1307 final binding and inventory for MO-1308,
MO-1309, Investigation History, history, persistence, database, checkpoint and
tag. Classification depends on the scope and time of each record.

| Finding / source | Classification | Disposition |
|---|---|---|
| ROADMAP product row and MO-1307 table row: "CONTRACT FREEZE 1 ESTABLISHED / PHASE 1 NEXT" | CONTRADICTION | Corrected in ROADMAP to verified Phase 3D state with the tag deferred. |
| ROADMAP MO-1307 section: "PHASE 1 FOUNDATION BOUND / PHASE 2 NEXT", "Phase 2 and Phase 3 are not started", exact next task MO-1307 Phase 2 | CONTRADICTION | Corrected in ROADMAP; Phase 1 record links retained. |
| ROADMAP MO-1308 "PLANNED / AUTHORITY PENDING" | CONTRADICTION | Set to AUTHORIZED / CONTRACT FREEZE 1 NEXT. |
| ARCHITECTURE §13 database and persistence exclusion | CURRENT_AUTHORITY | Owner-approved exception recorded (section 4); exact text change is H04. Not edited here. |
| ARCHITECTURE §5 repository list omits MO-13xx packages | CURRENT_AUTHORITY (incomplete) | Not changed here; relevant to H04–H06. |
| CLI "never serializes checkpoints"; SDK "serialized checkpoint metadata is not a restoration credential" versus V5 `INVESTIGATION_CHECKPOINT` | TENSION, resolvable | A stored checkpoint is a record, not a restoration credential (H14). Its serialized form is H13. |
| MO-1305 §6, MO-1306 §5, MO-1307 §13 reserving durable history for MO-1308 | RELEASED_HISTORY | Consistent with this authority; their bounded outputs remain non-history. |
| MO-1307 Phase 3D: tag "must target the exact BF", versus V1 tagging after the V2 correction | TENSION | Recorded as H34 for the owner; not resolved here. |
| MO-1307 final inventory `I3_COMPLETE_PENDING_BF_BINDING`, binding `BF_BINDING_ONLY`, `releaseTag: ABSENT` | HISTORICAL_EVIDENCE | Unchanged; the owner-supplied validator result supplies the later certified state. |
| Earlier milestone documents describing MO-1308 as prospective | HISTORICAL_EVIDENCE | Unchanged; describe their stage. |
| ROADMAP MO-1309 Cloud Dashboard | PROSPECTIVE | Remains PLANNED / AUTHORITY PENDING. |

Only current ROADMAP contradictions are corrected. Released documents,
inventories, schemas, packages, receipts, evidence and tags are unchanged.

## 17. Documentation validation and exact next task

Validation for this change: `git diff --check`; a read-only check that every
relative link in the changed documents resolves to a tracked path; the
changed-path set is exactly ROADMAP.md and this document; and the workspace
verifier `python3 tools/verify_workspace.py --root .`. In the cloud clone the
verifier already failed on the unmodified baseline in its MO-1304 parity
sub-check (`INSTALL_TOOLCHAIN` from the MO-1304 Windows receipt validator on a
Linux host); this change touches no MO-1304 input. No production or phase
evidence campaign is run to validate prose.

Commit once on branch `mo1308/authority` with parent
`1dd1e8c82fe0ed5a32a894744392f2c279f89d4c`, then push that branch. No tag,
pull request or `main` update.

The exact next task is:

**MEMORYOS 1.3 MO-1308 CONTRACT FREEZE 1 — INVESTIGATION HISTORY**

Its agenda is to resolve every OPEN entry in section 15 and reaffirm every
resolved entry, then freeze the v1 contract and Phase 1 plan. Resolve
architecture placement and dependency direction first (H04–H06); then record
admission, identity, ordering and the checkpoint form (H12, H13, H16, H17,
H36, H37, H39, H54); then persistence, concurrency and the store mechanism
(H26, H40–H42); then retention and tombstones (H20–H23); then query, export,
surfaces and errors (H25, H27, H28, H30, H43, H44); then security, platform,
distribution and certification (H07–H09, H45–H47); then phase structure (H02).
H31 and H34 need owner input. Freeze is documentation only and works on branch
`mo1308/freeze`, created from the accepted authority commit.

Separately, the MO-1307 stale-test correction (V2) may proceed under its own
authorization at any time, and must be complete before the MO-1308 Phase 1
binding.
