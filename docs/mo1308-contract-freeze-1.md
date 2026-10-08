# MemoryOS 1.3 MO-1308 — Contract Freeze 1: Investigation History

## 1. Authority, status, baseline and scope

Status: **FROZEN — CONTRACT FREEZE 1**.

The owner approved this Freeze on 2026-10-04 (section 1.3). Every resolution
below is frozen. Resolutions marked **FROZEN** are the technical resolutions
proposed in commit `aa3503652e3040f41ecd00a9afbbeea744d24605` and approved as
written; resolutions marked **RESOLVED_BY_OWNER** record the owner's decision on
a policy, product or risk choice. No register entry remains OPEN or awaiting a
decision. After this Freeze, implementation may resolve private details only;
any change to public behavior, shapes, identities, errors, limits or the
accepted risk returns to owner review (CCA-ENG-2.0).

This document follows the [MO-1308 roadmap authority](mo1308-investigation-history.md)
(commit `0c1b7d33866c94d41027ebd222cc3dd5cf836508`) and its 55-entry register.
It is documentation only: no production code, schema, package, fixture,
evidence, tag, pull request or `main` update, in this repository or in
`moelsaka01/cca-specifications`.

### 1.1 Baseline

The proposal baseline below was taken for commit
`aa3503652e3040f41ecd00a9afbbeea744d24605`. The approval commit is its
single-parent child on `mo1308/freeze`; `main` is unchanged.

| Check (2026-10-04) | Result |
|---|---|
| Branch | `mo1308/freeze`, created from `0c1b7d33866c94d41027ebd222cc3dd5cf836508` |
| Remote `refs/heads/main` | `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` (unchanged) |
| Remote `refs/heads/mo1308/authority` | `0c1b7d33866c94d41027ebd222cc3dd5cf836508` |

### 1.2 MO-1307 release tag (new fact)

The owner created and pushed annotated tag `memoryos-1.3-mo1307`. Verified with
Git:

| Field | Value |
|---|---|
| Tag object | `a3042f3bded41ec71deff8dac71691e9a595460b` (type `tag`) |
| Peels to | `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` (BF) |
| Tagger | `moelsaka01`, 2026-10-04T21:16:55Z |
| Message | `MemoryOS 1.3 MO-1307 Release Policies - Phase 3D CERTIFIED_READY_TO_TAG (632/639, 7 disclosed stale tests; correction follows separately)` |

Owner decision on H34: MO-1307 is tagged at BF as certified with 7 disclosed
stale tests. The V2 stale-test correction follows after the tag as a
separate, test-only, bound MO-1307 correction, and **must be complete before
the MO-1308 Phase 1 binding**. This document records that dependency and does
not perform V2.

### 1.3 Owner approval record (2026-10-04)

The owner approved all 25 technical resolutions as written and decided the
seven remaining items:

| ID | Owner decision | Section |
|---|---|---|
| H06 | Option B: the SDK performs no file I/O; the CLI owns the file store, following ARCHITECTURE §5 and the MO-1301 precedent. | 5.2 |
| H13 | Option A: a stored `INVESTIGATION_CHECKPOINT` contains the Standard's full nine-field checkpoint, including the transition log, so "MIP-backed only" is verifiable from stored bytes. It remains a record only, never a restore source (H14). | 7.2 |
| H20 | Tombstones are authorized by an operator command with a closed reason list and a free-text authority reference. Every tombstone is itself a ledger entry. | 10.1 |
| H23 | Purged bytes can never be re-added. | 10.5 |
| H26 | One ledger per Workspace; records belong to it intrinsically or by operator declaration. No ledgers without a Workspace. | 8.1 |
| H40 | Option A (Node-only file store), accepted as an explicit owner risk acceptance limited to local single-user v1, with mandatory re-review before any multi-user, shared-storage or cloud use (including MO-1309). No PowerShell helper and no new compiled helper. | 9.4 |
| H54 | No timestamp is stored per entry, diagnostic or otherwise. | 8.4 |

The owner also directed four records without resolution: the Standard's
registry-versus-section wording observation (section 22.1), the absent
`cca-specifications` branch (section 22.1), the Phase 1 entry obligations
(section 18.2), and the MO-1307 V2 dependency (sections 1.2 and 18.2).

## 2. CCA-MEMORYOS-1.0 Standard source verification (H31)

### 2.1 Access

`https://github.com/moelsaka01/cca-specifications` is public and was read
anonymously through a fresh clone. It was not modified.

| Check | Result |
|---|---|
| `main` | `bdf8fd465c1a402879911c1166179b41e72ca290`, subject `restore(v1.2.1): publish MemoryOS specifications` |
| Tags | `ar001-constitution` → `7f4cbfa1…`, `proc-1.0` → `153c757d…`, `sp001-foundation` → `fc904790…`, `sp004-persistence` → `cc2e3b26…` (all lightweight) |
| Branch `release/memoryos-v1.2.1-publications` | **Not present on the remote.** Only `main` exists. This differs from the owner's description; it does not affect the content checks below. |
| `specifications/CCA-MEMORYOS-1.0/` at `bdf8fd4` | All 20 listed entries present (19 files plus `diagrams/` with 2 files; 21 documents in total) |
| `investigation-lifecycle.md` size | 12991 bytes — MATCH |
| `requirements.yaml` size | 65167 bytes — MATCH |

### 2.2 Pinned identities in this repository versus the Standard

[`requirements-manifest.json`](../repositories/cca-conformance/requirements-manifest.json)
pins per-document SHA-256 values and publication digests. Each was recomputed
from the blobs at `bdf8fd4`. The publication digest is SHA-256 over the
canonical JSON of the `{path, sha256}` document list, as built by
[`build-pinned-manifest.mjs`](../repositories/cca-conformance/tools/build-pinned-manifest.mjs).

| Standard | Documents | Document hash mismatches | Publication digest |
|---|---:|---:|---|
| CCA-MEMORYOS-1.0 | 21 | 0 | `sha256:f77246da…c3dc716` — MATCH |
| CCA-MIP-1.0 (incorporated) | 4 | 0 | `sha256:997fd409…79c020ca` — MATCH |
| CCA-RF-1.0 (incorporated) | 4 | 0 | `sha256:721408f1…752029f3d` — MATCH |

The Standard's own `requirements.yaml` also declares the incorporated registry
hashes `c1505f5b…` (CCA-RF-1.0) and `4238525e…` (CCA-MIP-1.0); both equal the
pinned `requirements.yaml` hashes.

### 2.3 Requirement statements

| Check | Result |
|---|---|
| Requirement IDs | 218 pinned, 218 in the three source registries; no missing or extra ID |
| Statement text | **218 / 218 byte-identical** to the source `requirement` field |
| Source references, CCA-MEMORYOS-1.0 (114) | All match (`<document> § <anchor>` equals pinned `sourceDocument` and `sourceAnchor`) |
| Source references, incorporated (104) | CCA-MIP-1.0 rows carry `source: "MIP-001 §…"` in the Standard; the manifest records `sourceDocument: "requirements.yaml"` and `sourceAnchor: <id>` for every incorporated requirement, as the builder defines for incorporated standards. CCA-RF-1.0 rows have no `source` field. This is a documented representation convention, not a text mismatch. |

**Mismatches between this repository's pinned statements and the Standard: none.**

### 2.4 Finding inside the Standard: registry text versus section prose

For 109 of the 114 CCA-MOS requirements, the registry `requirement` text (which
this repository pins) is worded differently from the `### <ID>` section prose
in the referenced document. Both are declared normative (Standard README §2:
the README and documents marked Normative are normative; every mandatory
statement has a stable identifier in `requirements.yaml`). No precedence rule
between the two is stated. For the requirements MO-1308 relies on
(CCA-MOS-LIFE-003, -009, -011, CCA-MOS-CLI-001, -009 and the checkpoint
projection), the prose is a fuller form of the same obligation; no semantic
conflict was found. This Freeze cites the section prose and keeps the registry
ID. It is recorded for the owner in section 22; it is not a defect in this
repository.

### 2.5 Resolution

**H31 is RESOLVED.** CCA-MEMORYOS-1.0 at `bdf8fd4` is the authority. The
authority document's implementation-derived readings are replaced by the
Standard's own text:

- **CCA-MOS-LIFE-003** (investigation-lifecycle.md): "Investigation history
  **MUST** be an append-only log beginning at index zero, with the exact closed
  transition and log shapes, contiguous indices, exact ordered transition
  kinds, exact Core-generated payloads, the published prefix-digest chain, and
  content-derived identities using the exact domain-separated constructions in
  this document." The transition is exactly `kind`, `version`,
  `investigationIdentifier`, `index`, `payload`, `previousLogDigest`,
  `identifier`; the log is exactly `kind` `MemoryOSInvestigationTransitionLog`,
  version `1.0.0`, `investigationIdentifier`, `transitions`, `digest`.
- **Digest construction** (investigation-lifecycle.md): `D(domain, parts…)` is
  lower-case SHA-256 with prefix `sha256:` over
  `UTF8("MIP-1") || NUL || UTF8(domain) || (NUL || part bytes)…`; `JCS` is the
  exact CCA-MIP-1.0 canonical JSON. Transition identity uses domain
  `INVESTIGATION-CORE-TRANSITION-1.0`; log digests use
  `INVESTIGATION-CORE-LOG-1.0`.
- **CCA-MOS-LIFE-009**: "`Archived` **MUST** be terminal for mutation. An
  archived investigation **MUST** remain loadable and checkpointable and
  **MUST NOT** accept another state-changing command."
- **CCA-MOS-LIFE-011**: "A checkpoint **MUST** bind its Investigation,
  Workspace, intact transition log, log digest, transition count, and
  derived-state digest; restoration **MUST** re-derive state and **MUST**
  reject cross-owner, tampered, stale, or conflicting checkpoints atomically."
- **Checkpoint projection** (investigation-core.md): exactly nine members
  `kind, version, identifier, investigationIdentifier, workspaceIdentifier,
  transitionLog, transitionLogDigest, transitionCount, stateDigest`; kind
  `MemoryOSInvestigationCheckpoint`, version `1.0.0`; identifier
  `D("INVESTIGATION-CORE-CHECKPOINT-1.0", investigationIdentifier,
  transitionLogDigest, stateDigest)`; `stateDigest` uses domain
  `INVESTIGATION-CORE-STATE-1.0` over 14 derived-state members. "The SDK may
  impose its same-client handle rule and may keep the checkpoint opaque, but
  any public Core checkpoint projection has this exact value."
- **CCA-MOS-CLI-009**: `session` "**MUST NOT** serialize or restore a
  checkpoint across processes."
- **CCA-MOS-CLI-001**: "A conforming baseline CLI **MUST** identify as
  `memoryos` version `1.0.0` and **MUST** expose exactly the top-level command
  set and first-token aliases in this document."
- **Standard README §3.2**: the Standard does not prescribe "storage, network
  transport, … or repository organization", and "an excluded concern is not
  authorized by silence."

Consequences: MO-1308 storage is outside CCA-MEMORYOS-1.0 and is neither
authorized nor forbidden by it. MO-1308 makes no CCA-MEMORYOS-1.0 conformance
claim and changes no Standard requirement. No Freeze item remains provisional
on the Standard source.

## 3. SP-004 Persistence Foundation and the AR-001 constitution (effect on V4)

### 3.1 SP-004 (`sp004-persistence`, CCA-PERSIST-1.0)

SP-004 is **status Draft, "ready for independent review"**, implementation
milestone IM-006. It defines deterministic preservation and restoration of
CCA Workspace state — Workspace, Domains, Assets, Policies, metadata,
ProcessDefinitions and Execution Context snapshots — through a C++
`PersistenceEngine` (`save`, `validate`, `load`). This repository implements it
in [`cca-core`](../repositories/cca-core/docs/persistence-foundation.md) as an
in-memory, provider-independent package that "does not select a file,
database, network, compression, or encryption mechanism."

Relevant obligations:

| SP-004 text | Effect on MO-1308 |
|---|---|
| §4: preserved state is the Workspace representation, Policies, ProcessDefinitions, Execution Context snapshots | MemoryOS investigation, Policy, CI and readiness records are **not** in SP-004's preserved-state set. SP-004 does not govern the MO-1308 ledger. |
| §8 / CCA-PERSIST-015: the Persistence Foundation **MUST NOT** introduce databases, cloud providers, serialization formats, compression, encryption, networking, distributed persistence, replication, synchronization or storage engines; "those concerns belong to Providers" | **Consistent with V4** (no database, network or cloud). It establishes a pattern MO-1308 adopts: the ledger contract (canonical bytes and verification) is medium-independent, and the file store is a Provider-style realization that does not define the contract (section 5.3). |
| §5 / CCA-PERSIST-011: complete valid result or failure, never partial exposure; immutable after creation | Supports the single publication commit point and append-only entries. |
| CCA-PERSIST-013: loading does not start Runtime | Supports: MO-1308 reads never restore or run an investigation (H14). |

**SP-004 supports and constrains V4; it does not contradict it.**

### 3.2 AR-001 constitution (`ar001-constitution`)

The constitution (CCA-ARCH-1.0, CCA-LEX-1.0, CCA-GOV-1.0, CCA-ENG-2.0, ADR-001–005)
is referenced by CCA-MEMORYOS-1.0 (README §9) and is the constitutional
authority named by CCA-MIP-1.0. It governs "all conforming work."

| Constitutional text | Effect on MO-1308 |
|---|---|
| ADR-001: Workspace is the root aggregate; every element belongs to exactly one Workspace. ADR-002: Workspace is the boundary of consistency. | Supports a per-Workspace ledger (H26). Records with no intrinsic Workspace need an explicit Workspace association. |
| Invariant 4 / AR-004: Services never own persistent state. | Constrains: the history behavior owns no mutable state between calls. The ledger files are durable information at an operator-supplied location, not private service state (section 5.3). |
| Invariant 6 / AR-006: Providers implement infrastructure and never define architecture. | Constrains: the file store implements the ledger contract and cannot change it. |
| ADR-003: Runtime is disposable. | Supports durable history outside Runtime and process lifetime. |
| ADR-004: "Persistence preserves Workspace state … without becoming a Domain, Service, Policy, Provider, or Contract." | Compatible: the ledger preserves Workspace-associated records and introduces no constitutional concept. |
| Invariant 8: dependencies acyclic. | Constrains placement (section 5). |
| CCA-LEX-1.0: Asset forbidden synonyms "data object, record". | Terminology tension (section 22): MO-1308 uses "history record" as a MemoryOS product term. It is not a constitutional Asset or a synonym for one, following the CCA-STUDIO-001 precedent of introducing no new constitutional concept. |
| CCA-ENG-2.0: Architecture → Specification → Review → Freeze → Implementation → Verification → Release; after freeze, public behavior may not change. | Supports this Freeze-before-implementation process. |
| ARCHITECTURE §13 database exclusion | The constitution is technology-independent and neither requires nor forbids a file ledger. |

**AR-001 supports and constrains V4; it does not contradict it.** No owner
decision was needed because of a contradiction. The constraints are
applied in sections 5–8.

## 4. Terms

- **History ledger**: one MO-1308 append-only, hash-chained sequence of entries
  for one Workspace. It is not the Standard's "investigation history" (the Core
  TransitionLog, CCA-MOS-LIFE-003), which it may reference but never replaces.
- **History record**: the exact bytes of one admitted artifact produced by
  another authority, stored as one or more named members. A product term, not
  a constitutional Asset.
- **Entry**: one immutable ledger element: a RECORD entry or a TOMBSTONE entry.
- **Admission**: verification of a record through its owning authority's rules
  before an entry is created.

## 5. Architecture, placement and dependency direction (H04–H06)

### 5.1 H05 — placement: FROZEN

The history authority is a set of dependency-free, browser-safe ES modules in
`repositories/cca-studio/web/js/`, beside the other SDK-reachable authorities:

| Module (proposed name) | Responsibility |
|---|---|
| `memoryos-history-contract.js` | Closed constants, enums, limits, shape validators |
| `memoryos-history-ledger.js` | Entry construction, chain verification, query, export model (pure) |
| `memoryos-history-admission.js` | Per-kind admission delegating to MIP-001, Policy and Regression modules; MO-1306/MO-1307 digest recomputation (pure) |

The JavaScript SDK (`memoryos-sdk.js`) adds thin forwarding functions. The CLI
adds a `history` namespace and the file store in `repositories/memoryos-cli/src/`.

Reasoning: every SDK-exposed semantic authority added since MO-1204 (Policy
Engine, Regression, Explorer) lives in `cca-studio/web/js` and is reached
through the SDK facade; MO-1307 was a standalone package because it is not
SDK-exposed. Rejected: a standalone `repositories/memoryos-history` package
(the SDK would import across repository roots and need a new vendoring path);
the reserved `repositories/memoryos` boundary (reserved directories authorize
nothing by presence, ARCHITECTURE §5).

Released packages (MO-1302 Action, MO-1303 VS Code, MO-1304 MCP, MO-1305
REST, MO-1306 CI, MO-1307 readiness) vendor byte-preserved copies of
`memoryos-sdk.js` (all currently identical). They are **not** updated and keep
their released closures. The v1.2.1 Reference Implementation revision is
historical; `tools/verify_workspace.py` checks the recorded revision, not
current source bytes, and MO-1301 already extended `memoryos-sdk.js` after
v1.2.1. Phase 1 must still confirm, on the reference Windows host, that no
released inventory check recomputes current SDK bytes.

### 5.2 H06 — dependency direction: RESOLVED_BY_OWNER (option B)

The history authority and the SDK facade are pure (bytes in, bytes out; no
filesystem). The CLI owns the file store and all file transport. This matches
ARCHITECTURE §5: the CLI "performs file and terminal transport" and consumes
only the SDK, and the SDK owns no I/O and stays browser-safe. It mirrors
MO-1301 (`policy-publication.js` in the CLI). Durable ledgers are created and
appended only through the CLI. JavaScript SDK callers get pure operations,
including producing a checkpoint record file (section 7.2) for the CLI to
append.

Not selected: a Node-only file Provider exported through a new Node-specific
SDK entry point (adds a Node-specific SDK surface and an ARCHITECTURE §5
change); a CLI-only store with no SDK surface (contradicts V7 and would leave
no way to produce checkpoint records).

Dependency direction:

```text
MIP-001 module, Policy modules, Regression module, mip-canonical.js
        -> memoryos-history-* (pure authority; no SDK, Core, fs or network import)
        -> memoryos-sdk.js (forwarding facade)
        -> memoryos-cli (history namespace + file store)
```

The history authority never imports the SDK, the Investigation Core, the
renderer, the readiness package or the CI package. The SDK reads the private
Core checkpoint value only to produce a checkpoint record (section 7.2), as it
already does for `restore`.

### 5.3 Constitutional placement

The history authority owns no state between calls (AR-004). Each operation
takes explicit bytes and returns bytes. The CLI file store is a Provider-style
realization of the ledger contract: it never defines identities, shapes or
verification (AR-006, SP-004 §8).

### 5.4 H04 — ARCHITECTURE and ambiguity-register text: FROZEN

Applied in the Phase 1 commit, after Freeze approval, not in this document:

1. ARCHITECTURE §5, new paragraph under `cca-studio`: "MO-1308 adds the
   Investigation History authority inside the same JavaScript boundary. It
   admits records only through their owning authorities, binds them into an
   append-only, hash-chained ledger, and never re-derives their semantics. It
   performs no filesystem, network or Runtime access."
2. ARCHITECTURE §5, `memoryos-cli`: "The `history` namespace owns the MO-1308
   file store at an explicit operator-supplied location."
3. ARCHITECTURE §13, appended: "MO-1308 is the separately approved exception
   for a local, file-based, append-only Investigation History ledger. It does
   not authorize a database engine, embedded storage library, server process,
   network service, cloud store or general persistence for any other component."
4. Ambiguity register CCA-A016: status "Resolved for MO-1308 v1 scope" with a
   reference to section 15 of this Freeze; other domains remain Deferred.

Rejected: editing ARCHITECTURE in this documentation-only proposal, before
approval.

## 6. Versions, primitive types and canonical bytes (H37)

### 6.1 H37: FROZEN

All MO-1308 identities use the Standard's `D` and `JCS` (section 2.5) through
the existing `cca-studio/web/js/mip-canonical.js`. MO-1308 adds no new
canonicalization.

MO-1306 and MO-1307 records use their own `J` (sorted ASCII keys, no
insignificant whitespace, exactly one trailing LF, restricted value domain:
ASCII keys, safe integers, no fractions, no C0/DEL in strings). Over that
restricted domain, `J(x)` equals `JCS(x)` followed by one LF. MO-1308 verifies
`J` bytes by strict parse, the domain checks above, and byte comparison with
`JCS(x) + "\n"`. **Phase 1 must prove this equivalence against every MO-1306
and MO-1307 canonical fixture in this repository; any disagreement stops
Phase 1 as AUTHORITY_CONFLICT.**

Rejected: importing MO-1307's private `canonical.mjs` (the package exports only
`.`; deep imports are outside its public contract); adding an export to
`memoryos-readiness` (changes a tagged, certified package); calling
`verifyReadiness` (forbidden by V3).

### 6.2 Primitive types

| Type | Rule |
|---|---|
| `Digest` | `sha256:` followed by 64 lower-case hex characters |
| `Index` | Integer 0–99,999 |
| `LedgerName` | 1–64 characters, `[a-z0-9][a-z0-9._-]*` |
| `WorkspaceIdentifier` | Exactly the Workspace identifier form accepted by the Investigation Core and CCA-MIP-1.0 |
| `MemberName` | One of the closed per-kind names in section 7.1 |
| `AuthorityReference` | 1–256 printable ASCII characters (0x20–0x7E) |
| Versions | Every MO-1308 shape has `version` `"1.0.0"`; any other version is rejected |

All shapes are closed: every member is required, no extra member is allowed,
`null` only where stated. MO-1308-authored files are exactly `JCS(x)` bytes
with no trailing LF.

## 7. Record kinds, members and admission (H12, H13, H16, H17)

### 7.1 Members per kind

| Record kind | Members (exact names) | Per-member byte limit | Workspace association |
|---|---|---|---|
| `MIP_PACKAGE` | `package.mip` | 16,777,216 | INTRINSIC (package Workspace) |
| `INVESTIGATION_CHECKPOINT` | `checkpoint.json` | 33,554,432 | INTRINSIC (`workspaceIdentifier`) |
| `POLICY_EVALUATION` | `evaluation-identity.json`, `policy-outcome.json` | 4,060 each | DECLARED |
| `REGRESSION_REPORT` | `regression-report.json` | 16,777,216 | INTRINSIC (`baseline` and `candidate` `workspaceIdentifier`) |
| `CICD_RUN` | The exact MO-1306 bundle basenames: 6 files for a completed evaluation, 4 for a handled operational failure | 49,152 total | DECLARED |
| `READINESS_RESULT` | `memoryos-readiness-result.json` | 4,194,304 | DECLARED |
| `HUMAN_DECISION_CLAIM` | `human-decision.json` | 8,192 | DECLARED |

INTRINSIC: the record's own Workspace identity must equal the ledger
Workspace, otherwise `WORKSPACE_MISMATCH`. DECLARED: the record has no Workspace
identity in its owner's shape, so the operator's choice of ledger is the
association, recorded as `DECLARED` (H26).

`recordDigest = D("MEMORYOS-HISTORY-RECORD-1.0", recordKind,
JCS(members))`, where `members` is the name-sorted list of
`{name, byteLength, sha256}` and `sha256` is the `Digest` of the member's exact
bytes.

### 7.2 H13 — checkpoint record form: RESOLVED_BY_OWNER (option A)

`checkpoint.json` is the `JCS` of the Standard's exact nine-member public Core
checkpoint projection (section 2.5), including the complete `transitionLog`.
Admission verifies every transition identity, prefix digest, log digest and
count; the checkpoint identifier; transition 0 `CREATED` with `sourceKind`
`mip` and the ledger Workspace; and transition 1 `PACKAGE_IMPORTED` whose
package passes the MIP-001 verifier. `stateDigest` is retained as issued by the
Core, not re-derived. The Standard defines "any public Core checkpoint
projection" as this exact value, so the record is a Standard-defined shape, and
the "MIP-backed only" rule (V5) is checkable from stored bytes. The record
stores investigation content (the imported package and navigation payloads),
which governed tombstones can purge (section 10).

Not selected: the eight metadata members of the SDK's public `Checkpoint` (only
the checkpoint identifier would be verifiable).

In addition:
- the record is produced only by the SDK function `createHistoryCheckpointRecord(checkpoint)`
  from a Checkpoint issued by the same SDK instance for a MIP-backed
  investigation; a native investigation is rejected (`RECORD_INVALID`);
- the record is **a record only, never a restore source** (H14); no MO-1308
  operation passes it to `restore` or to any Core;
- writing the record file is the SDK caller's act. The CLI `session` command
  still never serializes or restores checkpoints (CCA-MOS-CLI-009), and the
  CLI `history append` reads and verifies a record file without restoring it.

### 7.3 H12 — admission per kind: FROZEN

Each kind has exactly one admission method. The method's name is recorded in
the entry as `admission`, so consumers (including MO-1309) see exactly what
was checked.

| Record kind | `admission` value | Checks (all must pass) |
|---|---|---|
| `MIP_PACKAGE` | `MIP_001_VERIFIED` | The existing MIP-001 verifier accepts the bytes; package Workspace equals ledger Workspace. |
| `INVESTIGATION_CHECKPOINT` | `CORE_LOG_VERIFIED_STATE_ISSUED` | As in section 7.2. |
| `POLICY_EVALUATION` | `SDK_POLICY_ARTIFACTS_VERIFIED` | The SDK's detached `verifyEvaluationIdentityArtifact` and `verifyPolicyEvaluationOutcomeArtifact` accept the two members, and the outcome cross-binds the identity. |
| `REGRESSION_REPORT` | `SDK_REGRESSION_REPORT_INSPECTED` | The SDK's existing `inspectRegressionReport` accepts the report; both Workspace identifiers equal the ledger Workspace. Phase 1 must confirm that this inspection checks the report's identity; if it does not, Phase 1 stops as AUTHORITY_CONFLICT. Regression is never recomputed. |
| `CICD_RUN` | `MO1306_BUNDLE_INTEGRITY_VERIFIED` | MO-1306 Freeze §9 bundle rules: completion marker present; exact cardinality (6 or 4) and basenames; canonical `J`; artifact-manifest sizes and digests; marker manifest digest; `runId` consistency; result, projection and exit agreement per MO-1306 §8; when present, the two normative SDK artifacts pass the POLICY_EVALUATION checks. MO-1306 distribution and runtime digests are retained as recorded, not re-verified. |
| `READINESS_RESULT` | `MO1307_SELF_DIGESTS_RECOMPUTED` | Canonical `J`; `kind` and version; recomputation of `readinessDigest` and `proofBindingDigest` per MO-1307 Freeze §14. Never `verifyReadiness` and never `windows-inspect.ps1` (V3). This is not a MO-1307 verification. |
| `HUMAN_DECISION_CLAIM` | `MO1307_DECISION_CLAIM_BOUND` | Canonical `J`; exact MO-1307 §13 shape; `authenticity` equals `NOT_VERIFIED_BY_MEMORYOS`; binding per H16. |

Failed admission creates no entry (V5 excludes INGESTION_REJECTED) and returns
`RECORD_INVALID`.

A record whose `(recordKind, recordDigest)` already appears in the ledger is
rejected with `RECORD_DUPLICATE`, so one artifact gives one entry.

### 7.4 H16 — decision-claim binding: FROZEN

A `HUMAN_DECISION_CLAIM` is admitted only if the ledger already contains a
`READINESS_RESULT` entry with equal `candidateDigest`, `readinessDigest` and
`proofBindingDigest`. Consistency (`CONSISTENT` or `CONTRARY_TO_READINESS`, per
MO-1307 §13) is a derived query value, never stored. Reasoning: MO-1307
verifies a decision only against a result it has recomputed; an orphan claim
would be an unbound, approval-shaped record. Rejected: optional or unchecked
binding. Error: `DECISION_UNBOUND`.

### 7.5 H17 — retained bytes for Policy and Regression: FROZEN

POLICY_EVALUATION retains exactly the two SDK artifact bytes (identity and
outcome), the same normative pair MO-1306 bundles. REGRESSION_REPORT retains
the exact SDK report bytes. Rejected: digests only (not re-verifiable later);
also storing the Policy, Policy Set or input packages (MO-1306 excludes raw
inputs; larger privacy surface).

## 8. Entries, ledger identity, ordering and scope (H26, H36, H39, H54)

### 8.1 H26 — ledger scope: RESOLVED_BY_OWNER

One ledger per Workspace. Every ledger has exactly one `workspaceIdentifier`.
A record belongs to it either **intrinsically** (`INTRINSIC`: the record's own
Workspace identity must equal the ledger Workspace) or **by operator
declaration** (`DECLARED`: the record has no Workspace identity of its own, and
the operator's choice of ledger is the association). There are no ledgers
without a Workspace, and no entry without the ledger's Workspace. This follows
AR-001 ADR-001/002 (Workspace as root and consistency boundary) and MemoryOS's
one-Workspace-per-investigation rule.

Not selected: a ledger with no Workspace and optional per-entry Workspace
subjects.

### 8.2 H36 — identities: FROZEN

```text
MemoryOSHistoryLedger {
  kind: "MemoryOSHistoryLedger", version: "1.0.0",
  ledgerName: LedgerName, workspaceIdentifier: WorkspaceIdentifier
}
ledgerIdentifier = D("MEMORYOS-HISTORY-LEDGER-1.0", JCS(ledger descriptor))
genesisDigest    = D("MEMORYOS-HISTORY-GENESIS-1.0", ledgerIdentifier)

MemoryOSHistoryEntry {
  kind: "MemoryOSHistoryEntry", version: "1.0.0",
  ledgerIdentifier: Digest, index: Index,
  previousEntryDigest: Digest,          // genesisDigest at index 0
  entryType: "RECORD" | "TOMBSTONE",
  record: null | {
    recordKind: RecordKind, recordDigest: Digest, admission: Admission,
    members: [{name: MemberName, byteLength: Integer, sha256: Digest}],
    workspaceAssociation: "INTRINSIC" | "DECLARED",
    subjects: [{type: SubjectType, value: String}]
  },
  tombstone: null | {
    targetIndex: Index, targetEntryDigest: Digest, targetRecordDigest: Digest,
    reason: TombstoneReason, authorityReference: AuthorityReference,
    authenticity: "NOT_VERIFIED_BY_MEMORYOS"
  },
  entryDigest: Digest
}
entryDigest = D("MEMORYOS-HISTORY-ENTRY-1.0", JCS(entry without entryDigest))
headDigest  = entryDigest of the highest index, or genesisDigest when empty
```

Exactly one of `record` and `tombstone` is non-null, matching `entryType`.
`members` sorts by name; `subjects` sorts by `(type, value)`. The new
`MEMORYOS-HISTORY-*` domains are distinct from every Core and MIP domain.

Reasoning: chaining by the previous entry digest gives linear verification
over 100,000 entries. The Core's full-prefix log digest is quadratic and is
used only inside the Core. Rejected: a caller-chosen ledger identifier
(two ledgers could collide); embedding a time (H54).

`SubjectType` is the closed enum `WORKSPACE`, `MIP_PACKAGE_DIGEST`,
`MIP_PACKAGE_IDENTIFIER`, `INVESTIGATION`, `CHECKPOINT`, `TRANSITION_LOG_DIGEST`,
`EVALUATION_IDENTITY_DIGEST`, `OUTCOME_DIGEST`, `REGRESSION_REPORT`,
`CICD_RUN_ID`, `READINESS_CANDIDATE_DIGEST`, `READINESS_DIGEST`,
`PROOF_BINDING_DIGEST`. Subjects copy exact owner values; Phase 1 binds each
kind's subject source fields to the owner's published schema without changing
them.

### 8.3 H39 — ordering: FROZEN

Order is the append index only. One append adds exactly one entry; there are
no batches in v1. Rejected: batches with tie-break rules (no v1 need; adds
partial-batch failure modes).

### 8.4 H54 — observed time: RESOLVED_BY_OWNER

**No timestamp is stored per entry, diagnostic or otherwise.** No
MO-1308-authored structure contains a time. Wall-clock time is not
authoritative (H38), and equivalent histories must produce byte-identical
ledgers. Producer timestamps inside retained record bytes (for example a
decision claim's `timestamp`) remain the producer's data and are neither added
nor interpreted by MO-1308. MO-1309 cannot rely on MO-1308 for time ordering;
order is the append index (H39).

## 9. Store, publication, concurrency and platform (H40–H42, H45)

### 9.1 H42 — layout: FROZEN

```text
<ledger-root>/
  memoryos-history-ledger.json        ledger descriptor; created once, never changed
  entries/00000000000000000000.json   one file per entry, 20-digit zero-padded index
  records/<64-hex recordDigest>/<MemberName>
  .pending/                           staging only
```

There is no head file, no segment and no seal: the head is the highest
contiguous index. No MO-1308 file is ever modified. The only deletion is record
member removal under a committed tombstone (section 10).

### 9.2 Append protocol: FROZEN

1. Read and verify the whole entry chain (section 11).
2. Admit the record (section 7) and build entry `n = entryCount`.
3. For each member: exclusive-create a staging file in `.pending/`, write,
   flush, re-read and compare, then hard-link it to
   `records/<digest>/<name>` (a hard link never replaces an existing name),
   then remove the staging name. An already-present identical member is
   accepted after a byte comparison.
4. Commit point: exclusive-create staging for entry `n`, write, flush,
   re-read, hard-link to `entries/<n>.json`. If that name exists, return
   `LEDGER_CONFLICT`; nothing is published.
5. Remove the staging name.

A crash before step 4 leaves only staging files or unreferenced record
members. They are never history; `verify` lists them and never deletes them.

### 9.3 H41 — concurrency: FROZEN

Optimistic and lock-free: exclusive creation of `entries/<n>.json` is the
single serialization point. A writer that loses the race gets
`LEDGER_CONFLICT` and may retry after re-reading. Rejected: a lock file (a
crashed writer leaves a stale lock, and breaking it safely needs time-based
rules, which wall-clock non-authority excludes).

### 9.4 H40 — store mechanism on Windows: RESOLVED_BY_OWNER (option A, risk accepted)

The v1 store is **Node-only**. There is **no PowerShell helper and no new
compiled helper**. The mechanism is: `lstat` of every path component (no
symlink, junction or other reparse point); `realpath` equality with the
canonical root; exclusive creation (`wx`) of every new name; hard-link
publication, which never replaces an existing name; handle `fstat` versus path
`lstat` identity comparison after writing; fail closed on any difference.

Context: MO-1306 (`check-paths.ps1`) and MO-1307 (`windows-inspect.ps1`) use a
Windows PowerShell helper for path, reparse-point and identity checks. Node
alone cannot open handle-relative paths or open a directory without following
reparse points, so this store is weaker than its predecessors in one respect.

**Owner risk acceptance (recorded exactly):**

1. A concurrent directory swap is **detected after the fact, not prevented**.
2. The store can **never overwrite or replace existing ledger content**.
3. **Every subsequent read fails closed.**
4. The acceptance applies to **local single-user v1 only**. It **MUST be
   re-reviewed before any multi-user, shared-storage or cloud use, including
   MO-1309.**

This is a disclosed qualification of every MO-1308 v1 certification and
release claim. Not selected: a MO-1306-style PowerShell path-check helper
(PowerShell start-up latency, observed at 8912 ms of 9000 ms on the reference
host); a new compiled non-PowerShell helper (new binary to build, distribute,
review and certify).

### 9.5 Cancellation and time

No MO-1308 operation uses timers or deadlines: the store starts no child
process, and work is bounded by section 14's limits. Ctrl-C before the commit
point publishes nothing.

### 9.6 H45 — platform: FROZEN

The certified platform is native Windows 11 x64 with the existing pinned Node
toolchain, following MO-1306 and MO-1307, with no Linux, WSL or VM gate. The
pure modules are platform-independent and may be developed and tested
anywhere, but certification claims Windows only. Rejected: claiming
Ubuntu/macOS (no certification precedent for this surface).

## 10. Tombstones and retention (H20–H23)

### 10.1 H20 — tombstone governance: RESOLVED_BY_OWNER

Tombstones are authorized only by the operator command
`memoryos history tombstone` (section 13.3), which requires:

- a closed `TombstoneReason`: `PRIVACY_REQUEST`, `LEGAL_REQUIREMENT`,
  `SECURITY_INCIDENT`, `DATA_MINIMIZATION`, `OPERATOR_CORRECTION`;
- a mandatory free-text `AuthorityReference` (1–256 printable ASCII) naming the
  external decision (for example a ticket or decision-record identifier),
  never fetched or validated;
- `authenticity: "NOT_VERIFIED_BY_MEMORYOS"`, as for MO-1307 decision claims.

**Every tombstone is itself a ledger entry** (`entryType: "TOMBSTONE"`,
section 8.2), appended and chained like any other entry. Rules: the target must
be a RECORD entry with retained bytes; one tombstone per target; a tombstone
cannot target a tombstone. Not selected: an external decision-record digest; a
two-step propose and confirm flow.

### 10.2 Purge protocol: FROZEN

The tombstone entry is committed first (section 9.2). Then every member of the
target record is deleted. If a crash interrupts deletion, `verify` reports
`purgePending`; re-running the same tombstone command deletes the remaining
members without appending a new entry. A member referenced by another retained
entry is impossible because duplicates are rejected (section 7.3).

### 10.3 H21 — retention period: FROZEN

No automatic expiry in v1. Bytes are removed only by a governed tombstone (V6).
Reasoning: V6 approves only governed tombstones, and age-based expiry would need
an authoritative clock (H38). Rejected: operator-configured periods (a new,
unapproved mechanism).

### 10.4 H22 — purged entries: FROZEN

The chain still verifies (V6). Content verification of a purged record reports
`retention: "PURGED"` and is never reported as verified. Queries show the
entry and its tombstone. Exports include both entries but no member bytes.

### 10.5 H23 — re-supply after purge: RESOLVED_BY_OWNER

**Purged bytes can never be re-added.** A `(recordKind, recordDigest)` whose
entry is tombstoned cannot be admitted again in that ledger
(`RECORD_PURGED`), so a privacy purge cannot be undone by re-appending the same
bytes. Not selected: re-supply as a new entry.

## 11. Verification and query (H27, H28)

### 11.1 Verification: FROZEN

`verify` reads the descriptor, every entry in index order and every retained
member. It checks: descriptor shape and `ledgerIdentifier`; contiguous indices
starting at 0 with no gap or extra file; exact `JCS` bytes; each
`previousEntryDigest` and `entryDigest`; shape, enum and limit rules; tombstone
targets; duplicate and purge rules; and each retained member's length and
digest, plus recomputation of every `recordDigest`. It does not re-run
admission verifiers (records were admitted under the stated method). Any
failure is an error; there is no partial result.

```text
MemoryOSHistoryVerification {
  kind: "MemoryOSHistoryVerification", version: "1.0.0",
  ledgerIdentifier, workspaceIdentifier, entryCount, headDigest,
  retainedRecords, purgedRecords, tombstones,
  purgePending: [Index], unreferencedRecords: [Digest], pendingArtifacts: Integer
}
```

The last three fields are disclosed anomalies that do not break integrity.

### 11.2 H27 — query: FROZEN

A query first verifies the entry chain (not member bytes), then filters:

```text
MemoryOSHistoryQuery {
  kind: "MemoryOSHistoryQuery", version: "1.0.0",
  recordKinds: [RecordKind],            // empty = all
  subject: null | {type: SubjectType, value: String},
  retention: "ANY" | "RETAINED" | "PURGED",
  fromIndex: Index, limit: 1..1000
}
MemoryOSHistoryQueryResult {
  kind: "MemoryOSHistoryQueryResult", version: "1.0.0",
  ledgerIdentifier, workspaceIdentifier, entryCount, headDigest, query,
  entries: [{index, entryDigest, entryType, recordKind|null, recordDigest|null,
             admission|null, workspaceAssociation|null, subjects,
             retention: "RETAINED"|"PURGED"|null, tombstoneIndex: Index|null,
             decisionConsistency: null|"CONSISTENT"|"CONTRARY_TO_READINESS"}],
  nextIndex: Index | null
}
```

Results sort by index ascending. Tombstone entries match on their target's kind
and subjects. Rejected: free-text or expression queries (unbounded, and
nondeterministic matching risk).

### 11.3 H28 — cross-ledger queries: FROZEN

Excluded from v1. Consumers may query several ledgers or exports independently.

## 12. Export (H25): FROZEN

`export` writes a complete ledger copy to a new directory:

```text
<export-root>/
  memoryos-history-export.json
  memoryos-history-ledger.json
  entries/<20-digit>.json
  records/<hex>/<MemberName>            retained members only
  memoryos-history-export-complete.json  created last; the commit point
```

```text
MemoryOSHistoryExport {
  kind: "MemoryOSHistoryExport", version: "1.0.0",
  ledgerIdentifier, workspaceIdentifier, entryCount, headDigest,
  files: [{path, byteLength, sha256}]    // path-sorted; excludes the two export files
}
MemoryOSHistoryExportComplete {
  kind: "MemoryOSHistoryExportComplete", version: "1.0.0", manifestSha256: Digest
}
```

The same ledger always produces a byte-identical export. `verify-export`
applies section 11.1 to the export plus manifest and marker checks. There is
no import in v1. Rejected: import or merge (ledger identity conflicts and
merge semantics are not authorized); partial exports (a chain without its
prefix cannot be verified).

This bundle and the query result are the MO-1309 forward interface (H49).

## 13. SDK and CLI interfaces (H29 reaffirmed, H30)

### 13.1 Versions: FROZEN

The JavaScript SDK and CLI move from `1.1.0` to `1.2.0` (additive, following
MO-1301's 1.0 → 1.1). This is not a CCA-MEMORYOS-1.0 baseline CLI (1.0.0)
claim (CCA-MOS-CLI-001), and released packages keep their vendored 1.1.0
closures. Every MO-1308 artifact declares its own version (CCA-MOS-VER-001).

### 13.2 SDK (pure, H06)

Exported functions, each returning new immutable values or `Uint8Array`
snapshots and throwing `MemoryOSHistoryError {code, stage}`:

```text
createHistoryLedger({ledgerName, workspaceIdentifier}) -> {descriptorBytes, ledgerIdentifier}
admitHistoryRecord({recordKind, members:[{name, bytes}], ledger}) -> admission
appendHistoryEntry({ledger, admission}) -> {entryBytes, entryDigest, index}
tombstoneHistoryEntry({ledger, targetIndex, reason, authorityReference}) -> {entryBytes, entryDigest, index}
verifyHistoryLedger({descriptorBytes, entries:[Uint8Array], members}) -> MemoryOSHistoryVerification
queryHistoryLedger({descriptorBytes, entries, query}) -> MemoryOSHistoryQueryResult
buildHistoryExport({descriptorBytes, entries, members}) -> {files:[{path, bytes}]}
verifyHistoryExport({files}) -> MemoryOSHistoryVerification
MemoryOS#createHistoryCheckpointRecord(checkpoint) -> Uint8Array   // instance method
```

`ledger` is the verified ledger value returned by `verifyHistoryLedger`.
`members` maps `recordDigest` to retained members. Phase 1 fixes exact
argument shapes without adding behavior.

### 13.3 CLI (`memoryos history`): FROZEN

```text
memoryos history init    --ledger DIR --name NAME --workspace ID [--json]
memoryos history append  --ledger DIR --kind KIND (--record FILE | --identity FILE --outcome FILE | --run DIR) [--json]
memoryos history tombstone --ledger DIR --target INDEX --reason REASON --authority-reference TEXT [--json]
memoryos history verify  --ledger DIR [--json]
memoryos history query   --ledger DIR [--kind KIND]... [--subject-type TYPE --subject VALUE] [--retention ANY|RETAINED|PURGED] [--from INDEX] [--limit N] [--json]
memoryos history export  --ledger DIR --output NEW-DIR [--json]
memoryos history verify-export --export DIR [--json]
```

`--record` applies to MIP_PACKAGE, INVESTIGATION_CHECKPOINT, REGRESSION_REPORT,
READINESS_RESULT and HUMAN_DECISION_CLAIM; `--identity`/`--outcome` to
POLICY_EVALUATION; `--run` to CICD_RUN. `init` requires a non-existing
`--ledger` under an existing parent. `export` requires a non-existing
`--output`. `verify`, `query` and `verify-export` never write.

**Exit codes (H30)** reuse the CLI's existing categories, as the MO-1301
`policy` namespace does: `0` success; `1` usage; `2` admission, validation or
query rejection; `3` ledger or export integrity failure; `4` filesystem or
transport failure; `5` SDK or internal failure. No new exit number.
Rejected: exits 8+ (a new exit space in the CLI; MO-1306's 10–17 belong only
to `memoryos-ci`). JSON errors use the existing CLI envelope with
`error.exitCode` and an added `error.historyCode` holding the full `MO1308_`
code (section 14).

## 14. Errors (H43) and limits (H44)

### 14.1 Error catalog: FROZEN

Wire codes are prefixed `MO1308_`. Stages: `USAGE`, `ACQUISITION`,
`VERIFICATION`, `ADMISSION`, `PUBLICATION`, `INTERNAL`.

| Code suffix | CLI exit | Meaning |
|---|---:|---|
| USAGE | 1 | Invalid command, flag or argument |
| RECORD_INVALID | 2 | Admission check failed, wrong members, unknown kind via SDK, native checkpoint |
| RECORD_DUPLICATE | 2 | Same `(recordKind, recordDigest)` already in the ledger |
| RECORD_PURGED | 2 | Re-supply of a purged record (H23) |
| WORKSPACE_MISMATCH | 2 | INTRINSIC Workspace differs from the ledger Workspace |
| DECISION_UNBOUND | 2 | No matching READINESS_RESULT entry (H16) |
| TOMBSTONE_INVALID | 2 | Target missing, already tombstoned, a tombstone, or purged |
| QUERY_INVALID | 2 | Malformed query |
| RESOURCE_LIMIT | 2 | A section 14.2 limit exceeded |
| LEDGER_CORRUPT | 3 | Descriptor, entry, chain, index or shape integrity failure |
| RECORD_BYTES_MISMATCH | 3 | Retained member length or digest mismatch |
| EXPORT_CORRUPT | 3 | Export manifest, marker or content failure |
| VERSION_UNSUPPORTED | 3 | Unknown MO-1308 shape version in stored data |
| LEDGER_EXISTS | 4 | `init` or `export` target exists |
| LEDGER_NOT_FOUND | 4 | No ledger descriptor at the location |
| LEDGER_CONFLICT | 4 | Lost the entry commit race |
| FILESYSTEM_BOUNDARY | 4 | Path, link, reparse-point or identity check failed |
| IO | 4 | Read, write or link failure |
| INTERNAL | 5 | Unexpected fault |

Stderr and JSON errors carry no path, record content, exception message or
stack.

### 14.2 Limits: FROZEN

| Limit | Value | Basis |
|---|---|---|
| Entries per ledger | 100,000 | Linear verification bound |
| Entry file | 16,384 bytes | Fixed-size shapes |
| Ledger descriptor | 1,024 bytes | |
| Per-kind member limits | Section 7.1 | Reused: MIP-001 import default (16 MiB), MO-1301 outcome limit (4,060), MO-1306 bundle (49,152), MO-1307 result and decision (4,194,304 and 8,192). Set by this Freeze without predecessor limit: Regression report 16 MiB, checkpoint 32 MiB (H13) |
| Subjects per entry | 16 | |
| Query page | 1–1,000 entries | |
| CLI JSON stdout | 4,194,304 bytes | |
| Staging and unreferenced artifacts reported | First 1,000, sorted; count exact | |

Phase 1 characterizes memory and time at these limits on the reference host.
Any limit change after approval returns to owner review.

## 15. Security and privacy (H07–H09)

### 15.1 H07 — authenticity: FROZEN

Integrity only in v1. Ledgers and exports carry no signatures; authenticity is
`NOT_VERIFIED_BY_MEMORYOS`. Reasoning: MIP-001, MO-1306 and MO-1307 establish
integrity, not origin, and MO-1307 accepts no key material. Rejected:
signatures (need a key-management authority that does not exist).

### 15.2 H08 — confidentiality at rest: FROZEN

No encryption and no ACL changes by MO-1308 in v1. Access control is the
operator's filesystem responsibility, and this is disclosed in the CLI
documentation. Reasoning: SP-004 §8 assigns encryption to Providers, and no
key authority exists. Purge by tombstone is the v1 privacy control.
Rejected: built-in encryption.

### 15.3 H09 — data classes: FROZEN

MO-1308-authored structures (descriptor, entries, verification, query, export
manifest, marker, errors) contain only: identifiers and names, digests, byte
lengths, integers, closed enum values, closed member names, exact owner
subject values, and the tombstone authority reference. They **never** contain
paths, URLs, hostnames, user or actor names, timestamps, environment values,
runner identity, raw inputs, exception messages or stacks. Retained member
bytes are the producer's exact bytes and may contain the producer's own fields
(for example a decision claim's actor), which MO-1308 neither adds nor
interprets.

## 16. Distribution and supply chain (H46): FROZEN

No new package and no new third-party dependency. Changes are confined to new
modules in `cca-studio/web/js`, additive changes to `memoryos-sdk.js`, and the
`memoryos-cli` history namespace. All released packages, vendored closures and
tags stay byte-identical. Rejected: a standalone installable package (section
5.1).

## 17. Requirement inventory

| ID | Requirement | Verification |
|---|---|---|
| MO1308-R01 | Every MO-1308 shape is closed and versioned `1.0.0`; any other version is rejected. | Schema/negative vectors |
| MO1308-R02 | All identities use the Standard `D`/`JCS` with `MEMORYOS-HISTORY-*` domains. | Golden vectors |
| MO1308-R03 | MO-1306/MO-1307 `J` checks equal `JCS + LF` on every repository fixture. | Equivalence vectors |
| MO1308-R04 | Equivalent appends produce byte-identical ledgers, query results and exports. | Determinism vectors |
| MO1308-R05 | Entries are contiguous from 0 and chained by `previousEntryDigest`. | Chain/tamper vectors |
| MO1308-R06 | No MO-1308 file is ever modified; only purge deletes member files. | Filesystem audit |
| MO1308-R07 | Each kind is admitted only by its section 7.3 method. | Per-kind accept/reject matrix |
| MO1308-R08 | Admission never calls `verifyReadiness` or `windows-inspect.ps1`. | Static and runtime audit |
| MO1308-R09 | Rejected admissions create no entry and no ledger change. | Negative vectors |
| MO1308-R10 | Duplicates are rejected. | Vectors |
| MO1308-R11 | INTRINSIC Workspace must equal the ledger Workspace. | Vectors |
| MO1308-R12 | Checkpoint records are MIP-backed only and never a restoration source. | Vectors; audit of `restore` callers |
| MO1308-R13 | Decision claims require a matching READINESS_RESULT entry; consistency is derived only. | Vectors |
| MO1308-R14 | History never grants approval or readiness; no MO-1307 gate consumes it. | Audit |
| MO1308-R15 | The entry commit point is exclusive creation of `entries/<n>.json`; losers get LEDGER_CONFLICT. | Concurrency tests |
| MO1308-R16 | Interruption before the commit point publishes nothing. | Fault injection at every step |
| MO1308-R17 | Filesystem checks per H40 (Node-only, section 9.4); failures are FILESYSTEM_BOUNDARY; the store never overwrites or replaces existing content. | Windows link/junction/race tests |
| MO1308-R18 | Tombstones follow section 10; the chain verifies after purge. | Vectors |
| MO1308-R19 | Purged content is never reported as verified. | Vectors |
| MO1308-R20 | A purged record can never be re-added (H23). | Vectors |
| MO1308-R21 | `verify` checks every section 11.1 rule and fails closed. | Tamper corpus (single-byte flips per structure) |
| MO1308-R22 | Queries verify the chain before answering and sort by index. | Vectors |
| MO1308-R23 | Exports are byte-identical for equal ledgers; `verify-export` fails closed. | Vectors |
| MO1308-R24 | No time, path, URL, actor, environment or message appears in MO-1308-authored bytes. | Data-class audit |
| MO1308-R25 | Section 14 errors and exits are exact; stderr discloses no content. | CLI contract tests |
| MO1308-R26 | Section 14.2 limits are enforced. | Boundary vectors |
| MO1308-R27 | SDK and CLI produce identical bytes for the same operations. | Parity tests |
| MO1308-R28 | The history authority imports no SDK, Core, fs, network or predecessor package. | Architecture test |
| MO1308-R29 | SDK history functions perform no I/O (H06). | Architecture test |
| MO1308-R30 | `session` still never serializes or restores checkpoints (CCA-MOS-CLI-009). | Regression test |
| MO1308-R31 | All existing suites pass unchanged, with the V2 MO-1307 correction applied first. | Full regression |
| MO1308-R32 | Released packages, vendored closures and tags are byte-identical. | Closure audit |
| MO1308-R33 | No new third-party dependency. | Supply audit |
| MO1308-R34 | SDK/CLI declare 1.2.0; no CCA-MEMORYOS-1.0 baseline claim changes. | Version tests |
| MO1308-R35 | No MO-1308-authored structure contains a timestamp (H54). | Data-class audit |
| MO1308-R36 | Every ledger has exactly one Workspace; every entry is INTRINSIC or DECLARED (H26). | Vectors |
| MO1308-R37 | No MO-1308 operation launches PowerShell or any helper process (H40). | Static and runtime audit |

## 18. Phase plan, streams and certification (H02, H47)

### 18.1 Phases: FROZEN

| Phase | Owner paths | Deliverable | One-shot |
|---|---|---|---|
| 0B Freeze approval | `docs/` | This document approved and marked FROZEN (complete) | No |
| (V2) MO-1307 stale-test correction | `repositories/cca-conformance` MO-1307 tests only | Test-only bound correction after the tag; prerequisite for B1 | Per its own authority |
| 1 Foundation | `cca-studio/web/js/memoryos-history-contract.js`, guarded SDK signatures, guarded CLI grammar, fixtures, ARCHITECTURE/ambiguity text (section 5.4), equivalence vectors (R03), Regression inspection confirmation | Binding B1 | No |
| 2A Ledger core | `memoryos-history-ledger.js` | Identities, chain, verify, query, export model | No |
| 2B Admission | `memoryos-history-admission.js` | Seven admission methods | No |
| 2C CLI store | `memoryos-cli/src/history-*.js` | File store, append/tombstone/export protocols, CLI namespace against Phase 1 signatures | No |
| 2D Integration | `memoryos-sdk.js` facade, wiring, version 1.2.0 | Integrated suite; binding B2 | No |
| 3A Native Windows | none (execution) | One-shot Windows 11 x64 CLI campaign: filesystem, concurrency, interruption, limits | **Yes** |
| 3B Closure and supply | none | Released closures unchanged; no new dependencies; source closure reproducibility | **Yes** |
| 3C Security and integrity | none | Tamper and forgery corpus, data-class audit, authority separation | **Yes** |
| 3D Final integration | `cca-conformance` | I3 plus binding-only BF; human tag review for `memoryos-1.3-mo1308` | Validator run |

```text
0B → (V2) → 1 ─┬─ 2A ─┐
               ├─ 2B ─┼─ 2D ─┬─ 3A ─┐
               └─ 2C ─┘      ├─ 3B ─┼─ 3D → human tag review
                             └─ 3C ─┘
```

Parallelism is genuine because Phase 1 freezes byte formats, the SDK
signatures 2C calls, and the module boundaries; 2A, 2B and 2C own disjoint
files, and the SDK facade is changed only in 2D. If Phase 1 cannot freeze the
SDK signatures, 2C runs after 2A and 2B. Accepted streams are preserved and a
failed stream restarts alone. Branches follow V9 (`mo1308/phase1`,
`mo1308/phase2a-ledger`, …).

### 18.2 Phase 1 entry obligations and dependency

These must be proven before any Phase 1 binding (B1). If any fails, Phase 1
stops and returns to owner review as AUTHORITY_CONFLICT; it is not worked
around.

1. **J equivalence (R03):** MO-1306 and MO-1307 `J` serialization equals the
   Standard's canonical JSON (`JCS`) plus one trailing newline on every
   existing MO-1306 and MO-1307 canonical fixture in this repository.
2. **Regression identity:** `inspectRegressionReport` actually verifies a
   Regression report's identity, so that REGRESSION_REPORT admission (section
   7.3) checks integrity rather than shape alone.
3. **Dependency:** the MO-1307 test-only stale-test correction (V2) is complete
   and bound.
4. **Released-closure check (section 5.1):** on the reference Windows host, no
   released inventory check recomputes current `memoryos-sdk.js` bytes.

### 18.3 H47 — certification applicability: FROZEN

3A applies because the Windows file store is the main risk. 3B applies as a
closure and supply audit, not package certification, because no package is
produced. 3C applies. Generations are append-only and one-shot; failed
generations are preserved and never promoted.

## 19. Decision register disposition

| ID | Subject | Disposition |
|---|---|---|
| H01 | Authority | RESOLVED_BY_OWNER (reaffirmed) |
| H02 | Phases and streams | FROZEN (§18; entry obligations §18.2) |
| H03 | File-based ledger | RESOLVED_BY_OWNER (V4; reaffirmed; supported by SP-004/AR-001, §3) |
| H04 | ARCHITECTURE text | FROZEN (§5.4) |
| H05 | Placement | FROZEN (§5.1) |
| H06 | Dependency direction | RESOLVED_BY_OWNER (§5.2; option B) |
| H07 | Authenticity | FROZEN (§15.1) |
| H08 | Confidentiality | FROZEN (§15.2) |
| H09 | Data classes | FROZEN (§15.3) |
| H10, H11 | Record kinds and exclusions | RESOLVED_BY_OWNER (V5; reaffirmed) |
| H12 | Admission | FROZEN (§7.3; checkpoint row depends on H13) |
| H13 | Checkpoint record form | RESOLVED_BY_OWNER (§7.2; option A) |
| H14 | Not a restore source | RESOLVED_BY_OWNER (accepted 2026-10-04; consistent with the Standard, which permits restoration but lets the SDK keep checkpoints opaque) |
| H15 | Claim authenticity | RESOLVED_BY_PREDECESSOR (reaffirmed) |
| H16 | Claim binding | FROZEN (§7.4) |
| H17 | Retained bytes | FROZEN (§7.5) |
| H18, H19 | Native exclusion; tombstone model | RESOLVED_BY_OWNER (reaffirmed) |
| H20 | Tombstone governance | RESOLVED_BY_OWNER (§10.1) |
| H21 | Retention period | FROZEN (§10.3) |
| H22 | Purged entries | FROZEN (§10.4) |
| H23 | Re-supply | RESOLVED_BY_OWNER (§10.5; never) |
| H24 | No MIP extension | RESOLVED_BY_OWNER (reaffirmed) |
| H25 | Export | FROZEN (§12) |
| H26 | Ledger scope | RESOLVED_BY_OWNER (§8.1; one ledger per Workspace) |
| H27, H28 | Query; cross-ledger | FROZEN (§11) |
| H29 | Surfaces | RESOLVED_BY_OWNER (reaffirmed) |
| H30 | CLI grammar and exits | FROZEN (§13.3) |
| H31 | Standard source | RESOLVED (§2) |
| H32, H33 | MO-1307 tag timing; ROADMAP | RESOLVED_BY_OWNER; superseded by the tag fact (§1.2) |
| H34 | MO-1307 tag target | RESOLVED_BY_OWNER (tag at BF; V2 after the tag, before MO-1308 B1) |
| H35 | Stale tests | RESOLVED_BY_OWNER (V2; dependency) |
| H36 | Identities | FROZEN (§8.2) |
| H37 | Canonicalization | FROZEN (§6.1) |
| H38 | Wall clock not authoritative | RESOLVED_BY_PREDECESSOR (reaffirmed) |
| H39 | Ordering | FROZEN (§8.3) |
| H40 | Store mechanism | RESOLVED_BY_OWNER (§9.4; Node-only, explicit risk acceptance for local single-user v1) |
| H41 | Concurrency | FROZEN (§9.3) |
| H42 | Layout | FROZEN (§9.1) |
| H43 | Errors | FROZEN (§14.1) |
| H44 | Limits | FROZEN (§14.2) |
| H45 | Platform | FROZEN (§9.6) |
| H46 | Distribution | FROZEN (§16) |
| H47 | Certification | FROZEN (§18.3) |
| H48–H53, H55 | Separation, MO-1309, conformance, logs, TransitionLog, branches, readiness runtime | Reaffirmed as recorded in the authority |
| H54 | Observed time | RESOLVED_BY_OWNER (§8.4; no timestamp) |

Of the 34 entries OPEN after the authority, H31 and H34 were resolved before
the proposal; of the remaining 32, **25 are FROZEN as proposed and 7 are
RESOLVED_BY_OWNER** (H06, H13, H20, H23, H26, H40, H54). **All 55 entries are
closed: zero remain OPEN and zero await an owner decision.**

## 20. Owner decisions — summary

| ID | Decision |
|---|---|
| H06 | Option B: pure SDK, the CLI owns the file store |
| H13 | Option A: full Standard nine-field checkpoint, record only, never a restore source |
| H20 | Operator command, closed reason list, free-text authority reference; every tombstone is a ledger entry |
| H23 | Purged bytes can never be re-added |
| H26 | One ledger per Workspace; INTRINSIC or DECLARED association; no Workspace-less ledgers |
| H40 | Node-only store; explicit risk acceptance for local single-user v1; re-review before multi-user, shared-storage or cloud use including MO-1309; no PowerShell or compiled helper |
| H54 | No timestamp per entry, diagnostic or otherwise |

## 21. Testing strategy

Freeze adopts R01–R37 as the requirement inventory. Test classes: closed-shape
and version negatives; `D`/`JCS` golden vectors and the R03 equivalence set;
determinism with independently varied volatile inputs; a per-kind admission
matrix (valid, forged, stale, wrong Workspace, wrong members, oversized,
duplicate, purged, native checkpoint); chain tamper corpus (single-byte flips,
deletion, reordering, gap, extra file, foreign-ledger splice, descriptor
substitution); tombstone and purge lifecycle including crash during purge;
Windows filesystem tests (links, junctions, reparse points, existing names,
races, interruption at each step); concurrent appenders; query and export
determinism; SDK/CLI parity; data-class audit; resource boundaries;
architecture and import tests; and the full predecessor regression after V2.
Development tests in Phases 1–2 are not one-shot; Phase 3 campaigns are.

## 22. Contradiction audit

| Finding | Classification | Disposition |
|---|---|---|
| ROADMAP MO-1307 "TAG DEFERRED" versus tag `memoryos-1.3-mo1307` → BF | CONTRADICTION | Corrected in ROADMAP to released; the authority document's ABSENT-tag statements remain historical. |
| The Standard calls the Core transition log "Investigation history" (CCA-MOS-LIFE-003) | TERMINOLOGY TENSION | MO-1308 uses "history ledger"; it never claims to be, replace or extend the Standard's investigation history (§4). |
| CCA-LEX-1.0 lists "record" as a forbidden synonym for Asset | TERMINOLOGY TENSION | "History record" is a MemoryOS product term, not a constitutional concept (§3.2, §4). |
| CCA-MOS-CLI-001 baseline CLI 1.0.0 exact command set versus a new `history` namespace | RESOLVED BY PRECEDENT | Additive CLI/SDK 1.2.0 outside the baseline claim, as MO-1301 did for 1.1.0 (§13.1). |
| CCA-MOS-CLI-009 versus durable checkpoint records | RESOLVED | The SDK caller writes the record; the CLI never serializes or restores a checkpoint (§7.2). |
| Standard permits a fresh Core to restore a public checkpoint value versus H14 | CONSISTENT (narrower) | MO-1308 records are never passed to `restore` (H14). |
| Standard registry text versus section prose differ in wording for 109 of 114 CCA-MOS requirements; no stated precedence | STANDARD-INTERNAL OBSERVATION | Recorded for future errata in `cca-specifications` (§22.1); MO-1308 assumes no precedence rule; no semantic conflict for the requirements it relies on. |
| Owner-described branch `release/memoryos-v1.2.1-publications` not present on remote | FACT DISCREPANCY | Content verified at `main` `bdf8fd4`; no effect. |
| SP-004 is Draft; this repository implements it in `cca-core` | INFORMATIONAL | SP-004 does not govern MO-1308 records; its Provider pattern is adopted (§3.1). |
| V3 non-PowerShell preference versus predecessors' PowerShell-based path protection | ACCEPTED RISK | H40: Node-only store under explicit owner risk acceptance for local single-user v1; re-review required before multi-user, shared-storage or cloud use including MO-1309 (§9.4). |
| ARCHITECTURE §5 and §13 do not describe MO-1308 | EXPECTED | Frozen text (§5.4) applied in Phase 1. |

Released documents, inventories, evidence, packages and tags are unchanged.

### 22.1 Owner-directed records (not resolved by MO-1308)

1. **Standard-level observation for future errata in `cca-specifications`:**
   the CCA-MEMORYOS-1.0 registry `requirement` text and the `### <ID>` section
   prose are worded differently for 109 of 114 CCA-MOS requirements, and the
   Standard states no precedence rule between them. MO-1308 assumes no
   precedence rule. No semantic conflict was found for the requirements
   MO-1308 relies on (CCA-MOS-LIFE-003, -009, -011, CCA-MOS-CLI-001, -009 and
   the checkpoint projection). Any erratum belongs to the Standard's own
   change process (CCA-MOS-VER), not to MO-1308.
2. **Absent branch:** `release/memoryos-v1.2.1-publications` does not exist on
   the `moelsaka01/cca-specifications` remote; only `main` (`bdf8fd4`) does.
   No action.
3. **Phase 1 entry obligations:** section 18.2.
4. **Dependency:** the MO-1307 test-only stale-test correction (V2) must
   complete before the MO-1308 Phase 1 binding (sections 1.2, 18.2).

## 23. Validation and exact next tasks

Validation for this approval commit: `git diff --check`; every relative link
in the changed documents resolves to a tracked path; the changed-path set is
exactly this document and ROADMAP.md; a scripted check that no register entry
is OPEN or awaiting an owner decision. The Standard checks in section 2 were
recomputed by script from the blobs at `bdf8fd4` for the proposal and are
unchanged.

The exact next tasks, in order:

1. **MEMORYOS 1.3 MO-1307 V2 — TEST-ONLY STALE-TEST CORRECTION.** Correct
   the 7 disclosed stale tests (`C2C01`, `C2C17`, `C2C18`, `R07`, `R08`, `R09`
   to the owner-authorized 9000/28000 ms bounds; `NRT01` to a
   preserved-evidence check, not a re-execution), with no production,
   contract, limit or evidence change, and bind it. It runs under its own
   authorization.
2. **MEMORYOS 1.3 MO-1308 PHASE 1 — FOUNDATION**, on `mo1308/phase1` created
   from the accepted Freeze commit: the section 18.1 Phase 1 deliverables and
   the section 18.2 entry obligations. B1 waits for task 1.

## 24. Amendment A1 — released-closure workspace check (2026-10-04, owner-authorized)

This amendment is append-only. The frozen text above is unchanged.

**Finding.** Section 5.1 states that `tools/verify_workspace.py` "checks the
recorded revision, not current source bytes". That is true of the v1.2.1
Reference Implementation revision but incomplete: the MO-1302 distribution
check also required every vendored Action file to equal the current SDK and
CLI source. Phase 1 entry obligation 4 (section 18.2) therefore failed, and
Phase 1 stopped as AUTHORITY_CONFLICT
([Phase 1 entry obligations](mo1308-phase1-entry-obligations.md)).

**Owner decision (Option A).** The workspace check is corrected so that each
vendored MO-1302 Action file is pinned to its source bytes at tag
`memoryos-1.3-mo1302` (tag object `773dd03829dd6b3632bf43a45578925b1498515d`,
commit `7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d`) and to the Action's own
released manifest, instead of to current source. It still fails if any bundled
byte changes, a bundled file is added or removed, or the manifest no longer
matches. Released Action bytes and the tag are unchanged, so R32 holds. The
correction is a WORKSPACE_CHECK_CORRECTION recorded in
[the correction record](mo1302-vendored-runtime-check-correction.md) and made
as its own commit before further Phase 1 work.

**Effect on this Freeze.** Section 5.1's statement is read with this
correction. Under the corrected check, obligation 4 is satisfied in the cloud
container for what can be checked there (released SDK copies and the MO-1302
bundle equal their release bytes); the reference-host run of the full verifier
confirms it at B1. Placement (H05) and dependency direction (H06) are
unchanged: SDK and CLI source may now change as sections 5 and 13 assign. The
correction is verified and bound as its own named item in the Phase 1 B1 run.

## 25. Amendment A2 — Phase 1 open points (2026-10-05, owner-authorized)

This amendment is append-only. The frozen text above, and Amendment A1, are
unchanged; where this amendment and section 13.3 or 8.2 differ, this amendment
governs. It records the owner's decisions on the four open points of the
[Phase 1 foundation record](mo1308-phase1-foundation.md) section 5.

1. **CLI query flags are required (section 13.3).** `memoryos history query`
   requires `--retention`, `--from` and `--limit`; there are no defaults. A
   missing flag is a grammar error: `MO1308_USAGE`, exit 1, the fixed message,
   no echoed input. The grammar line becomes
   `memoryos history query --ledger DIR [--kind KIND]... [--subject-type TYPE --subject VALUE] --retention ANY|RETAINED|PURGED --from INDEX --limit N [--json]`.
   `--kind` and `--subject-type`/`--subject` stay optional (`recordKinds` empty
   means all kinds; `subject` null means no subject filter). A repeated
   `--kind` with the same value cannot form a strictly ascending
   `recordKinds` and is also a usage error; ordering the kinds is left to the
   phase that builds the query (2C).
2. **Argument shapes confirmed (section 13.2).** `ledger` and `admission` are
   branded, immutable values issued only by the history code; `members` is a
   `Map` from record digest to `[{name, bytes}]`; export files are
   `[{path, bytes}]`, exactly as Phase 1 fixed them.
3. **`subjects` and `query.recordKinds` are strictly ascending (sections 8.2
   and 12).** `subjects` is strictly ascending by `(type, value)` in UTF-16
   code-unit order, and `query.recordKinds` strictly ascending in that order,
   with no duplicates, like every other set in the contract. A duplicate or
   unordered element is rejected by the existing shape validation: an entry
   (`MO1308_LEDGER_CORRUPT` on verification), a query (`MO1308_QUERY_INVALID`),
   and the subjects of a query result entry (the result validator's own code).
4. **Characterization scope (section 14.2).** Phase 1 measures the decoder and
   the validators only; each later phase measures what it builds.

No other rule, limit, error code or exit code changes.

## 26. Amendment A3 — B1 CTest deferral and Phase 3 dependency (2026-10-05, owner-authorized)

This amendment is append-only. The frozen text above, and Amendments A1 and A2,
are unchanged.

For the Phase 1 B1 binding, the CTest item is deferred as
`DEFERRED_TOOLCHAIN_ABSENT` because the reference Windows host has no C++
toolchain and Phase 1 changes no C++ code; `cca.workspace.verify` is run
directly as its exact command and counts toward `PASS`
([Phase 1 foundation record](mo1308-phase1-foundation.md) section 6.1).

**Dependency.** A full CTest run, including `cca.workspace.verify`, is a
mandatory precondition before any MO-1308 Phase 3 certification run (section
18.1, Phase 3). Phase 3 certification may not start until that run passes on the
reference host.

## 27. Amendment A4 — decision consistency, Phase 2 interpretations and checkpoint cost (2026-10-05, owner-authorized)

This amendment is append-only. The frozen text above, and Amendments A1, A2 and A3,
are unchanged. Where this amendment and an earlier section differ, this amendment
governs, and the superseded text is named below. It records the owner's resolution of the
Phase 2 report: [2A ledger core](mo1308-phase2a-ledger.md) (BLOCKER-1 and I1–I9),
[2B admission](mo1308-phase2b-admission.md) (J1–J11 and the checkpoint cost finding) and
[2C persistence](mo1308-phase2c-store.md) (K1–K11).

### A4.1 BLOCKER-1: `decisionConsistency` is computed at admission and stored

`decisionConsistency` is computed **once, at admission of a `HUMAN_DECISION_CLAIM`**, from
the verified bytes of the claim and of the `READINESS_RESULT` it references, both available
and verified at that moment, and is **stored in the claim's entry**. The entry identity
(`entryDigest`, section 8.2) covers it because it is a member of the entry.

**Field and placement.** The entry's `record` object gains one required member,
`decisionConsistency`, so `record` has exactly seven members:
`recordKind`, `recordDigest`, `admission`, `members`, `workspaceAssociation`, `subjects`,
`decisionConsistency`. Its value is `null` or one member of the closed set
`"CONSISTENT"` | `"CONTRARY_TO_READINESS"`, under this rule:

| Entry | `record.decisionConsistency` |
|---|---|
| `entryType` `TOMBSTONE` (`record` is `null`) | not applicable (no `record`) |
| `RECORD` entry of any kind other than `HUMAN_DECISION_CLAIM` | `null` |
| `RECORD` entry of kind `HUMAN_DECISION_CLAIM` | exactly `"CONSISTENT"` or `"CONTRARY_TO_READINESS"`, never `null` |

`recordDigest` (section 7.1) is unchanged: it still binds only the kind and the member
list. The closed query result shape (section 11.2) is unchanged: each entry's
`decisionConsistency` is the stored value for a `HUMAN_DECISION_CLAIM` record entry and
`null` for every other entry, including every tombstone entry.

**Computation (MO-1307 Freeze section 13, unchanged).** With `decision` from the claim
and `readiness` from `assessment.readiness` of the referenced result:

- `APPROVE` with `READY` or `READY_WITH_QUALIFICATIONS` is `CONSISTENT`;
- `APPROVE` with `NOT_READY` or `COULD_NOT_EVALUATE` is `CONTRARY_TO_READINESS`;
- `REJECT` and `DEFER` are `CONSISTENT` for every readiness.

**Inputs and rejection, never a guess.** The referenced result is the `READINESS_RESULT`
entry whose `READINESS_CANDIDATE_DIGEST`, `READINESS_DIGEST` and `PROOF_BINDING_DIGEST`
subjects equal the claim's `candidateDigest`, `readinessDigest` and `proofBindingDigest`
(H16, section 7.4). Admission reads that result's retained bytes and re-verifies them with
the `READINESS_RESULT` admission method (`MO1307_SELF_DIGESTS_RECOMPUTED`). A claim is
rejected, and nothing is stored, when the referenced result is
absent from the ledger (including a result that exists only in another ledger or
Workspace), purged so that its bytes are unavailable, or does not verify:

| Condition | Error |
|---|---|
| No matching `READINESS_RESULT` entry, or its retained bytes are unavailable (purged) | `DECISION_UNBOUND` |
| Retained bytes differ from the entry's recorded member length or digest | `RECORD_BYTES_MISMATCH` |
| Retained bytes fail the `READINESS_RESULT` admission method or do not carry the claim's three digests | `RECORD_INVALID` |

**Never recomputed.** The stored value is not recomputed by `query`, `verify`, `export` or
any later operation. It survives a later purge of the claim or of the readiness result.
`queryHistoryLedger` returns the stored value and needs no member bytes. Chain
verification (section 11.1) checks only the shape rule in the table above, not the value.

**Informational only (human authority separation).** `decisionConsistency` is a label
about the relation between a claimed human decision and a readiness state. It never
represents approval, risk acceptance or release authorization, grants none, and no
MO-1307 gate consumes it (R14). The claim's own authenticity remains
`NOT_VERIFIED_BY_MEMORYOS`.

**Frozen text superseded by A4.1:** section 7.4 "Consistency ... is a derived query value,
never stored" and R13 "consistency is derived only"; the closed `record` shape in section
8.2 (one member added); the section 11.2 comment that the value is derived by the query;
and the Phase 2B interpretation J2 (a purged readiness result no longer binds a new
claim, because its bytes are unavailable). Section 7.4's binding rule, error
`DECISION_UNBOUND`, R14 and R35 (no timestamp) are unchanged. This is the owner's option
(b) of the Phase 2A record (store at admission), storing the derived value rather than its
two inputs.

### A4.2 K1: frozen CLI success results

The minimal success-result projections recorded in the Phase 2C record (K1) are the
frozen shapes. They add nothing beyond the SDK return values and stay within the data
classes of section 15.3:

| Command | `result` |
|---|---|
| `init` | `{ledgerIdentifier}` |
| `append` | `{index, entryDigest}` |
| `tombstone` | `{index, entryDigest}` (the existing tombstone entry when an interrupted purge is finished) |
| `export` | `{ledgerIdentifier, entryCount, headDigest}` |
| `verify`, `verify-export` | the `MemoryOSHistoryVerification` (`pendingArtifacts` is the store's count of staging files) |
| `query` | the `MemoryOSHistoryQueryResult` |

### A4.3 Interpretations accepted

The interpretations I1–I9 (Phase 2A record), J1–J11 (Phase 2B record) and K1–K11 (Phase 2C
record) are accepted as written, except J2, which A4.1 changes as stated above. K1 is
adopted as A4.2.

### A4.4 Known limits accepted (recorded as limits, not defects)

1. `POLICY_EVALUATION` admission is inspection-only. It inherits the SDK detached
   verifiers' `authority: "inspectionOnly"`: a digest-valued field inside the outcome can
   be altered and the artifact still verifies.
2. `READINESS_RESULT` admission is not a MO-1307 verification (section 7.3).
3. Costs at the 100,000-entry ceiling are as characterized in the Phase 2A and 2C records
   (a chain verify or an append reads and verifies every entry and retained member;
   about 21 s to verify, about 16 s to append and about 7.7 minutes to write an export in
   the cloud container). They are Freeze consequences, not defects.

### A4.5 Checkpoint admission must be linear

`INVESTIGATION_CHECKPOINT` admission (section 7.2, H13) must not be quadratic in the
transition count. It must use an algorithm that is linear (or n log n) in the checkpoint
size and gives **byte-identical admission results** to the published construction: the
same accepted and rejected inputs, the same subjects and the same record. The Standard's
construction, its digests and the 10,000-transition count policy are unchanged. If that
proves impossible without changing semantics, the stream reports it, and any limit change
returns to owner review.

## 28. Amendment A5 — consistent read snapshot (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above, and Amendments A1 to A4, are unchanged
except where this amendment names the superseded text. It records the owner's approval of the
contract-visible changes in section 5a of the [Phase 2C record](mo1308-phase2c-store.md), found
by the native-Windows test W08b (a tombstone purge racing a read reported a valid ledger as
`RECORD_BYTES_MISMATCH`) and fixed in the file store.

### A5.1 `LEDGER_CONFLICT` also covers a read that cannot obtain a consistent snapshot

Every store read that combines the entry listing with member listings (`verify`, `query`,
`export`, `tombstone` and the read inside `append`) takes a consistent snapshot: it lists the
entries, reads the descriptor, the entries and the members, then lists the entries again, and
repeats the whole pass when the listing changed. The number of passes is
`STORE_SNAPSHOT_ATTEMPTS = 8`. A quiescent ledger is always read in one pass. When every pass
is overtaken by a writer's entry commit, the operation fails with `LEDGER_CONFLICT`, stage
`ACQUISITION`, exit category 4, with the same fixed message as before, and publishes nothing.
It is never reported as `RECORD_BYTES_MISMATCH` or any other integrity-class code. Anything
observed while the entry listing is unchanged is reported exactly as before.

**Superseded text.** The section 14.1 row "`LEDGER_CONFLICT` | 4 | Lost the entry commit race"
and R15 ("losers get LEDGER_CONFLICT") are extended: `LEDGER_CONFLICT` is also the result of a
read that could not obtain a consistent snapshot within eight passes.

### A5.2 A member that vanishes between listing and read is absent

A member file that is listed in a record directory and is gone when it is read (a purge is
deleting it, section 10.2) is treated as absent, as if it had been listed a moment later. It is
no longer reported as `IO`. The engine decides what an absent member means: on a stable
snapshot a retained record's missing member is `RECORD_BYTES_MISMATCH`, and a purged or
purge-pending record is valid.

### A5.3 Unchanged

No shape, layout, limit, identity, other error code or protocol step changes. The commit point
(exclusive creation of `entries/<n>.json`), the purge order and the engine functions are as
frozen.

## 29. Amendment A6 — exclusive-create failure on a staging file is a typed, unretried IO failure (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above, and Amendments A1 to A5, are unchanged.
It records the owner's decision on an observation from the MO-1308 Stream 2C development runs
(see section 5c of the [Phase 2C record](mo1308-phase2c-store.md)): in 1 of 16 executions of
the concurrent-appender test W08 on the reference Windows host, two appends failed with
`EPERM` (errno -4048, syscall `open`) while creating a staging name `.pending/entry-N.0`.

### A6.1 Behaviour accepted for v1

When the exclusive creation of a staging file fails with any error other than "the name already
exists" (`EEXIST`, which selects the next free staging name, K3), the operation fails with a
typed `IO` failure. The store does not retry it. The writer is informed of the failure, nothing
is committed (the commit point, exclusive creation of `entries/<n>.json`, is never reached), and
the ledger remains valid; any leftover staging name is a disclosed anomaly (section 11.1).

### A6.2 Known limitation, recorded as such

This is accepted for v1 as a known limitation, not a defect, with no product change. Two
hypotheses for the observed `EPERM` are recorded, neither confirmed: (1) a transient lock by
antivirus or an indexer on the staging name; (2) the Windows delete-pending state of a
contended staging name (a file whose deletion is requested but which still holds its name while
another handle is open). The recorded runs do not distinguish them.

### A6.3 Re-review condition

This limitation is re-reviewed together with H40 (the Node-only, helper-free file mechanism)
before any multi-user, shared-storage or cloud use of the history store.

## 30. Amendment A7 — Stream 2D integration decisions (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above, and Amendments A1 to A6, are unchanged
except where this amendment names the superseded text. It records the owner's acceptance of the
Stream 2D decisions in the [Phase 2D record](mo1308-phase2d-integration.md) section 3.

1. **CLI success envelope `command`.** The `command` field of the CLI success envelope for the
   history commands is `"history <subcommand>"` (for example `"history query"`), matching the
   error envelopes.
2. **`history query` human output.** Each result entry is printed as its canonical JSON. The
   previous output (`[object Object]`) was a defect of the human formatter, not a contract.
3. **`verify-export` on a missing directory.** Reports `LEDGER_NOT_FOUND` (exit category 4), the
   existing 2C behaviour, confirmed. The Freeze has no separate "export not found" code.
4. **Live version pins.** The live SDK and CLI version pins are `1.2.0`. The historical MO-1301
   inventory that records `1.1.0` is released evidence and is untouched.
5. **Corrections to bound 2C tests T09 and T20.** Both are accepted as test defects that encoded
   the 2C stand-in engine, not the product. Neither weakens what the test proves. The exact change
   (`git diff 76095766 93dc69de -- repositories/memoryos-cli/tests/history-store.test.mjs`):

   T09, "foreign member name in a record directory" (expected `RECORD_BYTES_MISMATCH`):

   ```
   before: writeFileSync(join(ledger, "records", hex, "checkpoint.json"), "x")   / rmSync(... "checkpoint.json")
   after:  writeFileSync(join(ledger, "records", hex, "package.mip"), "x")        / rmSync(... "package.mip")
   ```

   The test proves that a file in a record directory whose name the record's kind does not own
   fails closed with `RECORD_BYTES_MISMATCH`. The stand-in record's member was `package.mip`, so
   `checkpoint.json` was foreign to it; the real record's member is `checkpoint.json`, so
   `checkpoint.json` is now the record's own member and `package.mip` is the foreign name. The
   property, the planted file, the expected code and the restore step are unchanged.

   T20, operation `query` after a committed purge (the stable second pass answers):

   ```
   before: ...limit: 10 }).entries.length, 2, "the stable second pass answers (the purged record is listed once, its tombstone is not a result row)")
   after:  ...limit: 10 }).entries.length, 3, "the stable second pass answers (the purged record is listed once, plus its tombstone entry, section 11.2)")
   ```

   The test proves that a purge committed between the entry listing and the member listing never
   makes a read report an integrity failure, and that the stable second pass answers. The
   stand-in filtered tombstone entries out of query results; the Freeze (section 11.2,
   `entryType`) makes a tombstone entry a result row. The assertion remains an exact count on the
   same stable pass (2 became 3: the purged record's entry, the second record and the tombstone
   entry), so it is not weakened; the old value encoded the stand-in's filtering.

No shape, layout, limit, identity, error code or protocol step of the frozen text changes.

## 31. Amendment A3.1 — A3 full CTest run: cca_core_tests waiver (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above and Amendments A1 to A7 are unchanged.
It is a sub-amendment of Amendment A3 (section 26) and refines only how the A3 precondition
run is executed on the reference host. It does not use or pre-empt A8 or A9, which are reserved
for the Phase 3 protocol.

**Run configuration.** The A3 run uses CMake preset `default`, with MSVC 19.44.35229 (Visual
Studio Build Tools 17.14), CMake 3.31.6, Ninja 1.13.2, vcpkg commit
`cd61e1e26a038e82d6550a3ebbe0fbbfe7da78e3` (tag 2026.06.24) and triplet `x64-windows`, from
`origin/main` `47595cc95204307dd43c4772c417b52f0ac8402b` (B2).

**Waived.** The `cca_core_tests` target only. It does not compile with MSVC 19.44.35229
(error C2607, `static_assert(!CanMutateCoreMetric<Observability>)` at
`repositories/cca-core/tests/observability_test.cpp:86`). MSVC 19.44 mis-evaluates access
checking in a namespace-scope concept: a private member that a conforming compiler treats as
inaccessible (so the concept is false and the assert holds) is evaluated as accessible. A
standalone reproduction, compiled with `cl /std:c++latest /EHsc r.cpp` and failing with
`r.cpp(17): error C2607: static assertion failed`:

```cpp
#include <concepts>
#include <cstdint>
enum class RuntimeMetric { cleanup_operations };
class Runtime;
class Observability final {
  public:
    int pub() const { return 0; }
  private:
    void increment_metric(RuntimeMetric metric, std::uint64_t amount = 1) {}
    friend class Runtime;
};
class Runtime {};
template <typename Type>
concept CanMutateCoreMetric = requires(Type& observability) {
    observability.increment_metric(RuntimeMetric::cleanup_operations);
};
static_assert(!CanMutateCoreMetric<Observability>);
int main() {}
```

**Why the waiver hides nothing MO-1308 changed.** `git diff --stat 1dd1e8c8..47595cc9 --
repositories/cca-core` is empty: cca-core is byte-identical between BF (`1dd1e8c8`) and B2
(`47595cc9`). The failing assertion is unchanged since commit `3827a696` (2026-07-27, IM-003).

**What is still required.** Every other build target must build. Every other registered CTest
test must run and pass, including `cca.workspace.verify`. The tests that belong to
`cca_core_tests` are excluded from the run by an explicit `-E` pattern, and their names are
recorded in the evidence. Only a run where all of that holds is `PASS`; otherwise the result is
`FAILED_PRESERVED` with each failure classified.

**Pre-existing project issues, outside MO-1308 (recorded, not fixed here).**

1. `.github/workflows/ci.yml` has no successful run in its public history; the latest completed
   Windows job (run 62) failed at checkout.
2. The MSVC concept-access defect above, which prevents `cca_core_tests` from compiling with
   MSVC 19.44.35229.
3. Under the `ci` preset (`CCA_WARNINGS_AS_ERRORS=ON`), warning C4100 is promoted to an error at
   `repositories/cca-core/include/cca/runtime/service_registry.hpp:94` and in its dependents
   (`cca_process`, `memoryos_sdk`, and the `cca_core_tests` sources).
4. The `minimal` preset fails at `repositories/cca-compiler/CMakeLists.txt:15`
   (`find_package(yaml-cpp)`) because that preset provides no vcpkg.

**Follow-up.** A separate maintenance task makes Windows CI green before the MemoryOS 1.3
release. It is outside MO-1308.

No shape, layout, limit, identity, error code or protocol step of the frozen text changes.

## 32. Amendment A3.2 — A3 differential no-regression gate (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above and Amendments A1 to A7 and A3.1 are
unchanged. It is a sub-amendment of Amendment A3 (section 26) and replaces A3's absolute gate
("a full CTest run passes") with a differential no-regression gate. It does not use or pre-empt
A8 or A9, which are reserved for the Phase 3 protocol.

**The A3.1 run is preserved.** The A3.1 run is recorded as `FAILED_PRESERVED` (evidence commit
`59dfee40320f953570aff7e833eac61c10df04e6`, binding commit
`82bb165e7c1b2ee66179e940d62f26c635bb102d`, directory
`repositories/cca-conformance/evidence/mo1308/phase3-precondition/`). It stays untouched and is
not rerun or edited.

**Rule.** CTest is run twice, with preset `default`, the A3.1 waiver (target `cca_core_tests` is
not built; only its placeholder test `cca_core_tests_NOT_BUILT` is excluded, with
`-E "^cca_core_tests_NOT_BUILT$"`), and an identical toolchain, environment and setup:

- BASELINE = BF `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` (the MO-1307 release);
- CANDIDATE = B2 `47595cc95204307dd43c4772c417b52f0ac8402b`.

The verdict is `PASS` only if all of the following hold:

1. `cca.workspace.verify` passes on CANDIDATE;
2. no test that passes on BASELINE fails or is Not Run on CANDIDATE;
3. every test present on CANDIDATE but not on BASELINE passes;
4. every test that fails on both is listed as `PRE_EXISTING` with a classification.

Any other outcome is `FAILED_PRESERVED`. The recorded runs are each made once. Setup may be
repeated. Setup installs Node dependencies from the committed lockfiles as the repository's own
tooling or CI does, completes test discovery before the recorded runs, and does not edit
repository files, create the hard-coded workspace path, or remove tags. The evidence directory
is `repositories/cca-conformance/evidence/mo1308/phase3-precondition-g2/` and contains both raw
logs, both `ctest -N` listings, the setup records, the toolchain and dependency versions, a
computed comparison table and `receipt.json` with the A3.2 verdict.

**Classifications of the 125 A3.1 failures (recorded).**

| Class | Count | Tests |
| --- | ---: | --- |
| product or toolchain (undetermined) | 112 | `*AllocationFailureTest.*`: each aborts with exit code 3 about 0.03 s after `RUN` |
| environment | 7 | `memoryos.vscode.runtime`, `memoryos.vscode.product`, `memoryos.vscode.package.validation`, `memoryos.mcp.foundation`, `memoryos.standard.mo1303-phase3`, `memoryos.standard.mo1304-phase1`, `memoryos.standard.mo1304-phase2`: Node dependencies not installed in the fresh worktree (`esbuild`, `zod`, `@modelcontextprotocol/server`, `yauzl`); `npm` not found in the pinned Node folder |
| environment | 3 | `memoryos.standard.mo1305-phase3` (hard-coded workspace root `C:/Users/melsa/Documents/Codex/cca-workspace`), `memoryos.standard.mo1304-phase3-ubuntu` and `memoryos.standard.mo1304-phase3-windows` (assert that local tag `memoryos-1.3-mo1304` does not exist) |
| test | 2 | `memoryos.standard.specification` (stale 1.2.1 pin of `repositories/cca-core/src`), `memoryos.standard.coverage-gap` (same specification conformance check) |
| environment (consequence of the A3.1 waiver) | 1 | `memoryos.standard.runtime.reference`: Not Run, needs `cca_core_tests.exe` |

The 112 allocation tests by suite: `EpisodicMemoryAllocationFailureTest` 11,
`KnowledgeRetrievalAllocationFailureTest` 15, `LongTermMemoryAllocationFailureTest` 7,
`MemoryAllocationFailureTest` 3, `MemoryConsolidationAllocationFailureTest` 6,
`MemoryProviderAllocationFailureTest` 15, `MemoryReflectionAllocationFailureTest` 10,
`MemoryStudioAllocationFailureTest` 9, `ProceduralMemoryAllocationFailureTest` 15,
`ProcessAllocationFailureTest` 4, `SemanticMemoryAllocationFailureTest` 11,
`WorkingMemoryAllocationFailureTest` 6. The full names are in `receipt.json` of the A3.1
evidence.

**Project follow-up (outside MO-1308; extends the A3.1 follow-up: Windows CI green before the
MemoryOS 1.3 release).** In addition to the A3.1 items, the maintenance task covers: the
`AllocationFailureTest` aborts; missing Node dependencies in fresh worktrees; the hard-coded
workspace path in `memoryos.standard.mo1305-phase3`; the tag-absence assertions in
`memoryos.standard.mo1304-phase3-ubuntu` and `-windows`; and the stale 1.2.1 `cca-core/src` pin
behind `memoryos.standard.specification` and `memoryos.standard.coverage-gap`.

No shape, layout, limit, identity, error code or protocol step of the frozen text changes.

## 33. Amendment A3.3 — Smart App Control: blocked-executable exclusion for the A3.2 runs (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above, Amendments A1 to A7 and A3.1, and
Amendment A3.2, are unchanged. It is a sub-amendment of Amendment A3 (section 26) and supplements
A3.2 (section 32). It does not use or pre-empt A8 or A9.

**Finding.** Smart App Control is enforcing on the reference host
(`VerifiedAndReputablePolicyState = 1`) and blocks a build-dependent set of freshly built unsigned
executables ("An Application Control policy has blocked this file"). The owner does not change
this security setting, and the A3.2 setup does not rebuild until the set is empty. Because a
blocked gtest executable aborts `ctest` discovery, `ctest -N` cannot complete in a tree that
contains one.

**Precondition proof (C/C++ source diff).** `git diff --name-only 1dd1e8c8 47595cc9` lists 186
files and none is a C or C++ source or header (`*.c`, `*.cc`, `*.cpp`, `*.cxx`, `*.h`, `*.hh`,
`*.hpp`, `*.hxx`, `*.ipp`, `*.inl`, `*.tpp` and similar); `git diff --stat` over
`repositories/cca-core`, `cca-sdk`, `cca-compiler`, `cca-cli`, the root `CMakeLists.txt`,
`CMakePresets.json`, `vcpkg.json`, `cmake` and `tests` is empty. The non-source build-related
files that did change are:

- `repositories/memoryos-cli/CMakeLists.txt` (project is `LANGUAGES NONE`: version 1.1.0 to 1.2.0 and
  three added `node --check` commands for the new history sources; no C++ target or test is
  built or changed);
- `repositories/memoryos-cli/package.json` (version 1.2.0) and
  `repositories/cca-studio/package.json` (a `test` list extended with two history test files and a
  new `test:history-phase1` script; Node tests only);
- `repositories/cca-studio/tests/fixtures/memoryos-history/1.0.0/shape-cases.json` (a Node test
  fixture);
- `tools/verify_workspace.py` (the `cca.workspace.verify` script itself, changed by MO-1308);
- `.gitattributes`.

None of them alters how any C++ test is built or what it tests.

**Exclusion rule.** After setup, every executable that the Application Control policy blocks in
either tree is identified by launching each built executable and capturing the reason. Every
CTest test whose executable is in the UNION of the two blocked sets is excluded in BOTH runs, as
`ENVIRONMENT_BLOCKED_SAC`, with the executable and test names recorded. The A3.1 waiver
(`cca_core_tests_NOT_BUILT`) applies as well. The exclusion is frozen in
`repositories/cca-conformance/evidence/mo1308/phase3-precondition-g2/setup/exclusions.json`,
committed before the recorded runs. To let `ctest` complete discovery, each blocked gtest
executable is renamed to `<name>.exe.sac-blocked` in the build directory of both trees (build
output only; no repository file changes), so that its generated include registers the existing
`<target>_NOT_BUILT` placeholder, which is excluded by name like the `cca_core_tests` placeholder.
The names of the tests such an executable would have registered are recorded from the same
executable built unblocked in the A3.1 tree (C/C++ sources are identical between BF and B2).

**Guard.** If a blocked executable is not a native C++ test or tool binary (for example `node.exe`
or anything a Node-based test or `cca.workspace.verify` depends on), the run stops and is reported
instead of excluding.

**Setup deviation accepted.** `MEMORYOS_VSCODE_NPM_EXECUTABLE` is pinned to the pinned Node
folder's `npm.cmd` at configure time (`-DMEMORYOS_VSCODE_NPM_EXECUTABLE=.../npm.cmd`), identically
in both trees, because `find_program` otherwise selects the extensionless `npm` shell script. This
deviates from "preset `default` exactly" and is recorded as such.

**Possible earlier effect (unconfirmed).** Smart App Control may explain part of the A3.1
failures: freshly built executables that were blocked appear as failed or not-run tests. This has
not been confirmed and does not change the recorded A3.1 classifications.

**Follow-up added (outside MO-1308).** Native C++ verification belongs on GitHub's Windows runners
(no Smart App Control) once Windows CI is green. While Smart App Control enforces, this host is
not a reliable native C++ execution host.

No shape, layout, limit, identity, error code or protocol step of the frozen text changes.

## 34. Amendment A8 — Phase 3 certification protocol (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above and Amendments A1 to A7 are unchanged. It adopts the Phase 3
certification protocol as the Freeze's Phase 3 campaign protocol and case inventory, as MO-1307 Freeze section 21 requires
before any campaign runs. Amendments A3.1, A3.2 and A3.3 (sections 31, 32 and 33) are recorded on branch `mo1308/phase3-precondition` and are merged
into this branch; this amendment is section 34 (see A8.5), and A8 and A9 are the numbers those amendments reserved for the Phase 3
protocol.

### A8.1 Adoption

[`docs/mo1308-phase3-protocol.md`](mo1308-phase3-protocol.md) is the Phase 3 protocol. Its status is **APPROVED — FREEZE
AMENDMENT A8 (owner approval 2026-10-06)**. It refines the Phase 3 rows of section 18.1 and H47 (section 18.3) without changing
them: it adds the per-stream case inventories, acceptance rules, the one-shot generation lifecycle (seal, run, close), failure
classes and dispositions, budgets and guards, the receipt schemas, the requirement matrix R01 to R37, the qualification register
Q01 to Q15 and the allowed path set.

### A8.2 Bound inputs

The protocol, the inventory, the candidate identity and the corpus manifest are bound by the hashes below (SHA-256 of the file
bytes at the approval commit). A later change to any of them needs a new amendment; the shared tests fail if one changes.

| File | SHA-256 |
|---|---|
| `docs/mo1308-phase3-protocol.md` | `5f5caf6d81524eabd1c88377b129fa329f0b5dd35c85234c22f1942ec6df052c` |
| `repositories/cca-conformance/mo1308-phase3-inventory.json` | `c56642c4f46e4adb82744f4176cab8d35fdd19592376ed130e89af8726d9ed1c` |
| `repositories/cca-conformance/mo1308-phase3-candidate-identity.json` | `92b33904a1ff5a868d5b13b6f1354efbf718778d0b80594ce38b7e67077a7244` |
| `repositories/cca-conformance/mo1308-phase3-corpus-manifest.json` | `b055805d2db43f414261921ded61eb69d856ad5c821139254e9ba1b7ce386c9f` |

The candidate is B2 `47595cc95204307dd43c4772c417b52f0ac8402b`: 45 production paths by git blob, `productionTreeDigest`
`sha256:ccb1575f5d8e34743b38404898b2c720ee1a0046071fc5e57c824d4b4566562a`. The corpus digest is `sha256:cfca5edb267fad074863f3ddd1945a3f8fe500a8e07d602722140d745b54a730`.

### A8.3 Owner decisions

1. The NIST-style SHA-256 tests are accepted as proposed (FIPS 180-4 example messages and the CAVP Monte Carlo procedure computed
   against `node:crypto`). **Official CAVP response files were not used**, and the disclosures state it.
2. The 45 candidate paths are confirmed.
3. The seven allowed-path classes are confirmed; ordinary documents are not candidate changes.
4. The J-C ceiling run is a separate segment that runs only after the main segments PASS, ending with JC10.
5. An F7 escalation stops the generation; a rerun requires an owner approval reference.
6. A qualification case passes with `CONFIRMED` or `NOT_CONFIRMED` and fails otherwise. The release disclosures (3C-K3 and the
   D7 operator guidance) must state the actual recorded outcome of each qualification case: a weakness that was `NOT_CONFIRMED`
   is never disclosed as confirmed, and one that was `CONFIRMED` is never omitted.
7. Rehearsal evidence lives under `evidence/mo1308/phaseNx-rehearsal-rN/`.
8. A correct run must not be able to exceed its budget by design: in every segment the step guards plus a 5-minute reserve fit
   the normal budget (3A `main` is split into `main1` and `main2`; 3C and 3B guards are rebalanced).
9. The A3 precondition is the differential gate of Amendment A3.2; the gate input is its receipt with verdict PASS. A production
   change arising from the precondition is a new candidate and returns to the owner.

The earlier planning decisions D1 to D11 (candidate by blob, the protocol as an amendment, the 90-minute and 3-hour budgets,
rehearsals, the MO-1307 failure classes, the staging `EPERM` threshold of more than 1 in 10 F7 runs, the D7 qualifications and
operator guidance, the SHA-256 review, no SBOM, observed-not-claimed locations, the `mo1308/phase3b-closure` branch) stand and
are recorded in section 2 of the protocol.

### A8.4 Effect on the frozen text

No shape, layout, limit, identity, error code or protocol step of the frozen text changes, and no production behavior changes.
Certification claims remain qualified by the register of the protocol (Q01 to Q15), including the H40 and A6 qualifications of
sections 9.4 and 29.

### A8.5 Renumbering (append-only note, 2026-10-06, owner decision)

This amendment was first approved and committed as section 33 (approval commit `607777df`). Amendment A3.3 is recorded evidence on
`mo1308/phase3-precondition` and keeps section 33; when the branches merged, A8 became section 34. The text of A8.1 to A8.4 is
unchanged apart from this section number and the sentence about A3.1 to A3.3 above. Every citation of "section 33" for A8 in the
Phase 3 protocol, the inventory and the stream documents now reads "section 34", and the protocol cites A3.1 to A3.3 by their
sections 31 to 33. The hashes of A8.2 are those of the approval commit; the bound inputs changed afterwards only as recorded in A8.6.


### A8.6 Bound inputs after the merge of A3.1 to A3.3 (append-only note, 2026-10-06, owner decision)

The protocol text now cites Amendments A3.1 to A3.3 by their Freeze sections 31 to 33 and A8 as section 34. The inventory, the candidate identity and the corpus manifest are byte-identical to A8.2. These are the bound hashes from here; a later note records each further authorized change.

| File | SHA-256 |
|---|---|
| `docs/mo1308-phase3-protocol.md` | `8c1f82d21241476fa52803d59d8c197cea590a62b50b1b8d73c96bd6d47f836f` |
| `repositories/cca-conformance/mo1308-phase3-inventory.json` | `c56642c4f46e4adb82744f4176cab8d35fdd19592376ed130e89af8726d9ed1c` |
| `repositories/cca-conformance/mo1308-phase3-candidate-identity.json` | `92b33904a1ff5a868d5b13b6f1354efbf718778d0b80594ce38b7e67077a7244` |
| `repositories/cca-conformance/mo1308-phase3-corpus-manifest.json` | `b055805d2db43f414261921ded61eb69d856ad5c821139254e9ba1b7ce386c9f` |


### A8.7 Phase 3 housekeeping: release-claim review moved to 3D (append-only note, 2026-10-06, owner decision)

Cases 3C-K1 to K3 (step K of 3C) moved to 3D as step E, cases 3D-E1 to E3, because only after all stream outcomes are known can the release claims and disclosures be reviewed. 3C now has 67 cases and 3D has 10; the total stays 211. Guards: 3C main 78 + 5 = 83 of 90; 3D main D 60 + E 15 + 5 = 80 of 90. The requirement matrix is unchanged (the moved cases map to no requirement); the qualification register cites 3D-E2 and 3D-E3. The inventory, the generated protocol tables and the guard table were regenerated; these are the bound hashes from here.

| File | SHA-256 |
|---|---|
| `docs/mo1308-phase3-protocol.md` | `f904b3a0e863d15a9a6aff58730652d21ebfc89cd601a35edcf25526c28f952b` |
| `repositories/cca-conformance/mo1308-phase3-inventory.json` | `6c59151012db60fa5ecbfa68c99673a617be60450a8763c93f68c3621ec5bd98` |
| `repositories/cca-conformance/mo1308-phase3-candidate-identity.json` | `92b33904a1ff5a868d5b13b6f1354efbf718778d0b80594ce38b7e67077a7244` |
| `repositories/cca-conformance/mo1308-phase3-corpus-manifest.json` | `b055805d2db43f414261921ded61eb69d856ad5c821139254e9ba1b7ce386c9f` |

## 35. Amendment A9 — released-bundle checks, and export never writes into its ledger (2026-10-06, owner-authorized)

This amendment is append-only. The frozen text above and Amendments A1 to A7 are unchanged. Numbering
assumption: Amendments A3.1, A3.2 and A3.3 (sections 31 to 33 on `mo1308/phase3-precondition`) and A8 (section
33 on `mo1308/phase3-shared`, which will be renumbered to 34 when both are merged) live on other branches and
are merged later, so this amendment takes section 35 and refers to its parts as A9.1 to A9.5 so that no
reference depends on a section number. Nothing here depends on the text of those amendments.

It records the owner's decisions on the findings of the A3.2 differential run (evidence `4196acf5` on
`mo1308/phase3-precondition`) and of the Phase 3C rehearsal (`mo1308/phase3c-security`, case 3C-F4), and the
outcome of two observations from Phase 3A authoring.

### A9.1 Correction principle: a vendored copy inside a released package is pinned to its release (A1 extended)

**Finding.** The A3.2 differential found `memoryos.vscode.runtime` (`runtime_foundation.test.mjs`, the test
`runtime closure manifest and identities reproduce the frozen independent digests`) failing on B2 only: the
vendored `repositories/memoryos-vscode/runtime/vendor/repositories/cca-studio/package.json` no longer equalled the
current `repositories/cca-studio/package.json` after Stream 2D. The test compared every vendored file with the
current source it was copied from. This is a check defect of the same class as Amendment A1.

**Decision.** A1 is extended to every released bundle. Vendored copies inside a released package stay
byte-identical to their released bytes (R32); they are **not** refreshed. A check of such a copy is pinned to the
bytes at the releasing tag and, where the release has a manifest, to that released manifest. It still fails on
any changed byte and on any added or removed file. It never compares a released copy with moving current source.

**Applied.**

| Bundle | Releasing tag (object, peeled commit) | Check | Before | After |
|---|---|---|---|---|
| `memoryos-vscode` runtime (37 vendored files) | `memoryos-1.3-mo1303` (`f3891cba…`, peels to `49aa80fa76bffc03e36335be8ab805bb5dc38f9c`, the commit the MO-1304 and MO-1305 tag tables name) | `memoryos.vscode.runtime`, `runtime_foundation.test.mjs` | each vendored file `deepEqual` to the current source file | each file equals its pin (length, SHA-256) and its entry in the released manifest; the manifest equals the released bytes; `verifyReleasedRuntime` finds no changed, added or removed file |
| `memoryos-mcp` runtime (25 files) | `memoryos-1.3-mo1304` (`ce7b001d…`) | `memoryos.mcp.foundation`, `integrity.test.mjs` | `assert.deepEqual(copy, source)` against the manifest's `source` path (current source) | the manifest equals the released bytes (5,566 bytes, `0b910e64…`); each copy equals its manifest entry; `verifyRuntime` (unchanged) still rejects any change |

The vscode pins are constants in `repositories/memoryos-vscode/tests/support/released-runtime-pins.mjs` (no git
access at verification time, as in A1). The new test
`repositories/cca-conformance/tests/mo1308_phase2_corrections_test.mjs` proves that each tag exists, is annotated
and peels to the recorded commit (PC01); that every pin and the manifest equal the exact blobs at the tag and
cover exactly the released directory (PC02); that every released bundle directory, including the MCP, REST, CI
and MO-1302 Action ones, is unchanged since its releasing tag (PC03); that the corrected checks pass while current
source differs from the vendored copy (PC04); and that they still fail on a one-byte change, an appended byte, an
emptied file, a manifest change, a consistently re-hashed manifest, an added file, a removed file and a link
(PC05, PC06, on temporary copies only). No assertion is weakened: an equality with a moving file is replaced by an
equality with fixed released bytes.

**Inventory.** The whole repository was searched for every test or check that compares a released vendored or
bundled copy with current source. Found and corrected: the two rows above. Found and already correct (pinned to
the release, or to the bundle's own manifest, or not a comparison with current source):

- MO-1302 Action, `tools/verify_workspace.py` `validate_mo1302_distribution` (A1);
  `mo1308_phase1_entry_obligations_test.mjs` EO3 (compares the released SDK copies in the Action, `memoryos-ci`,
  `memoryos-mcp`, `memoryos-rest` and `memoryos-vscode` with the blob at `memoryos-1.3-mo1302`);
  `mo1308_phase1_workspace_check_correction_test.mjs` WC01 to WC11.
- `memoryos-ci` and `memoryos-rest`: `src/integrity.mjs` verifies the runtime against the bundle's own closure
  manifest; no test or script reads current source (REST `tests/*.test.mjs`, CI `scripts/verify-*.mjs`).
- `memoryos-mcp` `src/integrity.mjs` `verifyRuntime`: against the manifest pinned by `contracts/runtime-pin.json`.
- `mo1303_phase1_conformance_test.mjs`: the vscode runtime against its manifest and receipt.
- `mo1308_phase2d_integration_test.mjs` D01: asserts that the released SDK copies are identical, carry version
  1.1.0 and contain no MO-1308 code; the only comparison with current source is `notEqual`.
- `mo1304_*`, `mo1305_*`, `mo1306_*`, `mo1307_*` conformance tests and tools: a pattern search found none that
  compares a bundle with current `cca-studio` or `memoryos-cli` source. Those that fail in the cloud container fail
  for environment reasons (commits and external specification checkouts absent, Node v24.21.0 pinned, Windows
  paths), not for this one; they are listed in the Windows and pinned-host items of the correction report.
- `tools/build-pinned-manifest.mjs` and the pinned requirements manifests: describe the v1.2.1 Reference
  Implementation revision (Freeze section 5.1), not a bundled copy.

Generators, not checks, and therefore not changed: `memoryos-vscode/scripts/build-runtime-distribution.mjs`
(`npm run build:runtime`, also run by `npm run build` and the `memoryos_vscode_build` target),
`memoryos-mcp/scripts/assemble.mjs` and `cca-conformance/tools/build-mo1302-action-distribution.mjs` copy the
current source into the bundle. They are release-time tools wired into no test; running any of them after the
release would rewrite released bytes (R32) and must not be done for a released bundle.

### A9.2 Export refuses a location inside its own ledger (F4): public behaviour change, owner-approved

**Finding (3C-F4).** `history export --output` accepted a path equal to or inside the ledger directory (the
root, `entries/`, `records/`, `.pending/`, or a `..` spelling that resolves there). The export was written, the
command exited 0, and the ledger then failed `verify` with `MO1308_LEDGER_CORRUPT` (inside `.pending/` it still
verified, with an anomaly). Section 12 and section 13.3 required only that `--output` not exist.

**Decision.** Fix it. `export` refuses, with the existing code `MO1308_FILESYSTEM_BOUNDARY` (section 14.1: "Path,
link, reparse-point or identity check failed", exit 4, stage `PUBLICATION`), any `--output` that is equal to or
inside the ledger root, `.pending/` included, before anything is read or created. The check is made on the
resolved path (so `entries/../x` and relative spellings are covered) and on file identity: the output or any
ancestor of it that is the ledger root by `(dev, ino)` is refused, which also covers another drive-letter, UNC or
case spelling of the same directory on a Windows host. Links and junctions on the output path are refused by the
existing component check, as before. Nothing is created and the ledger is unchanged. No new code, exit number,
shape, limit or protocol step. Outside the ledger nothing changes, including a sibling directory whose name
starts with the ledger name and a name that starts with two dots.

Before: `history init` then `history export --ledger L --output L/entries/x` exits 0, and `history verify` then
reports `MO1308_LEDGER_CORRUPT` (exit 3). After: exit 4, `MO1308_FILESYSTEM_BOUNDARY`, `verify` unchanged.

This is the only production change of this correction (`repositories/memoryos-cli/src/history-store.js`).
Tests: `history-store.test.mjs` T23 (every F4 form of the 3C case: inside the ledger, `entries/`, `records/`,
`.pending/`, the ledger itself, `entries/../x`, plus a trailing separator, dot segments, a retained record
directory, the three directories themselves, a missing directory below the ledger, a relative path, links, an
identity alias, and the successful sibling and dot-prefixed names, through both the store and the command layer);
`history-store-windows.test.mjs` W07b (drive-letter, UNC and differently cased spellings, Windows host only).

### A9.3 Observation: the CLI grammar shadows `MO1308_QUERY_INVALID` with `MO1308_USAGE` (Phase 3A)

Outcome: **the Freeze allows it; nothing changes.** Section 14.1 defines `USAGE` as an invalid command, flag or
argument, and Amendment A2 item 1 makes a malformed query flag a grammar error (`MO1308_USAGE`, exit 1, the fixed
message). A `--limit` of 0 or above 1,000, a non-decimal `--from`, an unknown `--retention` or `--kind`, or a
repeated `--kind` is therefore a usage error at the CLI. `MO1308_QUERY_INVALID` (exit 2) is still produced by the
SDK query validator for every malformed `MemoryOSHistoryQuery`, which is where section 11.2 places the rule
(`limit: 1..1000`); the SDK is not changed. Recorded as a known property: through the CLI the malformed-query cases of Phase 3A end in
`USAGE`, because the grammar rejects first.

### A9.4 Observation: `verify` lists the first 1,000 `unreferencedRecords` with no total (Phase 3A)

Outcome: **the Freeze allows it; nothing changes.** Section 14.2 fixes "Staging and unreferenced artifacts
reported: first 1,000, sorted; count exact", and section 11.1 fixes the `MemoryOSHistoryVerification` shape.
`pendingArtifacts` is an exact integer count of staging artifacts, beyond 1,000 too. The shape has no field that
carries a total of unreferenced records, and adding one would change a frozen shape, which is not a correction.
Recorded as a known limit: a ledger with more than 1,000 unreferenced records reports the first 1,000 digests,
sorted, and the exact total is available only to a reader that lists the records directory. Reaching it needs more
than 1,000 interrupted appends (each leaves one unreferenced record, section 9.2). Any change to the shape returns
to owner review.

### A9.5 Unchanged

No shape, layout, limit, identity, error code, exit number or protocol step of the frozen text changes. No released
byte, tag or released manifest changes. No evidence or binding commit is made by this correction.

## 36. Amendment A3.4 — A3.2 generation 3 and project follow-ups (2026-10-07, owner-authorized)

This amendment is append-only. The frozen text above and Amendments A1 to A7, A3.1, A3.2 and A3.3 are
unchanged. It is a sub-amendment of Amendment A3 (section 26). The section number 36 is chosen so that it collides
with neither section 34 (A8, once merged) nor section 35 (A9, on `mo1308/phase2-corrections`); references to it use
"A3.4". It does not use or pre-empt A8 or A9.

**Generation 3 of the A3.2 differential.** The generation 2 run (`phase3-precondition-g2`, `FAILED_PRESERVED`) stays
untouched. Generation 3 repeats the A3.2 rule under A3.1 and A3.3 with the same toolchain and setup, with
BASELINE = BF `1dd1e8c82fe0ed5a32a894744392f2c279f89d4c` and CANDIDATE = the binding commit of the corrected
`mo1308/phase2-corrections` head (Amendment A9; see the generation 3 setup record). Smart App Control blocked
executables are identified freshly in both new trees and the union is excluded in both runs; the exclusion list is
committed before the runs. Evidence directory:
`repositories/cca-conformance/evidence/mo1308/phase3-precondition-g3/`. Each recorded run is made once.

**Expected clean-tree effect (recorded, not a gate).** The `memoryos.mcp.foundation` CTest test runs the whole
`memoryos-mcp` test suite. When its official-client integration tests fail, that suite rewrites the tracked file
`repositories/memoryos-mcp/measurements/phase2-integration.json` (status `FAIL`, empty results). The differential
may therefore leave the worktrees dirty by that one file. It is recorded in the evidence; A3.2 has no clean-tree
gate.

**Project follow-ups (outside MO-1308; extend the A3.1 and A3.2 lists: Windows CI green before the MemoryOS 1.3
release).**

1. The `memoryos-mcp` foundation suite rewrites the tracked `measurements/phase2-integration.json` when it fails.
2. Raw `npm ci --ignore-scripts` output does not match the pruned `memoryos-mcp` dependency-closure pin: it leaves 98
   zod test files that `distribution/dependency-closure.json` excludes, so the integrity test "production dependency
   closure rejects changed, missing and extra package members" fails, and every server start in that suite ends in
   `MO1304_RUNTIME_INTEGRITY`. The failure is identical on BF (`1dd1e8c8`).
3. The `out/phase2/memoryos-mcp-0.1.0.tgz` artifact that the MCP installed-archive tests require is not produced by
   `npm ci`.

No shape, layout, limit, identity, error code or protocol step of the frozen text changes.


### A8.8 Candidate moved from B2 to the corrected head (append-only note, 2026-10-07, owner-authorized)

The Phase 3 candidate moves from B2 `47595cc95204307dd43c4772c417b52f0ac8402b` to the binding commit `b0bf2d5618e76512867bcdf49f805b22a7e12774` of `mo1308/phase2-corrections` (Amendment A9, section 35; generation 2 PASS, generation 1 preserved `FAILED_PRESERVED`; `main` is at the same commit). The only production path that changed is `repositories/memoryos-cli/src/history-store.js` (the export-inside-ledger refusal, A9.2); the other 44 production blobs are identical, including `memoryos-history-admission.js` and `mip-canonical.js` (so the SHA-256 review of 3C-D9 stays valid). The new `productionTreeDigest` is `sha256:aa9816c37289f356784d2d3655e578c03052502a5698e8669624e299796c97a8` (it was `sha256:ccb1575f5d8e34743b38404898b2c720ee1a0046071fc5e57c824d4b4566562a`). The corpus manifest is unchanged (corpus digest `sha256:cfca5edb267fad074863f3ddd1945a3f8fe500a8e07d602722140d745b54a730`).

The A3 gate input of cases 3A-A4 and 3D-D5 is the A3.2 generation 3 receipt, `repositories/cca-conformance/evidence/mo1308/phase3-precondition-g3/receipt.json` (branch head `8297ce31`, evidence `2edd9d5d`, Amendment A3.4, section 36), and the gate reads the receipt's top-level member `verdict`, which must be `PASS`; `binding.json` has no verdict member and only hashes the receipt. The allowed path set gains the three test corrections that A9.1 authorizes (`runtime_foundation.test.mjs`, `released-runtime-pins.mjs`, `memoryos-mcp/tests/integrity.test.mjs`); all 262 paths changed between BF and the candidate are classified. Cases 3C-F4 and 3A-D5 now expect `MO1308_FILESYSTEM_BOUNDARY` (exit 4) for every export-inside-ledger form. The protocol, inventory and candidate identity were regenerated; these are the bound hashes from here.

| File | SHA-256 |
|---|---|
| `docs/mo1308-phase3-protocol.md` | `b31bd1e0dcb76bbf89ffc48eef0e8232b47494ae539a7b9fc8fcb0851d8f6041` |
| `repositories/cca-conformance/mo1308-phase3-inventory.json` | `7c5fa7ed9389971ece72278d29bed65387650ff36c0992c59d5b631d61fea2d7` |
| `repositories/cca-conformance/mo1308-phase3-candidate-identity.json` | `ec85daa9245f7d581ff912cb08ec6a4b3e558cf408c1ac8de81bfeac5969bebe` |
| `repositories/cca-conformance/mo1308-phase3-corpus-manifest.json` | `b055805d2db43f414261921ded61eb69d856ad5c821139254e9ba1b7ce386c9f` |

## 37. Amendment A10 — Phase 3A findings, corrections and accepted items (2026-10-07, owner-authorized)

Note: sections 31 to 36 (A3.1 to A3.4 and related text) live on other branches (`mo1308/phase3-precondition` and others) and are merged with this section at step 3D. The same text is kept as `docs/mo1308-amendment-a10.md`, its source.

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


### A8.9 Candidate moved from b0bf2d56 to f4211c8c (append-only note, 2026-10-08, owner-authorized)

The Phase 3 candidate moves from `b0bf2d5618e76512867bcdf49f805b22a7e12774` to the binding commit `f4211c8c502f771bc78c2d2ab509c20d2b715676` of `mo1308/phase3-corrections` (Amendment A10, section 37; evidence `d1836294`; `main` is at the same commit). Exactly two production paths changed against b0bf2d56: `repositories/memoryos-cli/bin/memoryos.js` (blob `20da4ed007c9615eee940146c83ffbf964fe05a2` to `8bcfc21b5aeecedde2fd35e4022102178c1ffcd0`) and `repositories/memoryos-cli/src/history-store.js` (blob `c38ecfeadc4c1be7b4775a5ed5034a845fa32140` to `45f9d2200b4fd5a221193b1551a4df05611851a5`); the other 43 production blobs are identical, including `memoryos-history-admission.js` and `mip-canonical.js`, so the SHA-256 review of 3C-D9 stays valid. The new `productionTreeDigest` is `sha256:144171044dad6b83050cf0933ce68f243416d66ca3f39f458b15a0b8216200d3` (it was `sha256:aa9816c37289f356784d2d3655e578c03052502a5698e8669624e299796c97a8`). The corpus manifest is unchanged.

The A3 gate input of cases 3A-A4 and 3D-D5 is the A3.2 generation 4 receipt, `repositories/cca-conformance/evidence/mo1308/phase3-precondition-g4/receipt.json` (SHA-256 `d55b1c3192d858b1b111e97e872bb73e3a6d7fac5f1e6c39b2722b26f2a43e8c`, evidence `ce3876f4`, branch head `ce0d15ce`, BF `1dd1e8c8` versus `f4211c8c`), and the gate reads the receipt's top-level member `verdict`, which must be `PASS` (`binding.json` hashes the receipt and carries its own `verdict` of `PASS`). Generations 2 and 3 stay preserved and are not gate inputs. All 299 paths changed between BF and the candidate are classified; `repositories/memoryos-cli/bin/memoryos.js` joins the class CLI_HISTORY_NAMESPACE of the allowed set (it is the entry file corrected by A10) and the protocol sections 2, 3, 14 and 15 and the A3.2 bullets of section 3, the inventory titles of 3A-A4 and 3D-D5, the shared test (299 paths) and the candidate library constants were updated. No other case or budget changed. The protocol, inventory and candidate identity were regenerated; these are the bound hashes from here.

| File | SHA-256 |
|---|---|
| `docs/mo1308-phase3-protocol.md` | `1c3622ba59e97e517213c1a8e805e025e79b6fa8f3aae8f4749864514e6aa2a0` |
| `repositories/cca-conformance/mo1308-phase3-inventory.json` | `884638ed9a8b4c707f26566a064fd37c171f8347353486e1dd57038141e66c06` |
| `repositories/cca-conformance/mo1308-phase3-candidate-identity.json` | `13565f19bd393c411e7bb133a889a34eb9429185b3b8eeb8686a1ed7713e042f` |
| `repositories/cca-conformance/mo1308-phase3-corpus-manifest.json` | `b055805d2db43f414261921ded61eb69d856ad5c821139254e9ba1b7ce386c9f` |

#### A8.9 harness expectation changes

(Placeholder, filled by Task 2: harness cases whose expectations change because of A10, namely the output-write rule, staging names `<role>.<pid>.<n>`, the D4 planted-link refusal and the G3 purge-boundary refusal; the strict assertions for 3A-D4, 3A-G3 and 3A-L3; removal of `--tolerate`.)
