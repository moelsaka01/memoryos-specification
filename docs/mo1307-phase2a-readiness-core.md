# MemoryOS 1.3 MO-1307 Phase 2A readiness core

Phase 2A implements the pure readiness computation authorized by [Contract Freeze 1](mo1307-contract-freeze-1.md), using the unchanged [Phase 1 foundation](mo1307-phase1-foundation.md). This is an implementation handoff, not integrated CLI/API or product certification. The public API and fixed acquisition helper remain guarded until the separately owned verification and orchestration work is integrated.

## Baseline and ownership

Worktree: `C:\Users\melsa\Documents\Codex\cca-mo1307-2a`.
Branch: `codex/mo1307-phase2a-readiness-core`.
The initial working tree was clean at B1 `3883ca889911fcc5a6f46c24e569478a8c32648e`, subject `conformance(memoryos-1.3): bind MO-1307 phase 1 foundation`.
Its parent is I1 `7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee`, whose parent is Freeze `e0cb8e9cc6aa73e26945db30756a6667a8d9e322`.

The new private modules are [readiness-core.mjs](../repositories/memoryos-readiness/src/readiness-core.mjs) and [readiness-result.mjs](../repositories/memoryos-readiness/src/readiness-result.mjs). They compute profiles, applicability, gates, blockers, CNE, qualifications, history/provider projections, normalized results, readiness/proof identities and bounded renderings. No filesystem read, network, child process, environment selector, Git query, provider API or clock supplies semantic input. Node crypto and the existing shared canonical implementation supply hashes.

Phase 2B remains responsible for trust pins, manifest/envelope/source integrity, grants and their authority, candidate closure, dependencies, staleness, selective reuse, historical authenticity/inventory and graph derivation. Phase 2C remains responsible for acquisition, tag observations, Windows handles/helper, public wrappers, worker topology, deadlines/cancellation, external decision checking, publication and stdout transport. Phase 2A authenticates none of these. No predecessor semantic campaign was rerun.

## Exact internal verified-input contract

`computeReadiness(verified)` is synchronous and private: it is not exported from the package root. The closed own-data-property argument has exactly:

```text
{
  candidate: Candidate,
  candidateDigest: Digest,
  profile: Profile,
  stage: PRE_TAG_READINESS | POST_TAG_VERIFICATION,
  scopeId: Id,
  authorityIdentityDigest: Digest,
  slots: [NormalizedSlot],
  claims: [{claim: Claim, claimDigest: Digest, grantDigest: Digest}],
  graph: Graph,
  graphDigest: Digest,
  audit: Audit
}
```

Every named record is the existing Phase 1 representation. Each NormalizedSlot is `{gateId,grantDigests,availability,reason}`. Exactly the 22 frozen gate IDs are present. An inactive slot is empty/AVAILABLE; each available active parent selects exactly one supplied claim/grant. Each optional child exactly mirrors its provider parent. Every claim row is selected, and every selected grant/claim has its corresponding Audit binding. No raw envelope, authority file, configuration, source bytes, caller-authored gate state or derived readiness is accepted.

Only the private `slots` and `claims` transport collection order is nonsemantic; the core sorts detached copies. All embedded Phase 1 arrays retain their mandated sorted, unique order. Object key insertion order is nonsemantic under the shared J encoder. Malformed values, unknown fields, accessors, cycles, duplicate transport identities, wrong profile/candidate identity and inconsistent selected references are operational errors, never fabricated normative CNE.

The caller **must already have verified** every supplied claim and its source lineage, normalized authority, exact graph and audit. The private projection is an integration boundary, not an authenticity token: constructing a JavaScript object cannot grant authority. `inspectFoundationInputs` alone is insufficient to produce it. The core's defensive shape/digest/selection checks are not a second authority verifier. Graph structure/hash and audit representation are retained; edge derivation and raw proof checking remain upstream.

Already verified History records remain embedded in the selected HISTORICAL_DISPOSITION claim. No separate alternative history representation or serializer is introduced. The result copies their original outcome, exact original disposition, condition, applicability and recurrence without reinterpretation.

Return value:

```text
{
  result, resultBytes, readinessDigest, proofBindingDigest,
  proofInput, exitCode
}
```

The private `projectReadinessResult(result, format)` returns the JSON summary for `json` or the bounded text for `text`, using the unchanged shared renderers. Rendering is explicit: a text-only overflow must not reject a valid machine result/API/JSON assessment. Phase 2C selects rendering and handles transport after computation.

Returned bytes and records are detached from the input; callers cannot mutate future computations through prior outputs. `compareReadinessResult(verified, suppliedResultBytes)` recomputes using this same core, then requires exact byte equality and returns the computed value. It does not implement the public verification pipeline or accept a self-hashed result as authority.

## Gate engine and profiles

Both `rest@1.0.0` and `cicd@1.0.0` consume the unchanged compiled definitions, with `MO1307_PROFILE_MISMATCH` for unknown/substituted profiles. REST uses memoryos-rest and SAME_HOST_RFC1918; CI/CD uses memoryos-ci and its five exact providers. No user-defined gate, expression, mandatory flag, runtime judgment or optional-gate suppression is available.

The 22 gates, in frozen order, are:

| Gate | Applicability | Mandatory | Qualification rule |
|---|---|---|---|
| artifact | ALWAYS | yes | RETAIN |
| binding | ALWAYS | yes | RETAIN |
| history | ALWAYS | yes | HISTORY |
| provenance | ALWAYS | yes | RETAIN |
| provider.azure | CICD_ONLY | yes | PROVIDER |
| provider.azure.live | CICD_ONLY | no | OBSERVE |
| provider.generic | CICD_ONLY | yes | PROVIDER |
| provider.github | CICD_ONLY | yes | PROVIDER |
| provider.github.hosted | CICD_ONLY | no | OBSERVE |
| provider.gitlab | CICD_ONLY | yes | PROVIDER |
| provider.gitlab.live | CICD_ONLY | no | OBSERVE |
| provider.jenkins | CICD_ONLY | yes | PROVIDER |
| provider.jenkins.live | CICD_ONLY | no | OBSERVE |
| resources | ALWAYS | yes | RETAIN |
| rest.contract | REST_ONLY | yes | SAME_HOST |
| sbom | ALWAYS | yes | RETAIN |
| scope | ALWAYS | yes | COMPLETE |
| security | ALWAYS | yes | RETAIN |
| semantic | ALWAYS | yes | RETAIN |
| supply | ALWAYS | yes | ADVISORY |
| tag | ALWAYS; stage predicate | yes | RETAIN |
| windows | ALWAYS | yes | RETAIN |

Inactive gates are NOT_APPLICABLE with null digests and empty arrays. Applicable optional provider gates are always NOT_REQUIRED, including failed observations and unavailable parents. Available optional rows preserve the parent's claim/grant and applicable qualification IDs; unavailable parents create no invented provider observation.

All mandatory gates evaluate every frozen coverage check. Failed checks create blockers; unevaluable checks create distinct CNE reasons. Provider minima and tag predicates add known failures. Historical active conditions merge after all gate calculations, including into otherwise unavailable gates, without removing CNE. Final gate state is BLOCKED, otherwise COULD_NOT_EVALUATE, otherwise SATISFIED_WITH_QUALIFICATION for an attached release qualification, otherwise SATISFIED. No first-failure short circuit drops other gates or findings.

Semantic certification consumes the assertion that required expected vectors matched, including expected Policy FAIL/CNE and INPUT_ERROR/11. It does not re-evaluate those semantics or demand that every original semantic outcome be PASS. Runtime component, semantic contract IDs, final target and REST remote-scope details must agree with the supplied candidate.

## Blockers, CNE, qualifications and history

A blocker records candidate, gate, check, reason, condition and the selected evidence/grant digests. Its identity uses the existing `blockerId` over `{gateId,reasonCode,checkCode,conditionId}`. Findings merge by gate/check/condition with CONDITION_UNSATISFIED > PROVIDER_MINIMUM_UNMET > TAG_CONDITION_UNMET > CHECK_FAILED; distinct findings are retained and sorted by final ID. Current mandatory failures alone block. Missing authority, malformed data, operational errors and preserved failures do not become current blockers.

An explicit trusted UNAVAILABLE slot creates its exact MISSING, AUTHORITY_UNAVAILABLE, STALE or UNEVALUABLE reason with null checkCode. Available claims retain every unevaluable check. A proven blocker can dominate readiness without erasing those reasons. Missing declared raw input and invalid authority are upstream operational errors, not inferred unavailable slots.

The union of qualifications uses stable ID, scope, gates, provider, condition IDs, impact and disclosure code. Identical records shared across claims merge all selected claim/grant digest references; conflicting records fail. No qualification is generated from prose. All seven frozen codes remain:

| Code | Impact |
|---|---|
| HOSTED_NOT_CERTIFIED | RELEASE_IMPACTING |
| PROVIDER_NOT_LIVE_CERTIFIED | RELEASE_IMPACTING |
| SAME_HOST_REMOTE_ONLY | RELEASE_IMPACTING |
| BOUNDED_ADVISORY_REVIEW | RELEASE_IMPACTING |
| HISTORICAL_UNRESOLVED_PRESERVED | RELEASE_IMPACTING |
| PLATFORM_NOT_REQUIRED | INFORMATIONAL |
| ENVIRONMENT_LIMITATION | INFORMATIONAL |

Required provider, same-host, advisory and preserved-condition disclosures use the exact frozen predicates. Available scope inventories must match the qualification union and available history conditions. Scope/history deliberately unavailable defers only the corresponding completeness/missing-inventory checks; locally invalid records still fail and known records remain visible. An informational record may name an inactive gate, but that gate's arrays stay empty and informational impact cannot waive a mandatory condition.

CURRENT_APPLICABLE or OBSERVED history contributes HISTORICAL_CONDITION blockers to its active mandatory gate links. Other dispositions preserve their negative original outcomes without blocking. PRESERVED_WITH_QUALIFICATION requires its exact condition disclosure. Historical blocker evidence references the history selection, including when the target gate itself is unavailable.

The unchanged `aggregateReference` applies blocker > mandatory CNE > release-impacting qualification > READY. All arrays remain in the result regardless of precedence. No existing shared aggregate API or behavior changes.

## Providers, tag stages and human decisions

Implementation, validation, execution, original execution label, support and hosted case/parity fields remain independent. Generic requires IMPLEMENTED / REAL_EXECUTION_CERTIFIED validation and execution / SUPPORTED. GitHub requires OFFLINE_VALIDATED and either all four explicitly certified hosted cases or its exact accepted hosted limitation. Azure/GitLab/Jenkins require CONTRACT_VALIDATED and their exact live or qualified contract-only support. No provider level implies another provider's certificate or a higher execution level.

Known lower minima produce PROVIDER_MINIMUM_UNMET blockers, deduplicated against overlapping failed coverage. Partial hosted certification or contradictory execution/support/qualification combinations are QUALIFICATION_MISMATCH. The Phase 1 lower-minimum unsupported exception and provider representation validator remain unchanged.

PRE_TAG_READINESS requires the expected tag name and ABSENT. POST_TAG_VERIFICATION requires the expected name, PRESENT, annotated and exact peeled target. All independently known wrong fields block. An absent post-tag observation does not fabricate target/annotation failures. Tag facts are consumed only; no Git operation exists in the core.

APPROVE, REJECT and DEFER are downstream external governance data. They are never input to computeReadiness or its normative digests. The unchanged decision-binding helper is exercised against computed results without changing readiness; contrary approval cannot promote NOT_READY/CNE or erase qualifications.

## Canonical result, proof and output bounds

The result uses the exact `MemoryOSReadinessResult` schema for `memoryos.readiness@1.0.0`, with intended publication filename `memoryos-readiness-result.json`. Its assessment includes candidate, profile, stage, normalized authority identity, complete gate/blocker/qualification/CNE/history/provider arrays, upstream graph/hash and both required human action codes. Audit includes supplied trusted root/manifest/configuration/candidate-file hashes, manifest entries, authority sources and grant/claim/raw-envelope bindings.

`readinessDigest = H(J({kind:"MemoryOSReadinessIdentity",version:"1.0.0",assessment}))`.

`proofInput = {kind:"MemoryOSReadinessProofBinding",version:"1.0.0",readinessDigest,audit}` and `proofBindingDigest = H(J(proofInput))`.

There is one shared J implementation and no alternative serializer. The audit supplied by upstream binds raw observations; 2A projects and hashes it, never claims to verify raw authority. Valid metadata/audit-only changes alter proof identity while leaving readiness identity unchanged. Timestamps, machine/user names, run/job IDs and paths are never added from the environment.

JSON summary reuses the Phase 1 renderer with exact counts, readiness and both digest references; it is not a separate full authority. Text reuses every frozen row template in the frozen order, retaining all blockers, CNE, qualifications, history, provider axes and human actions. Neither renderer invents, truncates or hides findings.

Count and representation limits use the existing definitions and schemas: exactly 22 compiled gates, maximum 128 blockers/qualifications/history records, five providers, 64 claims/grants, and the unchanged per-record/ref/graph/JSON limits. Result bytes are checked at 4,194,304, JSON summary at 1,024 and text at 131,072 bytes. Result-size preflight uses only shared canonical encoding of finite fragments plus the whole result, preserving shared depth/value checks and reporting byte overflow as OUTPUT/EVALUATION. Count/admission overflow remains RESOURCE_LIMIT; graph count overflow remains GRAPH_LIMIT. No successful truncated output is returned. A result can be valid for the API or JSON output while its requested text projection is too large; the latter reports OUTPUT without changing or invalidating the canonical assessment.

## Vectors, testing and retained evidence

The [Phase 2A tests](../repositories/cca-conformance/tests/mo1307_phase2a_core_test.mjs) use a clearly labeled [engineering fixture projection adapter](../repositories/cca-conformance/tools/mo1307-phase2a/fixture-projection.mjs). It supplies upstream bindings from the independent frozen fixtures and loads selected claims, never copying expected gate states, readiness, blockers or derived qualifiers as core input. It is not production authority verification. Synthetic mutations are explicit test facts and do not issue real certificates.

All 16 unchanged Phase 1 bundles are reproduced byte-for-byte, including result and JSON summary, not merely aggregate labels. CI/CD supplies READY/0, QUALIFIED/2, NOT_READY/3 and CNE/4; informational-only READY remains READY. REST's successful complete vector necessarily retains SAME_HOST_REMOTE_ONLY and is qualified; mandatory failure and unavailable-condition variants exercise REST NOT_READY and CNE without inventing an unqualified REST release.

MO-1306 is READY_WITH_QUALIFICATIONS/2. Generic remains REAL_EXECUTION_CERTIFIED. GitHub remains OFFLINE_VALIDATED / HOSTED_EXECUTION_NOT_CERTIFIED, original NOT_CERTIFIED, qualified support, and four false hosted case/parity flags. Azure/GitLab/Jenkins remain contract-only and not live certified. All 12 negative/unclosed history projections remain, with all 19 historical source rows retained by the unchanged raw fixture. The ten disclosures are four provider limitations, one bounded-advisory disclosure and five individual unresolved-history disclosures. Hosted runs 36357568243 and 36396330199 and native publication FAIL / UNRESOLVED retain their exact original dispositions.

Focused tests additionally cover precedence combinations, every gate/state, coverage and provider minima, blocker merge identity, all seven qualification codes, inventory availability, history recurrence, tag stages, external decisions, false promotion/suppression, malformed projections, private collection permutations, repeated calls, detached outputs and resource boundaries. The final execution set passed 84 Phase 2A tests (83 in the complete acceptance run plus the subsequently added targeted REST CNE test) and 105 Phase 1 regression tests, with no failed accepted checks. Exact command results belong to the retained [Phase 2A evidence](../repositories/cca-conformance/evidence/mo1307/phase2a), which includes baseline, vectors, determinism, MO-1306 receipt, regression, shared overlaps and Phase 2D handoff.

The cheap Phase 1 regression includes its core, fixture, package and native tests, offline schema/SPDX validation, independent fixture regeneration check and package validation. Workspace verification and git diff --check run after the final changes. Characterization is not rerun: the pinned runtime, characterization tools, transitive measured source closure and measured fixture files remain byte-identical to B1. New pure-core unit timings are not Phase 3 performance/RSS certification.

## Shared overlaps and exact Phase 2D handoff

No Phase 1 source interface, canonicalizer, schema, generated constants/schema data, errors, input shape, helper protocol, filesystem model, publication primitive, fixture or requirements catalog changes. The only shared edits are the engineering package tool's allowlist and generated package.json/SBOM/distribution bindings, to include the two private modules. The package has 77 members, 53 contract members, 76 distribution rows and 75 SPDX file rows. Contract files stay byte-identical, public root exports stay exactly the two frozen async functions, and production dependencies stay zero. Package bindings must be regenerated once after 2D reconciles every stream's source additions.

Phase 2D must:

1. Have 2B produce the exact closed verified projection only after its full pinned authority, evidence, dependency/reuse/history and graph checks. Reconcile names through a narrow adapter if necessary; do not reinterpret records or copy the engineering fixture loader into production.
2. Route both 2C public surfaces to this single pure core with detached bounded snapshots. Keep acquisition observations, worker/cancellation/deadline handling and publication outside the core.
3. Bind 2B's normalized authority, graph and exact audit, including 2C's checked observation/source bytes, before computing either result identity. Do not accept raw claims merely because their hashes or result self-hashes agree.
4. Recompute from independently trusted original inputs on verify, require exact result bytes, then check optional external decisions and render the correct verify summary/exit. A changed raw proof requires a new decision binding even when normalized readiness is unchanged.
5. Reconcile the four shared package-binding files centrally, regenerate manifests/SBOM, and run full integrated CLI/API, native offline installed execution, security/authority negatives, determinism, V18, resource/deadline/publication checks before B2. Phase 2A evidence does not substitute for those checks or authorize a release/tag.

This task creates one implementation commit whose parent is the existing B1; no future commit hash is embedded in its evidence. No push, tag, Linux/Ubuntu/WSL, VM, provider account or network is used.
