from __future__ import annotations

import copy
import json
import os
import subprocess
import unittest
from collections.abc import Callable, Mapping
from dataclasses import replace
from pathlib import Path

from memoryos import (
    MemoryOS,
    MemoryOSPolicyOperationalError,
    MemoryOSPolicyPreparationError,
    PolicyFactContextInspection,
    RegressionPolicyFactSourceInspection,
    RegressionReportInspection,
    SDK_VERSION,
)


SDK_ROOT = Path(__file__).resolve().parents[2]
STUDIO_ROOT = SDK_ROOT.parent / "cca-studio"
NODE = os.environ.get("MEMORYOS_NODE", "node")


def reference_snapshot() -> dict[str, object]:
    module = (STUDIO_ROOT / "web" / "data" / "studio-snapshot.js").resolve().as_uri()
    script = (
        f'import {{ referenceSnapshot }} from {json.dumps(module)};'
        "process.stdout.write(JSON.stringify(referenceSnapshot));"
    )
    result = subprocess.run(
        [NODE, "--input-type=module", "--eval", script],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def policy_bytes(allowed_state: str = "Observed") -> bytes:
    return canonical_bytes(policy_value("p", allowed_state))


def policy_value(identifier: str, allowed_state: str = "Observed") -> dict[str, object]:
    return {
        "identifier": identifier,
        "kind": "MemoryOSInvestigationPolicy",
        "policyVersion": "0.0.0",
        "rules": [{
            "identifier": "r",
            "parameters": {"allowedStates": [allowed_state]},
            "type": "memoryos.require-lifecycle-state",
            "version": "1.0.0",
        }],
        "version": "1.0.0",
    }


def regression_policy_bytes(identifier: str = "n") -> bytes:
    return canonical_bytes({
        "identifier": identifier,
        "kind": "MemoryOSInvestigationPolicy",
        "policyVersion": "0.0.0",
        "rules": [{
            "identifier": "r",
            "parameters": {"categories": ["reflection"]},
            "type": "memoryos.prohibit-regression-findings",
            "version": "1.0.0",
        }],
        "version": "1.0.0",
    })


def plain(value: object) -> object:
    if isinstance(value, Mapping):
        return {str(key): plain(member) for key, member in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(member) for member in value]
    return value


def canonical_bytes(value: object) -> bytes:
    return json.dumps(
        plain(value), ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")


class InvestigationPolicySDKTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.snapshot = reference_snapshot()

    def assert_preparation_failure(
        self,
        action: Callable[[], object],
        *,
        code: str,
        operation: str,
        phase: str,
        artifact_kind: str,
    ) -> None:
        with self.assertRaises(MemoryOSPolicyPreparationError) as raised:
            action()
        self.assertEqual(raised.exception.code, code)
        self.assertEqual(raised.exception.operation, operation)
        self.assertEqual(raised.exception.phase, phase)
        self.assertEqual(raised.exception.artifact_kind, artifact_kind)
        self.assertEqual(raised.exception.failure_class, "preparation")

    def test_prepare_capture_evaluate_and_verify_exact_bytes(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            self.assertEqual(SDK_VERSION, "1.1.0")
            prepared = memory.prepare_policy(policy_bytes())
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = memory.observe(
                workspace, self.snapshot, identifier="python-policy-candidate"
            )
            context = memory.capture_policy_fact_context(investigation)
            evaluation = memory.evaluate_policy(prepared, context)

            self.assertEqual(evaluation.decision, "PASS")
            self.assertEqual(bytes(evaluation), evaluation.canonical_outcome_bytes)
            self.assertFalse(evaluation.canonical_outcome_bytes.endswith(b"\n"))
            self.assertFalse(evaluation.evaluation_identity_bytes.endswith(b"\n"))
            decoded_outcome = json.loads(evaluation.canonical_outcome_bytes)
            self.assertEqual(decoded_outcome["result"]["decision"], evaluation.decision)
            self.assertTrue(evaluation.outcome_digest.startswith("sha256:"))

            identity_check = memory.verify_evaluation_identity_artifact(
                evaluation.evaluation_identity_bytes,
                evaluation.evaluation_identity_digest,
            )
            reconstructed_identity = memory.verify_evaluation_identity_for_evaluation(
                evaluation.evaluation_identity_bytes, prepared, context
            )
            outcome_check = memory.verify_policy_evaluation_outcome_artifact(
                evaluation.canonical_outcome_bytes,
                expected_evaluation_identity_digest=evaluation.evaluation_identity_digest,
                expected_outcome_digest=evaluation.outcome_digest,
            )
            reconstructed_outcome = memory.verify_policy_evaluation_outcome_for_evaluation(
                evaluation.canonical_outcome_bytes,
                prepared,
                context,
                expected_outcome_digest=evaluation.outcome_digest,
            )
            self.assertTrue(identity_check.verified)
            self.assertEqual(reconstructed_identity.authority, "authoritativeReconstruction")
            self.assertEqual(outcome_check.decision, "PASS")
            self.assertEqual(reconstructed_outcome.outcome_digest, evaluation.outcome_digest)
            with self.assertRaises(ValueError):
                memory.verify_policy_evaluation_outcome_artifact(
                    evaluation.canonical_outcome_bytes,
                    expected_identity=evaluation.evaluation_identity_bytes,
                    expected_evaluation_identity_digest=evaluation.evaluation_identity_digest,
                )
            with self.assertRaises(MemoryOSPolicyOperationalError) as mismatch:
                memory.verify_policy_evaluation_outcome_artifact(
                    evaluation.canonical_outcome_bytes,
                    expected_outcome_digest="sha256:" + ("0" * 64),
                )
            self.assertEqual(mismatch.exception.code, "VERIFICATION_FAILED")
            self.assertTrue(mismatch.exception.verification_failure)

    def test_detached_inspection_does_not_restore_authority(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            prepared = memory.prepare_policy(policy_bytes())
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = memory.observe(
                workspace, self.snapshot, identifier="python-policy-detached"
            )
            authoritative = memory.capture_policy_fact_context(investigation)
            detached = memory.inspect_policy_fact_context(
                bytes(authoritative),
                expected_context_digest=authoritative.context_digest,
            )
            self.assertIsInstance(detached, PolicyFactContextInspection)
            self.assertEqual(detached.authority, "inspectionOnly")
            self.assert_preparation_failure(
                lambda: memory.evaluate_policy(prepared, detached),  # type: ignore[arg-type]
                code="POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
                operation="evaluatePolicy",
                phase="policyFactContext",
                artifact_kind="MemoryOSPolicyFactContext",
            )
            with self.assertRaises(TypeError):
                memory.evaluate_policy(prepared, object())  # type: ignore[arg-type]

    def test_prepared_policy_is_transferable_but_authority_is_not(self) -> None:
        with MemoryOS(node_executable=NODE) as first, MemoryOS(node_executable=NODE) as second:
            prepared = first.prepare_policy(policy_bytes())
            workspace = second.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = second.observe(
                workspace, self.snapshot, identifier="python-policy-transfer"
            )
            context = second.capture_policy_fact_context(investigation)
            self.assertEqual(second.evaluate_policy(prepared, context).decision, "PASS")
            self.assert_preparation_failure(
                lambda: first.evaluate_policy(prepared, context),
                code="POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
                operation="evaluatePolicy",
                phase="policyFactContext",
                artifact_kind="MemoryOSPolicyFactContext",
            )

    def test_trusted_regression_pair_is_context_bound(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            baseline = memory.observe(
                workspace, self.snapshot, identifier="python-policy-baseline"
            )
            changed = copy.deepcopy(self.snapshot)
            changed["observationIdentifier"] = "python-policy-changed"
            changed["longTermMemory"]["entries"][0]["value"] = "changed"
            candidate = memory.observe(
                workspace, changed, identifier="python-policy-regression-candidate"
            )
            pair = memory.capture_regression_policy_facts(baseline, candidate)
            detached_source = memory.inspect_regression_policy_fact_source(
                bytes(pair.regression_policy_fact_source),
                expected_source_digest=pair.regression_policy_fact_source.source_digest,
            )
            self.assertIsInstance(detached_source, RegressionPolicyFactSourceInspection)
            self.assertEqual(detached_source.authority, "inspectionOnly")
            self.assertEqual(
                detached_source.source_digest,
                pair.regression_policy_fact_source.source_digest,
            )
            prepared_for_detached = memory.prepare_policy(policy_bytes())
            self.assert_preparation_failure(
                lambda: memory.evaluate_policy(
                    prepared_for_detached,
                    pair.policy_fact_context,
                    regression_source=detached_source,  # type: ignore[arg-type]
                ),
                code="DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
                operation="evaluatePolicy",
                phase="regressionPolicyFactSource",
                artifact_kind="MemoryOSRegressionPolicyFactSource",
            )
            with self.assertRaises(TypeError):
                memory.evaluate_policy(
                    prepared_for_detached,
                    pair.policy_fact_context,
                    regression_source=object(),  # type: ignore[arg-type]
                )

            report = memory.regression(baseline, candidate)
            detached_report = memory.inspect_regression_report(canonical_bytes(report.projection))
            self.assertIsInstance(detached_report, RegressionReportInspection)
            self.assertEqual(detached_report.authority, "inspectionOnly")
            self.assertEqual(detached_report.report_identifier, report.identifier)

            prepared = memory.prepare_policy(policy_bytes())
            result = memory.evaluate_policy(
                prepared,
                pair.policy_fact_context,
                regression_source=pair.regression_policy_fact_source,
            )
            self.assertEqual(result.decision, "PASS")
            other_context = memory.capture_policy_fact_context(candidate)
            with self.assertRaises(MemoryOSPolicyPreparationError) as mismatch:
                memory.evaluate_policy(
                    prepared,
                    other_context,
                    regression_source=pair.regression_policy_fact_source,
                )
            self.assertEqual(
                mismatch.exception.code,
                "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
            )
            self.assertEqual(mismatch.exception.phase, "regressionPolicyFactSource")

    def test_authority_rejections_are_stable_across_all_evaluation_paths(self) -> None:
        def trusted_pair(memory: MemoryOS, prefix: str):
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            baseline = memory.observe(
                workspace, self.snapshot, identifier=f"{prefix}-baseline"
            )
            changed = copy.deepcopy(self.snapshot)
            changed["observationIdentifier"] = f"{prefix}-changed"
            changed["longTermMemory"]["entries"][0]["value"] = prefix
            candidate = memory.observe(
                workspace, changed, identifier=f"{prefix}-candidate"
            )
            return memory.capture_regression_policy_facts(baseline, candidate)

        with MemoryOS(node_executable=NODE) as owner, MemoryOS(node_executable=NODE) as foreign:
            local = trusted_pair(owner, "python-policy-owner")
            other = trusted_pair(foreign, "python-policy-foreign")
            prepared = owner.prepare_policy(policy_bytes())
            policy = policy_value("a")
            set_member = owner.prepare_policy(canonical_bytes(policy))
            prepared_set = owner.prepare_policy_set(canonical_bytes({
                "identifier": "s",
                "kind": "MemoryOSInvestigationPolicySet",
                "policies": [{
                    "expectedSemanticDigest": set_member.semantic_digest,
                    "policy": policy,
                }],
                "policySetVersion": "0.0.0",
                "version": "1.0.0",
            }))
            evaluation = owner.evaluate_policy(
                prepared, local.policy_fact_context
            )

            context_operations = (
                ("evaluatePolicy", lambda: owner.evaluate_policy(
                    prepared,
                    other.policy_fact_context,
                    regression_source=other.regression_policy_fact_source,
                )),
                ("evaluatePolicySet", lambda: owner.evaluate_policy_set(
                    prepared_set,
                    other.policy_fact_context,
                    regression_source=other.regression_policy_fact_source,
                )),
                ("verifyEvaluationIdentityForEvaluation", lambda:
                    owner.verify_evaluation_identity_for_evaluation(
                        evaluation.evaluation_identity_bytes,
                        prepared,
                        other.policy_fact_context,
                        regression_source=other.regression_policy_fact_source,
                    )),
                ("verifyPolicyEvaluationOutcomeForEvaluation", lambda:
                    owner.verify_policy_evaluation_outcome_for_evaluation(
                        evaluation.canonical_outcome_bytes,
                        prepared,
                        other.policy_fact_context,
                        regression_source=other.regression_policy_fact_source,
                    )),
            )
            for operation, action in context_operations:
                with self.subTest(authority="context", operation=operation):
                    self.assert_preparation_failure(
                        action,
                        code="POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
                        operation=operation,
                        phase="policyFactContext",
                        artifact_kind="MemoryOSPolicyFactContext",
                    )

            source_operations = (
                ("evaluatePolicy", lambda: owner.evaluate_policy(
                    prepared,
                    local.policy_fact_context,
                    regression_source=other.regression_policy_fact_source,
                )),
                ("evaluatePolicySet", lambda: owner.evaluate_policy_set(
                    prepared_set,
                    local.policy_fact_context,
                    regression_source=other.regression_policy_fact_source,
                )),
                ("verifyEvaluationIdentityForEvaluation", lambda:
                    owner.verify_evaluation_identity_for_evaluation(
                        evaluation.evaluation_identity_bytes,
                        prepared,
                        local.policy_fact_context,
                        regression_source=other.regression_policy_fact_source,
                    )),
                ("verifyPolicyEvaluationOutcomeForEvaluation", lambda:
                    owner.verify_policy_evaluation_outcome_for_evaluation(
                        evaluation.canonical_outcome_bytes,
                        prepared,
                        local.policy_fact_context,
                        regression_source=other.regression_policy_fact_source,
                    )),
            )
            for operation, action in source_operations:
                with self.subTest(authority="source", operation=operation):
                    self.assert_preparation_failure(
                        action,
                        code="DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
                        operation=operation,
                        phase="regressionPolicyFactSource",
                        artifact_kind="MemoryOSRegressionPolicyFactSource",
                    )

            missing_context = replace(
                local.policy_fact_context, _capability=[]
            )
            self.assert_preparation_failure(
                lambda: owner.evaluate_policy(prepared, missing_context),
                code="POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
                operation="evaluatePolicy",
                phase="policyFactContext",
                artifact_kind="MemoryOSPolicyFactContext",
            )
            missing_source = replace(
                local.regression_policy_fact_source, _capability=[]
            )
            self.assert_preparation_failure(
                lambda: owner.evaluate_policy(
                    prepared,
                    local.policy_fact_context,
                    regression_source=missing_source,
                ),
                code="DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
                operation="evaluatePolicy",
                phase="regressionPolicyFactSource",
                artifact_kind="MemoryOSRegressionPolicyFactSource",
            )

    def test_policy_set_and_pass_fail_cne_are_normal_results(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = memory.observe(
                workspace, self.snapshot, identifier="python-policy-all-decisions"
            )
            context = memory.capture_policy_fact_context(investigation)

            passing_value = policy_value("a", "Observed")
            failing_value = policy_value("b", "Archived")
            passing = memory.prepare_policy(canonical_bytes(passing_value))
            failing = memory.prepare_policy(canonical_bytes(failing_value))
            cne = memory.prepare_policy(regression_policy_bytes())

            self.assertEqual(memory.evaluate_policy(passing, context).decision, "PASS")
            self.assertEqual(memory.evaluate_policy(failing, context).decision, "FAIL")
            cne_evaluation = memory.evaluate_policy(cne, context)
            self.assertEqual(cne_evaluation.decision, "COULD_NOT_EVALUATE")
            self.assertEqual(
                cne_evaluation.outcome["result"]["kind"],
                "MemoryOSPolicyResult",
            )

            set_value = {
                "identifier": "s",
                "kind": "MemoryOSInvestigationPolicySet",
                "policies": [
                    {
                        "expectedSemanticDigest": passing.semantic_digest,
                        "policy": passing_value,
                    },
                    {
                        "expectedSemanticDigest": failing.semantic_digest,
                        "policy": failing_value,
                    },
                ],
                "policySetVersion": "0.0.0",
                "version": "1.0.0",
            }
            prepared_set = memory.prepare_policy_set(canonical_bytes(set_value))
            set_evaluation = memory.evaluate_policy_set(prepared_set, context)
            self.assertEqual(prepared_set.kind, "MemoryOSInvestigationPolicySet")
            self.assertEqual(set_evaluation.decision, "FAIL")
            self.assertEqual(
                set_evaluation.outcome["result"]["kind"],
                "MemoryOSPolicySetResult",
            )
            self.assertEqual(
                memory.verify_evaluation_identity_for_evaluation(
                    set_evaluation.evaluation_identity_bytes,
                    prepared_set,
                    context,
                ).evaluation_identity_digest,
                set_evaluation.evaluation_identity_digest,
            )
            self.assertEqual(
                memory.verify_policy_evaluation_outcome_for_evaluation(
                    set_evaluation.canonical_outcome_bytes,
                    prepared_set,
                    context,
                    expected_outcome_digest=set_evaluation.outcome_digest,
                ).decision,
                "FAIL",
            )

    def test_contract_identities_and_stable_error_survive_bridge(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            identities = memory.policy_contract_identities()
            self.assertEqual(identities["evaluatorVersion"], "1.0.0")
            self.assertEqual(
                identities["resourceProfile"]["resourceProfileDigest"],
                "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239",
            )
            with self.assertRaises(MemoryOSPolicyPreparationError) as raised:
                memory.prepare_policy(b"{")
            self.assertEqual(raised.exception.code, "POLICY_SYNTAX_INVALID")
            self.assertEqual(raised.exception.phase, "policyArtifact")
            self.assertEqual(raised.exception.failure_class, "preparation")


if __name__ == "__main__":
    unittest.main()
