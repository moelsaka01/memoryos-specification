from __future__ import annotations

import json
import copy
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from test_memoryos_sdk import NODE, complete_package, reference_snapshot


EXAMPLES = Path(__file__).resolve().parents[2] / "examples" / "python"


class PythonExamplesTest(unittest.TestCase):
    def run_example(self, name: str, *arguments: str) -> dict[str, object]:
        environment = os.environ.copy()
        try:
            result = subprocess.run(
                [
                    sys.executable,
                    str(EXAMPLES / name),
                    *arguments,
                    "--node",
                    NODE,
                ],
                check=True,
                capture_output=True,
                text=True,
                env=environment,
            )
        except subprocess.CalledProcessError as error:
            self.fail(f"{name} failed: {error.stderr}")
        return json.loads(result.stdout)

    def test_all_published_examples_execute(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot = root / "snapshot.json"
            candidate_snapshot = root / "candidate-snapshot.json"
            package = root / "investigation.mip"
            exported = root / "exported.mip"
            snapshot.write_text(
                json.dumps(reference_snapshot(), ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            candidate = copy.deepcopy(reference_snapshot())
            candidate["observationIdentifier"] = "python-example-regression-candidate"
            candidate["reflections"][0]["knowledge"] = "Example regression truth."
            candidate_snapshot.write_text(
                json.dumps(candidate, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            package.write_bytes(complete_package())
            policy = root / "policy.json"
            policy.write_text(json.dumps({
                "identifier": "p",
                "kind": "MemoryOSInvestigationPolicy",
                "policyVersion": "0.0.0",
                "rules": [{
                    "identifier": "r",
                    "parameters": {"allowedStates": ["Observed"]},
                    "type": "memoryos.require-lifecycle-state",
                    "version": "1.0.0",
                }],
                "version": "1.0.0",
            }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

            observed = self.run_example(
                "observe.py",
                str(snapshot),
                "--identifier",
                "python-example-observe",
            )
            self.assertEqual(observed["lifecycle"], "Observed")

            imported = self.run_example("import_package.py", str(package))
            self.assertEqual(imported["lifecycle"], "Observed")

            replay = self.run_example(
                "replay.py",
                str(package),
                "trace-observation-b",
            )
            self.assertEqual(replay["status"], "completed")

            comparison = self.run_example(
                "compare.py",
                str(package),
                "trace-observation-b",
                "evolution-observation-a-observation-b",
                "comparative-observation-a-observation-b",
            )
            self.assertEqual(comparison["stage"], "compare")

            regression = self.run_example(
                "regression.py",
                str(snapshot),
                str(candidate_snapshot),
            )
            self.assertTrue(regression["regressionDetected"])
            self.assertEqual(regression["overall"], "regressionDetected")

            regression_report = root / "regression.json"
            regression_report.write_text(
                json.dumps(regression, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            investigation_result = self.run_example(
                "investigate.py",
                str(regression_report),
                "--category",
                "reflection",
            )
            self.assertEqual(investigation_result["status"], "matched")
            self.assertGreater(investigation_result["matchCount"], 0)

            verified = self.run_example("verify.py", str(package))
            self.assertTrue(verified["valid"])

            self.run_example("export_package.py", str(package), str(exported))
            self.assertEqual(exported.read_bytes(), package.read_bytes())

            batch = self.run_example(
                "batch_verification.py",
                str(package),
                str(exported),
            )
            self.assertTrue(batch["valid"])

            policy_result = self.run_example(
                "policy.py",
                str(policy),
                str(candidate_snapshot),
                "--baseline-snapshot",
                str(snapshot),
            )
            self.assertEqual(policy_result["decision"], "PASS")
            self.assertEqual(policy_result["contextAuthorityAfterInspection"], "inspectionOnly")
            self.assertEqual(policy_result["sourceAuthorityAfterInspection"], "inspectionOnly")
            self.assertTrue(policy_result["identityArtifactVerified"])
            self.assertTrue(policy_result["identityAuthoritativeVerified"])
            self.assertTrue(policy_result["outcomeArtifactVerified"])
            self.assertTrue(policy_result["outcomeAuthoritativeVerified"])

            policy_set = root / "policy-set.json"
            policy_set.write_text(json.dumps({
                "identifier": "s",
                "kind": "MemoryOSInvestigationPolicySet",
                "policies": [{
                    "expectedSemanticDigest": policy_result["semanticDigest"],
                    "policy": json.loads(policy.read_text(encoding="utf-8")),
                }],
                "policySetVersion": "0.0.0",
                "version": "1.0.0",
            }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            policy_set_result = self.run_example(
                "policy.py",
                str(policy_set),
                str(candidate_snapshot),
                "--policy-set",
            )
            self.assertEqual(policy_set_result["decision"], "PASS")


if __name__ == "__main__":
    unittest.main()
