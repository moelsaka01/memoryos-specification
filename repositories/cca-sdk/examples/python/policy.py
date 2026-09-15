from __future__ import annotations

import argparse
import json
from pathlib import Path

from memoryos import MemoryOS

from _common import emit


def load_snapshot(path: str) -> dict[str, object]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("snapshot must be a JSON object")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate one prepared MemoryOS Policy or Policy Set."
    )
    parser.add_argument("artifact", help="Policy or Policy Set JSON")
    parser.add_argument("candidate_snapshot", help="candidate snapshot JSON")
    parser.add_argument("--baseline-snapshot", help="optional Regression baseline JSON")
    parser.add_argument("--policy-set", action="store_true", help="prepare a Policy Set")
    parser.add_argument("--node", default="node", help="Node.js executable")
    args = parser.parse_args()

    artifact_bytes = Path(args.artifact).read_bytes()
    candidate_snapshot = load_snapshot(args.candidate_snapshot)
    with MemoryOS(node_executable=args.node) as memory:
        prepared = (
            memory.prepare_policy_set(artifact_bytes)
            if args.policy_set
            else memory.prepare_policy(artifact_bytes)
        )
        workspace = memory.open_workspace(str(candidate_snapshot["workspaceIdentifier"]))
        candidate = memory.observe(
            workspace,
            candidate_snapshot,
            identifier="memoryos-sdk-policy-example-candidate",
        )

        source = None
        if args.baseline_snapshot is None:
            context = memory.capture_policy_fact_context(candidate)
        else:
            baseline_snapshot = load_snapshot(args.baseline_snapshot)
            baseline = memory.observe(
                workspace,
                baseline_snapshot,
                identifier="memoryos-sdk-policy-example-baseline",
            )
            captured = memory.capture_regression_policy_facts(baseline, candidate)
            context = captured.policy_fact_context
            source = captured.regression_policy_fact_source

        detached_context = memory.inspect_policy_fact_context(
            bytes(context), expected_context_digest=context.context_digest
        )
        detached_source = None if source is None else (
            memory.inspect_regression_policy_fact_source(
                bytes(source), expected_source_digest=source.source_digest
            )
        )
        evaluation = (
            memory.evaluate_policy_set(prepared, context, regression_source=source)
            if args.policy_set
            else memory.evaluate_policy(prepared, context, regression_source=source)
        )
        identity_artifact = memory.verify_evaluation_identity_artifact(
            evaluation.evaluation_identity_bytes,
            evaluation.evaluation_identity_digest,
        )
        identity_authoritative = memory.verify_evaluation_identity_for_evaluation(
            evaluation.evaluation_identity_bytes,
            prepared,
            context,
            regression_source=source,
        )
        outcome_artifact = memory.verify_policy_evaluation_outcome_artifact(
            evaluation.canonical_outcome_bytes,
            expected_evaluation_identity_digest=evaluation.evaluation_identity_digest,
            expected_outcome_digest=evaluation.outcome_digest,
        )
        outcome_authoritative = memory.verify_policy_evaluation_outcome_for_evaluation(
            evaluation.canonical_outcome_bytes,
            prepared,
            context,
            regression_source=source,
            expected_outcome_digest=evaluation.outcome_digest,
        )
        identities = memory.policy_contract_identities()
        emit({
            "contextAuthorityAfterInspection": detached_context.authority,
            "contextDigest": context.context_digest,
            "decision": evaluation.decision,
            "documentDigest": prepared.document_digest,
            "evaluationIdentityDigest": evaluation.evaluation_identity_digest,
            "factModelDigest": identities["factModel"]["factModelDigest"],
            "identityArtifactVerified": identity_artifact.verified,
            "identityAuthoritativeVerified": identity_authoritative.verified,
            "outcomeArtifactVerified": outcome_artifact.verified,
            "outcomeAuthoritativeVerified": outcome_authoritative.verified,
            "outcomeDigest": evaluation.outcome_digest,
            "semanticDigest": prepared.semantic_digest,
            "sourceAuthorityAfterInspection": (
                None if detached_source is None else detached_source.authority
            ),
            "sourceDigest": None if source is None else source.source_digest,
        })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
