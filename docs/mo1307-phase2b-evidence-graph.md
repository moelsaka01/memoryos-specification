# MO-1307 Phase 2B evidence authority and graph

Phase 2B implements the pure evidence-verification layer frozen by [Contract Freeze 1](mo1307-contract-freeze-1.md). The exact starting B1 is `3883ca889911fcc5a6f46c24e569478a8c32648e`, parent `7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee`, on `codex/mo1307-phase2b-evidence-graph` in `C:\Users\melsa\Documents\Codex\cca-mo1307-2b`. The initial working tree was clean. This report binds existing baseline identities only; it embeds no future implementation commit.

The implementation verifies evidence, produces deterministic current facts, and supports independent result evidence checking. Readiness aggregation, profile gate outcomes, acquisition, public API/CLI orchestration, deadlines/cancellation and publication remain with 2A/2C/2D. The two package-root functions retain their Phase 1 fail-closed guard until integration. No new public API, schema, contract version, error, qualification, evidence type or limit is introduced.

## Authority and exact identities

The operator supplies `expectedCandidateDigest` and `trustedAuthorityDigest` separately from configuration/evidence. The latter hashes the exact reviewed authority bytes. Evidence cannot supply or select that pin. A matching source hash proves integrity, not organizational authentication or that a test ran. The reviewed issuer remains responsible for correct normalization of opaque predecessor records; production neither executes predecessor validators nor interprets arbitrary legacy prose.

Each root binds the exact candidate/profile/stage, complete component and semantic-contract inventories, scope, assumptions, grant inventory, slots and manifest hash. Every grant binds one exact claim digest, envelope hash, source set, authority-source set, dependency set, scope, assumptions and CURRENT/REUSED disposition. Grant type/version are inherited through the frozen root/envelope contracts; the frozen Grant has no independent type/version or invented permission fields. Compiled gate selectors determine permitted evidence type and exact provider. An available active slot selects one grant; only a provider parent and its optional observation gate may share that same grant. Inactive and explicitly unavailable slots follow Freeze exactly.

Every manifest file is independently supplied and copied after admission. Length and SHA-256 are checked before its content can contribute. ENVELOPE origin/dependency labels must match its claim. Authority provenance must match exact manifest Git fields, class, length and digest; RELEASED_BINDING requires release-tag target equal revision. Source kind/version remain reviewed manifest labels for opaque exact bytes. Claim digest is recomputed with the shared J serializer. A correct claim hash cannot hide altered source bytes, swapped lineage or an unauthorized envelope.

Every manifest entry must be consumed by a grant or root provenance. V1 accepts no diagnostic-only evidence extras. Missing declared IDs use INPUT; invalid grant/source lineage uses EVIDENCE_AUTHORITY; contradictory raw/cross-binding identities use INTEGRITY. Duplicated IDs, repeated normalized grants/claims, conflicting dependency/authority records and hidden unconsumed inputs fail closed. No filename, branch, latest-file selector, network lookup or implicit authority is used.

## Dependencies, staleness and reuse

Claims bind either the current complete candidate or an explicit flat, complete dependency closure. The existing role classes identify source/package/configuration/runtime/schema/provider/security content; no new dependency record or recursive discovery mechanism is added. Every declared `(componentId, role, byteLength, sha256)` must match the candidate inventory. All candidate components of each minimum required role must be included; provider ADAPTER coverage selects that provider's adapter. Reviewed additional dependencies are retained. History/scope closure is the exact nonempty reviewed set.

Scope must match claim, grant and assessment. Claim and grant assumptions must match exactly and be a subset of root assumptions. An unrelated additional root assumption does not stale another claim. Qualification assumptions remain part of the exact granted claim.

CURRENT requires the current origin root. REUSED requires DEPENDENCY_SET and a different explicit origin root, unchanged dependency identities, scope, assumptions and qualifications, and a newly reviewed current grant. Whole-candidate FINAL_BINDING/TAG_OBSERVATION cannot cross candidate roots. Changed declared content or scope/assumptions yields STALE_EVIDENCE; missing IDs yield INPUT. A trusted UNAVAILABLE/STALE slot is a distinct safe representation, never an automatic downgrade of supplied stale evidence.

The projection returns one explicit reuse row per accepted claim with claim/grant identity, origin/current candidate, binding, dependency IDs and CURRENT/REUSED disposition. Unrelated component changes preserve unaffected claims; relevant changes reject them. Production does not load a prior authority or infer reuse from matching filenames. A newly chosen trusted root represents explicit issuer review, not automatic historical authentication.

There is no clock or age window. Metadata `observedAt` is nullable bounded opaque text in the frozen schema, not a freshness timestamp parser. BOUNDED_SNAPSHOT requires BOUNDED_ADVISORY_REVIEW disclosure and retains exact audit identity regardless of age.

## History, qualifications and providers

Exact raw sources, claim/envelope digests and reviewed grant bindings preserve original outcomes, dispositions and context. History cannot be rewritten or omitted under an unchanged authority. Negative originalOutcome has no PASS alias. Fabricated resolution, wrong source/candidate, conflicting records, missing unresolved history and changed dispositions are rejected. Opaque successful/authority-change rows remain source bytes, not fabricated negative enum rows.

The verified history projection copies the frozen fields and exact enclosing claim/grant identities. `historicalApplicability` contains only verified active mandatory gate links for CURRENT_APPLICABLE or OBSERVED recurrence, including a gate whose evidence is unavailable. It computes no blocker, gate state or final readiness. 2A must merge these links and retain all history. Preserved history never changes its original FAIL/BLOCKED label.

Qualifications use the seven closed codes, exact fixed impact/disclosure, scope, provider, affected gates and condition predicates. Their complete union must match available scope authority; derived records retain every enclosing claim/grant identity. Missing, weakened, wrong-provider/gate, unknown-code, disclosure-stripped or unsupported records fail QUALIFICATION_MISMATCH. Missing history/scope inventory deliberately marked UNAVAILABLE defers only its completeness/reference checks; known valid records remain visible.

Provider implementation, validation, execution and support are independent axes. A source label must equal execution except the frozen GitHub NOT_CERTIFIED to HOSTED_EXECUTION_NOT_CERTIFIED alias. Full GitHub hosted certification requires all four cases and correct support, with no contradictory limitation. GitLab/Jenkins/Azure live certification and Generic real execution cannot be substituted under existing grants. Valid known lower-minimum facts remain facts for 2A to block; 2B does not invent a universal certification ranking or execute providers.

The mandatory MO-1306 vector preserves C3CB/M3/S3/I3/BF/tag identities, all 19 raw history rows, exactly 12 failure/unclosed projections, five provider rows and ten disclosures. GitHub unresolved/exhausted hosted history and native publication history remain exact. Generic remains real-execution-certified; GitHub remains offline/hosted-not-certified; GitLab/Jenkins/Azure remain contract/not-live-certified. No predecessor campaign was rerun.

## Normative DAG

The only node types are ASSESSMENT, CANDIDATE, GRANT, CLAIM, DEPENDENCY and AUTHORITY. The only edge types are ASSESSES, ACCEPTS, AUTHORIZES, ROOTED_IN and DEPENDS_ON, directed from consumer to prerequisite. The sole root is literal `assessment`; all other IDs are their uppercase type plus content Digest. One candidate is assessed, every current grant is accepted, every accepted claim has exactly its reviewed authority and candidate/dependency paths, and every node is reachable.

Normalized grant content, normalized authority source content, root authority identity and exact graph digest follow Freeze section 7. Nodes sort by id; edges sort by `(from,type,to)`; identical content nodes/edges are shared once. Raw paths/times/provenance remain audit-bound, not normalized authority. Historical opaque links add no normative edges. Every fixture matches the independently generated exact graph bytes and normalized authority identity.

Bounded cycle/self-loop detection yields GRAPH_CYCLE and no projection. Missing nodes/claims/grants/dependencies/authority and dangling edges reject INPUT. Wrong types, roots, unreachable claims and duplicate IDs reject. Graph expansion enforces 2048 nodes and 8192 edges before adding excess entries; exact boundary and +1 cases are tested, including internal adversarial graphs and derived expansion overflow.

## Private integration seam and proof material

`repositories/memoryos-readiness/src/evidence-verifier.mjs` exports private functions:

```js
verifyEvidence(input) -> { projection, audit, diagnostics }
verifyResultEvidence(input, resultBytes) -> { projection, audit, diagnostics }
```

`input` is the existing evaluate input with original bytes, exact sorted files and both independent pins. Each call re-verifies snapshots; there is no trusted cache or caller-supplied graph. Results are detached and deeply frozen.

`projection` contains candidate/root/profile/stage, normalized authority and identity, accepted `claims` sorted by claimDigest, all 22 `slots` with nullable claim/grant identities, derived qualifications, immutable history, current historicalApplicability links, provider axes, graph/digest and reuse dispositions. Authorized tag facts remain in their selected TAG_OBSERVATION claim. It contains no readiness, gate states, blockers or diagnostics. Logical claim IDs retain normative identity; metadata never selects evidence.

`audit` is exactly the frozen Audit record: independently trusted root digest, manifest/candidate/configuration raw hashes, every manifest input, authority sources and exact grant/envelope/source bindings. This is the pure proof material required by the existing shared `proofBindingDigest(readinessDigest, audit)`. Operational metadata is separately returned as `diagnostics` and remains protected by raw envelope hashes. Metadata-only changes with newly reviewed raw pins preserve normalized projection/graph while changing audit/proof identity.

`verifyResultEvidence` recomputes from independent original inputs, checks result identity, exact 2B-owned assessment fields, selected gate claim/grant references and the entire audit. Self-consistent altered graph/history/provider/qualification/audit hashes fail RESULT_MISMATCH. **This is result-verification support, not complete public verifyReadiness.** It deliberately does not validate 2A's final readiness/gate/blocker computation. 2D must recompute the complete final result and compare exact J result bytes before accepting verify.

`evidence-graph.mjs` exports `deriveEvidenceGraph`, `normalizeEvidenceGrant` and `validateEvidenceGraph`; `evidence-history.mjs` exports `verifyHistoryQualificationsProviders`. These are internal pure seams; the latter consumes already-authorized selections and grants no authority itself.

## Limits, determinism and verification

All frozen constants/schemas remain byte-identical. Phase 2B enforces manifest files128, aggregate bytes8388608, authority1048576, envelope262144, raw source2097152, claims64, grants64, authority sources32, dependencies1024, assumptions32, history128, qualifications128, graph2048/8192 and reference-list caps. Shared parser limits remain depth16, values131072, members64, key64 and general string4096, with tighter fields retained. Bootstrap/control byte ceilings are unchanged.

Admission boundary tests distinguish capacity from authority validity: the finite 22-gate profile cannot consume 64 different grants, and a byte-sized malformed document is not presented as valid evidence. Exact/+1 representation and byte-admission checks complement end-to-end manifest128, aggregate8MiB, source2MiB and authority-source32 cases. Graph tests reach both independent ceilings. No cap is relaxed or required disclosure truncated.

Nonsemantic object/map/collection insertion order yields byte-identical projections. Frozen arrays (manifest/claim dependency/grant/history/provider/file lists) have mandated sorted order; permutations violating that order reject instead of silently changing signed identity. Internal graph claim-collection permutations remain equivalent. Claims and diagnostics use deterministic lexical ordering, without locale behavior.

Final acceptance passed 172 Phase 2B tests and 105 Phase 1 regressions, with zero failures, skips or cancellations. Fixture regeneration, package integrity, workspace verification and whitespace checks passed.

The [acceptance receipt](../repositories/cca-conformance/evidence/mo1307/phase2b/acceptance/receipt.json) owns exact test names/counts/results, runtime/source hashes, graph/projection/proof vectors, Phase 1 regression, package, workspace and whitespace checks. Tests cover trust roots, grants, raw bytes, claim/candidate identity, closure, selective reuse, staleness, history, qualifications, all provider promotions, DAG negatives, tamper, limits, determinism and independent result evidence. The native runtime pin is Node24.21.0 win-x64, SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`. No network/provider account/Linux/Ubuntu/WSL/VM is used. Cheap Phase 1 tests are rerun; no characterization or predecessor certification campaign is rerun.

## Necessary shared overlaps and retained findings

Shared production overlap is `src/foundation.mjs`: explicit reference-list admission, per-envelope cap before copying, dedicated nested history/qualification mismatch categories, raw-integrity-before-root-candidate checking, and frozen phase priority before numeric/reference tie-breaks. Full unchanged schema validation remains mandatory. Earlier rejected schema-deferral proposals were not applied. The failure-only diagnostic path can choose an earlier authority/graph rejection but has no successful return; it cannot convert rejected evidence into a projection.

Full verification exposed eight previously unconsumed MO-1306 configuration sources in the Phase 1 fixture. Freeze prohibits unused manifest entries. The minimal correction adds those existing raw sources to exactly the 11 claims whose dependencies include CONFIGURATION, updates their envelope/grant raw bindings, manifest/root pins and expected audit/proof/summary. The generator, catalog and dependent history-omission vector are synchronized. No normalized claim, candidate, graph, authority identity, readiness assessment, raw source or historical/provider fact changed. Exact old/new identities, original rejection and unchanged-identity assertions are retained in [mo1306-source-lineage.json](../repositories/cca-conformance/evidence/mo1307/phase2b/development/mo1306-source-lineage.json). Historical Phase 1 acceptance/binding records are not rewritten.

Package overlap is the existing package generator/allowlist, package.json, SPDX SBOM and distribution manifest, registering the three new private modules and their exact hashes. The package has 78 members, zero external production dependencies, unchanged public exports and no lifecycle hooks. Shared contracts/schemas/constants, Phase 1 tests, public wrappers and Windows helper remain unchanged. Exact changed-path hashes and every overlap are enumerated by the Phase 2B binding evidence.

Development attempts remain under `phase2b/development`; corrected test expectations, the initial unused-source defect and the phase-priority probe are not relabeled as passes.

## Exact Phase 2D handoff

1. Start integration from accepted existing 2A/2B/2C commits; preserve this branch's B1 parent and reconcile shared foundation changes once.
2. Call `verifyEvidence` with copied original inputs and the operator's independent pins before 2A uses any claim. Map slots to accepted claims by exact claim/grant digest, retaining explicit unavailable slots.
3. Compute all compiled gate states, provider minima, tag-stage predicates, historical blockers, CNE, qualifications and final readiness in the single 2A core. Merge every verified historicalApplicability link, including unavailable gates. Do not infer authority from diagnostics or source labels.
4. Construct the frozen assessment from verified candidate/authority/graph/history/qualification/provider facts. Use the exact returned audit for shared proof-binding computation; include no diagnostics in normalized identity.
5. On verify, independently rerun original source/root verification, use `verifyResultEvidence` for 2B bindings, then recompute and compare the complete canonical result through 2A/2C. Only afterward check optional human-decision binding. Self-hashes alone never suffice.
6. Reconcile the necessary fixture raw-lineage correction and package allowlist/SBOM/distribution with other streams. Preserve all normalized MO-1306 facts and all original raw history. Carry the new authority/proof pins, never the obsolete fixture raw pins.
7. Verify both public surfaces, exact normative bytes, corrected V18, all stream negatives, limits, native/offline installed package identity and 2C operational boundaries. Bind B2 only to already-existing parent artifacts. No release authorization, push or tag follows from this Phase 2B result.
