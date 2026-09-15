# MemoryOS Investigation Policies

MemoryOS 1.3 introduces Investigation Policies as an unreleased engineering
operations subsystem. A Policy evaluates deterministic facts from one
point-in-time Investigation state. It does not execute code, infer missing
cognition, or interpret an investigation. MemoryOS v1.2.1 remains the immutable
compatibility baseline.

The implementation is frozen at evaluator, Fact Model, registry, resource
profile, and outcome contract version `1.0.0`. The public MemoryOS SDK and CLI
product surfaces that expose it are version `1.1.0`. These identities are
independent: an SDK or CLI version is not a substitute for a normative contract
identity.

## Deterministic model

Evaluation has two authorities:

- Investigation Core owns investigation state and atomically creates an
  authoritative `MemoryOSPolicyFactContext` from one captured transition log.
- The Policy Engine owns rule, selector, evidence, aggregation, resource, and
  outcome semantics over that context.

The evaluator never traverses arbitrary Core objects. It accepts an immutable,
owner-bound context capability minted by the private Core adapter. An optional
authoritative `MemoryOSRegressionPolicyFactSource` may add the registered
`cognitiveRegression` fact domain. MO-1301 permits zero or one such source and
no other external source domain.

A Policy contains ordered registered rules. A Policy Set contains ordered
Policies and pins every child's `semanticDigest`. All rules and all children
are evaluated without short-circuiting. Aggregation is deterministic:

1. any `FAIL` makes the enclosing result `FAIL`;
2. otherwise any `COULD_NOT_EVALUATE` makes it `COULD_NOT_EVALUATE`;
3. otherwise the result is `PASS`.

## Artifacts and identity

`MemoryOSInvestigationPolicy` and `MemoryOSInvestigationPolicySet` are closed
JSON artifacts at version `1.0.0`. Restricted JCS canonicalization rejects
duplicate members, byte-order marks, invalid Unicode scalars, floating-point
forms, negative zero, unsafe integers, unsupported members, and ambiguous
collection semantics.

Each prepared artifact has two identities:

- `documentDigest` commits to the complete canonical document, including
  non-semantic description metadata;
- `semanticDigest` commits only to the frozen evaluation projection.

Changing a description, filename, or transport path cannot change evaluation
identity or outcome bytes. A Policy Set's semantic identity includes its
ordered children and their semantic pins.

The Fact Model exposes exactly these Core domains:

`lifecycle`, `transitions`, `observations`, `artifactCardinalities`,
`activeTrace`, `activeReplay`, `activeEvolution`,
`activeComparativeReconstruction`, `verification`, `mipIntegrity`, and
`compatibility`.

`available` with an empty `items` array proves authoritative absence.
`notApplicable` and `unavailable` have different meanings and are never
silently converted to absence. MIP package inventory does not create active
state: an imported artifact appears in an active domain only when the captured
local Core state designates that exact artifact as active.

## Initial rules

| Rule | Deterministic question |
|---|---|
| `memoryos.require-verification-completed@1.0.0` | Is exactly one authoritative Verification fact present with `status == "passed"`? |
| `memoryos.require-replay-completed@1.0.0` | Is the authoritative active Replay completed? |
| `memoryos.require-artifact-cardinality@1.0.0` | Does a registered artifact class satisfy the configured integer bound? |
| `memoryos.require-lifecycle-state@1.0.0` | Does the authoritative lifecycle equal the registered required state? |
| `memoryos.prohibit-regression-findings@1.0.0` | Does the optional trusted Regression source contain no finding in the registered prohibited categories? |
| `memoryos.require-mip-integrity@1.0.0` | Does an applicable MIP integrity fact satisfy the frozen integrity predicate? |

Rules return exactly one evidence value. MO-1301 evidence is one of
`MemoryOSPolicyFactReference`, `MemoryOSPolicyFactSelection`,
`MemoryOSPolicyFactDomainState`, or
`MemoryOSDeterministicFactSourceAbsence`. Evidence identifies deterministic
facts or proves a registered absence; it is not generated explanation text.

## Evaluation Identity and outcome

Every completed evaluation binds an immutable
`MemoryOSPolicyEvaluationIdentity` containing:

- evaluator version;
- Rule Registry version and digest;
- Fact Model version and digest;
- Deterministic Fact Source Registry version and digest;
- Resource Profile identifier, version, and digest;
- Policy or Policy Set semantic digest;
- PolicyFactContext version and digest;
- the ordered registered external-source digests; and
- outcome contract version.

For a supported identity, the same authoritative inputs produce the same
canonical normative outcome bytes. `evaluationIdentityDigest` identifies that
request. `outcomeDigest` commits to the exact canonical
`MemoryOSPolicyEvaluationOutcome` bytes. The outcome embeds and cross-binds the
Evaluation Identity and contains a completed Policy result, Policy Set result,
or the one frozen evaluation-wide resource-limit CNE result.

The standard Resource Profile contains 31 limits. Limits 25 through 27 are
pre-identity input limits and use `POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED`.
Limits 28 through 31 are post-identity evaluation limits and use
`POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED`. The outcome-byte limit is `4060`.
Its replacement resource CNE is non-recursive and is proven to fit the profile.

The evaluator's cache is keyed only by `evaluationIdentityDigest`. A hit is
accepted only after exact retained identity bytes, outcome bytes, digests,
cross-bindings, and semantic recomputation agree. Cache state never enters a
normative artifact.

## SDK 1.1

JavaScript uses camel case, Python uses the corresponding snake case, and C++
uses camel case for this one-to-one capability surface:

- `preparePolicy` and `preparePolicySet`;
- `inspectPolicyFactContext`, `inspectRegressionPolicyFactSource`, and
  `inspectRegressionReport`;
- `capturePolicyFactContext` and `captureRegressionPolicyFacts`;
- `evaluatePolicy` and `evaluatePolicySet`;
- `verifyEvaluationIdentityArtifact` and
  `verifyEvaluationIdentityForEvaluation`;
- `verifyPolicyEvaluationOutcomeArtifact` and
  `verifyPolicyEvaluationOutcomeForEvaluation`; and
- `policyContractIdentities`.

The language bindings delegate to the same authoritative JavaScript evaluator.
They retain evaluator-produced canonical bytes instead of reconstructing bytes
from a language-native object.

### JavaScript example

```js
const memory = new MemoryOS();
const prepared = memory.preparePolicy(policyBytes);
console.log(prepared.documentDigest, prepared.semanticDigest);

const context = memory.capturePolicyFactContext(investigation);
const evaluation = memory.evaluatePolicy(prepared, context);
const exactOutcomeBytes = evaluation.canonicalOutcomeBytes();

memory.verifyPolicyEvaluationOutcomeArtifact(exactOutcomeBytes, {
  expectedEvaluationIdentityDigest: evaluation.evaluationIdentityDigest,
  expectedOutcomeDigest: evaluation.outcomeDigest,
});
console.log(memory.policyContractIdentities());
```

Policy Set preparation and evaluation use `preparePolicySet` and
`evaluatePolicySet`. Detached inspection is deliberately different:

```js
const inspectedContext = memory.inspectPolicyFactContext(contextBytes, {
  expectedContextDigest,
});
const inspectedSource = memory.inspectRegressionPolicyFactSource(sourceBytes, {
  expectedSourceDigest,
});
```

These inspection values verify serialized material but cannot be passed as
authoritative context or source capabilities.

## CLI 1.1

The additive `policy` namespace contains exactly seven commands:

```console
memoryos policy validate --policy policy.json --json
memoryos policy digest --policy-set policy-set.json --canonical-output policy-set.canonical.json --json
memoryos policy inspect --context context.json --json
memoryos policy evaluate --policy policy.json --package candidate.mip --outcome outcome.json --identity-output identity.json --evaluation-identity-digest-output identity.sha256 --outcome-digest-output outcome.sha256 --json
memoryos policy verify-identity identity.json --mode artifact --expected-evaluation-identity-digest sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --json
memoryos policy verify-outcome outcome.json --mode artifact --expected-identity identity.json --expected-outcome-digest sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --json
memoryos policy identities --json
```

Use `--policy-set` instead of `--policy` for a Policy Set. Authoritative CLI
evaluation accepts the frozen MIP-backed acquisition path; an optional
`--regression-baseline` supplies the trusted Regression baseline. It does not
define a generic native cross-process authority protocol.

Paths and stdin are transport only. There is no URL resolution, globbing,
directory discovery, environment interpolation, or policy-controlled path.
When `--outcome -` requests raw output, standard output is exactly the
canonical outcome bytes with no newline or decoration. Digest sidecars are
exactly 71 ASCII bytes with no newline.

JSON success envelopes containing only normative fields use restricted-JCS
semantic bytes plus one transport LF. In error envelopes, `message` and
`details` are presentation-only. CI decisions use the stable `code`, `phase`,
`artifactKind`, `limitIdentifier`, `failureClass`, and `exitCode` fields.

| Exit | Meaning |
|---:|---|
| 0 | Successful non-evaluation operation or valid `PASS` |
| 1 | Usage failure |
| 2 | Deterministic preparation or validation failure |
| 3 | Verification failure |
| 4 | Transport or file failure |
| 5 | Operational or internal failure |
| 6 | Valid `FAIL` |
| 7 | Valid `COULD_NOT_EVALUATE` |

## Publication generation

Requested Evaluation Identity bytes, identity-digest sidecar, outcome-digest
sidecar, and outcome bytes form one logical generation. The normative outcome
is the final commit marker. Sidecars are accepted only after they cross-verify
against its embedded identity and digests. A failed write may leave an earlier
complete generation intact, but no mixed generation is valid.

## Security boundary

Investigation Policies have no executable expressions, arbitrary selectors,
plugins, runtime registry mutation, callbacks, URLs, network resolution,
environment interpolation, policy-controlled shell, user-defined resource
overrides, or caller-minted authority. Serialized contexts, detached Regression
reports, and correct caller-supplied digests do not restore production
authority. Operational failures are not converted to Policy decisions.

## MO-1302 handoff

MO-1302 will verify two independent pins: the immutable evaluator/tool
distribution and the complete normative contract identity returned by
`memoryos policy identities`. It will also pin the workflow-controlled Policy
or Policy Set `semanticDigest`, evaluate through the CLI, preserve exit status,
cross-verify the publication generation, and retain the canonical identity and
outcome artifacts with their digests.

`PASS` maps to workflow success. `FAIL` and `COULD_NOT_EVALUATE` both block the
gate while remaining distinguishable. Preparation, verification, transport,
and operational failures are tool failures rather than policy violations.
Human summaries may display decisions, codes, digests, and evidence references,
but never replace the canonical outcome.

No GitHub Actions workflow is part of MO-1301.

## Compatibility and publication gate

MO-1301 is additive over v1.2.1 and does not modify Core, MIP 1.0, Cognitive
Regression 1.0, or CCA-MEMORYOS-1.0 behavior. `CCA-MEMORYOS-1.1` remains only
the intended normative target. It is materialized and published only after the
schemas and golden vectors are frozen, evaluator semantics are validated,
cross-language SDK parity is demonstrated, and conformance behavior is
independently verified. The Standard will codify that frozen behavior; it will
not become a second semantic authority.
