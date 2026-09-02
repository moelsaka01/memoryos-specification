from __future__ import annotations

import base64
import copy
import json
import os
import subprocess
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import FrozenInstanceError
from pathlib import Path

from memoryos import MemoryOS, MemoryOSError, RegressionReport


PYTHON_ROOT = Path(__file__).resolve().parents[1]
SDK_ROOT = PYTHON_ROOT.parent
WORKSPACE_ROOT = SDK_ROOT.parents[1]
STUDIO_ROOT = SDK_ROOT.parent / "cca-studio"
NODE = os.environ.get("MEMORYOS_NODE", "node")
COMPLETE_FIXTURE = STUDIO_ROOT / "tests" / "fixtures" / "mip" / "complete-investigation.mip.b64"
EXTENSION_FIXTURE = STUDIO_ROOT / "tests" / "fixtures" / "mip" / "noncritical-extension.mip.b64"


def complete_package() -> bytes:
    return base64.b64decode(COMPLETE_FIXTURE.read_text(encoding="ascii").strip(), validate=True)


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


def complete_replay(investigation):
    replay = investigation.replay()
    guard = 0
    while replay.status != "completed":
        replay = replay.next()
        guard += 1
        if guard >= 10_000:
            raise AssertionError("finite source-authored Replay did not complete")
    return replay


class MemoryOSSDKTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.snapshot = reference_snapshot()
        cls.package_bytes = complete_package()

    def test_default_observation_operations_match_cross_language_digests(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            initial = memory.observe(
                workspace,
                self.snapshot,
                identifier="sdk-default-parity",
            )
            initial_digest = initial.transition_log_digest
            changed = copy.deepcopy(self.snapshot)
            changed["observationIdentifier"] = "observation-memoryos-sdk-second"
            changed["longTermMemory"]["entries"][0]["value"] = "SDK-visible deterministic evidence."
            changed["semanticMemory"]["concepts"][0]["meaning"] = "SDK-visible deterministic meaning."
            changed["retrievalSessions"][0]["candidates"][0]["rankScore"] += 1
            changed["reflections"][0]["knowledge"] = "SDK-visible deterministic reflection."
            appended = initial.observe(changed)

            self.assertEqual(
                initial_digest,
                "sha256:73d96188aee03223d8cab1693ea89a5f856a52aca3412250ff0693ad81e1a35e",
            )
            self.assertEqual(
                appended.transition_log_digest,
                "sha256:d71ea86ef5987acf507f57dfb61ca538e2ced64bad381cc799828a46060e142b",
            )

    def test_regression_is_core_owned_immutable_and_deterministic(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            baseline = memory.observe(
                workspace,
                self.snapshot,
                identifier="python-regression-baseline",
            )
            changed = copy.deepcopy(self.snapshot)
            changed["observationIdentifier"] = "python-regression-observation-candidate"
            changed["longTermMemory"]["entries"][0]["value"] = "Changed evidence."
            changed["semanticMemory"]["concepts"][0]["meaning"] = "Changed meaning."
            changed["retrievalSessions"][0]["candidates"][0]["rankScore"] += 1
            changed["reflections"][0]["knowledge"] = "Changed reflection."
            candidate = memory.observe(
                workspace,
                changed,
                identifier="python-regression-candidate",
            )

            first = memory.regression(baseline, candidate)
            second = memory.regression(baseline, candidate)
            self.assertIsInstance(first, RegressionReport)
            self.assertTrue(first.regression_detected)
            self.assertEqual(first.overall, "regressionDetected")
            self.assertEqual(first.identifier, second.identifier)
            self.assertEqual(first.projection, second.projection)
            self.assertEqual(
                tuple(category["category"] for category in first.projection["categories"]),
                (
                    "replay",
                    "reflection",
                    "evidence",
                    "retrieval",
                    "evolution",
                    "verification",
                    "transition",
                    "lifecycle",
                ),
            )
            identical = memory.regression(baseline, baseline)
            self.assertFalse(identical.regression_detected)
            self.assertEqual(identical.overall, "identical")
            with self.assertRaises(FrozenInstanceError):
                first.overall = "identical"

    def test_regression_rejects_foreign_investigation_handles(self) -> None:
        first = MemoryOS(node_executable=NODE)
        second = MemoryOS(node_executable=NODE)
        try:
            workspace = first.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            baseline = first.observe(
                workspace,
                self.snapshot,
                identifier="python-regression-owned",
            )
            foreign_workspace = second.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            foreign = second.observe(
                foreign_workspace,
                self.snapshot,
                identifier="python-regression-foreign",
            )
            with self.assertRaises(ValueError):
                first.regression(baseline, foreign)
            with self.assertRaises(ValueError):
                second.regression(baseline, foreign)
        finally:
            first.close()
            second.close()

    def test_explicit_observation_trace_replay_and_verification(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = memory.observe(
                workspace,
                self.snapshot,
                identifier="python-native-investigation",
            )
            self.assertEqual(investigation.lifecycle, "Observed")
            self.assertEqual(investigation.phase, "observe")
            with self.assertRaises(MemoryOSError) as unprepared:
                investigation.replay()
            self.assertEqual(unprepared.exception.code, "INVALID_TRANSITION")
            with self.assertRaises(ValueError):
                investigation.trace("")
            nodes = investigation.projection["currentFrame"]["world"]["nodes"]
            reflection = next(node for node in nodes if node["family"] == "Reflection")
            investigation = investigation.trace(reflection["key"])
            self.assertEqual(investigation.lifecycle, "ReplayReady")
            replay = investigation.replay().play().pause().next().previous().restart()
            self.assertEqual(replay.status, "ready")
            replay = complete_replay(replay.investigation)
            self.assertEqual(replay.status, "completed")
            verified = replay.investigation.verify()
            self.assertTrue(verified.valid)
            self.assertEqual(verified.investigation.lifecycle, "Verified")
            self.assertIn("TRACE", {check["code"] for check in verified.checks})
            with self.assertRaises(FrozenInstanceError):
                investigation.lifecycle = "Created"

    def test_complete_mip_replay_staged_comparison_and_exact_export(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            investigation = memory.import_package(
                self.package_bytes,
                identifier="python-complete-mip",
            )
            self.assertEqual(bytes(memory.export_package(investigation)), self.package_bytes)
            with self.assertRaises(ValueError):
                investigation.comparison_session(None)
            investigation = investigation.trace("trace-observation-b")
            replay = complete_replay(investigation)
            session = replay.investigation.comparison_session(
                "evolution-observation-a-observation-b"
            )
            comparison = replay.investigation.compare(session)
            self.assertEqual(comparison.stage, "evolution")
            comparison = comparison.previous_observation().next_observation().start(
                comparative_identifier="comparative-observation-a-observation-b"
            )
            self.assertEqual(comparison.stage, "compare")
            comparison = comparison.play().pause().next().previous().reset().advance()
            self.assertEqual(comparison.investigation.lifecycle, "Comparing")
            verified = comparison.investigation.verify()
            self.assertTrue(verified.valid)
            self.assertIn("MIP", {check["code"] for check in verified.checks})
            self.assertEqual(bytes(memory.export_package(verified.investigation)), self.package_bytes)

    def test_native_second_observation_reaches_explicit_comparison_atomically(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = memory.observe(
                workspace,
                self.snapshot,
                identifier="python-native-comparison",
            )
            before = investigation.transition_log_digest
            foreign = copy.deepcopy(self.snapshot)
            foreign["workspaceIdentifier"] = "workspace-foreign"
            with self.assertRaises(MemoryOSError) as mismatch:
                investigation.observe(foreign)
            self.assertEqual(mismatch.exception.code, "WORKSPACE_MISMATCH")
            self.assertEqual(investigation.refresh().transition_log_digest, before)

            changed = copy.deepcopy(self.snapshot)
            changed["observationIdentifier"] = "python-native-observation-second"
            changed["longTermMemory"]["entries"][0]["value"] = "Changed evidence."
            changed["semanticMemory"]["concepts"][0]["meaning"] = "Changed meaning."
            changed["retrievalSessions"][0]["candidates"][0]["rankScore"] += 1
            changed["reflections"][0]["knowledge"] = "Changed reflection."
            investigation = investigation.observe(changed)
            nodes = investigation.projection["currentFrame"]["world"]["nodes"]
            target = next(node for node in nodes if node["family"] == "Reflection")["key"]
            replay = complete_replay(investigation.trace(target))
            request = replay.investigation.comparison_session(None)
            evolution = replay.investigation.compare(request)
            comparative = evolution.start(target_node_key=target)
            self.assertEqual(comparative.stage, "compare")
            self.assertEqual(comparative.investigation.lifecycle, "Comparing")

    def test_mip_verification_is_package_owned_and_deterministic(self) -> None:
        corrupted = bytearray(self.package_bytes)
        corrupted[-2] ^= 1
        with MemoryOS(
            node_executable=NODE,
            binding_host=SDK_ROOT / "bridge" / "investigation-core-host.mjs",
        ) as memory:
            first = memory.verify_package(self.package_bytes)
            second = memory.verify_package(self.package_bytes)
            self.assertTrue(first.valid)
            self.assertEqual(first.package.data, self.package_bytes)
            self.assertEqual(first.manifest, second.manifest)
            invalid_first = memory.verify_package(corrupted)
            invalid_second = memory.verify_package(corrupted)
            self.assertFalse(invalid_first.valid)
            self.assertEqual(invalid_first.diagnostics, invalid_second.diagnostics)
            self.assertGreater(len(invalid_first.diagnostics), 0)
            self.assertIsNone(invalid_first.package)
            empty = memory.verify_package(b"")
            self.assertFalse(empty.valid)
            self.assertGreater(len(empty.diagnostics), 0)

            extension_bytes = base64.b64decode(
                EXTENSION_FIXTURE.read_text(encoding="ascii").strip(),
                validate=True,
            )
            extension = memory.import_package(
                extension_bytes,
                identifier="python-extension-parity",
            )
            self.assertEqual(bytes(memory.export_package(extension)), extension_bytes)

    def test_replay_session_rejects_replacement_replay(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            workspace = memory.open_workspace(str(self.snapshot["workspaceIdentifier"]))
            investigation = memory.observe(
                workspace,
                self.snapshot,
                identifier="python-stale-replay",
            )
            nodes = investigation.projection["currentFrame"]["world"]["nodes"]
            target = next(node for node in nodes if node["family"] == "Reflection")["key"]
            investigation = investigation.trace(target)
            stale = investigation.replay()

            changed = copy.deepcopy(self.snapshot)
            changed["observationIdentifier"] = "python-stale-replay-second"
            changed["reflections"][0]["knowledge"] = "Replacement Replay truth."
            current = investigation.observe(changed)
            self.assertNotEqual(
                stale.replay_identifier,
                current.replay().replay_identifier,
            )
            with self.assertRaises(MemoryOSError) as mismatch:
                stale.next()
            self.assertEqual(mismatch.exception.code, "SESSION_MISMATCH")

    def test_checkpoint_is_opaque_owned_and_integrity_bound(self) -> None:
        first = MemoryOS(node_executable=NODE)
        second = MemoryOS(node_executable=NODE)
        try:
            investigation = first.import_package(
                self.package_bytes,
                identifier="python-checkpoint",
            )
            checkpoint = investigation.checkpoint()
            restored = first.restore(checkpoint)
            self.assertEqual(restored.transition_log_digest, checkpoint.transition_log_digest)
            self.assertEqual(
                investigation.restore(checkpoint).transition_log_digest,
                checkpoint.transition_log_digest,
            )
            foreign = second.import_package(
                self.package_bytes,
                identifier="python-checkpoint",
            )
            with self.assertRaises(ValueError):
                foreign.restore(checkpoint)
            with self.assertRaises(ValueError):
                second.restore(checkpoint)
            foreign_request = foreign.comparison_session(
                "evolution-observation-a-observation-b"
            )
            with self.assertRaises(ValueError):
                investigation.compare(foreign_request)
        finally:
            first.close()
            second.close()

    def test_invalid_transition_preserves_published_state_and_diagnostics(self) -> None:
        with MemoryOS(node_executable=NODE) as memory:
            investigation = memory.import_package(
                self.package_bytes,
                identifier="python-atomic-failure",
            )
            before = investigation.transition_log_digest
            with self.assertRaises(MemoryOSError) as caught:
                session = investigation.comparison_session(
                    "evolution-observation-a-observation-b"
                )
                investigation.compare(session)
            self.assertEqual(caught.exception.code, "INVALID_TRANSITION")
            self.assertEqual(caught.exception.operation, "compare")
            self.assertGreater(len(caught.exception.diagnostics), 0)
            self.assertEqual(investigation.refresh().transition_log_digest, before)

    def test_concurrent_sdk_instances_are_isolated_and_deterministic(self) -> None:
        def execute(index: int) -> tuple[str, str, bytes]:
            with MemoryOS(node_executable=NODE) as memory:
                investigation = memory.import_package(
                    self.package_bytes,
                    identifier="shared-python-investigation",
                )
                investigation = investigation.trace("trace-observation-b")
                replay = complete_replay(investigation)
                return (
                    replay.investigation.lifecycle,
                    replay.investigation.transition_log_digest,
                    bytes(memory.export_package(replay.investigation)),
                )

        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(execute, range(4)))
        self.assertEqual({lifecycle for lifecycle, _, _ in results}, {"ReplayComplete"})
        self.assertEqual(len({digest for _, digest, _ in results}), 1)
        self.assertTrue(all(package == self.package_bytes for _, _, package in results))


if __name__ == "__main__":
    unittest.main()
