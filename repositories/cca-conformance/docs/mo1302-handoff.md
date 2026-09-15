# MO-1302 handoff contract

MO-1302 will consume the MO-1301 evaluator through the public SDK/CLI boundary.
It must not copy Policy rules, selectors, aggregation, resource checks,
canonicalization, or outcome semantics into a workflow.

The checked-in
[`mo1302-handoff-vectors.json`](../tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json)
is conformance input for this boundary. It is not a GitHub Actions workflow.

## Required sequence

1. Select the evaluator/action/tool distribution by immutable revision or
   cryptographic distribution digest.
2. Run `memoryos policy identities --json`.
3. Compare every returned normative identity with the frozen expected values.
4. Prepare the workflow-controlled Policy or Policy Set and compare its
   `semanticDigest` with the configured pin.
5. Evaluate through the authoritative MIP-backed CLI acquisition path.
6. Preserve the exact CLI exit status.
7. Accept auxiliary sidecars only as part of the outcome's publication
   generation.
8. Verify the canonical outcome bytes and `outcomeDigest` offline.
9. Verify the embedded Evaluation Identity and `evaluationIdentityDigest`.
10. Cross-check the normative decision with exit 0, 6, or 7.
11. Retain the required canonical artifacts and digests.
12. Build any human summary as a non-normative projection of the verified
    outcome.

## Two independent pins

Layer A is trusted software distribution identity. It proves which evaluator
or CLI distribution was selected. Layer B is the MemoryOS normative contract
identity returned by `policyContractIdentities()` or
`memoryos policy identities`. It contains the evaluator, Fact Model, Rule
Registry, Deterministic Fact Source Registry and Cognitive Regression entry,
Resource Profile, and outcome contract identities.

Both layers are mandatory. A correctly pinned distribution reporting the wrong
contract identity is rejected. A tool reporting the correct contract identity
but obtained outside the required immutable distribution is also rejected.
After evaluation, the embedded Evaluation Identity must cross-bind Layer B.

Users may select a Policy or Policy Set only through a workflow-controlled
artifact and expected `semanticDigest`. They cannot select alternate runtime
registries, evaluator versions, or Resource Profiles.

## Decision mapping

| Outcome | CLI exit | Workflow interpretation |
|---|---:|---|
| `PASS` | 0 | gate success |
| `FAIL` | 6 | gate failure: policy violation |
| `COULD_NOT_EVALUATE` | 7 | gate failure: distinguishable inability to evaluate |

Usage (1), preparation (2), verification (3), transport (4), and operational
(5) exits are workflow/tool failures. They are never fabricated Policy
decisions. Stable machine fields—not human `message` or `details`—drive the
mapping.

## Publication generation verification

Canonical Evaluation Identity bytes, the identity-digest sidecar,
outcome-digest sidecar, and canonical outcome bytes belong to one logical
generation. The outcome is the final commit marker. A retained sidecar is valid
only when it cross-verifies against the outcome's embedded Evaluation Identity
and computed digests. A previous complete generation may survive a failed
replacement; a mixed generation is never accepted.

The portable filesystem mechanics are private. MO-1302 verifies observable
generation consistency rather than assuming a cross-platform transaction API.

## Retention and summaries

Retain, where required:

- the Policy or Policy Set semantic identity;
- canonical Evaluation Identity and `evaluationIdentityDigest`;
- canonical outcome and `outcomeDigest`;
- PolicyFactContext digest; and
- Regression source digest when present.

Avoid retaining sensitive investigation bodies when their digests and the
normative evidence references are sufficient.

A GitHub summary may display the overall and rule decisions, stable codes,
digests, and evidence references. It is non-normative and cannot replace the
canonical outcome. Summary prose is never an input to a CI decision.

## Explicit exclusion

MO-1301 provides no action metadata and no workflow YAML. Implementing the
GitHub Actions integration, packaging pin, artifact upload, and summary
rendering belongs exclusively to MO-1302.
