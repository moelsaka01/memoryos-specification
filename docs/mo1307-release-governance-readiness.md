# MemoryOS 1.3 MO-1307 — Release Governance and Readiness

## 1. Authority, status and verified baseline

Status: **AUTHORIZED / CONTRACT FREEZE 1 NEXT**.

This owner-authorized roadmap authority establishes MO-1307's purpose, scope,
boundaries and closed Contract Freeze 1 agenda. It is documentation and analysis
only. Implementation has not started. No exact schema, filename convention,
API, readiness enumeration, gate algorithm, resource value or package boundary
is frozen by a recommendation in this document.

The reviewed workspace is exclusively
`C:\Users\melsa\Documents\Codex\cca-workspace`, on clean `main`, at
`332ab0d2c35643ea8d155bcbea9c5019b304bbe3`, subject
`conformance(memoryos-1.3): close MO-1306 provider-neutral CI/CD certification`.
At the 2026-09-28 baseline check, local `origin/main` and the remote
`refs/heads/main` matched that HEAD. Read-only `git ls-remote` verified the
remote without fetching or moving refs. The local MO-1306 tag is annotated;
local and remote `memoryos-1.3-mo1306` have tag object
`9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8` and peel exactly to that commit.

MO-1301 through MO-1306 are **RELEASED**, with their recorded qualifications.
The [current roadmap](../ROADMAP.md) supplies current status. Earlier pending,
ABSENT-tag and CERTIFIED_READY_TO_TAG fields remain certification-time history.
The observed release tag is a later fact, not permission to rewrite those
fields or an assertion that a certification campaign was repeated here.

This task changes only this authority and ROADMAP.md. It authorizes exactly one
documentation commit on the stated parent, with no push, tag, branch/worktree,
production code, adapters, release automation, package/dependency changes,
schemas, or Phase 1/2/3 evidence. Those restrictions also prevent treating the
testing and certification plans below as executed work.

## 2. Purpose and human authority

MO-1307 will provide a deterministic, evidence-backed assessment of an exact
MemoryOS integration or release candidate. It must identify the candidate,
required gates, satisfied conditions, blockers, qualifications, supporting
evidence and remaining human actions. A bounded explanation must answer why
the candidate is ready, not ready, qualified or unevaluable without making
explanatory prose an independent authority.

**MemoryOS may compute, validate and present release-readiness evidence.
Computed readiness is not final organizational release authorization.**
Even a future READY result must not autonomously approve release, create a
tag, push, publish, deploy or merge. Those actions remain explicit human or
governance decisions unless a later milestone expressly changes that authority.
A recorded human decision would document a decision; it would not execute it.

Six dimensions must remain distinguishable:

| Dimension | Owner / meaning |
|---|---|
| Semantic outcome | Released Policy/Policy Set, Regression and other existing semantic authorities |
| Operational execution outcome | Whether acquisition, execution, verification or publication actually completed |
| Certification state | Exactly which artifact, platform or provider behavior has an accepted witness |
| Provider/platform limitation | The disclosed bounds of support or certification, including unexecuted cases |
| Computed release readiness | MO-1307's future composition of bound evidence under an explicit readiness contract |
| Final human release decision | Separate organizational authorization, rejection or deferral |

Policy PASS alone proves neither release readiness nor human approval. A
provider limitation is neither semantic FAIL nor proof of certification.
An operational error must not fabricate a semantic outcome or collapse into
NOT_READY without the separately frozen error/readiness contract.

## 3. Sources and predecessor boundaries

The identifiers below are evidence references for the decision register.
They refer to existing authority, not newly generated certification evidence.
Released contracts apply within their original scope; their old stage labels
are not the current roadmap status.

| Ref | Read authority | Boundary retained |
|---|---|---|
| A1 | [Architecture](../ARCHITECTURE.md), [ambiguity register](ambiguity-register.md) | One semantic authority per capability; unresolved architecture stops implementation. Broader licensing, contribution, topology and supply-chain governance remain unresolved where recorded. |
| A2 | [Investigation Policies](investigation-policies.md), [MO-1301 conformance](../repositories/cca-conformance/docs/mo1301-conformance.md) | Closed Policy/Policy Set, owner-bound Core context, zero or one registered Regression source, SDK/CLI identities, canonical bytes/digests, errors and resource limits. Detached validation is not semantic provenance. |
| A3 | [MO-1302 GitHub Policy Gate](../repositories/cca-conformance/docs/mo1302-github-policy-gate.md), [engineering history](../repositories/cca-conformance/docs/mo1302-engineering-conformance.md) | Released GitHub Action/job behavior, semantic/operational distinctions, pins, distribution and historical certification. No reassignment to MO-1307. |
| A4 | [VS Code scope](../repositories/memoryos-vscode/README.md), [final exception binding](../repositories/cca-conformance/evidence/mo1303-final-conformance-binding-run-35474897159.json) | Released commands, trust, runtime and package boundaries; Ubuntu/Windows hosted PASS, macOS NOT EXECUTED, three-platform parity NOT EXECUTED under the existing exception. |
| A5 | [MCP authority](mo1304-mcp-server-agent-integration.md), [cache correction](mo1304-contract-freeze-1-cache-correction.md), [Windows correction](mo1304-contract-freeze-windows-support-correction.md), [certification](../repositories/cca-conformance/docs/mo1304-phase3-windows-certification.md) | Frozen six-tool local stdio transport and semantic delegation; historical Windows/Ubuntu certification and parity remain intact; no new MCP tool implied. |
| A6 | [REST authority](mo1305-rest-gateway.md), [Freeze](mo1305-contract-freeze-1.md), [platform](mo1305-contract-freeze-1-platform-correction.md), [verification](mo1305-contract-freeze-1-verification-methodology-correction.md), [metadata corrections](mo1305-release-metadata-correction.md) | Frozen REST runtime, six semantic operations and three operational endpoints, security, measured resources and exact release metadata. No redesign or mandatory REST transport. |
| A7 | [CI/CD authority](mo1306-provider-neutral-cicd.md), [Freeze](mo1306-contract-freeze-1.md), [process correction](mo1306-contract-freeze-1-process-correction.md) | Provider-neutral execution and adapters, exact SDK semantic artifacts, bounded operational bundles, filesystem/network/process controls and private offline distribution. |
| A8 | [MO-1306 hosted scope correction S3](mo1306-hosted-certification-scope-correction.md), [machine scope authority](../repositories/cca-conformance/mo1306-hosted-scope-correction.json) | Qualified GitHub support, optional/non-blocking hosted certification for v1, preserved failures and exhausted diagnostics; mandatory offline/security/package gates remain. |
| A9 | [MO-1306 methodology M3](mo1306-phase3-unresolved-observation-methodology.md) | Narrow candidate-specific historical/current distinction, 18 eligibility conditions, mandatory disclosure and recurrence invalidation; no general waiver. |
| A10 | [MO-1306 final release record](mo1306-phase3d-qualified-release.md), [final inventory](../repositories/cca-conformance/mo1306-final-release-inventory.json), [binding graph](../repositories/cca-conformance/evidence/mo1306/phase3d/binding-graph.json) | Exact production/methodology/scope authorities, provider matrix, dependency reuse, acyclic I3/BF binding and pre-tag snapshots. |
| A11 | [MO-1305 final release record](mo1305-phase3d-release.md) | Non-self-referential binding, exact metadata/runtime reuse, preserved failures, bounded advisory review and same-host-only remote certification limits. |
| A12 | Owner's 2026-09-28 MO-1307 authority task, recorded in sections 1–2 and the hard constraints below | Documentation-only authorization, human control, offline/Windows scope, exclusions and required Freeze questions. |
| A13 | [Current roadmap](../ROADMAP.md) | Released MO-1301–MO-1306, authorized MO-1307, prospective MO-1308/MO-1309; stage-specific history is retained. |

Nothing here reopens MO-1301–MO-1306 or changes CCA-MEMORYOS-1.0. Product
versions and normative contract versions remain independent. Any future
standardization follows separately authorized work, not an implicit new
semantic standard in this milestone.

## 4. Candidate identity and proposed evidence categories

No floating latest candidate, latest file, mutable branch name alone or
provider job status may identify the assessed candidate. Freeze must choose
which exact identities are mandatory, conditionally required or explicitly
inapplicable: Git commit, tree, production source closure, package/archive,
distribution, SBOM, provenance, configuration, provider/adapter, runtime and
toolchain, semantic contracts, validator and certification receipts. Missing
identity is not equivalent to inapplicability.

Distinguish the assessed production bytes from the later evidence/binding
commit and from methodology/scope authority. MO-1306's C3CB, M3, S3, I3 and BF
demonstrate why one commit field is insufficient as an unexplained universal
identity. Freeze must define the allowed relationship, including how a
documentation-only descendant affects assessment identity versus reuse of
unchanged production evidence. This is not an automatic adoption of the
predecessor commit protocol.

The following is a **closed proposed category inventory for Freeze review**.
Each must be accepted with a bounded source/version/trust contract, combined
with a justified category, or explicitly excluded. It is not an accepted-input
schema and grants no arbitrary file ingestion.

| Proposed category | Required scope distinction |
|---|---|
| Semantic conformance | Exact normative authority and existing evaluator-produced artifacts |
| Regression results | Existing Regression authority and bound inputs, not a new comparison engine |
| Security checks | Reviewed candidate, controls, method and bounded conclusions |
| Package integrity | Exact archive, distribution and member identities |
| SBOM validation | Exact SBOM, pinned validator/schema and declared validation scope |
| Provenance | Producer/build/dependency claims with independently established origin |
| Supply-chain review | Reviewed component/advisory set and frozen-usage assumptions, not an exhaustive safety claim |
| Platform certification | Actual platform/runtime and tested scope versus supported scope |
| Provider certification | Implementation, offline validation and real execution separately |
| CI/CD execution | MO-1306 operational evidence versus normative semantic bytes |
| Resource limits | Applicable contract, measured properties and enforced bounds separately |
| Filesystem/network/process controls | Exact controls and evidence limits; no inferred OS-wide containment |
| Historical blockers | Original outcome and authorized current applicability/disposition |
| Qualified limitations | Explicit structured limitations and required disclosures |
| Required documentation | Versioned required inventory and candidate binding, not prose-derived readiness |
| Release metadata | Exact package/version/compatibility identities and scoped requirements |
| Tag state | Supplied exact observation, expected target and assessment stage |
| Human approvals | If included, bounded preparatory approvals; final decision remains downstream and distinct |

Freeze must identify permissible existing validators without invoking obsolete
phase-specific assumptions. A digest or structurally valid receipt alone
proves neither trusted origin nor accepted authority. Repository contents,
provider metadata and self-declared certification labels are untrusted inputs.

## 5. Readiness profiles, gates, qualifications and blockers

Possible readiness states are READY, NOT_READY, READY_WITH_QUALIFICATIONS and
COULD_NOT_EVALUATE. Possible gate classifications are SATISFIED,
SATISFIED_WITH_QUALIFICATION, BLOCKED, NOT_REQUIRED, NOT_APPLICABLE,
COULD_NOT_EVALUATE and HISTORICAL_FAILURE_PRESERVED. **These are candidates,
not frozen enumerations or precedence rules.** Freeze must decide completeness,
aggregation, applicability and how errors interact with reportable assessments.
In particular, it must decide whether historical disposition is an orthogonal
dimension instead of a competing current gate state.

The recommended direction is an explicit finite gate composition with bound
scope/profile authority. Consider core release, provider integration, SDK,
REST and CI/CD integration profiles; do not presume all are required in v1.
MO-1301's closed facts concern investigations and registered Regression, not
arbitrary release receipts. Existing Policy/Policy Set outcomes can satisfy
properly scoped semantic-evidence requirements, but arbitrary release facts
cannot be injected as authoritative Policy contexts. Freeze must compare a
small closed readiness profile contract with fixed conformance-only gate sets;
neither a general policy language nor new Policy rules are authorized here.

| Concept | Required distinction for Freeze |
|---|---|
| Hard release blocker | An applicable mandatory condition is unsatisfied under bound authority; prose or an unsupported waiver cannot suppress it. |
| Qualification | A permitted, explicit limitation with scope, evidence and authorizing disposition; it must remain visible in machine output and summaries. |
| Warning/diagnostic | Supporting information that cannot silently change a normative gate. |
| Historical failure | The original failure remains true; an authorized disposition determines its relevance to this exact current candidate. Age alone does not retire it. |
| Not-required gate | Explicit release-scope authority removes the requirement; this is not proof the behavior passed. |
| Not-applicable gate | A defined applicability predicate is false with evidence; omission is not such evidence. |
| Unavailable evidence | No accepted proof is available; Freeze must distinguish missing, invalid, stale and inaccessible evidence and their error/readiness effects. |

A qualification should carry structured identity, affected scope/candidate/gate,
source authority, evidence, limitation, disposition and any recurrence or review
condition. Exact fields and cardinalities remain open. Examples include provider
not live-certified, hosted execution not certified, a platform not required,
bounded advisory review, same-host-only remote certification, an unresolved
historical observation retained, and an environment limitation. Freeze must
decide which are gate applicability facts and which require qualification
records; none may disappear merely because a summary is short.

Conflicting current evidence, unsupported exceptions and omitted limitations
cannot default to an unqualified success. A previously resolved or preserved
failure must not permanently block unrelated current candidates without an
applicable authority/dependency link. Conversely, M3 is not a general rule that
old failures or fail-closed errors may always be waived. Its actual scope,
eligibility, disclosure and recurrence stop conditions remain binding.

## 6. Released provider matrix and GitHub limitation

MO-1307 must preserve this MO-1306 matrix as qualified evidence, not silently
turn every row into PASS or generic failure:

| Provider | Implementation | Validation | Execution certification | Release support |
|---|---|---|---|---|
| Generic | IMPLEMENTED | REAL_EXECUTION_CERTIFIED | REAL_EXECUTION_CERTIFIED | SUPPORTED |
| GitHub | IMPLEMENTED | OFFLINE_VALIDATED | HOSTED_EXECUTION_NOT_CERTIFIED | SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION |
| GitLab | IMPLEMENTED | CONTRACT_VALIDATED | NOT_LIVE_PROVIDER_CERTIFIED | SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY |
| Jenkins | IMPLEMENTED | CONTRACT_VALIDATED | NOT_LIVE_PROVIDER_CERTIFIED | SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY |
| Azure DevOps | IMPLEMENTED | CONTRACT_VALIDATED | NOT_LIVE_PROVIDER_CERTIFIED | SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY |

The exact released GitHub machine execution label is `NOT_CERTIFIED`; S3
explicitly equates it with HOSTED_EXECUTION_NOT_CERTIFIED in release wording.
The table preserves that meaning without editing the machine record. Generic
certification is real native Windows execution, not hosted-provider proof.

GitHub run `36357568243` remains FAILURE / HOSTED_BOOTSTRAP_UNRESOLVED; policy
evaluation did not start and no certification product artifacts were produced.
Diagnostic `36396330199` remains FAILURE / STILL_UNRESOLVED /
HOSTED_DIAGNOSTIC_EXHAUSTED. Hosted PASS is not certified, hosted FAIL/CNE were
not executed/certified, and native/hosted parity is not established. No product,
workflow, scaffold, contract, hosted-incompatibility or transient cause was
proven. Diagnostic artifacts are not certification bundles.

S3 made hosted certification optional/non-blocking for MO-1306 v1. It did not
turn those failures into success, resolve their cause, or relax mandatory
Generic execution, offline provider contracts, semantic parity, security,
package, SBOM, provenance or binding gates. The exhausted retry/diagnostic rule
remains closed. MO-1302's own released hosted history cannot certify the
different MO-1306 candidate. No new hosted or native campaign is authorized.

## 7. Evidence graph, historical dispositions and safe reuse

Recommend a bounded acyclic graph rooted in explicit authoritative assessment
inputs, with candidate, contract/profile, receipts and immutable evidence
references. Freeze must settle the root, allowed node/edge types, receipt
binding, resolution rules, qualification propagation and cycle/self-reference
rejection. Do not hash a file through itself, embed an unknown future commit,
or accept a candidate that substitutes different bytes behind the same path.

MO-1305/MO-1306 offer a useful pattern: immutable evidence in I3, followed by a
binding-only BF referencing existing I3 bytes; actual containing commits are
resolved externally. They do not already define a generic MO-1307 graph schema
or require MO-1307 to use two commits for every assessment. A later human
decision or tag observation must not create a back-edge into the assessment
it consumes.

Freeze must distinguish current, historical, reusable, invalidated, qualified
and superseded evidence. Supersession changes applicability, not original
bytes or outcomes. Retain failed attempts and their original scope; link later
accepted evidence and the actual authority permitting its use. No latest-file
wins, retry-until-pass selection, historical failure promotion or diagnostic
promotion to certification is permitted.

Reuse requires explicit dependency identity and unchanged assumptions. Freeze
must define a closed dependency manifest and how complete correspondence is
verified. MO-1306's exact per-member/receipt reconciliation is evidence that
scoped reuse is possible; it is not permission to reuse every older PASS.

| Relevant change | Invalidation question for Freeze |
|---|---|
| Production source or source closure | Which gates depend on the changed bytes, and which remaining evidence has an exact unaffected closure? |
| Configuration or provider adapter | Are invocation, grammar, security and provider assumptions still identical? |
| Package/archive/distribution | Are archive identity and all relevant members bound, even when executable bytes are unchanged? |
| SBOM or provenance | Which integrity, package, supply-chain and origin assertions require renewed verification? |
| Runtime/toolchain/validator | Do execution, canonicalization, resource and validation claims remain valid for these exact versions? |
| Security controls or reviewed usage | Has a containment, trust or bounded-advisory assumption changed? |
| Certification evidence or authority | Are receipt identity, accepted scope, methodology and required disclosures unchanged? |
| Profile/contract, human decision or tag observation | Does the assessment still refer to the same authority and stage, and does any decision still bind it exactly? |

A result cannot stay valid after relevant candidate bytes or authority changes.
Freeze must choose deterministic invalidation and explicit reuse, including
scope corrections and recurrence conditions. If expiry is needed, it requires
an explicit bound evaluation reference time or supplied observation; hidden
wall-clock dependence would violate offline determinism.

## 8. Output, human decision record and tag relationship

Freeze must decide the canonical machine result: candidate identity, readiness,
gate matrix, blockers, qualifications, evidence references, historical
dispositions, provider matrix, required human actions, digest and independent
schema/contract version. Encoding, ordering, digest domain, unknown-field
behavior, partial/error results and bounds remain open. Exact output filenames
and serialized fields are not selected here. Human reports should be projections
of that structure; explanatory prose cannot change a gate or hide a limitation.

A separate human decision record is a candidate, not a committed v1 feature.
Compare a bound APPROVE/REJECT/DEFER record with leaving final decisions outside
the machine contract. If included, Freeze must define permitted author and
authoring mechanism, authentication evidence, candidate and assessment binding,
reason, immutability/supersession, conflicting decisions, timestamp treatment,
and signature/attestation requirements. A claimed username or approval string
is not authenticated authorization. No identity provider, account directory,
enterprise IAM or organizational approval service is authorized.

Avoid approval cycles: preparatory approvals, if inputs, need separate purpose
and identity from the final decision over a completed assessment. A final
decision should bind the assessment it reviewed, and a subsequent tag fact
should bind the actual target. Freeze must settle this staging without making
the final approval a prerequisite for computing the very assessment it approves.

Tag readiness is bounded observation/validation, not Git release management.
Freeze must distinguish pre-tag and post-tag assessment, absent/present tags,
expected name and exact target, annotated versus lightweight requirements,
wrong-target behavior, observation freshness, and effects on an earlier result.
The predecessor release protocol requires an annotated tag at validated BF;
whether and how a generic MO-1307 profile encodes it remains open. An ABSENT
pre-tag snapshot can coexist with a later verified tag; the snapshot remains
unchanged. Tag creation remains explicitly human-authorized.

## 9. Interfaces, distribution and dependency policy

MO-1307 may consume MO-1306 outputs. It must not run an arbitrary CI workflow or
become another CI engine. Freeze may scope readiness evaluation, machine output,
a provider-neutral projection or bounded publication of readiness evidence.
Acquisition and publication, if included, must be separate from readiness
authority and have explicit side effects, ownership and limits.

No interface expansion is automatic:

| Surface | Current boundary / Freeze obligation |
|---|---|
| SDK / CLI | Existing identities and semantics unchanged; select a bounded entry point only with explicit scope and compatibility analysis. |
| REST | Existing MO-1305 operations/runtime unchanged; no new endpoint or mandatory transport. |
| MCP | Existing MO-1304 six-tool/stdio contract unchanged; no new tool or mandatory transport. |
| VS Code | Existing MO-1303 extension unchanged; no readiness command or view implied. |
| GitHub Action / CI adapters | Existing MO-1302/MO-1306 contracts unchanged; no adapter generation, Action pin change or hosted job implied. |

Prefer one readiness core with thin surfaces if exposure is selected. Compare
an existing package, a new private package, conformance-only tooling or another
bounded artifact. The presence of Node-based predecessor packages is useful
evidence, not an architecture decision for MO-1307. Runtime/language, ownership,
installation and packaging remain OPEN.

Prefer zero or minimal production dependencies. Any runtime/validator
dependency needs explicit justification, pinning, provenance, license/notices,
offline availability and supply-chain review. Zero production dependencies
does not remove runtime, toolchain, schema or engineering-validator risk.
CCA-A001 licensing/distribution and broader CCA-A009 governance are not closed
by this task; a private or conformance artifact must not imply public release
permission. Freeze must record applicable distribution constraints.

## 10. Security and trust agenda

| Threat | Required Freeze control/question |
|---|---|
| Forged evidence / false certification | Authenticate the permitted root and claim origin as well as checking bytes; reject self-asserted live certification and diagnostic promotion. |
| Stale evidence / candidate substitution / digest substitution | Bind expected candidate, authority, dependencies and digest domains; compare exact identities and invalidate affected evidence. |
| Qualification omission / blocker suppression | Require complete gate and qualification coverage, cross-check summaries and reject unauthorized applicability changes. |
| Historical evidence rewriting | Preserve immutable source identities, original outcomes and explicit supersession/disposition links. |
| False human approval | Keep computed readiness separate; validate authorship/binding only within an explicitly frozen narrow mechanism. |
| Path traversal / malicious repository contents | Bound input roots, normalization, symlinks/junctions/reparse points, UNC/device/drive paths, alternate streams, case collisions, containment and race behavior. |
| Untrusted CI metadata | Treat run IDs, URLs, jobs and provider-supplied labels as association data unless separately authenticated and frozen for a specific claim. |
| Secret leakage / log injection | Minimize environment/credential access, redact or reject sensitive inputs, escape reports/logs and bound diagnostic text. |
| Resource exhaustion | Bound parsing, files, graph traversal, gates, output, time and memory; reject cycles and pathological inputs deterministically. |

Hashes establish integrity, not trust. Repository content cannot elect itself
as a trusted root; untrusted evidence cannot supply its own expected digest or
approve a more permissive profile. Freeze must specify trust bootstrap, allowed
authority versions, signed/unsigned receipt treatment, evidence provenance,
conflict resolution and narrowly scoped revocation/supersession. Prefer existing
repository mechanisms where sufficient; do not invent a cloud trust service.

## 11. Determinism, offline operation and platform policy

Computed readiness must be identical for identical authoritative inputs. Freeze
must specify canonical order, equality, path display, digest construction,
duplicate/conflict handling, schema/version rejection and deterministic errors.
Timestamps, hostnames, run IDs, URLs, temporary paths and usernames must not
alter normative readiness identity unless explicitly justified and frozen.
Evidence may retain authentic operational metadata without promoting it into
semantic or readiness identity indiscriminately.

Core evaluation must operate offline over supplied bounded evidence. No
mandatory external provider API, cloud service, GitHub connection, GitLab,
Jenkins or Azure account is permitted. Any network acquisition is a separate
explicitly scoped concern; offline evaluation can assess a supplied tag or
approval observation without claiming it performed a fresh remote query.

Native **Windows 11 x64** is the local certification platform. No Linux,
Ubuntu, WSL, additional Windows VM or user-provisioned VirtualBox, VMware,
Hyper-V or other VM requirement may enter MO-1307 through a reused tool or
certification plan. Historical predecessor Ubuntu/other platform evidence
remains true within its scope. GitHub Actions may be used only where separately
authorized; hosted execution is not required merely to compute readiness.

## 12. Errors, resource limits and publication questions

Freeze must separate operational errors from readiness outcomes. Review invalid
candidate, missing evidence, stale evidence, integrity mismatch, unsupported
evidence version, graph cycle, qualification mismatch, decision-record mismatch,
filesystem failure and internal failure. Decide deterministic precedence,
stable codes, exit mapping, whether a bounded partial assessment is valid and
what must never appear as a completed ready result. Do not map every error to
NOT_READY or reuse semantic CNE as a generic infrastructure error.

Freeze must bound evidence file count/bytes, graph nodes/edges, gates,
qualifications, path length, JSON depth, output size, execution time and memory.
Input/output staging and temporary space, if needed, require bounds too. Reuse
established limits only when their scope is actually shared; MO-1301 semantic
limits remain untouched and unrelated REST/CI numbers are not copied. Separate
functional correctness, resource characterization and boundary enforcement;
measurement-dependent values need a finite Phase 1 resolution plan before
dependent implementation proceeds.

If output is written, Freeze must settle atomic completion, interrupted writes,
cancellation, duplicate/conflicting assessments, immutable result identity and
bounded cleanup. No partial artifact may masquerade as a complete assessment.
Retry or publication behavior must not become workflow orchestration, an
unbounded evidence campaign or a method of selecting only successful attempts.

## 13. Exclusions and later milestones

- **MO-1308 remains prospective:** no durable investigation database, general
  historical query service, long-lived analytics store or evidence warehouse.
  Bounded supplied files/receipts and bounded readiness output are sufficient.
- **MO-1309 remains prospective:** no dashboard, SaaS control plane, web
  administration UI or organization-management portal. Machine output and
  bounded human reports suffice.
- No enterprise IAM/RBAC platform, approval-workflow SaaS, change-management
  system, ticketing, deployment orchestrator or release-train scheduler.
- No second Policy/Regression engine, semantic reinterpretation, new provider
  adapter, arbitrary workflow executor or arbitrary Git release manager.
- No implicit public distribution, cloud trust service, account provisioning,
  hosted certification campaign, interface expansion or predecessor redesign.

## 14. Testing, certification and candidate workstreams

This is a plan for Freeze, with no new test implementation or evidence now.
Freeze must define a closed vector/requirement inventory and acceptance criteria
covering candidate substitution and binding; gate completeness/aggregation;
qualification and blocker propagation; missing, stale and tampered evidence;
cycles/self-reference; historical preservation, supersession and recurrence;
false certification promotion; provider limitations; exact canonical output and
determinism; human-decision separation; tag-state handling; resource boundaries;
filesystem security; offline operation; interrupted/partial output; and a
negative corpus for forged claims, duplicates, unknown versions and omissions.
Vary volatile metadata independently and compare exact normative bytes, not
only parsed objects. Test candidate/error/state cross-products where precedence
could otherwise mask a limitation or invalid input.

Plan Phase 3 for real Windows execution **if a production runtime is selected**;
artifact/package certification if applicable; security/release audit;
readiness-vector conformance; evidence-graph integrity; reproducibility;
offline operation; supply chain; and final non-self-referential binding. Each
conditional campaign needs applicability decided at Freeze. Conformance-only
tooling still needs its declared execution and integrity checks but cannot
claim certification of a nonexistent production runtime/package. There is no
Linux/Ubuntu/VM gate. Reuse existing evidence only through verified exact
dependencies; do not rerun predecessor campaigns to create MO-1307 authority.

Freeze should adopt the existing methodology's structural checks first,
focused functional coverage, separate resource characterization, bounded
negative tests and honest fresh/reused provenance. Applicable predecessor
engineering task budgets remain constraints on later implementation/conformance
planning; this authority creates no campaign budget or execution permission.

Candidate post-Freeze workstreams, subject to Phase 1 interfaces and review:

| Candidate stream | Responsibility | Integration dependency |
|---|---|---|
| 2A — readiness core | Profile applicability, deterministic gate composition, readiness and error projection | Frozen evidence identity/validation boundary from Phase 1 |
| 2B — evidence integrity | Bound graph, trust verification, history, dependency invalidation and reuse | Frozen candidate/profile/receipt contracts; no independent readiness engine |
| 2C — release projection | Canonical/human output, optional decision record, tag observations and explicitly selected thin interfaces | One core result; no alternative gate or semantic computation |

A smaller serial implementation may be preferable if these boundaries overlap.
No branch/worktree is created now. Actual parallel branches can be justified
only after Phase 1, with closed ownership, shared contracts and integration
criteria. Freeze and Phase 1 precede implementation; Phase 2 streams and Phase 3
campaigns are not implied to have started.

## 15. Closed Contract Freeze 1 decision register

The register contains **50 entries: 36 OPEN, 6 RESOLVED_BY_PREDECESSOR and
8 RESOLVED_BY_CONSTRAINT**. It is the complete substantive agenda discovered
by this task. OPEN recommendations are proposals, not decisions. Freeze must
record the selected option, evidence and compatibility consequences for every
OPEN entry, or explicitly exclude the feature from v1 and freeze that exclusion.
New questions discovered at Freeze must be added explicitly before closure;
there is no silent unregistered design authority.

### Open architecture and input decisions

**D01 — What artifact, runtime and owner implement readiness?**

- Evidence: A1, A7, A10 show existing semantic consumers and private Node packages, but no MO-1307 runtime.
- Options: existing package; new private package; conformance-only tooling; another bounded artifact with justification.
- Constraints: preserve dependency direction, licensing limits and zero implementation now.
- Recommendation: compare the smallest offline artifact against actual surface requirements; no placement selected.
- Status: OPEN.

**D02 — Which interfaces expose readiness in v1?**

- Evidence: A2–A7 freeze existing SDK/CLI, REST, MCP, VS Code, Action and CI contracts.
- Options: bounded standalone/conformance entry point; selected thin SDK/CLI surface; individually justified REST/MCP/VS Code/Action/adapter exposure; exclude each unused surface.
- Constraints: no automatic expansion or duplicated readiness computation.
- Recommendation: one core and minimum necessary surface, with an explicit include/exclude decision per interface.
- Status: OPEN.

**D03 — Are readiness profiles needed, and how are they represented?**

- Evidence: A2 permits closed investigation facts, not generic release receipts; A10 uses finite release gates.
- Options: fixed gate set; closed declarative profiles for selected release types; reuse only already-supported Policy outputs within composition.
- Constraints: no general policy language, custom rule execution or new MO-1301 fact domains.
- Recommendation: assess a finite purpose-specific profile contract; freeze which of core/provider/SDK/REST/CI release profiles exist.
- Status: OPEN.

**D04 — Which exact identities define the candidate and assessment?**

- Evidence: A10 separates production C3CB, methodology M3, scope S3, evidence I3 and binding BF; A11 separates changed metadata from runtime.
- Options: commit plus explicit dependency closure; tree/package-centric identity with bound Git/authority references; profile-specific mandatory identity subsets.
- Constraints: no floating candidate; distinguish required, absent and inapplicable commit/tree/archive/distribution/SBOM/provenance/configuration/adapter/contract/receipt identities.
- Recommendation: explicit candidate and authority closures; decide documentation-only descendants without pretending old evidence tested new bytes.
- Status: OPEN.

**D05 — What is the closed accepted evidence category set?**

- Evidence: section 4 inventories 18 candidate categories; A2–A11 establish different authorities and scopes.
- Options: accept a bounded subset; combine categories with justification; explicitly exclude unsupported categories.
- Constraints: every proposed category receives a disposition; no arbitrary plugin evidence or implicit source expansion.
- Recommendation: require source, version, claim scope and applicability for each included category.
- Status: OPEN.

**D06 — Which formats, versions and verification mechanisms are accepted?**

- Evidence: A7 distinguishes semantic and operational bundles; A10's validator assumes its historical BF/pre-tag stage.
- Options: narrow readers using existing verification capabilities; bounded normalized references preserving original bytes; exclude unsupported receipts.
- Constraints: never run obsolete phase campaigns or mint semantic authority through detached inspection; unknown versions must have explicit behavior.
- Recommendation: list exact accepted versions and verification responsibilities without coupling to historical HEAD/tag assertions.
- Status: OPEN.

**D07 — What authenticates the root authority and evidence origin?**

- Evidence: A2 and A7 distinguish integrity from provenance; A4's owner label alone is not an authentication protocol.
- Options: explicit trusted repository revision/inventory; narrowly pinned attestations; another bounded offline root mechanism.
- Constraints: untrusted input cannot choose its expected digest, trust root or permissive profile; no cloud trust service.
- Recommendation: use existing repository binding where sufficient and explicitly decide signed/unsigned evidence, trust bootstrap and rejection rules.
- Status: OPEN.

### Open evaluation and evidence decisions

**D08 — Which gates are mandatory, optional or inapplicable?**

- Evidence: A8/A10 distinguish mandatory Generic/offline/security gates from optional hosted and not-required live-provider gates.
- Options: fixed mandatory inventory; selected profile inventory with frozen applicability predicates.
- Constraints: NOT_REQUIRED and NOT_APPLICABLE need bound authority/evidence; omissions and duplicates are not success.
- Recommendation: closed gate coverage and explicit applicability proof for each candidate/profile.
- Status: OPEN.

**D09 — What are readiness states and deterministic aggregation precedence?**

- Evidence: A12 requires more than one boolean; predecessors do not freeze MO-1307 aggregation.
- Options: the four proposed states; another justified closed model with separate completeness/error dimensions.
- Constraints: preserve qualifications, blockers and errors; Policy PASS cannot decide overall readiness.
- Recommendation: freeze a complete truth table for mixed blockers, qualifications, missing evidence and unevaluable gates.
- Status: OPEN.

**D10 — What is the gate model and where does history live?**

- Evidence: A10 permits zero current blockers while preserving historical failures; section 5 lists candidate labels.
- Options: one closed gate-state enumeration; orthogonal applicability, current evaluation and historical disposition axes.
- Constraints: do not erase historical failures or let historical rows substitute for current required gates.
- Recommendation: compare orthogonal dimensions against the proposed states before choosing exact labels.
- Status: OPEN.

**D11 — What constitutes a structured qualification and how does it propagate?**

- Evidence: A4, A8–A11 contain provider, advisory, same-host and historical limitations.
- Options: typed qualification records linked to gates/evidence; bounded shared records with explicit references.
- Constraints: retain scope, authority, disclosure, unresolved cause and recurrence/review conditions in every required projection.
- Recommendation: preserve qualifications transitively with deterministic identity/deduplication; freeze required fields and counts.
- Status: OPEN.

**D12 — How are blockers, diagnostics and unavailable evidence distinguished?**

- Evidence: A2 separates errors from semantic results; A8 separates optional limitations from mandatory failures.
- Options: independent finding/error categories plus gate projection; another closed model retaining these distinctions.
- Constraints: no silent blocker suppression, qualification-to-PASS conversion or error-to-NOT_READY collapse.
- Recommendation: explicit category and precedence matrix including missing, invalid, stale and inaccessible evidence.
- Status: OPEN.

**D13 — How are historical, superseded and current evidence related?**

- Evidence: A9's narrow 18-condition disposition and recurrence rule; A10/A11 retain original failures separately.
- Options: explicit immutable disposition links with applicability predicates; fixed predecessor-specific disposition recognition.
- Constraints: no general waiver, age-based retirement, retry selection or rewriting; current contrary evidence must be accounted for.
- Recommendation: bind the actual superseding/scope authority and original evidence; preserve unresolved causes and recurrence invalidation.
- Status: OPEN.

**D14 — What is the bounded evidence graph and root?**

- Evidence: A10/A11 use acyclic I3/BF binding; A5 uses external non-self-hashing receipts.
- Options: typed DAG rooted in the assessment input closure; bounded reference inventory with mechanically checked DAG semantics.
- Constraints: no cycles, self/future references, dangling mandatory nodes or final-decision/tag back-edges.
- Recommendation: reuse non-self-referential principles; select topology and allowed edges without copying a milestone-specific schema blindly.
- Status: OPEN.

**D15 — How are references, duplicates and conflicting receipts resolved?**

- Evidence: A7 requires exact cardinality/path/size/digest/cross-links; A10 compares exact dependencies.
- Options: content-addressed references plus explicit root mapping; closed relative-path inventory with expected identities.
- Constraints: no latest-file wins, traversal, digest substitution or source-dependent iteration order.
- Recommendation: deterministic resolution and explicit rejection/disposition rules for duplicate, conflicting and missing references.
- Status: OPEN.

**D16 — What dependency closure permits reuse and causes invalidation?**

- Evidence: A10 reconciles each affected file/assertion; A11 limits runtime reuse to identical members.
- Options: exact per-gate dependency manifests; conservative whole-candidate invalidation with explicitly justified unaffected subsets.
- Constraints: source/config/package/SBOM/provenance/runtime/toolchain/adapter/security/certification changes must be covered; no unjustified inherited PASS.
- Recommendation: explicit per-claim closures and invalidate on any relevant identity or assumption change.
- Status: OPEN.

**D17 — How do authority changes, expiry and fresh observations affect validity?**

- Evidence: A8 changes gate applicability without rewriting results; A9 makes recurrence invalidate an exception.
- Options: identity-only validity; explicit bound observation/evaluation time where a profile requires expiry; bounded revocation/supersession references.
- Constraints: offline determinism and historical preservation; no hidden clock or remote polling dependency.
- Recommendation: authority/dependency identity first; add temporal policy only for a justified explicit requirement.
- Status: OPEN.

### Open output, decision and integration decisions

**D18 — What is the canonical result and its independent identity?**

- Evidence: A2/A7 preserve normative bytes; section 8 lists candidate output content.
- Options: one versioned bounded canonical result; result plus separately bound evidence inventory.
- Constraints: all gates, blockers, qualifications, history, providers and human actions remain inspectable; no semantic artifact reserialization.
- Recommendation: freeze encoding, fields, digest domain, schema/version and canonicalization together, without choosing filenames now.
- Status: OPEN.

**D19 — How are human explanations and provider projections produced?**

- Evidence: A3/A7 keep presentation separate from semantic authority; A12 requires reasons and visible limitations.
- Options: bounded text projection; structured report plus text; minimal provider-neutral summary.
- Constraints: prose cannot decide gates, leak secrets or silently truncate required qualifications/blockers.
- Recommendation: derive explanations from canonical references and define overflow/completeness behavior.
- Status: OPEN.

**D20 — Is a human decision record included in v1?**

- Evidence: A4 has a scoped human exception precedent; A12 keeps final authorization distinct.
- Options: separate APPROVE/REJECT/DEFER-like record; external human process referenced without a MO-1307 decision artifact.
- Constraints: no autonomous approval, workflow service or execution of a decision.
- Recommendation: include only if a bounded review use case warrants it; exact record and states remain open.
- Status: OPEN.

**D21 — If included, who authors/authenticates decisions and how are they retained?**

- Evidence: A7's integrity/origin distinction; A12 requires author, reason, immutability, timestamp and attestation analysis.
- Options: trusted local/repository-authored record; pinned offline attestation; explicitly external authentication boundary.
- Constraints: a username/string is not proof; no IAM; define conflicts, supersession/revocation and timestamp treatment.
- Recommendation: narrow authoring/trust contract with immutable decision history and explicit signature requirements or exclusion.
- Status: OPEN.

**D22 — How do preparatory approvals, assessment and final decision bind without cycles?**

- Evidence: A10/A11 stage binding after immutable evidence; section 8 distinguishes preparatory and final approvals.
- Options: assessment then separate exact-bound final decision; staged assessment inputs with separately scoped preparatory approvals.
- Constraints: final approval cannot be needed to compute its own assessment; approval cannot change computed readiness or expected candidate bytes.
- Recommendation: downstream decision binding, explicit purpose/identity and stale-decision behavior; decide external-record case too.
- Status: OPEN.

**D23 — How are tags observed and assessed?**

- Evidence: A10/A11 preserve ABSENT snapshots and require annotated tags at exact validated BF; section 1 verifies the later tag.
- Options: explicit pre/post-tag profiles; bounded tag observation with stage/applicability rules.
- Constraints: choose absent/present/wrong-target/lightweight handling, exact target, freshness and invalidation; no tag creation.
- Recommendation: stage-aware observations linked to exact targets while retaining original pre-tag evidence.
- Status: OPEN.

**D24 — What CI acquisition, projection or publication is in scope?**

- Evidence: A7 already owns provider execution; A12 permits considering readiness output/publication.
- Options: consume supplied files only; explicitly scoped acquisition or provider-neutral projection/publication outside the core.
- Constraints: offline core, bounded side effects, no provider account requirement or workflow engine.
- Recommendation: supplied evidence first; justify each additional operation and publication authority separately.
- Status: OPEN.

### Open security, resources and delivery decisions

**D25 — What filesystem boundary and race defenses apply?**

- Evidence: A6/A7 have Windows containment models; evidence input introduces new read/parse paths.
- Options: explicitly supplied regular files under a trusted root; bounded archive/input staging with extra validation.
- Constraints: cover traversal, absolute/UNC/device/drive paths, reparse points, alternate streams, case collisions and races.
- Recommendation: smallest allowed path surface and hostile-filesystem negative vectors; freeze output/temp ownership too.
- Status: OPEN.

**D26 — What process, network, environment, secret and log boundaries apply?**

- Evidence: A7 bounds process roles and metadata; A12 requires offline evaluation and malicious-input handling.
- Options: in-process bounded verification; narrowly pinned helper invocation; separate optional acquisition/publication.
- Constraints: no arbitrary executable/network access, secret inheritance or log injection; no borrowed VM/provider prerequisites.
- Recommendation: avoid helpers/network unless needed; explicitly freeze trusted executable selection, redaction and escaped diagnostics.
- Status: OPEN.

**D27 — What is the error model, precedence and exit contract?**

- Evidence: A2/A7 separate operational failures from completed semantic outcomes; section 12 lists candidate errors.
- Options: typed errors with no assessment on invalid roots; bounded partial result for explicitly supported incomplete cases.
- Constraints: deterministic codes/order, filesystem/internal handling and unsupported-version behavior; do not change predecessor exit codes.
- Recommendation: freeze a matrix linking each error to completion, output and readiness effects, separately from gate aggregation.
- Status: OPEN.

**D28 — What resource values and measurement obligations apply?**

- Evidence: A2 semantic limits are fixed; A6/A7 measured transport/process limits are scope-specific.
- Options: conservative fixed readiness limits; bounded Phase 1 measurements for unresolved values.
- Constraints: files/bytes/nodes/edges/gates/qualifications/path/depth/output/time/memory and staging all bounded; no blind REST/CI copying.
- Recommendation: define independent readiness limits, pre/post-identity error behavior and boundary tests; close measurement-dependent values before dependent work.
- Status: OPEN.

**D29 — Which bytes and metadata determine deterministic identity?**

- Evidence: A1/A2 canonical contracts exclude ambient variation; A7 separates operational metadata.
- Options: restricted canonical representation with separate diagnostic metadata; explicit claim-specific inclusion of necessary observation identity.
- Constraints: justify any timestamp/hostname/run ID/URL/temp path/username identity contribution; freeze ordering, equality and duplicates.
- Recommendation: minimal normative projection and metadata-perturbation byte-equality vectors.
- Status: OPEN.

**D30 — What dependency and supply-chain contract ships with the selected artifact?**

- Evidence: A7/A10 show zero external production npm dependencies but pinned runtime, schemas, validators and tooling; A1 keeps licensing open.
- Options: no added runtime dependency; justified pinned minimal dependency; engineering-only validator with explicit distribution boundary.
- Constraints: provenance, license/notices, offline availability and bounded advisory review; no unpinned fetch or public-license assumption.
- Recommendation: inventory all runtime and engineering trust dependencies and assess each separately.
- Status: OPEN.

**D31 — What is the closed test/vector inventory and acceptance threshold?**

- Evidence: A2–A11 have negative and identity checks; section 14 collects MO-1307 coverage.
- Options: vector conformance with exact expected bytes/errors; targeted integration checks for each selected surface.
- Constraints: all specified positive/negative, history, qualification, trust, resource and offline cases covered; no tests/evidence now.
- Recommendation: freeze traceability from every requirement/decision to meaningful acceptance vectors.
- Status: OPEN.

**D32 — Which Phase 3 certifications are required and what can be reused?**

- Evidence: A6/A10/A11 distinguish native, package, security and exact reused evidence.
- Options: Windows runtime plus applicable package/audit tracks; conformance-only validation when no runtime/package exists.
- Constraints: readiness vectors, DAG integrity, reproducibility, offline, supply chain and final binding covered; no Linux/Ubuntu/VM requirement.
- Recommendation: condition each campaign on actual frozen deliverables and reuse only exact unaffected dependencies.
- Status: OPEN.

**D33 — What are Phase 1 outputs and post-Phase-1 workstream boundaries?**

- Evidence: A7 uses phased contracts; section 14 proposes 2A/2B/2C.
- Options: serial bounded implementation; parallel core/integrity/projection work after stable Phase 1 contracts.
- Constraints: no branches now; no shared-file semantic duplication; resolve resources and interfaces before dependent implementation.
- Recommendation: freeze Phase 1 acceptance and candidate stream ownership/integration criteria, then justify parallel work after Phase 1.
- Status: OPEN.

**D34 — How are readiness contracts versioned and assessed for compatibility?**

- Evidence: A1's CCA-A011 and A2 separate product, normative and compatibility identities.
- Options: independent readiness contract/profile versions with a supported evidence matrix; bounded v1-only acceptance.
- Constraints: no silent predecessor version change, automatic future-version acceptance or implied Standard revision.
- Recommendation: explicit compatible evidence/profile/contract matrix and unknown-version rejection policy.
- Status: OPEN.

**D35 — Who may define profiles or authorize gate applicability/qualification changes?**

- Evidence: A8 changes a release requirement through explicit scope authority; A9 permits only a narrow historical disposition.
- Options: fixed owner-approved profile inventory; externally selected but explicitly trusted versioned profiles.
- Constraints: final approval cannot rewrite readiness facts; repository/evidence content cannot grant its own waiver or suppress a blocker.
- Recommendation: bind profile/disposition authority independently of both untrusted evidence and downstream human decision.
- Status: OPEN.

**D36 — What are completion, interruption and duplicate-publication semantics?**

- Evidence: A7/A9 distinguish failed publication from complete evidence and preserve all attempts.
- Options: return-only evaluation; bounded atomic file publication with explicit incomplete/failure state.
- Constraints: cancellation, retries, concurrent writers, duplicate/conflicting results, output ownership and cleanup cannot fabricate completion.
- Recommendation: smallest complete-output protocol matching the selected surface; no retry engine or durable store.
- Status: OPEN.

### Decisions resolved by released predecessors

**D37 — May readiness redefine Policy, Regression or SDK/CLI semantic identities?**

- Evidence: A2's closed sources, canonical outcomes, independent identities and limits.
- Options: preserve authoritative outputs; reinterpret them or add generic release facts (excluded).
- Constraints: released semantic contracts cannot be silently changed.
- Recommendation: consume and verify original semantic artifacts; detached digest checks never mint Core authority.
- Status: RESOLVED_BY_PREDECESSOR.

**D38 — Does MO-1302 job gating become organizational release authority?**

- Evidence: A3 freezes GitHub-specific Policy gating and excludes MO-1307.
- Options: preserve job/semantic distinctions; reassign release-decision semantics (excluded).
- Constraints: immutable Action behavior and historical certification.
- Recommendation: treat its evidence within its original candidate and scope.
- Status: RESOLVED_BY_PREDECESSOR.

**D39 — Can the MO-1303 exception be promoted to full platform certification?**

- Evidence: A4 retains macOS and three-platform parity NOT EXECUTED.
- Options: preserve qualified history; promote unexecuted cases (excluded).
- Constraints: existing VS Code scope/trust/runtime and exception boundaries.
- Recommendation: retain the exact exception and certification dimensions.
- Status: RESOLVED_BY_PREDECESSOR.

**D40 — Does MO-1304 permit readiness tools or broader transport implicitly?**

- Evidence: A5 freezes six local stdio tools and released platform receipts.
- Options: retain protocol; infer a readiness tool/transport (excluded).
- Constraints: no automatic MCP expansion or rewriting historical Windows/Ubuntu parity.
- Recommendation: preserve MCP; any new exposure must be separately decided under D02.
- Status: RESOLVED_BY_PREDECESSOR.

**D41 — Does MO-1305 certify general remote/cloud deployment or new endpoints?**

- Evidence: A6/A11 freeze endpoints and bound same-host, advisory and resource claims.
- Options: consume exact scoped REST evidence; generalize certification/runtime (excluded).
- Constraints: existing REST contract and release certification remain unchanged.
- Recommendation: carry its limitations and dependencies explicitly; D02 cannot imply redesign.
- Status: RESOLVED_BY_PREDECESSOR.

**D42 — May MO-1306 provider limitations or failed history be promoted away?**

- Evidence: A7–A10 freeze the qualified matrix, exhausted hosted diagnostics and narrow M3 disposition.
- Options: preserve support/validation/execution separately; claim unproved hosted/live PASS or reopen diagnostics (excluded).
- Constraints: Generic real execution, GitHub hosted limitation and other providers' contract-only status remain exact.
- Recommendation: apply section 6 without changing predecessor machine labels or scope.
- Status: RESOLVED_BY_PREDECESSOR.

### Decisions resolved by this task's constraints

**D43 — Does computed readiness authorize final release actions?**

- Evidence: A12 and section 2 explicitly reserve final human authority.
- Options: evidence computation/presentation; autonomous release/tag/push/publish/deploy/merge approval (excluded).
- Constraints: any later authority change needs explicit later milestone authorization.
- Recommendation: keep computed assessment and final human decision separate.
- Status: RESOLVED_BY_CONSTRAINT.

**D44 — Must readiness require provider APIs, cloud or live accounts?**

- Evidence: A12 requires offline supplied-evidence evaluation.
- Options: offline core with separately scoped optional acquisition; mandatory external connection (excluded).
- Constraints: no mandatory GitHub connection, GitLab/Jenkins/Azure accounts or cloud trust service.
- Recommendation: preserve offline authority; decide optional side effects only under D24/D26.
- Status: RESOLVED_BY_CONSTRAINT.

**D45 — Are Linux, Ubuntu, WSL or VMs certification prerequisites?**

- Evidence: A12 fixes native Windows 11 x64; A6/A8 already exclude new VM/Linux prerequisites.
- Options: native Windows local certification; mandatory alternate platform/VM infrastructure (excluded).
- Constraints: preserve historical predecessor platform evidence without importing new obligations.
- Recommendation: Windows 11 x64, no Linux/Ubuntu/WSL/user-provisioned VM gate.
- Status: RESOLVED_BY_CONSTRAINT.

**D46 — May MO-1307 own durable investigation storage?**

- Evidence: A12/A13 reserve MO-1308's prospective history scope.
- Options: bounded files/receipts/results; durable database/query/analytics/evidence warehouse (excluded).
- Constraints: no long-lived history service.
- Recommendation: bounded evidence input/output only.
- Status: RESOLVED_BY_CONSTRAINT.

**D47 — May MO-1307 deliver a dashboard or administration UI?**

- Evidence: A12/A13 reserve MO-1309's prospective dashboard scope.
- Options: machine output and bounded human report; dashboard/SaaS/control-plane/admin portal (excluded).
- Constraints: no cloud product or organization portal.
- Recommendation: retain MO-1309 as PLANNED / AUTHORITY PENDING.
- Status: RESOLVED_BY_CONSTRAINT.

**D48 — May MO-1307 become an organizational governance platform?**

- Evidence: A12's governance exclusions and A1's wider unresolved governance.
- Options: bounded MemoryOS readiness contracts; IAM/RBAC/approval SaaS/change-management/ticketing/deployment/scheduling platform (excluded).
- Constraints: no organizational identity management or arbitrary workflow/Git release engine.
- Recommendation: narrow evidence and decision boundaries only.
- Status: RESOLVED_BY_CONSTRAINT.

**D49 — Does roadmap authorization permit implementation or release operations now?**

- Evidence: A12 and section 1 restrict this task to two documentation files and one local commit.
- Options: authority analysis; production/schema/package/dependency/adapter/automation work, campaigns, branches/worktrees, push/tag (excluded).
- Constraints: production changes zero; Phase 1/2/3 evidence zero.
- Recommendation: Contract Freeze 1 is the exact next task; no implementation-started claim.
- Status: RESOLVED_BY_CONSTRAINT.

**D50 — May a new surface independently compute readiness or semantic truth?**

- Evidence: A12 requires explicit Freeze scope and prefers one authoritative core; A1/A2 preserve existing semantic ownership.
- Options: one core with explicitly scoped thin surfaces; automatic interface expansion/duplicated evaluation (excluded).
- Constraints: D02 selects exposure; no REST/MCP/VS Code/Action/CI expansion by implication.
- Recommendation: preserve one readiness authority and all predecessor semantic authorities.
- Status: RESOLVED_BY_CONSTRAINT.

## 16. Contradiction audit

The audit searched repository authority and supporting Markdown, inventories and
binding records for MO-1307, release readiness, release governance, release
decision, ready to tag, CERTIFIED_READY_TO_TAG, approval, blocker,
qualification, release gate, human approval, MO-1308 and MO-1309. Classification
depends on the scope and time of the record, not a keyword alone. The table
groups findings with the same authority/disposition; it does not reclassify
every historical mention as a live requirement.

| Finding / source | Classification | Disposition |
|---|---|---|
| A1/A2 single semantic authority, independent identities, closed facts, canonical bytes and detached-verification limits | CURRENT_AUTHORITY | Preserve; no second semantic engine or invented release-fact domain. |
| Baseline ROADMAP product row, post-MO-1305 reconciliation, MO-1306 table/status/pre-tag paragraphs and MO-1306 tag-review next task | CONTRADICTION | Correct current roadmap to released MO-1306 with verified tag; do not alter certification snapshots. |
| Baseline ROADMAP MO-1307 PLANNED / AUTHORITY PENDING and future-only assignment | CONTRADICTION | Replace with AUTHORIZED / CONTRACT FREEZE 1 NEXT and bounded readiness/human-authority scope. |
| ROADMAP released-history treatment of development-stage guides/indexes and inventories | CURRENT_AUTHORITY | Extend current reconciliation to MO-1306 stage records; preserve their bytes. |
| A3 GitHub job gating, PASS/FAIL/CNE/tool errors and frozen MO-1307 exclusion | RELEASED_HISTORY | Retain exact released behavior; it is not general release authorization. |
| A4 VS Code external-infrastructure exception and A5 MCP platform/transport contracts | RELEASED_HISTORY | Preserve qualified/platform history and closed surfaces. |
| A6/A11 REST runtime, same-host remote limits, bounded advisory scope, certification and tag protocol | RELEASED_HISTORY | Consume scoped evidence; no general cloud certificate or mandatory REST transport. |
| A7/A8/A9 original CI freeze and later S3/M3 scope/methodology authorities | RELEASED_HISTORY | Preserve exact corrections, applicability, disclosure and exhausted retry/recurrence rules. |
| A10 provider matrix, accepted current binding and preserved native/hosted failures | HISTORICAL_EVIDENCE | Keep original machine labels and outcomes; derive no unproved PASS/live certification. |
| A10 final inventory CERTIFIED_READY_TO_TAG and ABSENT tag; phase reports' pending review and scope correction's then-not-released wording | HISTORICAL_EVIDENCE | They describe pre-tag state; section 1/current ROADMAP record the later observed tag. No rewrite. |
| MO-1301 conformance guide release-readiness naming, Core example readiness prose, older MO-1302 pending hosted wording and frozen MCP package Phase 3 wording | HISTORICAL_EVIDENCE | Certification/navigation/example or stage context, not an implemented MO-1307 readiness contract. A7's original contradiction audit already records these distinctions. |
| ROADMAP MO-1308 Investigation History and MO-1309 Cloud Dashboard | PROSPECTIVE | Keep PLANNED / AUTHORITY PENDING, with existing boundaries. |
| Generic roadmap future release-governance work and A6's future release-decision-engine wording | PROSPECTIVE | No automatic final approval, IAM or workflow authorization; this authority supplies the explicit human boundary. |

Only current ROADMAP contradictions are corrected. Released documents,
inventories, schemas, packages, receipts, historical evidence and tags are
unchanged. The historical MO-1306 Phase 3D validator requires the exact BF HEAD
and an absent release tag; those pre-tag assumptions make it inappropriate as
a new generic workspace check. No assertion is made that it was rerun here.

## 17. Documentation validation and exact next task

For this authority change, run the existing read-only workspace verifier,
available documentation/link checks, `git diff --check` and full diff review.
No dedicated repository Markdown/link-check command was found; use a read-only
local path/anchor check on the changed documents and report that limited scope.
Verify the changed-path set is exactly ROADMAP.md and this authority. Do not
run production or phase evidence campaigns to validate prose. Commit once with
subject `docs(memoryos-1.3): authorize MO-1307 release governance` and parent
`332ab0d2c35643ea8d155bcbea9c5019b304bbe3`; leave the commit local and tags intact.

The exact next task is:

**MEMORYOS 1.3 MO-1307 CONTRACT FREEZE 1 — RELEASE GOVERNANCE AND READINESS**

Its agenda is to resolve D01–D36, reaffirm D37–D50, and freeze the bounded v1
contract and Phase 1 plan. Resolve candidate/evidence/trust and profile authority
first; then gate/qualification/history/aggregation and errors; then graph,
invalidation/reuse, canonical output, optional decisions and tag staging; then
surfaces, security, resources, distribution/dependencies, testing and applicable
certification. Account explicitly for all 18 proposed evidence categories and
every possible interface. Freeze must leave no implementation-dependent design
choice implicit, and must keep computed readiness separate from final human
release authorization. Implementation, Phase 1 evidence and parallel branches
remain later tasks.
