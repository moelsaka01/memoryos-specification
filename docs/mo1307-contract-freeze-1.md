# MemoryOS 1.3 MO-1307 — Contract Freeze 1

Status: **CONTRACT FREEZE 1 ESTABLISHED / PHASE 1 NEXT**.

**Authoritative Phase 2C publication inspection correction:** the historical
status above describes the original Freeze task. The later
[publication inspection correction](mo1307-phase2c-publication-inspection-correction.md)
supersedes only the private helper/publication rules marked below. All other
Freeze semantics and historical task boundaries remain unchanged.

## 1. Authority, baseline and scope

This document freezes `memoryos.readiness` version `1.0.0`. MUST, MUST NOT and
the closed tables/types below are normative. It resolves D01–D36 of the
[roadmap authority](mo1307-release-governance-readiness.md) and reaffirms
D37–D50. The original authority's OPEN statuses, candidate designs and next
task are historical pre-Freeze analysis; this document supplies their current
resolution. No unresolved normative decision is delegated to Phase 1.

The verified starting point is clean `main` in
`C:\Users\melsa\Documents\Codex\cca-workspace`, HEAD
`cd8221d13a3d130c92d3993f481987d2095a824c`, subject
`docs(memoryos-1.3): authorize MO-1307 release governance`, parent
`332ab0d2c35643ea8d155bcbea9c5019b304bbe3`. Annotated MO-1306 tag
`memoryos-1.3-mo1306` remains object
`9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8`, peeling to that parent.
MO-1301–MO-1306 remain released with their exact limitations.

This task creates contract documentation only: no production code, schema
files, package, dependency, Phase 1 work, certification evidence, branch,
worktree, push or tag. The normative record definitions below are sufficient
to derive the Phase 1 schemas without selecting new behavior.

MO-1307 is an offline deterministic release-readiness evaluator. It validates
explicit candidate/evidence/authority/dependency identities, composes a closed
gate vector, and produces a machine result and bounded explanation. It does
not recompute Policy, Policy Set, Regression, SDK or CLI semantics; execute CI
workflows; manage Git releases; deploy; implement IAM/RBAC, ticketing, dashboards
or an evidence database. Bounded repository conformance records do not establish
MO-1308 storage or MO-1309 UI authority.

### 1.1 Released authority read and retained

The full roadmap and MO-1307 authority, including all 50 decisions, govern this
freeze together with these scoped predecessor sources:

- [Policy authority](investigation-policies.md) and
  [MO-1301 conformance](../repositories/cca-conformance/docs/mo1301-conformance.md):
  closed owner-bound facts, exact normative bytes, independent identities and limits.
- [GitHub Policy Gate](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md)
  and [engineering conformance](../repositories/cca-conformance/docs/mo1302-engineering-conformance.md):
  Policy outcomes and operational/job outcomes are distinct.
- [VS Code](../repositories/memoryos-vscode/README.md),
  [MCP authority](mo1304-mcp-server-agent-integration.md), its
  [cache](mo1304-contract-freeze-1-cache-correction.md) and
  [Windows](mo1304-contract-freeze-windows-support-correction.md) corrections:
  released interfaces and platform exceptions remain unchanged.
- [REST Freeze](mo1305-contract-freeze-1.md),
  [platform](mo1305-contract-freeze-1-platform-correction.md),
  [verification](mo1305-contract-freeze-1-verification-methodology-correction.md),
  [metadata](mo1305-release-metadata-correction.md) corrections and
  [final release record](mo1305-phase3d-release.md): exact candidate reuse,
  bounded security/supply claims and I3/BF binding.
- [CI/CD Freeze](mo1306-contract-freeze-1.md),
  [process correction](mo1306-contract-freeze-1-process-correction.md),
  [M3](mo1306-phase3-unresolved-observation-methodology.md),
  [S3](mo1306-hosted-certification-scope-correction.md),
  [final record](mo1306-phase3d-qualified-release.md),
  [inventory](../repositories/cca-conformance/mo1306-final-release-inventory.json)
  and [binding graph](../repositories/cca-conformance/evidence/mo1306/phase3d/binding-graph.json):
  qualified providers, immutable failed attempts, exact dependency closures and
  non-self-referential evidence. Their pre-tag validators are not readiness APIs.

## 2. Architecture and human authority

The future private package owns one pure JavaScript readiness core. A thin CLI
acquires bounded immutable snapshots, invokes that core, and publishes one
result file. The core has no filesystem, network, process, environment, clock,
Git, provider or semantic-evaluator access. Existing semantic conformance is
consumed as explicitly authorized certification assertions, never recreated.

```text
Explicit operator pins + reviewed offline authority + supplied evidence
                              |
                    bounded CLI acquisition
                              |
                     pure readiness core
                              |
                canonical result + text projection
                              |
             separate optional human decision verification
```

**Computed readiness is NOT final release authorization.** Neither interface
may create/delete/push tags, push commits, merge, publish a GitHub release,
deploy, approve organizational release, or modify repository settings.
Final authorization is an explicit human action. A human record never changes
the computed assessment and is never executable authorization.

Readiness, semantic outcome, operational execution, certification, provider
support and human decision remain separate. Certification can legitimately
prove that an expected Policy FAIL/CNE or operational INPUT_ERROR/11 occurred.
The conformance gate checks the accepted assertion that required vectors
matched; it does not require every underlying decision to be PASS or every exit
to be zero. No direct business-policy PASS requirement is introduced in v1.

## 3. Versions, primitive types and canonical bytes

| Identity | Frozen value |
|---|---|
| Private package | `memoryos-readiness@0.1.0` |
| Contract | `memoryos.readiness@1.0.0` |
| Profiles | `rest@1.0.0`, `cicd@1.0.0` only |
| Gate/claim/qualification contracts | `1.0.0` each |
| Every new semantic record kind in this document | Independent `version:"1.0.0"`; private helper wire exception below |
| Human-decision record | `MemoryOSReadinessHumanDecision@1.0.0` |
| Private helper wire protocol | `2.0.0`, authoritative Phase 2C publication inspection correction; semantic records remain `1.0.0` |

These identifiers are independent of MemoryOS semantic versions, SDK/CLI
versions and package versions even where version strings coincide. Unknown
versions/profiles are rejected; no fallback, migration or user-defined profile
exists. A changed field, predicate, exit, limit, trust rule or canonical byte
requires an explicit contract correction/version review. Internal fixes cannot
silently broaden accepted inputs. Existing normative contracts are untouched.

`Digest` is `sha256:` plus 64 lowercase hex digits. `Revision` is exactly 40
lowercase hex digits (the repository's current Git object format). `Id` is
1–64 ASCII characters matching `[a-z][a-z0-9._-]*`; `Code` is 1–64 ASCII
characters matching `[A-Z][A-Z0-9_]*`. A product version is a 1–64 ASCII
`major.minor.patch` string of nonnegative decimal integers without leading
zeroes, with an optional hyphen followed by ASCII alphanumeric/dot/hyphen
prerelease text; no build metadata. All integers are nonnegative safe integers.
All record fields are required unless explicitly marked `?`; there are no
unstated defaults, extension maps or additional members. `null` is allowed
only where stated. Arrays with set semantics are duplicate-free and sorted
by the stated key; producers must emit this order and validators reject a
different order rather than silently changing identity.

`J(x)` recursively sorts object keys by ASCII, preserves the already-validated
array order, uses JSON string escaping with no insignificant whitespace, UTF-8
without BOM and exactly one trailing LF. `H(x)` is SHA-256 of the exact bytes,
including LF for J. Reject duplicate keys, invalid UTF-8, unpaired surrogates,
negative zero, fractions/exponents, unsafe integers, unknown fields and C0/DEL
controls inside strings. No Unicode normalization or locale sorting. Object
keys are ASCII. Text fields may contain other valid Unicode scalars within
their bounds; JSON escaping of quote/backslash and controls uses the standard
minimal JSON escapes. Solidus and non-ASCII scalars are not unnecessarily escaped.

New JSON inputs must equal their J re-encoding byte-for-byte. This rule does
not apply to legacy source artifacts: those remain opaque exact bytes, with
their original schemas/canonical conventions owned by predecessors. Source
floats, measurement metadata and legacy key order are not rewritten or parsed
under the new envelope rules.

## 4. Candidate and dependency identity

The canonical root is `candidateDigest = H(J(candidate))`. It identifies one
explicit candidate, not a branch or a release-name alias. The candidate record
has exactly:

```text
MemoryOSReadinessCandidate {
 kind, version,
 product: {name: "memoryos-rest"|"memoryos-ci", version: ProductVersion},
 profile: {id:"rest"|"cicd", version:"1.0.0"},
 source: {commit:Revision, tree:Revision},
 components: [Component],
 semanticContracts: [{id:Id, version:ProductVersion, sha256:Digest}],
 providers: [{id:Provider, adapterVersion:ProductVersion, componentId:Id}],
 expectedTag: {name:TagName, target:Revision},
 remoteScope: "NOT_APPLICABLE"|"SAME_HOST_RFC1918"
}
Component = {id:Id, role:Role, byteLength:Integer, sha256:Digest}
```

`kind` is the displayed record name throughout this document. `Provider` is
`generic|github|gitlab|jenkins|azure`. `Role` is `SOURCE_MEMBER|ARCHIVE|
DISTRIBUTION|CONFIGURATION|SBOM|PROVENANCE|RUNTIME_CLOSURE|RUNTIME|TOOLCHAIN|
SCHEMA|ADAPTER|SECURITY_CONTROL|DOCUMENTATION`. Components, semanticContracts
and providers are sorted by id. Component IDs are stable logical IDs, not
filesystem paths. Component content digests are authoritative identities;
Git source commit/tree supply provenance but do not substitute for them.
source.tree is the entire Git tree of source.commit, not a product subtree;
the product closure is represented by the explicit component inventory.

Exactly one ARCHIVE, DISTRIBUTION, CONFIGURATION, SBOM, PROVENANCE,
RUNTIME_CLOSURE, RUNTIME and TOOLCHAIN component is required. At least one
SOURCE_MEMBER, SCHEMA, SECURITY_CONTROL and DOCUMENTATION component is required.
The reviewed authority enumerates the complete relevant source/security/schema
closure, and the candidate must match that inventory. The semanticContracts
array is nonempty and must match the authority's exact expected identity set;
readiness never invents or updates those identities. REST has no providers or
ADAPTER components and remoteScope SAME_HOST_RFC1918; CI/CD has exactly the
five providers, each referencing a distinct ADAPTER component, and remoteScope
NOT_APPLICABLE. Product/profile pairs are fixed as shown, not caller-selectable
alternatives for a product. All component references must resolve.

CONFIGURATION identifies the assessed product/integration configuration, not
the readiness launch config. TOOLCHAIN can be a canonical reviewed inventory
of multiple build/validation tools; it does not collapse their individual
identities, which the bound inventory must enumerate. The raw manifest need
not contain package archives or every product member: supplied certification
assertions bind those candidate identities; readiness does not rebuild them.

`TagName` is 1–128 ASCII characters matching `[a-z0-9][a-z0-9._-]*`, without
`..`, trailing dot or `.lock` suffix. The expected target is the already-existing
final binding commit, which may differ from the production source commit.
No record embeds its own future commit. Receipts are separate graph inputs,
not candidate fields that would require circular binding.

The operator separately supplies `expectedCandidateDigest`. A candidate file
or config cannot supply that trust pin for itself. Changed candidate bytes
always require a new root/assessment, while section 8 permits reuse of
unaffected dependency-bound claims.

## 5. Evidence registry, envelopes and closed claims

There are **14 evidence types**. Their normalized claim contract is `1.0.0`;
legacy source kind/version remains separate provenance. Each type uses the
common payload below, plus exactly its listed `detail` variant. The listed
coverage codes are exhaustive, not examples. `passed`, `failed` and
`unevaluable` partition that type's coverage set exactly, with no duplicates.
Verdict is FAIL if failed is nonempty, otherwise UNEVALUABLE if unevaluable is
nonempty, otherwise PASS. All sets sort by code. Assertions are accepted only
through section 6, never merely because these arrays claim PASS.

Every Id/Code/Digest array in a type detail, reference list, result or
qualification is a sorted unique lexical set unless an explicit different
order is given. This includes contractIds, qualificationIds, conditionIds,
blockerIds, evidenceClaimDigests and grantDigests. Empty sets are permitted
only when no minimum/cardinality rule requires a member.

| Type | Exact coverage codes | Additional detail |
|---|---|---|
| SEMANTIC_CONFORMANCE | CONTRACT_IDENTITIES, EXPECTED_VECTORS, NORMATIVE_BYTES, SEMANTIC_PARITY | `{contractIds:[Id]}`; exact candidate semantic-contract IDs |
| EXECUTION_CERTIFICATION | NATIVE_WINDOWS, INSTALLED_EXECUTION, EXPECTED_EXITS | `{platform:"windows11-x64", runtimeComponent:Id}` |
| ARTIFACT_CERTIFICATION | ARCHIVE_MEMBERS, DISTRIBUTION, OFFLINE_INSTALL, REPRODUCIBILITY, DOCUMENTATION, RELEASE_METADATA | `{}` |
| SECURITY_AUDIT | FILESYSTEM, NETWORK, PROCESS, SECRETS, LOGGING, NEGATIVE_CORPUS | `{}` |
| SUPPLY_CHAIN_REVIEW | RUNTIME, INSTALL_TOOLING, PRODUCTION_DEPENDENCIES, ENGINEERING_VALIDATORS, SCHEMAS, LICENSES_NOTICES, ADVISORY_DISPOSITION | `{reviewScope:"DECLARED_INVENTORY_COMPLETE"|"BOUNDED_SNAPSHOT"}` |
| SBOM_VALIDATION | SCHEMA, FILE_CHECKSUMS, PACKAGE_RELATIONSHIPS | `{}` |
| PROVENANCE | SOURCE, BUILD_TOOLCHAIN, ARCHIVE_BINDING, SBOM_BINDING | `{}` |
| RESOURCE_VALIDATION | INPUT_BOUNDS, OUTPUT_BOUNDS, DEADLINES, MEMORY_CHARACTERIZATION, BOUNDARY_ENFORCEMENT | `{}` |
| PROVIDER_CERTIFICATION | IMPLEMENTATION, OFFLINE_CONTRACT, EXECUTION_SCOPE | ProviderDetail below |
| HISTORICAL_DISPOSITION | HISTORY_COMPLETE, DISPOSITION_AUTHORITY, RECURRENCE_ACCOUNTED | `{records:[History]}` |
| SCOPE_AUTHORITY | PROFILE_MATCH, QUALIFICATIONS_COMPLETE, ASSUMPTIONS_CURRENT | `{qualificationIds:[Id], conditionIds:[Id]}` |
| FINAL_BINDING | CANDIDATE_CLOSURE, RECEIPT_CLOSURE, ACYCLIC_BINDING | `{target:Revision}`; exact candidate expectedTag.target |
| REST_CONTRACT | OPENAPI, SIX_SEMANTIC_OPERATIONS, THREE_OPERATIONAL_ENDPOINTS, TLS_AUTH, SAME_HOST_REMOTE | `{remoteScope:"SAME_HOST_RFC1918"}` |
| TAG_OBSERVATION | OBSERVATION_COMPLETE | TagDetail in section 12 |

A normalized envelope has exactly:

```text
MemoryOSReadinessEvidence {
 kind, version,
 claim: {
   type: EvidenceType, version:"1.0.0", originCandidate:Digest,
   binding:"WHOLE_CANDIDATE"|"DEPENDENCY_SET",
   dependencies:[{componentId:Id, role:Role, byteLength:Integer, sha256:Digest}],
   scopeId:Id, assumptions:[{id:Id, sha256:Digest}],
   passed:[Code], failed:[Code], unevaluable:[Code], verdict:"PASS"|"FAIL"|"UNEVALUABLE",
   detail: TypeDetail, qualifications:[Qualification]
 },
 sources:[Id],
 metadata:{observedAt:String|null, runId:String|null, locator:String|null}
}
```

Metadata strings are <=256 code units, retained only for audit and never
interpreted or fetched. Dependencies sort by componentId, assumptions by id,
qualifications by id, sources by id. Sources are manifest raw-source IDs,
nonempty. `claimDigest = H(J(claim))`; `envelopeDigest` hashes exact envelope
bytes. The metadata and raw source bindings are deliberately outside the claim
digest. Their integrity is still mandatory under the separate proof binding.

FINAL_BINDING and TAG_OBSERVATION use WHOLE_CANDIDATE and must have
originCandidate equal the current root. Other types use DEPENDENCY_SET, with
nonempty dependencies and authority-approved complete closure. They may name
an older originCandidate under the exact reuse rules. Minimal role coverage:

| Claim type | Required dependency roles (all relevant IDs of each role) |
|---|---|
| SEMANTIC_CONFORMANCE | SOURCE_MEMBER, RUNTIME_CLOSURE, RUNTIME, SCHEMA, CONFIGURATION |
| EXECUTION_CERTIFICATION | SOURCE_MEMBER, ARCHIVE, RUNTIME_CLOSURE, RUNTIME, CONFIGURATION |
| ARTIFACT_CERTIFICATION | ARCHIVE, DISTRIBUTION, TOOLCHAIN, DOCUMENTATION |
| SECURITY_AUDIT | SOURCE_MEMBER, SECURITY_CONTROL, CONFIGURATION, RUNTIME |
| SUPPLY_CHAIN_REVIEW | RUNTIME, TOOLCHAIN, RUNTIME_CLOSURE, SCHEMA, DISTRIBUTION |
| SBOM_VALIDATION | SBOM, ARCHIVE, DISTRIBUTION, SCHEMA |
| PROVENANCE | PROVENANCE, ARCHIVE, SBOM, SOURCE_MEMBER, TOOLCHAIN |
| RESOURCE_VALIDATION | SOURCE_MEMBER, RUNTIME, CONFIGURATION, SECURITY_CONTROL |
| PROVIDER_CERTIFICATION | Its ADAPTER, CONFIGURATION, RUNTIME, SECURITY_CONTROL |
| HISTORICAL_DISPOSITION / SCOPE_AUTHORITY | Every component relevant to the reviewed disposition/condition; exact required IDs fixed by authority, nonempty |
| REST_CONTRACT | SOURCE_MEMBER, SCHEMA, CONFIGURATION, SECURITY_CONTROL |
| FINAL_BINDING / TAG_OBSERVATION | Empty dependency array; whole current candidate binding is mandatory |

The authority can enumerate additional dependencies, never remove the minimum
role coverage. A generic SOURCE_MEMBER role does not require every source file
of a monorepo; it requires the complete reviewed product closure recorded in
this candidate. For a provider claim, all other listed roles remain complete.

Raw legacy evidence is not arbitrarily interpreted by production. A reviewed
repository conformance record supplies the normalized assertion and exact
sources; its grant pins both. V1 recognizes these 14 types only. It does not
execute legacy validators, infer facts from prose, or dynamically load adapters.
This is explicit reviewed certification consumption, not cryptographic proof
that tests ran or automatic extraction from arbitrary source JSON. Correct
normalization is part of the authority issuer's responsibility and conformance
review, including predecessor-specific fixture checks in Phase 1.

The roadmap's 18 proposed categories close as follows: semantic conformance
and regression coverage use SEMANTIC_CONFORMANCE; security and filesystem/
network/process controls use SECURITY_AUDIT; package integrity, required docs
and release metadata use ARTIFACT_CERTIFICATION; SBOM, provenance, supply,
resources and providers use their named types; platform/CI execution uses
EXECUTION_CERTIFICATION and PROVIDER_CERTIFICATION; history and qualifications
use HISTORICAL_DISPOSITION/SCOPE_AUTHORITY; tags use TAG_OBSERVATION. Human
approvals are excluded from readiness inputs and handled separately in section
13. No residual arbitrary-document category is accepted.

## 6. Trust root, manifest and authority grants

The trust bootstrap is **explicit operator-pinned repository authority**.
The operator supplies a reviewed authority file plus `trustedAuthorityDigest`
through a launch/API argument separate from config and evidence. The digest
must match exact authority bytes. Possession of a matching digest is integrity,
not organizational authentication: choosing that pin is a trusted human or
protected-launch responsibility. Evidence-controlled configuration, fork content
or CI metadata MUST NOT choose it. V1 has no PKI, signing service or automatic
trust-on-first-use. A verifier must receive the same independently trusted pin.

The root `MemoryOSReadinessAuthority` has exactly:

```text
{kind,version,
 assessment:{candidateDigest:Digest, profile:{id,version}, stage:Stage,
   scopeId:Id, assumptions:[{id,sha256}], requiredComponents:[Component],
   semanticContracts:[{id,version,sha256}],
   grants:[Grant], slots:[Slot]},
 provenance:[AuthoritySource],
 manifestSha256:Digest}
Grant = {id:Id, claimDigest:Digest, envelopeId:Id,
 envelopeSha256:Digest, sourceIds:[Id], authoritySourceIds:[Id],
 dependencyIds:[Id], scopeId:Id, assumptions:[{id,sha256}],
 applicability:"CURRENT"|"REUSED"}
Slot = {gateId:Id, grantIds:[Id], availability:"AVAILABLE"|"UNAVAILABLE",
 reason:null|"MISSING"|"AUTHORITY_UNAVAILABLE"|"STALE"|"UNEVALUABLE"}
AuthoritySource = {id:Id, classification:"RELEASED_BINDING"|
 "CURRENT_CONFORMANCE_BINDING"|"FREEZE_SCOPE_AUTHORITY",
 revision:Revision, tree:Revision, path:RelativeFile,
 blob:Revision, byteLength:Integer, sha256:Digest,
 releaseTag:null|{name:TagName,object:Revision,target:Revision}}
```

All arrays sort by id, except slots by gateId, dependency/source/grant ID lists
lexically and assumptions by id. There is exactly one Slot for every profile
gate, including inactive gates. An available required slot has exactly one
grant except section 9's provider slots; those too select one provider claim
per provider, never an arbitrary first of several results. UNAVAILABLE has no
grants and a nonnull reason; AVAILABLE has a null reason. Inactive slots have
no grants and availability AVAILABLE. All grants must be consumed by a slot
or shared by the explicit provider parent/optional gate pair. Duplicate or
unused grants are errors. Historical sources are consumed through the reviewed
HISTORICAL_DISPOSITION claim, not separately as current certification grants.

The root pins the candidate, profile, stage, complete component/semantic
inventory, reviewed scope assumptions, grant set and manifest. claim.scopeId,
grant.scopeId and root assessment.scopeId must be equal. Claim and grant
assumptions must be identical, and each pair must occur in root assumptions;
the grant approves that subset's completeness. Unrelated added root assumptions
do not alone stale another claim. Qualification.scopeId must equal the enclosing
claim.scopeId. A grant approves
one normalized claim and exact source lineage, not an executable instruction.
It must reference at least one supplied AuthoritySource; RELEASED_BINDING must
have a tag whose target equals revision, and other classes have releaseTag null.
Source provenance is an externally reviewed repository fact pinned by the
operator; the core checks its shape, hashes and cross-bindings and does not run
Git, authenticate a user, or claim a fresh remote observation. The supplied
manifest must contain each AuthoritySource's exact source bytes and provenance
fields; mismatches fail closed. External evidence enters only through such a
reviewed grant and exact digest/source/dependency bindings. Ungranted evidence
is not a gate input; v1 does not ingest diagnostic-only extras.

For each grant, envelopeId selects exactly one ENVELOPE; its raw hash and
computed claimDigest must equal the grant, envelope.sources must exactly equal
grant.sourceIds, and dependencyIds must equal the sorted claim component IDs.
Nested history sourceIds must be included in that grant's sourceIds; nested
authoritySourceIds must be included in its authoritySourceIds. All source IDs
select SOURCE entries and all authority-source IDs select matching
AUTHORITY_SOURCE entries. Every entry is consumed by a grant or root provenance;
no undeclared evidence or unused entry is accepted. Candidate/root/manifest
candidate digests and complete component/semantic inventories must agree.
Duplicate normalized grants are rejected even if their arbitrary IDs differ;
sharing a provider claim uses the same grant ID, not a copied grant.

`MemoryOSReadinessManifest` is:

```text
{kind,version, candidateDigest:Digest,
 entries:[{id:Id, type:"ENVELOPE"|"SOURCE"|"AUTHORITY_SOURCE",
   sourceKind:String, sourceVersion:String, path:RelativeFile,
   byteLength:Integer, sha256:Digest,
   candidateBinding:Digest|null, dependencyIds:[Id],
   authorityClass:"UNTRUSTED_SOURCE"|"GRANTED_CLAIM"|
     "RELEASED_BINDING"|"CURRENT_CONFORMANCE_BINDING"|"FREEZE_SCOPE_AUTHORITY",
   git:null|{revision:Revision,tree:Revision,blob:Revision,path:RelativeFile}}]}
```

Entries sort by id; IDs and paths are unique, including case-insensitive path
comparison. sourceKind is 1–128 printable ASCII, sourceVersion 1–64 printable
ASCII. Legacy records without intrinsic kind/version use the reviewed labels
`legacy.<logical-format-id>` and `unversioned`; this does not add fields to the
source. An ENVELOPE uses
sourceKind `memoryos-readiness-evidence`, sourceVersion `1.0.0`, nonnull origin
candidateBinding, GRANTED_CLAIM, git null or exact optional repository provenance,
and exact claim dependency IDs. SOURCE retains its declared legacy kind/version,
UNTRUSTED_SOURCE, candidateBinding null, empty dependencyIds, and optional Git
provenance; it cannot directly satisfy a gate. AUTHORITY_SOURCE has the matching
authority classification, required Git provenance, null candidateBinding and
empty dependencyIds. Every listed file is acquired and checked; there are no
hidden inputs, globbing or recursive directory discovery. Unlisted files are
ignored without enumeration and can never contribute evidence.

Manifest/authority documents are bootstrap inputs and do not list or hash
themselves. Authority references manifest/envelopes/sources; envelopes contain
claims and source IDs but no authority digest; sources pre-exist grants. No
source may refer to its future normalization grant as its own authority.
The trusted grant closes the otherwise untrusted boundary explicitly. An
arbitrary correctly hashed JSON file, unsigned actor string or provider label
has no authority absent this pinned review chain.

## 7. Evidence graph and proof identities

The evaluator derives the graph; callers cannot submit gate states or graph
edges. Normative node types are ASSESSMENT, CANDIDATE, GRANT, CLAIM, DEPENDENCY
and AUTHORITY. Node IDs use `type:` followed by the node's content digest.
The ASSESSMENT node ID is the literal `assessment` (it has no self digest).
Normative edges point from consumer to prerequisite, with exactly these types:

| Edge | Endpoints |
|---|---|
| ASSESSES | ASSESSMENT -> CANDIDATE |
| ACCEPTS | ASSESSMENT -> GRANT |
| AUTHORIZES | GRANT -> CLAIM |
| ROOTED_IN | GRANT -> AUTHORITY |
| DEPENDS_ON | CLAIM -> DEPENDENCY or CANDIDATE |

WHOLE_CANDIDATE claims point to the candidate; dependency claims point only to
their exact dependency nodes. Origin candidate identity is immutable provenance
inside the claim, not an edge that requires loading every historical candidate.
No reverse edges are inferred from approval membership or source cross-links.
History and qualification references use IDs inside claims and resolved source
references in the audit projection; they never add a back-edge to an assessment.
Historical arbitrary cross-links are retained inside opaque source bytes only,
outside the normative DAG. Normative references must all resolve; cycles,
self/future references and dangling normative references are errors.

The fixed derived graph is layered; public inputs cannot edit arbitrary edges.
Cycle/self-reference negatives additionally exercise the internal graph
validator with adversarial derived-graph fixtures. The ban on opaque original
sources claiming a future grant is a reviewed provenance obligation; runtime
does not scan arbitrary legacy bytes for references. Node IDs are the uppercase
node type, a colon, and its Digest; the literal assessment is the sole exception.
These content IDs are not subject to the shorter Id grammar.

For deterministic identity without accidental metadata authority:

- CLAIM content is `claim`; DEPENDENCY content is `{id,role,byteLength,sha256}`;
  CANDIDATE content is the complete candidate.
- AUTHORITY content is `{classification,scopeId,assumptions}` for the selected
  grant/source classification. Raw revision/blob/path/time provenance is in
  the audit binding, not this normalized authority node.
- GRANT content is `{claimDigest,dependencyIds,scopeId,assumptions,applicability,
  authorityClasses}`; authorityClasses is a sorted unique class list. It omits
  envelope/source IDs and their raw hashes, which remain audit-bound.
- `authorityIdentityDigest` hashes J of `{candidateDigest,profile,stage,scopeId,
  assumptions,requiredComponents,semanticContracts,normalizedGrants,slots}`,
  with normalizedGrants the sorted unique list of normalized grant digests and
  replacing the slots' grantIds member with `grantDigests`, containing those
  sorted unique digests. All other slot fields are unchanged. This is
  normalized decision authority, not a replacement for the trusted raw pin.
- Graph nodes are `{id,type,digest}` except ASSESSMENT has digest null. Edges
  are `{from,type,to}`, sorted lexically by `(from,type,to)`; nodes sort by id.
  Identical content-addressed nodes/edges are shared once. GraphDigest hashes
  J of `{kind:"MemoryOSReadinessGraph",version:"1.0.0",nodes,edges}`.

Every result separately carries an audit projection tying claim/grant node
digests to exact envelope/source/authority bytes and the trusted root pin.
`proofBindingDigest` covers that audit projection. Changing raw operational
metadata requires new reviewed raw pins and changes proofBindingDigest; if
authoritative claims, dependencies and scope are identical, readinessDigest
stays identical. Tampered raw evidence cannot be accepted by comparing only
claimDigest. Both layers are always verified. Metadata never creates a gate.
Logical source, authority, component, condition and qualification IDs inside
claims are explicit normative identifiers. Renaming them is not a metadata-only
change. Audit filesystem locations and permitted metadata values may vary
without changing those logical IDs or normalized readiness.

## 8. Staleness, selective invalidation, reuse and history

Freshness in v1 means exact dependency, applicability, authority and assumption
identity, not wall-clock age. No evidence type has a normative age window.
Supply/advisory timestamps remain an audit snapshot; BOUNDED_SNAPSHOT requires
an explicit qualification. This neither claims current exhaustive vulnerability
coverage nor expires arbitrary older evidence. No current date enters evaluation.

For each dependency claim, compare every declared `(componentId,role,length,
digest)` to the current candidate, require the complete authority-approved
dependencyIds and minimum roles, and compare scope/assumptions to its grant.
Missing/changed identity or scope makes supplied evidence stale. Reject it with
STALE_EVIDENCE; do not silently reuse or downgrade it. A reviewed UNAVAILABLE
slot with reason STALE can instead yield a safe CNE without submitting that
invalid payload. A changed dependency invalidates only claims that include it,
provided the closure was complete; it does not invalidate unrelated claims.

CURRENT grants require originCandidate equal current candidateDigest. REUSED
grants require DEPENDENCY_SET binding and a different explicit originCandidate,
with every dependency, applicability, scope and qualification assumption
unchanged. WHOLE_CANDIDATE evidence is never reusable across candidate roots.
Historical raw sources cannot directly satisfy current certification slots. A changed
authority must be explicitly re-reviewed and pinned; no automatic promotion
of equivalent filenames/content or latest-file selection exists.

`History` fields are exactly `{id:Id, originalOutcome:"FAIL"|"BLOCKED"|
"NOT_EXECUTED"|"UNEVALUABLE", originalDisposition:String, sourceIds:[Id], conditionId:Id,
disposition:"CURRENT_APPLICABLE"|"SUPERSEDED"|"PRESERVED_NOT_APPLICABLE"|
"PRESERVED_WITH_QUALIFICATION", affectedGateIds:[Id], authoritySourceIds:[Id],
recurrence:"NOT_APPLICABLE"|"NOT_OBSERVED"|"OBSERVED"}`. Records sort by id;
all ID arrays sort and resolve. SourceIds are immutable raw sources. Disposition
authority is mandatory, including a preserved failure whose cause is unknown.
originalDisposition is the exact original disposition text (1–256 printable
ASCII), distinct from normalized originalOutcome; no outcome is rewritten.

The HISTORICAL_DISPOSITION claim and root must account for every failure or
unclosed-gate record identified by the reviewed source inventory. Successful,
completed and authority-change rows remain in the exact raw source; they are
not forced into a negative outcome enum. For MO-1306 this is exactly the 12
rows with historicalFailureOrUnclosedGate=true; all 19 source rows stay bound.
For other reviewed sources the root grants the explicit failure inventory, not
a runtime heuristic over prose. Omitting/rewriting a required row invalidates
the granted claim digest. CURRENT_APPLICABLE or
OBSERVED recurrence contributes CONDITION_UNSATISFIED blockers to each named
active mandatory gate. Other dispositions never turn the original outcome to
PASS. PRESERVED_WITH_QUALIFICATION requires the corresponding active historical
qualification. No active gate link means no current blocker. Empty affected
gates are allowed only for SUPERSEDED/PRESERVED_NOT_APPLICABLE. M3's narrow
eligibility/recurrence authority is retained, never generalized into a waiver.

## 9. Profiles, gate definitions and provider requirements

Exactly two profiles exist. REST assesses memoryos-rest; CI/CD assesses
memoryos-ci. Core, SDK, arbitrary integrations and MO-1307 self-assessment are
excluded from v1 profiles. This bounded selection derives from the released
MO-1305/1306 evidence. MO-1307's own certification uses ordinary conformance
records; it does not recursively evaluate its own final readiness.

A compiled GateDefinition has exactly `{id,version,mandatory,applicability,
evidenceType,provider,minimumRoles,acceptedVerdict,qualificationRule,
failureRule}`. Version is 1.0.0, provider is null except provider gates,
acceptedVerdict PASS, failureRule `ALL_FAILED_CHECKS`, and minimumRoles is the
section 5 type-specific rule. Applicability is one of ALWAYS, REST_ONLY,
CICD_ONLY, PRE_TAG, POST_TAG; it is not an expression language. The tables
below fix every other field. qualificationRule is a closed enum: RETAIN for
artifact/binding/provenance/resources/sbom/security/semantic/windows/tag;
HISTORY for history; PROVIDER for each mandatory provider gate; OBSERVE for
optional live/hosted gates; SAME_HOST for rest.contract; COMPLETE for scope;
ADVISORY for supply. The table descriptions explain those exact enum values.
Users cannot add, delete, override or reorder
definitions, select different mandatory flags, or submit precomputed states.

Both profiles emit the following **22 gates**, ordered by gate ID:

| Gate ID | Evidence / selector | Mandatory and applicability | Qualification rule |
|---|---|---|---|
| artifact | ARTIFACT_CERTIFICATION | true / ALWAYS | retain all authorized qualifications |
| binding | FINAL_BINDING | true / ALWAYS | retain |
| history | HISTORICAL_DISPOSITION | true / ALWAYS | require preserved-history disclosures |
| provenance | PROVENANCE | true / ALWAYS | retain |
| provider.azure | PROVIDER_CERTIFICATION / azure | true / CICD_ONLY | contract-only limitation when not live-certified |
| provider.azure.live | same azure claim | false / CICD_ONLY | retain live status; no additional duplicate qualification |
| provider.generic | PROVIDER_CERTIFICATION / generic | true / CICD_ONLY | real native execution required |
| provider.github | PROVIDER_CERTIFICATION / github | true / CICD_ONLY | hosted limitation unless fully hosted-certified |
| provider.github.hosted | same github claim | false / CICD_ONLY | retain hosted status |
| provider.gitlab | PROVIDER_CERTIFICATION / gitlab | true / CICD_ONLY | contract-only limitation when not live-certified |
| provider.gitlab.live | same gitlab claim | false / CICD_ONLY | retain live status |
| provider.jenkins | PROVIDER_CERTIFICATION / jenkins | true / CICD_ONLY | contract-only limitation when not live-certified |
| provider.jenkins.live | same jenkins claim | false / CICD_ONLY | retain live status |
| resources | RESOURCE_VALIDATION | true / ALWAYS | retain |
| rest.contract | REST_CONTRACT | true / REST_ONLY | SAME_HOST_REMOTE_ONLY required |
| sbom | SBOM_VALIDATION | true / ALWAYS | retain |
| scope | SCOPE_AUTHORITY | true / ALWAYS | exact complete qualification/condition inventory |
| security | SECURITY_AUDIT | true / ALWAYS | retain |
| semantic | SEMANTIC_CONFORMANCE | true / ALWAYS | retain |
| supply | SUPPLY_CHAIN_REVIEW | true / ALWAYS | BOUNDED_ADVISORY_REVIEW for BOUNDED_SNAPSHOT |
| tag | TAG_OBSERVATION | true / ALWAYS; stage predicate in section 12 | no qualification can waive a wrong tag |
| windows | EXECUTION_CERTIFICATION | true / ALWAYS | native Windows required |

For inactive REST_ONLY/CICD_ONLY gates, state is NOT_APPLICABLE and slot is
empty. Optional live/hosted gates in CI/CD are NOT_REQUIRED regardless of the
observed execution result; their slot exactly mirrors the parent provider gate's grantIds, availability
and reason. When the parent is UNAVAILABLE, the optional child still emits
NOT_REQUIRED with null digests and no fabricated provider observation; the
parent contributes CNE. When available, both reference the same grant. This shared use is permitted. Their retained
observation and qualification remain visible. NOT_REQUIRED is not certification.
There are no other optional gates and no applicability inferred from missing
data. Provider claims have the type's fixed dependencies and exact provider id.

`ProviderDetail` is exactly `{provider:Provider, implementation:"IMPLEMENTED"|
"NOT_IMPLEMENTED", validation:"OFFLINE_VALIDATED"|"CONTRACT_VALIDATED"|
"REAL_EXECUTION_CERTIFIED"|"NOT_VALIDATED", execution:"REAL_EXECUTION_CERTIFIED"|
"HOSTED_EXECUTION_CERTIFIED"|"HOSTED_EXECUTION_NOT_CERTIFIED"|
"LIVE_PROVIDER_CERTIFIED"|"NOT_LIVE_PROVIDER_CERTIFIED"|"NOT_CERTIFIED",
sourceExecutionLabel:Code, support:"SUPPORTED"|
"SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION"|
"SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY"|"UNSUPPORTED",
hostedCases:{pass:boolean,fail:boolean,cne:boolean,parity:boolean}|null}`.

The provider axes have no invented universal ranking. Requirements are exact:

- Generic: IMPLEMENTED, validation REAL_EXECUTION_CERTIFIED, execution
  REAL_EXECUTION_CERTIFIED and SUPPORTED; hostedCases null.
- GitHub: IMPLEMENTED and OFFLINE_VALIDATED. Either hosted execution is
  HOSTED_EXECUTION_CERTIFIED with all four hostedCases true and SUPPORTED, or
  HOSTED_EXECUTION_NOT_CERTIFIED/NOT_CERTIFIED with qualified hosted support
  and HOSTED_NOT_CERTIFIED disclosure. A source NOT_CERTIFIED normalizes to
  HOSTED_EXECUTION_NOT_CERTIFIED only for this GitHub field, preserving
  sourceExecutionLabel. Partial hosted cases cannot claim full certification.
- GitLab/Jenkins/Azure: IMPLEMENTED and CONTRACT_VALIDATED. LIVE_PROVIDER_CERTIFIED
  permits SUPPORTED; NOT_LIVE_PROVIDER_CERTIFIED requires contract-only support
  and PROVIDER_NOT_LIVE_CERTIFIED disclosure. hostedCases null.

An authoritative known lower implementation/validation level or unsupported
support state is a mandatory provider blocker, not a qualification that meets
the minimum. Valid contradictory execution/support/qualification claims are
rejected as QUALIFICATION_MISMATCH. Claims of execution certification require
the source lineage and granted coverage of that exact provider/candidate; a
Generic or MO-1302 certificate cannot satisfy GitHub MO-1306 execution.
Future providers require contract review, not a hard-coded plugin extension.
sourceExecutionLabel must equal execution except GitHub's original NOT_CERTIFIED
may normalize to HOSTED_EXECUTION_NOT_CERTIFIED. No other alias is accepted.

Provider minimum checks use IMPLEMENTATION, OFFLINE_CONTRACT, EXECUTION_SCOPE
and SUPPORT_DISPOSITION, respectively. Missing required real execution is
EXECUTION_SCOPE; wrong supported/qualified label is SUPPORT_DISPOSITION.
Contradictory claims of full hosted certification without all four cases are
QUALIFICATION_MISMATCH, not an accepted weaker certificate. For a provider
coverage code also failing its minimum, emit one blocker using
PROVIDER_MINIMUM_UNMET; otherwise a failed coverage code uses CHECK_FAILED.
Coverage UNEVALUABLE remains CNE unless a known minimum failure proves a blocker.

For an unmet implementation/validation minimum, UNSUPPORTED with NOT_CERTIFIED
execution and no qualifications is structurally valid and yields a blocker;
it is not rejected as a malformed qualified-support combination. The stricter
support/qualification consistency rules apply when claiming the minimum is met.

## 10. Gate states, CNE and aggregation

The six gate states are SATISFIED, SATISFIED_WITH_QUALIFICATION, BLOCKED,
NOT_REQUIRED, NOT_APPLICABLE and COULD_NOT_EVALUATE. History is metadata in
the historical claim, not a seventh state that competes with a current gate.

The root, candidate, manifest, grants, graph and all supplied bytes must first
be safe and valid. Malformed/forged/cyclic input is an operational error with
no result. An explicit trusted UNAVAILABLE slot is a complete representation
of absent/unevaluable authority, not a dangling graph reference. It is allowed
to produce CNE. Unexpected missing/unreadable declared files, corrupt JSON or
invalid grants are errors; they are not repaired into UNAVAILABLE slots.

For every compiled gate, without short-circuiting:

1. If its applicability is false, emit NOT_APPLICABLE, no blockers/CNE.
2. If applicable and mandatory=false, emit NOT_REQUIRED with retained provider
   observation and authorized qualification references; failure is not BLOCKED.
3. If applicable/mandatory and slot UNAVAILABLE, emit COULD_NOT_EVALUATE with
   its exact reason. Do not infer inapplicability or a passing condition.
4. Otherwise validate the selected claim and profile-specific conditions.
   Every failed coverage code, provider minimum failure, tag-stage failure or
   currently applicable historical condition adds a blocker. If any exists,
   emit BLOCKED, retaining any unevaluable checks too.
5. Otherwise if any required check is unevaluable, emit COULD_NOT_EVALUATE.
6. Otherwise if any attached active release-impacting qualification exists,
   emit SATISFIED_WITH_QUALIFICATION; else SATISFIED.

After all slots are evaluated, merge every CURRENT_APPLICABLE/OBSERVED historical
condition into its named active mandatory gates, including an otherwise CNE
gate. Set any gate with a merged blocker to BLOCKED, retaining its CNE reasons.
An unavailable scope/history slot leaves its completeness check unevaluable;
retain all qualifications/history known from other valid claims and yield CNE
unless a proven blocker dominates. Do not invent a missing inventory or reject
a deliberately unavailable slot as a malformed supplied claim.

Collect every blocker, CNE reason, history disposition and qualification across
all gates before aggregate selection. The exact precedence is:

```text
if blockers.length > 0:                    NOT_READY
else if mandatoryCneReasons.length > 0:    COULD_NOT_EVALUATE
else if activeReleaseQualifications > 0:   READY_WITH_QUALIFICATIONS
else:                                     READY
```

An informational qualification alone does not change READY. Mandatory BLOCKED
always dominates independent CNE, but neither erases the other. NOT_REQUIRED
and NOT_APPLICABLE never contribute failures. Qualifications from accepted
optional provider limitations do contribute to qualified readiness. Missing
required scope/history authority produces CNE and cannot silently suppress
potential qualifications. The same complete safe gate vector always produces
the same state. Empty/edited gate vectors are invalid.

## 11. Qualifications, blockers and explanation codes

`Qualification` is exactly `{id:Id,type:"MemoryOSReadinessQualification",
version:"1.0.0",gateIds:[Id],provider:Provider|null,scopeId:Id,
reasonCode:QCode,impact:"RELEASE_IMPACTING"|"INFORMATIONAL",
disclosureCode:QCode,conditionIds:[Id]}`. It is embedded in a claim; its source
claim and grant supply evidence and authority references without a hash cycle.
IDs are unique across the assessment; repeated identical records share one
identity, conflicting records with the same ID are errors. gateIds and
conditionIds sort and resolve to the profile/history/scope inventory. Active
qualifications are the union from all current/reused selected claims, including
optional provider parents. The result adds candidateDigest, evidenceClaimDigests
and grantDigests as derived fields, the latter two sorted unique digest arrays
of every selected claim/grant carrying that identical record. No free-form
explanation is normative.

| QCode / disclosureCode | Fixed impact | Required meaning |
|---|---|---|
| HOSTED_NOT_CERTIFIED | RELEASE_IMPACTING | Hosted execution is not certified; retain case/parity limits. |
| PROVIDER_NOT_LIVE_CERTIFIED | RELEASE_IMPACTING | Adapter is contract validated; live provider execution is not certified. |
| SAME_HOST_REMOTE_ONLY | RELEASE_IMPACTING | Remote certification covers same-host assigned RFC1918 mode only. |
| BOUNDED_ADVISORY_REVIEW | RELEASE_IMPACTING | Advisory review is the declared bounded snapshot, not an exhaustive current census. |
| HISTORICAL_UNRESOLVED_PRESERVED | RELEASE_IMPACTING | Identified unresolved history is preserved under the exact scoped disposition. |
| PLATFORM_NOT_REQUIRED | INFORMATIONAL | Named historical platform requirement is not required for this profile. |
| ENVIRONMENT_LIMITATION | INFORMATIONAL | Environmental observation only; cannot satisfy or waive a mandatory condition. |

QCode is this closed seven-code set; impact and disclosureCode must equal its
table values. Scope authority's qualificationIds must exactly equal the union
required by all selected claims and profile predicates. Missing, extra,
conflicting or improperly weakened qualifications are errors. Qualified states
and every machine/text projection retain all active records, even when the
aggregate is NOT_READY/CNE. Limits cause errors, never truncation.

Matching required qualification predicates is exact: HOSTED_NOT_CERTIFIED has
provider github and gateIds exactly [provider.github,provider.github.hosted];
PROVIDER_NOT_LIVE_CERTIFIED has its gitlab/jenkins/azure provider and exactly
its mandatory and .live gates. SAME_HOST_REMOTE_ONLY has provider null and
[rest.contract]; BOUNDED_ADVISORY_REVIEW has provider null and [supply]. Those
four classes have empty conditionIds. HISTORICAL_UNRESOLVED_PRESERVED has
provider null, one conditionId and the exact affectedGateIds of that preserved
history row. PLATFORM_NOT_REQUIRED and ENVIRONMENT_LIMITATION have provider
null, nonempty gateIds and empty conditionIds. Their gates may be inactive;
their informational impact cannot waive a condition. All required records have
matching scope and source/grant authority. Each required provider/condition
gets its own record; repeated identical records are shared, not substituted.

When scope/history is intentionally UNAVAILABLE, locally validate and retain
all supplied known qualifications/conditions, but defer only completeness and
missing-inventory reference checks to that gate's CNE. If the corresponding
inventory is supplied, omissions/conflicts/dangling condition IDs are errors.
An unavailable inventory never asserts that the known union is complete.

`Blocker` in the result is `{id:Id,gateId:Id,reasonCode:"CHECK_FAILED"|
"PROVIDER_MINIMUM_UNMET"|"TAG_CONDITION_UNMET"|"CONDITION_UNSATISFIED",
checkCode:Code,claimDigest:Digest|null,grantDigest:Digest|null,
candidateDigest:Digest,conditionId:Id|null}`. Blocker id is `blocker.` plus the 64 hex digits of
H(J({gateId,reasonCode,checkCode,conditionId})); this 72-character ID is an
explicit exception to Id's length. Historical blockers use checkCode
HISTORICAL_CONDITION and their exact conditionId. Ordinary checks have null
conditionId. Identical (gate,checkCode,conditionId) findings merge into one
blocker, preferring CONDITION_UNSATISFIED, then PROVIDER_MINIMUM_UNMET, then
TAG_CONDITION_UNMET, then CHECK_FAILED; all distinct failures remain. The
claim/grant reference is the selected history grant for historical conditions,
otherwise the selected gate grant. This prevents a known negative condition
from becoming a duplicate-ID operational error. No remediation
workflow/category is normative in v1. CNE reason records are
`{gateId,reason:"MISSING"|"AUTHORITY_UNAVAILABLE"|"STALE"|"UNEVALUABLE",
checkCode:Code|null}`; unique records sort by `(gateId,reason,checkCode)`.

## 12. Tag stages and observations

Both stages exist: PRE_TAG_READINESS and POST_TAG_VERIFICATION. The trusted
root and config must select the same stage. `TagDetail` is exactly
`{name:TagName,presence:"ABSENT"|"PRESENT",object:Revision|null,
annotated:boolean|null,peeledTarget:Revision|null}`. ABSENT requires all three
nullable fields null; PRESENT requires all nonnull. This is an authorized
supplied observation, not a live query. It is WHOLE_CANDIDATE-bound.

The tag gate's checkCode values are TAG_NAME, TAG_PRESENCE, TAG_ANNOTATION and
TAG_TARGET, evaluated in this order and retaining all failures that can be
established. Name must always equal candidate expectedTag.name. PRE_TAG requires
ABSENT; any PRESENT tag blocks that stage, including a correctly targeted tag.
POST_TAG requires PRESENT, annotated=true and peeledTarget=expectedTag.target.
ABSENT POST_TAG fails TAG_PRESENCE only (annotation/target are unavailable,
not additional fabricated failures). Lightweight/wrong-target/wrong-name are
known negative conditions and yield blockers. A forged observation/grant or
wrong candidate root is an operational error. Unavailable trusted tag slot is
CNE. No tag operation exists in either API.

A later observation produces a new assessment/proof for its stage; it never
rewrites an older ABSENT snapshot. The MO-1306 released vector uses POST_TAG
with the actual tag; its original pre-tag inventory remains historical.

## 13. Optional external human decision record

V1 includes structural/binding verification of one optional, externally authored
record, separate from all readiness inputs and digests. Its exact shape is:

```text
MemoryOSReadinessHumanDecision {
 kind,version, candidateDigest:Digest, readinessDigest:Digest,
 proofBindingDigest:Digest, decision:"APPROVE"|"REJECT"|"DEFER", reason:String,
 actor:String|null, timestamp:String|null,
 authenticity:"NOT_VERIFIED_BY_MEMORYOS", attestation:Digest|null
}
```

Reason is nonempty <=1024 code units; actor <=128. Timestamp, if supplied, is
exact UTC `YYYY-MM-DDTHH:mm:ssZ` with a valid Gregorian date and no leap second;
it is an external claim, not consulted for freshness or ordering. Attestation
is an opaque external record digest, never fetched or signature-verified.
No credentials, key material, roles or authorization tokens are accepted.

Verification binds candidateDigest, readinessDigest and proofBindingDigest to a result just
recomputed and verified from independently pinned inputs. Mismatch is
DECISION_MISMATCH. Authenticity always remains NOT_VERIFIED_BY_MEMORYOS,
including a supplied actor/attestation. APPROVE with READY or QUALIFIED yields
decision consistency CONSISTENT; APPROVE with NOT_READY/CNE yields
CONTRARY_TO_READINESS. REJECT or DEFER is CONSISTENT for any readiness. None
changes the assessment or establishes actual human authority. Unknown actor
(null or any bounded string) authenticates nothing. A contrary record is
retained as a claimed decision, not treated as permission to release.

The API accepts zero or one record; no latest-wins, conflict resolution,
revocation service or approval workflow. Corrections are new external records
retaining old ones under the repository's human governance; v1 does not select
among them. Decision bytes/digest belong outside the result/proof bundle. A new raw proof
binding invalidates a previous decision binding even if normalized readiness
is identical; there is no automatic carry-forward of human review.

## 14. Canonical machine result, digests and human output

Exactly one file is published: **`memoryos-readiness-result.json`**.

```text
MemoryOSReadinessResult {
 kind,version,
 assessment:{contract:{id:"memoryos.readiness",version:"1.0.0"},
   candidate:Candidate,candidateDigest:Digest,profile:{id,version},stage:Stage,
   authorityIdentityDigest:Digest,readiness:ReadinessState,
   gates:[GateResult],blockers:[Blocker],qualifications:[DerivedQualification],
   cneReasons:[CneReason],history:[HistoryProjection],providers:[ProviderDetail],
   graph:Graph,graphDigest:Digest,
   requiredHumanActions:["REVIEW_READINESS_AND_LIMITATIONS","DECIDE_RELEASE"]},
 readinessDigest:Digest,
 audit:{trustedAuthorityDigest:Digest,manifestSha256:Digest,
   candidateFileSha256:Digest,configurationSha256:Digest,
   inputs:[ManifestEntry],authoritySources:[AuthoritySource],
   bindings:[{grantId:Id,grantDigest:Digest,claimDigest:Digest,
     envelopeId:Id,envelopeSha256:Digest,sourceIds:[Id],authoritySourceIds:[Id]}]},
 proofBindingDigest:Digest
}
```

GateResult is exactly `{id,version,mandatory,applicable,state,claimDigest:
Digest|null,grantDigest:Digest|null,blockerIds:[String],qualificationIds:[Id],
cneReasons:[CneReason]}`. Inactive gates have null digests/empty arrays.
Optional provider gates retain their selected parent claim/grant digest and
qualification IDs. Gate results order by id; blockers/qualifications/history
by id; providers by provider; audit inputs/bindings by id/grantId. A
HistoryProjection is exactly `{id,originalOutcome,originalDisposition,conditionId,disposition,
affectedGateIds,recurrence,claimDigest,grantDigest}`. The last two identify the
selected enclosing HISTORICAL_DISPOSITION claim and normalized grant; other
values copy that History record exactly. Its exact raw source/authority links
remain in the audit-bound envelope. Empty/unavailable history produces no
invented records and retains its gate CNE. The providers array contains exactly
the available mandatory provider parents' ProviderDetail rows, one per provider.
Unavailable parents contribute no fabricated row; their gate CNE and optional
NOT_REQUIRED/null digests remain visible. Inactive profiles have no provider rows.

`readinessDigest = H(J({kind:"MemoryOSReadinessIdentity",version:"1.0.0",
assessment}))`. `proofBindingDigest = H(J({kind:"MemoryOSReadinessProofBinding",
version:"1.0.0",readinessDigest,audit}))`. The entire file uses J and has a
separate ordinary byte hash when a later receipt lists it. No digest includes
its own field. All assessment fields are normative; audit binds exact supplied
provenance without changing readiness identity. Changing candidate, normalized
authority, stage, claim, dependencies, gates, qualifiers or graph changes the
readiness identity. Changing only permitted envelope/operational metadata with
new valid raw pins changes proofBindingDigest, not readinessDigest.

Hostnames, usernames, run/job IDs, paths, URLs and timestamps are never inferred
from the environment. Where retained in sources/metadata/audit they are opaque,
never selectors. Candidate logical component IDs and expected tag name are
normative explicit identifiers, not ambient filesystem paths.

CLI stdout defaults to one J JSON line:
`{kind:"MemoryOSReadinessSummary",version:"1.0.0",operation:"evaluate"|
"verify",readiness,readinessDigest,proofBindingDigest,blockerCount,
qualificationCount,cneCount,decision:null|{decision,consistency,
authenticity:"NOT_VERIFIED_BY_MEMORYOS"}}`.
Counts and digest references preserve access to the full mandatory disclosures;
the summary is not a standalone complete readiness report. `--format text`
emits, in order: readiness/digests, every gate id/state, every blocker id/code,
every CNE gate/reason, every qualification id/code/provider/impact, every history
id/outcome/disposition, provider matrix, and the two required-human-action codes.
Lines use `key=value` tokens separated by one ASCII space, LF; null renders
`null`; arrays join with comma; no user-authored reason/source text or clickable
URLs are interpolated. A decision check adds its three fixed fields last.
Exact text line templates, in the preceding order, are frozen below. Repeat
row templates in the same sorted order as the corresponding result arrays;
omit a row family when empty. Values use their literal enum/ID/digest/boolean,
null is `null`, and sets join with comma (empty set renders `[]`). Prefixes and
keys are literal; exactly one space separates fields and every line ends LF.
No additional heading, ANSI styling, localization or prose is inserted.

```text
readiness=<state> readinessDigest=<digest> proofBindingDigest=<digest>
gate=<id> state=<state>
blocker=<id> gate=<id> reason=<code> check=<code> condition=<id-or-null>
cne=<gateId> reason=<code> check=<code-or-null>
qualification=<id> reason=<code> impact=<impact> provider=<provider-or-null> gates=<ids> conditions=<ids>
history=<id> outcome=<normalized-outcome> disposition=<disposition> recurrence=<recurrence>
provider=<provider> implementation=<implementation> validation=<validation> execution=<execution> sourceExecutionLabel=<code> support=<support> hostedPass=<boolean-or-null> hostedFail=<boolean-or-null> hostedCne=<boolean-or-null> hostedParity=<boolean-or-null>
humanAction=REVIEW_READINESS_AND_LIMITATIONS
humanAction=DECIDE_RELEASE
decision=<decision> consistency=<consistency> authenticity=NOT_VERIFIED_BY_MEMORYOS
```

The final decision line exists only for verify with a decision record; hosted
fields are null when hostedCases is null. Both projections derive only from
the verified result. Diagnostics go to stderr.

## 15. Operational errors and exits

The closed catalog has **21 codes**, prefixed `MO1307_` on the wire. No
pre-publication operational failure publishes a normative readiness result.
A post-commit stdout failure is the explicit section 19 exception: preserve the
already committed valid file, return OUTPUT, and never claim a success summary.
These exit values
belong only to the new executable; predecessor semantic exits are unchanged.

| Suffix | Exit | Meaning |
|---|---:|---|
| USAGE | 10 | Invalid command/argument/unsupported launch form |
| CONFIGURATION | 11 | Invalid config shape or config/root disagreement other than profile/candidate |
| INPUT | 12 | Malformed new JSON, unexpected missing/unreadable input, dangling input/reference, duplicate ID |
| INTEGRITY | 13 | Length/digest/canonical-byte/cross-binding contradiction |
| CANDIDATE_MISMATCH | 14 | Expected candidate/root/whole-candidate mismatch |
| EVIDENCE_VERSION | 15 | Unknown record/evidence/contract version |
| EVIDENCE_AUTHORITY | 16 | Missing/invalid grant, authority provenance or root trust pin |
| GRAPH_CYCLE | 17 | Normative cycle, self/future reference |
| GRAPH_LIMIT | 18 | Node/edge ceiling exceeded |
| STALE_EVIDENCE | 19 | Supplied claim dependency/scope/assumption mismatch |
| FILESYSTEM_BOUNDARY | 20 | Disallowed path/link/reparse/root/race condition |
| OUTPUT | 21 | Publication, existing destination, output-size/summary-size or stdout-write failure |
| INTERNAL | 22 | Unexpected implementation fault or worker crash |
| QUALIFICATION_MISMATCH | 23 | Missing/extra/conflicting qualification or false provider promotion |
| HISTORY_MISMATCH | 24 | Rewritten/missing history or invalid disposition/recurrence references |
| PROFILE_MISMATCH | 25 | Unknown/substituted profile or attempted gate redefinition |
| RESULT_MISMATCH | 26 | Supplied result differs from exact recomputed result |
| DECISION_MISMATCH | 27 | Malformed/incorrectly bound optional human decision |
| RESOURCE_LIMIT | 28 | Other input/parser/count/heap admission limits exceeded |
| TIMEOUT | 29 | Assessment deadline reached before completion |
| CANCELLED | 30 | Caller cancellation/control-C before completed return/publication |

Evaluate exits: READY=0, READY_WITH_QUALIFICATIONS=2, NOT_READY=3,
COULD_NOT_EVALUATE=4. Exit 2 is a completed qualified assessment, not an
operational failure; consumers must use the state, never invent Policy FAIL.
Verify exits 0 for a fully verified result regardless of its readiness state
and for a structurally valid contrary decision; its summary reports both.
Verify never means release approval. Any operational error uses its table exit.

Validation phases are ordered: LAUNCH, CONFIGURATION, ACQUISITION, INTEGRITY,
AUTHORITY, GRAPH, EVALUATION, VERIFICATION, PUBLICATION. Detect all safely
inspectable errors within a phase, choose the smallest numeric error exit,
then smallest logical input/reference ID; do not proceed past that phase.
The exact phase/check assignment is:

| Phase | Ordered responsibility |
|---|---|
| LAUNCH | Argv/pin syntax, trusted runtime/forbidden preload options, operational timer initialization; USAGE wins malformed launch. |
| CONFIGURATION | Acquire bounded config/authority/candidate/manifest bootstrap snapshots with filesystem checks; raw authority pin mismatch is EVIDENCE_AUTHORITY; raw candidate pin mismatch is CANDIDATE_MISMATCH. Parse strict bootstrap J and versions, then config shape/profile/stage and root manifest digest; noncanonical bytes or root manifest digest mismatch use INTEGRITY. Config shape uses CONFIGURATION, other malformed bootstrap uses INPUT, unknown version EVIDENCE_VERSION, profile mismatch PROFILE_MISMATCH. Collect inspectable failures within this phase using numeric precedence. |
| ACQUISITION | Read the explicit manifest files in ID order; verify also acquires bounded result and optional decision snapshots, without interpreting their contents yet. Path violations FILESYSTEM_BOUNDARY, unexpected absence/read failure INPUT, caps RESOURCE_LIMIT. |
| INTEGRITY | Check all declared lengths/raw digests first; only intact envelopes undergo strict J/shape/version parsing and claim-digest computation. Raw mismatch INTEGRITY; malformed envelope INPUT; unknown evidence version EVIDENCE_VERSION; parser caps RESOURCE_LIMIT. Raw opaque sources are never new-JSON parsed. |
| AUTHORITY | Candidate/profile/component equality, grant/source/manifest correspondence, exact dependency completeness/scope/applicability and reuse; use CANDIDATE_MISMATCH, PROFILE_MISMATCH, EVIDENCE_AUTHORITY, STALE_EVIDENCE or INPUT for dangling declared IDs according to their catalog definitions. |
| GRAPH | Build and bound typed nodes/edges, enforce graph/reference/self/cycle rules. |
| EVALUATION | Validate coverage/qualification/history/provider/tag cross-fields; calculate all gates, blockers and normalized/audit result; supplied contradictions use INTEGRITY, QUALIFICATION_MISMATCH or HISTORY_MISMATCH as defined. Output sizing is OUTPUT. |
| VERIFICATION | Verify command only: strict supplied result and exact recomputation comparison -> RESULT_MISMATCH; only then optional decision shape/binding -> DECISION_MISMATCH. |
| PUBLICATION | Evaluate exclusive directory/staging/rename, then stdout; verify stdout only. Failures OUTPUT. |

No dependency on directory traversal order. TIMEOUT/CANCELLED interrupt the
pipeline and suppress result publication. Acquisition failure cannot be masked
by a later semantic-looking blocker. Operational stderr is one J record
`{kind:"MemoryOSReadinessError",version:"1.0.0",code,stage,reference:Id|null}`;
no raw path, body, exception message, stack, environment or credential content.
Bootstrap diagnostic references are the literal IDs config, authority, candidate
and manifest; verify uses result and decision. Listed evidence uses its manifest
ID, gate failures use gate ID, and invocation/global failures use null. Error
code is the full MO1307_ name and stage is the exact phase enum above.
OS-enforced termination may yield no error record and no complete result;
it cannot fabricate CNE. INTERNAL never includes internal exception text.

## 16. Configuration, CLI and pure JavaScript API

Configuration is explicit, conventionally `memoryos-readiness.json`:

```text
MemoryOSReadinessConfiguration {
 kind,version, profile:{id,version},stage:Stage,
 candidate:RelativeFile,manifest:RelativeFile
}
```

The authority file path and both trusted pins are separate mandatory launch
parameters. No config discovery, merge, environment interpolation/override,
provider-derived semantic settings, network URL, stdin, response file, glob,
inline JSON, arbitrary executable or custom schema selection is allowed.
All flags occur once; unknown/missing/duplicate flags and positional extras
are USAGE. Root paths are absolute local Windows directories; config and
authority arguments are relative files under input root. The only optional
flags are those bracketed below. `--format` defaults to json. No other default
exists, including no default profile/stage. Each invocation assesses exactly
one candidate, with no queue, server, retry, watcher or cross-run cache.

```text
node.exe <package>/bin/memoryos-readiness.mjs evaluate --input-root <absolute> --config <relative> --authority <relative> --authority-sha256 <Digest> --candidate-sha256 <Digest> --output-root <absolute-new-directory> [--format json|text]
node.exe <package>/bin/memoryos-readiness.mjs verify --input-root <absolute> --config <relative> --authority <relative> --authority-sha256 <Digest> --candidate-sha256 <Digest> --result-root <absolute-directory> [--decision <relative>] [--format json|text]
```

These describe argv, not shell strings. There are exactly two commands;
help/version shortcuts, tagging and general release commands are not part of
v1. Verify reads the fixed result filename under result-root, recomputes using
all original inputs and both independent pins, compares exact J result bytes
including proof binding, then optionally checks decision under input-root.
It never trusts self-consistent result hashes alone, republishes, or modifies
inputs. Config selects only profile/stage/locations; it must match authority.
Launch controls paths/pins/format exclusively; no overlapping precedence exists.

The package root ESM export `src/index.mjs` has exactly two named async functions:

```text
evaluateReadiness({configurationBytes,candidateBytes,manifestBytes,
 authorityBytes,files,expectedCandidateDigest,trustedAuthorityDigest},
 {signal}?) -> Promise<{resultBytes,readinessDigest,proofBindingDigest}>

verifyReadiness({configurationBytes,candidateBytes,manifestBytes,
 authorityBytes,files,expectedCandidateDigest,trustedAuthorityDigest,
 resultBytes,decisionBytes:null|Uint8Array},
 {signal}?) -> Promise<{resultBytes,readinessDigest,proofBindingDigest,
 decision:null|{decision,consistency,authenticity}}>
```

Every Bytes argument is Uint8Array; files is an array of `{id:Id,bytes:Uint8Array}`
sorted by id and exactly matching manifest entries. Copy inputs before async
execution; reject SharedArrayBuffer-backed input and excess bytes/count before
copying. Duplicate/unknown properties or files are INPUT. The signal is only an
AbortSignal and never normative. The returned arrays are independent snapshots.
Rejections are an exported-shape Error with read-only `code`, `stage` and
`reference` fields matching section 15; no third function or mutable global
registry is exported. The caller provides trusted pins explicitly. No paths,
environment or filesystem capability enter the pure core. The API runs one
assessment per call; simultaneous independent calls are the embedding host's
responsibility, not a product queue or shared cache. Limits apply to each call.

## 17. Filesystem, network, process and secret boundaries

Input/result/output roots must be distinct, non-overlapping absolute local
drive paths. Root and every ancestor/descendant component used must be ordinary
directories/files without symlinks, junctions or any Windows reparse point.
RelativeFile is 1–180 ASCII characters: slash-separated nonempty segments of
`[A-Za-z0-9._-]+`; no dot/dot-dot segment, trailing dot/space, backslash, colon,
UNC/device prefix, ADS, reserved Windows device basename (including extension),
or case-fold collision. Full resolved path <=240 UTF-16 code units. Hardlinked
input files (link count >1), directories used as files and alternate streams
are rejected. No automatic directory discovery or normalization to a different
file is allowed. Config, authority, candidate and manifest cannot alias each
other or a listed entry. Result/decision files follow the same boundary rules.

The CLI uses a fixed packaged Windows inspection/acquisition helper invoked
only through the trusted system Windows PowerShell 5.1 absolute path, with
NoProfile, NonInteractive and no user-selected script or expression. Use the
actual system Windows directory established by the trusted installation, with
its fixed `System32/WindowsPowerShell/v1.0/powershell.exe`; do not resolve it
from untrusted PATH/SystemRoot input. Pass only SystemRoot and WINDIR with that
verified directory. No TEMP/TMP, provider, credential, profile or module-path
environment is inherited. The helper imports no external modules and performs
inspection/acquisition in memory without temporary files or an additional
writable root. Verify creates no product files or directories. Its fixed
request is an explicit ordered allowlist of root-relative files and byte caps;
no glob/command/network functionality. It checks Windows attributes, link count
and final handle identity, opens regular input handles denying write/delete
sharing, reads each file once within bounds, and returns those exact snapshots.
The same open handle supplies identity, length and bytes; before/after component
and root identity checks must agree. Reparse checks must cover every component,
not just Node lstat's symlink indicator. Failure to establish these properties
is FILESYSTEM_BOUNDARY. This freezes observable guarantees, not a copy of the
MO-1306 helper's implementation or deadline exception history.

Bootstrap files are read first, then manifest-listed paths in ID order.
The operator must supply private immutable roots with no concurrent adversarial
ancestor/namespace mutation; the CLI additionally detects identity changes.
This is bounded handle/path validation, not an OS sandbox against a privileged
concurrent attacker. The same helper validates output destination identities;
publication occurs only in an exclusively created directory. Helpers never
receive secrets or evaluate evidence as commands. Fixed argument arrays,
encoded bounded protocol and trusted script bytes prevent shell injection.
**Authoritative Phase 2C publication inspection correction.** Private helper
stdin remains framed JSON, not public stdin. Each fresh invocation of the same
fixed helper accepts exactly one request frame then stdin EOF and emits exactly
one response frame then stdout EOF. Request/response ceilings, including their
four-byte big-endian length prefix, remain 65,536 / 16,777,216 bytes. The body
is exact J. Private wire version is now 2.0.0, with a required fresh per-assessment
session of 64 lowercase hex characters echoed with the exact global sequence
and operation. Unknown fields/operations/versions, wrong session/sequence,
extra/trailing frames and noncanonical bytes reject; no 1.0.0 fallback exists.

Slots 1-4 retain their order and acquisition meaning: (1) config/authority;
(2) candidate/manifest paths learned from validated config; (3) explicit
manifest files; (4) result/decision for verify, or CHECK_OUTPUT for evaluate.
CHECK_OUTPUT now returns ABSENT with the complete drive-through-output-parent
identity chain, never an identity for an absent object. All READ_SET allowlists,
snapshots and decoded limits remain unchanged; output is not a READ_SET root.

After those helpers and the sole evaluation worker have terminated, evaluate
uses exactly five additional serial slots: (5) CHECK_OUTPUT immediately before
exclusive mkdir; (6) INSPECT_OUTPUT_ROOT after mkdir; (7) CHECK_STAGE_ROOT before
pending creation; (8) INSPECT_PENDING after writing/verifying/closing pending;
(9) CHECK_FINALIZATION after the final exact-byte reread/close and before the
final checkpoint/rename. Slots 5-9 carry exactly the captured output-root
capability and zero files. Pending/final basenames are fixed, never request
parameters. Slot 9 supplies the full stable pending chain, including root,
and native final-destination absence. Complete chains are at most 120 unchanged
Identity records and must match the exact path-derived components. Parent,
root and pending identities must remain stable across their observations.

Successful evaluate has nine helper invocations/requests; successful verify has
four; each invocation has exactly one request. Failures stop earlier, with no
retry, skipped/repeated slot or open-ended loop. A private branded sequence
enforces acquisition, confirmed helper exit, worker start/termination and
publication phases. A branded single-use publication inspection capability
binds the sequence, immutable root and byte transport; caller-supplied identities
or arbitrary inspect callbacks cannot supply native authority. The correction
document freezes exact request/response records, operation/status/chain mapping,
cross-slot comparisons and capability/token transitions. No returned message
or code is executed and no extra path, command or filesystem write authority is
granted to the helper.

Network is zero in core, CLI, helper and verification. External acquisition and
human attestation happen before invocation. No provider API, URL fetching,
Git subprocess or credential store exists. Product commands require no secrets.
No environment dump or automatic provider metadata collection occurs. Inputs
with credentials remain the supplier's data; raw contents/reason strings never
enter logs or summaries. Product schemas have no credential fields. Required
Node/bootstrap refusal checks reject NODE_OPTIONS/NODE_PATH, preload/loader/
inspection/eval options and untrusted executable/module selection before I/O;
they do not claim to undo code preloaded before trusted launch.

The CLI has one supervisor and at most one active helper process plus its
Windows console host (three attributable OS processes total), with no overlap
between any helper and the evaluation worker or between helper invocations.
Confirmed helper/console termination and bounded transport EOF are required
before the next helper or worker; a response frame alone is insufficient.
Evaluation uses one Node
worker thread with fixed resource limits, not another process. No SDK runtime
closure, provider SDK or arbitrary child executable is invoked. Resource and
deadline failures cannot be relaxed by retrying inside a call.

## 18. Resource contract and bounded characterization

These are conservative frozen admission/success ceilings, not claims of
measured readiness performance. The released MO-1306 Phase 3D top-level set
contains 24 files totaling 1,118,389 bytes, 75 closure rows, 19 history records
and 568 native dependency bindings. Its largest top-level JSON is 210,605
bytes. MO-1305's corresponding top-level set has 20 files totaling 567,403
bytes. V1 consumes reviewed summaries and exact source records, not recursively
all raw campaigns. Limits give bounded headroom for envelopes plus that scale.

| Resource | Exact ceiling |
|---|---:|
| Manifest evidence files (all entry types) | 128 |
| Each raw source / envelope | 2,097,152 / 262,144 bytes |
| Aggregate manifest file bytes | 8,388,608 bytes |
| Config / candidate / manifest / authority | 16,384 / 524,288 / 262,144 / 1,048,576 bytes |
| Candidate components / claims (envelopes) / grants / authority sources | 1,024 / 64 / 64 / 32 |
| Dependencies per claim / assumptions per claim or authority | 1,024 / 32 |
| Normative graph nodes / edges | 2,048 / 8,192 |
| Gates / qualifications / blockers / history records | 128 / 128 / 128 / 128; current profiles still require exactly 22 gates |
| New JSON depth / total values per file / object members per object | 16 / 131,072 / 64 |
| New JSON key / general string | 64 / 4,096 UTF-16 code units; tighter field limits prevail |
| Relative / full path | 180 ASCII / 240 UTF-16 code units |
| Result file / text stdout / JSON summary | 4,194,304 / 131,072 / 1,024 bytes |
| Error record / aggregate stderr | 1,024 / 4,096 bytes |
| Decision input | 8,192 bytes |
| Temporary output space | 4,194,304 bytes; one staged result only |
| Evaluation worker old / young heap | 128 / 16 MiB |
| Engineering aggregate peak RSS | 512 MiB across supervisor/helper/console/worker |
| Overall CLI invocation deadline | 30,000 ms |
| Pure API call deadline | 10,000 ms |
| One helper request / helper duration | 128 paths / 5,000 ms within overall deadline |
| Aggregate helper-active duration, authoritative Phase 2C correction | 20,000 ms across all helper invocations; startup through confirmed process/console/transport quiescence |
| Helper requests/invocations, authoritative Phase 2C correction | Evaluate 9 / verify 4; one request per invocation, no retries |
| Native inspection chain, authoritative Phase 2C correction | At most 120 identities, exact complete path-derived chain |
| Cancellation/termination cleanup allowance | 2,000 ms; never a success grace period |

Byte limits are checked with cap+1 bounded reads before parsing/copying.
Counts are checked before graph expansion; cycle detection is bounded.
The 8 MiB aggregate counts unique manifest-entry bytes exactly once. Bootstrap
controls, result verification input and optional decision have their separate
stated caps and are not charged to that aggregate; aliases are forbidden, not
deduplicated around the file-count limit. Helper wire/base64 bytes are bounded
separately and do not expand the decoded admission limits. Every
new JSON token/container counts once toward total values, root depth is 1,
child values increment depth. Raw legacy bytes are bounded and hashed, not
reparsed under these new JSON limits. Output is sized before publication; if
all required rows cannot fit, OUTPUT, never truncation. Per-list counts use
the applicable global counts above; source/ref lists cannot exceed manifest
entries, qualifications/gate lists cannot exceed their respective limits.

The CLI deadline starts at trusted entry-point invocation before bootstrap
acquisition; the API deadline starts at public function entry before input
snapshot copying. The CLI uses the remaining 30-second overall budget and a
10-second evaluation sub-budget, whichever ends first. Input copying/parsing
must remain bounded and wrapper checkpoints reject already-expired work.

**Authoritative Phase 2C publication inspection correction:** the 5,000 ms
helper ceiling is per one-frame invocation. A new explicit 20,000 ms aggregate
helper-active ceiling preserves the original four-times-5,000 upper bound;
nine requests do not receive nine independent budgets beyond that aggregate.
For helper start S, prior helper-active elapsed used, and absolute CLI deadline
D, its effective deadline is min(D, S+5,000, S+(20,000-used)). Active elapsed
includes startup, inspection, framing/EOF waits and confirmed helper/console
termination. It excludes periods when all helpers are gone, including worker
execution; those periods still consume the unchanged overall CLI deadline.
No phase resets used. Exhausting either helper ceiling is terminal TIMEOUT;
cleanup is not success time. API, CLI, evaluation and cleanup limits are unchanged.

Deadlines use an operational monotonic clock outside the pure evaluation
function. A supervisor timer plus worker isolation prevents a same-thread timer
from falsely claiming preemption of synchronous parsing. Success is accepted
only strictly before the deadline; equality/later is TIMEOUT. Cancellation
observed before success is CANCELLED. Late worker/helper output is ignored;
no success grace. Cleanup may continue within its separate allowance but cannot
publish. If abort and deadline are first observed at the same checkpoint,
TIMEOUT wins when now >= deadline; an abort observed strictly earlier wins
CANCELLED. After final rename, the result is committed: later abort/deadline
cannot retract it. The remaining overall deadline still bounds stdout transport.
Before rename (or for verify), timeout/abort returns TIMEOUT/CANCELLED; after
rename, timeout/abort during stdout is OUTPUT with the committed file retained.
A failed transport may have emitted a partial line; only one fully written
summary ending LF is a complete success summary. Cancel pending writes and
terminate within the cleanup allowance; stdout backpressure cannot wait forever.
The 2-second cleanup allowance extends total elapsed time only for failed
invocations, never the success deadline; maximum cleanup completion is 32 seconds for CLI or
12 seconds for API. Worker termination failure is operational failure with no completed
result, not a promise of instantaneous OS termination.

The pure algorithm has no clock; API/CLI wrappers impose operational budgets.
Completed results for identical authoritative inputs are deterministic; whether
an overloaded host reaches the deadline is not a new readiness fact. Worker
heap limits are configured explicitly without inherited Node heap flags that
override them; unsupported launch flags are USAGE. Aggregate RSS is an external
engineering acceptance ceiling, not claimed hard OS memory containment. Exceeding
observed 512 MiB fails certification; heap exhaustion yields RESOURCE_LIMIT
when attributable, otherwise INTERNAL and no result.

Phase 1 first performs bounded structural/size analysis and then readiness-only
characterization: one small vector, one MO-1306-shaped vector and one maximum
admitted vector; at most three additional repeats for a measured uncertainty.
Record parser/output sizes, monotonic timings and externally sampled aggregate
RSS with sampling limitations. Budget is <=90 minutes, no soak or predecessor
campaign. No runtime now exists, so this plan is not a measurement claim.
All numeric ceilings stay fixed; Phase 1 must meet them or stop for a documented
contract correction, not select new numbers as an implementation detail.

## 19. Distribution, schema contracts and publication

Select a separate private offline package because readiness is a reusable
product capability with CLI/JS consumers; conformance-only scripts would tie
the public behavior to milestone-specific historical validators. The future
location is `repositories/memoryos-readiness`; package is ESM, private=true,
version 0.1.0, bin `bin/memoryos-readiness.mjs`, root export `src/index.mjs`.
No file/directory/package is created by this Freeze task.

Runtime is exact Node **24.21.0 win-x64**, using the established externally
acquired verified runtime. The retained node.exe pin is 93,580,104 bytes,
SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
Use an absolute verified executable and absolute entry point, no PATH/npm/npx
runtime lookup or product downloader. npm **11.19.0** is engineering/install
tooling only. Windows PowerShell 5.1 is an explicit system acquisition dependency;
record actual OS/runtime identities and packaged helper hash in certification.
Native Windows 11 x64 certification is required. Linux/Ubuntu/WSL/VM and hosted
GitHub execution are not required and not certified by inference.

External production npm dependencies: **zero**. No install/lifecycle hooks,
dynamic plugin/validator loading, semantic closure copy or provider SDK. Closed
validators implement this frozen contract; engineering schema validators, when
used, are pinned and offline. JSON Schema Draft 2020-12 files in Phase 1 cover
Configuration, Candidate, Manifest, Authority, Evidence (14 discriminated
variants), Qualification, HumanDecision, Result, Summary and Error. Their
record kinds and versions are exactly those defined here, with closed objects
and these cross-field algorithms; schemas cannot override text authority.
Graph/GateResult/Blocker/History/Component are closed shared definitions inside
those schemas, not new extensibility points. No runtime remote `$ref` resolution.

`contracts/contract.json` will be `{kind:"MemoryOSReadinessContract",
version:"1.0.0",id:"memoryos.readiness",files:[{path,byteLength,sha256}]}`,
with rows sorted by path covering schemas, gate/profile tables, codes, limits
and canonicalization constants, excluding itself. Path is RelativeFile and the
member byte length/digest bind the exact shipped bytes.

`distribution-manifest.json` is exactly
`{kind:"MemoryOSReadinessDistributionManifest",version:"1.0.0",
package:{name:"memoryos-readiness",version:"0.1.0"},
files:[{path:RelativeFile,byteLength:Integer,sha256:Digest}]}` in J encoding.
Rows sort by path and enumerate every regular shipped member except the
manifest itself and the containing archive. Unsafe/duplicate/case-colliding
paths, missing members and extra members fail package validation. External
release/package receipts bind manifest and archive identities; neither
self-authenticates and no self-hash is embedded. Required shipped classes:
bin/src/fixed Windows helper, schemas,
contracts, distribution manifest, SPDX 2.3 SBOM, README and pending-license/
notices records. No node_modules or test/certification evidence in the package.
Existing licensing ambiguity is not resolved by private packaging; no public
registry publication is authorized. Offline install uses a new explicit local
directory, no scripts/network, and verifies exact package members before use.

There is no multi-file assessment bundle, duplicate graph file, receipt or
completion marker. The single result already includes graph and audit manifest
projection. Exclusively create output-root (existing directory is OUTPUT), write
only `memoryos-readiness-result.json.pending`, close and verify complete bytes,
then atomically rename without replacement to the fixed final basename. The
final rename is the sole publication commit point. A pending file or malformed
final file is never complete. Result verification checks exact recomputation,
not mere filename presence. No overwrite, cross-volume move or partial-result
publication. On failure retain owned pending bytes for diagnosis; no recursive
cleanup or failed-attempt deletion. Later manual retention management is outside
the evaluator. A publication failure after computation returns OUTPUT and no
success summary. A subsequent stdout failure also returns OUTPUT; if a complete
file was already committed, retain it and never mislabel it partial or delete it.

**Authoritative Phase 2C publication inspection correction:** native publication
observations use section 17 slots 5-9 through the same fixed helper and a
branded single-use inspection capability. createPublication binds the fresh
parent/created-root chains; stagePublication binds the refreshed root and
newly created pending chain; finalizePublication rereads/closes exact bytes,
then obtains the stable full pending/root chain and native final absence before
the deadline/cancellation checkpoint and rename. The opaque token remains
private and single-use. Mandatory checkpoints surround each inspection and
precede filesystem mutations. No Node stat/lstat or prior parent observation
substitutes for native checks of newly created objects. The private immutable-root
precondition and committed-output behavior remain unchanged. Verify never
creates a publication capability or republishes a normative result.

## 20. Normative vectors and security negatives

These are required contract vectors for Phase 1/2/3, not executed evidence now.
Each fixture must supply independently pinned authority/candidate and exact
accepted/rejected bytes. Verification must compare exact normative bytes and
the independent raw proof binding. A trusted fixture authority is a test input,
not a production release authorization.

| Vector | Exact expected behavior |
|---|---|
| V01 complete pass | All mandatory gates SATISFIED, authoritative/current inputs, no release qualifications/blockers/CNE -> READY. A CI/CD fixture with actual granted full provider certificates can realize this; no live run is required to test the fixture. |
| V02 accepted qualifications | All mandatory conditions met, >=1 accepted release qualification -> READY_WITH_QUALIFICATIONS; retain every qualification. |
| V03 known negative | Valid evidence establishes >=1 mandatory failed condition -> NOT_READY, all blockers retained. |
| V04 safely unavailable | Trusted required slot UNAVAILABLE/UNEVALUABLE with no proven blocker -> COULD_NOT_EVALUATE. |
| V05 unsafe operation | Corrupt input/forged root/cycle/internal failure -> operational error, no result, no fabricated CNE. |
| V06 mixed precedence | Blocker+CNE+qualification -> NOT_READY with all lists; known historical blocker on an unavailable gate still -> NOT_READY retaining CNE; CNE+qualification without blocker -> CNE with qualification. |
| V07 informational only | Only informational qualifications, mandatory gates satisfied -> READY with information retained. |
| V08 nonrequired/inapplicable | Optional provider live observation remains NOT_REQUIRED; unrelated profile gates NOT_APPLICABLE; neither proves certification or blocks. |
| V09 expected negative semantics | Correctly certified expected Policy FAIL/CNE and INPUT_ERROR/11 satisfy conformance; underlying outcomes are not rewritten. |
| V10 history | Authorized preserved failure is not a current blocker; active linked recurrence adds blocker; age alone changes nothing. |
| V11 reuse | Changed unrelated component changes candidate root but allows exact unaffected DEPENDENCY_SET reuse with new grant; changed declared dependency -> STALE_EVIDENCE. |
| V12 metadata | Allowed metadata/source-audit-only change with fresh exact trusted pins changes proof binding but not normalized readiness; hidden mutation without updated pins -> INTEGRITY/EVIDENCE_AUTHORITY. |
| V13 complete recomputation | Altered state/gate/qualification/blocker/history/graph/digest in result -> RESULT_MISMATCH; valid self-hashes do not suffice. |
| V14 decision | READY+APPROVE, READY+REJECT and QUALIFIED+APPROVE leave readiness unchanged; NOT_READY/CNE+APPROVE is CONTRARY_TO_READINESS; wrong candidate/digest -> DECISION_MISMATCH; unknown actor remains unauthenticated; changed proofBindingDigest rejects the old decision even when readinessDigest is unchanged. |
| V15 tags | PRE absent passes; POST correct annotated target passes; PRE present, POST absent, wrong target/name, lightweight/unexpected tag block applicable checks; no mutation. |
| V16 publication | Pending/truncated file cannot verify; rename is commit point; existing output never overwritten; late completion cannot publish. |
| V17 bounds/offline | Every limit at boundary and +1, graph cycle, cancellation/deadline equality, hostile Windows paths and unavailable network; resource failures are operational and complete offline inputs need no network. |
| V18 MO-1306 | Released qualified vector described below -> READY_WITH_QUALIFICATIONS, never hosted-certified by inference. |

V18 uses the exact released production C3CB
`701d48ee2012675966360dda775ab13013c09ab9`, methodology M3
`85a0f85c1ebd013c545ccf2b3efe58a760e6cf37`, scope S3
`6e562c578f86022ee28911f7b91a8b3aa209da17`, immutable I3
`f8e19fc5427cf3acfe60d5e2717dc87d0c74e04a` and final BF
`332ab0d2c35643ea8d155bcbea9c5019b304bbe3`, with source/component identities
from the released final inventory. POST_TAG observation is the annotated
`memoryos-1.3-mo1306` object verified in section 1. Normalized reviewed claims
must preserve the actual final package/SBOM/provenance and all relevant scope
and historical dispositions; the source receipts remain byte-identical.

| Provider | Required preserved released facts |
|---|---|
| Generic | IMPLEMENTED / REAL_EXECUTION_CERTIFIED validation and execution / SUPPORTED. |
| GitHub | IMPLEMENTED / OFFLINE_VALIDATED / HOSTED_EXECUTION_NOT_CERTIFIED; original execution label NOT_CERTIFIED; SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION. |
| GitLab | IMPLEMENTED / CONTRACT_VALIDATED / NOT_LIVE_PROVIDER_CERTIFIED / SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY. |
| Jenkins | IMPLEMENTED / CONTRACT_VALIDATED / NOT_LIVE_PROVIDER_CERTIFIED / SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY. |
| Azure DevOps | IMPLEMENTED / CONTRACT_VALIDATED / NOT_LIVE_PROVIDER_CERTIFIED / SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY. |

The Generic validation and execution labels and raw record remain exact.
GitHub hosted PASS is not certified, hosted FAIL/CNE
were not executed/certified, and native/hosted parity is not established.
Run 36357568243 remains FAILURE/HOSTED_BOOTSTRAP_UNRESOLVED; diagnostic
36396330199 remains FAILURE/STILL_UNRESOLVED/HOSTED_DIAGNOSTIC_EXHAUSTED.
The native publication failure remains FAIL/UNRESOLVED under its exact M3
disposition. Retain four provider limitations, bounded-advisory and applicable
historical disclosures. S3 changes applicability, not any failed outcome.
Exhaustion remains binding; V18 authorizes no new predecessor campaign.

Mandatory rejection classes (all require negative fixtures): candidate
substitution, wrong raw/claim/proof digest, forged authority, stale dependency,
cycle, dangling reference, qualification omission, blocker suppression, false
certification promotion, historical rewriting, profile substitution, tag-target
substitution, human-decision mismatch, traversal, reparse/link escape, oversized
evidence, deep JSON, unknown fields and duplicate IDs. Also test incomplete
dependency declarations, safe unavailable versus missing files, mixed error
precedence, late success, partial publication and output-overflow truncation.

## 21. Phase plan, certification and failure policy

**Phase 1 foundation (next task, not started here):** package skeleton; exact
contracts/schemas; strict parser/J/hash functions; candidate/root/envelope/
manifest/grant validation; graph and aggregation foundations; error catalog;
minimal CLI/API seams; normative fixtures including V18 source normalization;
conformance requirement inventory; structural resource analysis and bounded
characterization. No interface beyond the frozen two commands/two functions.
Exit requires exact schemas/fixtures matching this text, no OPEN normative
decisions, boundary enforcement demonstrated, fixed resource ceilings met and
stable shared interfaces. New architectural gaps require a correction before
dependent work, not an invented interpretation.

After Phase 1, three disjoint workstreams are justified by independent core,
evidence and acquisition/publication responsibilities. This freezes ownership,
not immediate branch creation:

| Stream | Ownership and acceptance |
|---|---|
| 2A | Pure profiles, gate/qualification/blocker/CNE aggregation, normalized identity and canonical result; consumes 2B verified projection through Phase 1 interface. |
| 2B | Evidence/authority/manifest verification, graph, exact dependencies, staleness/reuse/history and integrity negatives; no alternative gate engine. |
| 2C | CLI acquisition, fixed Windows helper, API wrappers, external decision checking, tag-observation projection, deadline/cancellation and single-file publication; no independent semantic/readiness computation. |
| 2D | Reconcile overlaps and package; verify both public surfaces, all cross-stream vectors, V18, security, deterministic bytes, offline/native Windows installed execution and exact package identity; bind completed integrated implementation as B2 with existing-parent identities only. |

Shared contract/fixtures remain Phase 1-owned; changes reconcile centrally,
never through conflicting branch-local schemas. Actual branches/worktrees need
the later authorized phase, and cannot be created by this Freeze task.

Phase 3 streams assess the exact B2 candidate and can run independently only
after their distinct inputs/ownership are bound:

| Stream | Required certification |
|---|---|
| 3A | Real native Windows 11 x64 installed runtime; all readiness/decision/tag vectors, normative byte parity between CLI/API, offline execution, interruption and resource boundaries/characterization. |
| 3B | Exact archive/member/distribution integrity; two independent assemblies; one offline install; SPDX 2.3 schema/semantic validation; Node/npm/PowerShell/production and engineering dependencies, validators, schemas, licenses/notices, bounded advisory scope, provenance and reproducibility. |
| 3C | Security/trust/evidence-graph audit; negative corpus; dependency completeness, forged claims/false approval, history/qualification preservation, filesystem/network/process/log/secret boundaries and release-claim review. |
| 3D | Integrate exact accepted 3A/B/C evidence and all failed attempts/dispositions; reconcile only changed dependencies; final gate/vector/graph audit, reproducible package identity and non-self-referential binding; prepare later human tag review. |

Native Windows is required because an executable package is selected. No
Linux/Ubuntu/WSL/VM, cross-platform parity or mandatory GitHub hosted execution
is added. No GitLab/Jenkins/Azure account is required. Legacy platform history
and MO-1306 qualifications are retained. A GitHub-specific runtime claim would
require a later contract correction, not an implicit Phase 3 gate.

For final certification, I3 contains immutable accepted receipts, inventory,
source/history mappings and validation tooling. A binding-only BF child binds
existing I3 bytes; neither embeds its own future hash. Read-only post-BF checks
establish the accepted certification state; any later annotated release tag
must target that exact BF. The tag is not a prerequisite for pre-tag review,
and this protocol never makes computed READY a human decision. MO-1307
certification is ordinary conformance, not recursive readiness input into itself.

Retain bounded inputs/receipts, exact digests, raw failed attempts and accepted
dispositions in repository release/conformance records. Freeze the finite
campaign protocol/inventory before execution; do not silently discard failed
attempts or expand into a warehouse. Diagnose before rerun and distinguish
product defect, contract defect, environment blocker, harness defect,
interruption and historical failure. No retry-until-pass, general methodology
waiver, hidden extension or migration of current failures into historical rows.
Recurrence obeys the precise active authority; evidence reuse is explicit.

Ordinary implementation/certification tasks target **<=90 minutes**. Extended
work is **<=3 hours only when necessary and making measurable progress**;
record rationale, intermediate results and remaining work. This owner's new
MO-1307 budget supersedes earlier prospective 60/90-minute guidance for this
milestone only; released campaigns/history are unchanged. These engineering
budgets do not alter the 30-second product deadline or 10-second API deadline.

## 22. Decision closure and non-normative implementation details

All **50 decisions are closed**: 36 RESOLVED_BY_FREEZE, six
RESOLVED_BY_PREDECESSOR and eight RESOLVED_BY_CONSTRAINT. No normative decision
is deferred. Section references are normative destinations, not recommendations.

| ID | Final decision | Section | Status |
|---|---|---|---|
| D01 | Separate private offline ESM package | 2, 19 | RESOLVED_BY_FREEZE |
| D02 | New package CLI/JS only; existing interfaces unchanged | 2, 16, 19 | RESOLVED_BY_FREEZE |
| D03 | Closed rest/cicd profiles; no policy language | 9 | RESOLVED_BY_FREEZE |
| D04 | Canonical candidate digest plus exact components and source provenance | 4 | RESOLVED_BY_FREEZE |
| D05 | Fourteen evidence types; all 18 proposed categories disposed | 5 | RESOLVED_BY_FREEZE |
| D06 | Versioned normalized claims with reviewed raw provenance; no legacy execution | 3, 5, 6 | RESOLVED_BY_FREEZE |
| D07 | Separate operator-pinned repository authority | 6 | RESOLVED_BY_FREEZE |
| D08 | Exactly 22 compiled gates and explicit applicability | 9 | RESOLVED_BY_FREEZE |
| D09 | Four readiness states with blocker/CNE/qualification/ready precedence | 10 | RESOLVED_BY_FREEZE |
| D10 | Six gate states; history separate | 8, 10 | RESOLVED_BY_FREEZE |
| D11 | Seven closed qualification codes and complete propagation | 11 | RESOLVED_BY_FREEZE |
| D12 | Mandatory blockers, safe missing slots and operational errors distinct | 10, 11, 15 | RESOLVED_BY_FREEZE |
| D13 | Immutable history plus authorized current disposition/recurrence | 8 | RESOLVED_BY_FREEZE |
| D14 | Derived six-node-type/five-edge-type bounded DAG | 7 | RESOLVED_BY_FREEZE |
| D15 | Explicit unique references; no latest or discovery | 6, 7, 17 | RESOLVED_BY_FREEZE |
| D16 | Complete per-claim dependency closure; selective reuse/invalidation | 5, 8 | RESOLVED_BY_FREEZE |
| D17 | Dependency/authority freshness; no age windows | 8 | RESOLVED_BY_FREEZE |
| D18 | One canonical result; separate readiness/proof digests | 14 | RESOLVED_BY_FREEZE |
| D19 | JSON summary or complete bounded text projection | 14 | RESOLVED_BY_FREEZE |
| D20 | Optional separate external human record included | 13 | RESOLVED_BY_FREEZE |
| D21 | Actor authenticity outside evaluator; structure/bindings only | 13 | RESOLVED_BY_FREEZE |
| D22 | Decision strictly downstream; no approval input/cycle | 7, 13 | RESOLVED_BY_FREEZE |
| D23 | Explicit PRE_TAG/POST_TAG, annotated exact target post-tag | 12 | RESOLVED_BY_FREEZE |
| D24 | Supplied evidence only; no CI acquisition/publication service | 2, 16, 17 | RESOLVED_BY_FREEZE |
| D25 | Explicit contained Windows roots, handle checks, no links/reparse | 17 | RESOLVED_BY_FREEZE |
| D26 | Zero network/secrets; fixed helper, worker and trusted launch | 17, 18 | RESOLVED_BY_FREEZE |
| D27 | Twenty-one operational errors; separate completed readiness exits | 15 | RESOLVED_BY_FREEZE |
| D28 | Fixed ceilings; bounded verification, no silent measurement-driven change | 18 | RESOLVED_BY_FREEZE |
| D29 | J plus normalized claim identity and independent raw proof binding | 3, 7, 14 | RESOLVED_BY_FREEZE |
| D30 | Zero production npm dependencies; pinned full supply-chain scope | 19, 21 | RESOLVED_BY_FREEZE |
| D31 | V01–V18 plus complete security/boundary negative classes | 20 | RESOLVED_BY_FREEZE |
| D32 | Windows, artifact, security and final-binding certification | 21 | RESOLVED_BY_FREEZE |
| D33 | Frozen Phase 1 exit and later 2A/B/C/D ownership | 21 | RESOLVED_BY_FREEZE |
| D34 | Independent closed versions, explicit correction/no fallback | 3, 19 | RESOLVED_BY_FREEZE |
| D35 | Compiled profiles, pinned reviewed scope; no input-authored waiver | 6, 9 | RESOLVED_BY_FREEZE |
| D36 | One result, exclusive staging and atomic no-replace rename | 19 | RESOLVED_BY_FREEZE |
| D37 | Existing semantic sources/bytes/identities/limits unchanged | 1, 2 | RESOLVED_BY_PREDECESSOR |
| D38 | MO-1302 job gating is not organizational release authority | 1, 2 | RESOLVED_BY_PREDECESSOR |
| D39 | VS Code exception remains exact; no platform promotion | 1 | RESOLVED_BY_PREDECESSOR |
| D40 | MCP six-tool/stdio boundaries remain intact | 1, 16 | RESOLVED_BY_PREDECESSOR |
| D41 | REST scope and same-host certification limits retained | 1, 9 | RESOLVED_BY_PREDECESSOR |
| D42 | MO-1306 qualified matrix/history/stop rules retained | 8, 9, 20 | RESOLVED_BY_PREDECESSOR |
| D43 | Final release authorization remains explicit human action | 2, 13 | RESOLVED_BY_CONSTRAINT |
| D44 | Offline core; no provider/cloud/account prerequisite | 17 | RESOLVED_BY_CONSTRAINT |
| D45 | Native Windows; no Linux/Ubuntu/WSL/VM requirement | 19, 21 | RESOLVED_BY_CONSTRAINT |
| D46 | No MO-1308 database/history service | 1, 21 | RESOLVED_BY_CONSTRAINT |
| D47 | No MO-1309 dashboard/admin/cloud UI | 1 | RESOLVED_BY_CONSTRAINT |
| D48 | No IAM/RBAC/governance workflow platform | 1, 2, 13 | RESOLVED_BY_CONSTRAINT |
| D49 | This task is documentation only; Phase 1 remains next | 1, 21, 23 | RESOLVED_BY_CONSTRAINT |
| D50 | One core; no implicit REST/MCP/VS Code/Action/adapter expansion | 2, 16 | RESOLVED_BY_CONSTRAINT |

Implementation-only choices left to Phase 1 are private module filenames other
than frozen entry points, local variable/function names, internal data structures
and allocation strategies, and test-harness organization, plus private helper framing field names within
its frozen operations/limits. They cannot change
accepted bytes, schemas, observable ordering, errors/exits, limits, trust,
profiles, paths, package entry points, source provenance or normative vectors.
No architecture item is deferred under that label.

## 23. Contradiction audit, validation and next task

The audit searches READY, NOT_READY, READY_WITH_QUALIFICATIONS,
COULD_NOT_EVALUATE, CERTIFIED_READY_TO_TAG, BLOCKED, qualification, human
approval, release decision, release gate, tag target, historical failure and
MO-1307 across current authority and relevant released documents/inventories.

| Classification | Finding / reconciliation |
|---|---|
| CURRENT_AUTHORITY | Existing semantic PASS/FAIL/CNE remain owned by MO-1301; MO-1307 uses independent readiness states and errors. Human final authority and provider honesty remain binding. |
| CONTRADICTION_RESOLVED | Prior ROADMAP said Freeze next/no frozen contract. Its current MO-1307 statements now say CONTRACT FREEZE 1 ESTABLISHED / PHASE 1 NEXT and link this Freeze. |
| CURRENT_AUTHORITY | Original MO-1307 candidate states/open register are resolved by this closure table. Its original wording remains the pre-Freeze record, expressly superseded for current decisions. |
| RELEASED_HISTORY | MO-1302 workflow states, VS Code exceptions, MCP tools/platform history and REST/CI contracts retain their original meanings; do not retrofit new gate enums. |
| HISTORICAL_EVIDENCE | MO-1305/1306 CERTIFIED_READY_TO_TAG, ABSENT tag and prior BLOCKED/FAIL records remain pre-tag/attempt snapshots. The new tag stages do not rewrite them. |
| RELEASED_HISTORY | S3's NOT_CERTIFIED hosted label, original failures and M3 recurrence/disclosure remain exact. No qualification becomes hosted PASS. |
| CURRENT_AUTHORITY | New <=90-minute/conditional <=3-hour MO-1307 engineering budgets supersede earlier prospective budget guidance only for future MO-1307 tasks; product deadlines are separate. |
| PROSPECTIVE | MO-1308/1309 and broader organizational governance remain outside this contract. |

Validate all 50 closure rows, zero unresolved normative decisions, exact type/
gate/error/profile/vector counts and references, complete local Markdown paths,
existing read-only workspace verification, whitespace and full diff. No
production test/certification campaign is required to validate this document.
Keep every released artifact and original MO-1307 authority byte unchanged.

The exact next task is **MEMORYOS 1.3 MO-1307 PHASE 1 — READINESS FOUNDATION**,
implementing only the frozen section 21 foundation after separate task
authorization. This Freeze itself begins no Phase 1 work.
